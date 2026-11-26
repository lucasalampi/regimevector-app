#!/usr/bin/env node
// Build the app's data bundle from a RegimeVector macro archive plus the editorial
// content manifests in content/.
//
//   node scripts/build-data.mjs [path/to/macro_archive_YYYY-MM-DD.json]
//
// With no argument it uses the newest macro_archive_*.json in ../project/uploads.
// Writes src/data/edition.generated.json and src/data/briefAssets.generated.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => path.join(ROOT, ...p);
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const MINUS = '−';

function fail(msg) { console.error('build-data: ' + msg); process.exit(1); }

function findArchive() {
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);
  const dir = rel('..', 'project', 'uploads');
  const hits = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^macro_archive_.*\.json$/.test(f)).sort() : [];
  if (!hits.length) fail('no archive given and none found in ' + dir);
  return path.join(dir, hits[hits.length - 1]);
}

const archivePath = findArchive();
const archive = readJson(archivePath);
const eds = archive.editions;
if (!Array.isArray(eds) || !eds.length) fail('archive has no editions');
const instruments = readJson(rel('content', 'instruments.json'));
const notesAll = readJson(rel('content', 'editions.json'));
const research = readJson(rel('content', 'research.json'));
const events = readJson(rel('content', 'events.json'));
const positioning = readJson(rel('content', 'positioning.json'));

const last = eds[eds.length - 1];
const A = last.assets || {};
const N = eds.length;
const notes = notesAll[last.date] || {};
if (!notesAll[last.date]) console.warn(`build-data: no content/editions.json entry for ${last.date}; drivers will be empty`);

// ---------- series ----------
// Values are carried forward across interior gaps (an edition that did not re-observe a field keeps its last value),
// but nothing is invented before an instrument's first observation: those editions stay null and the app marks
// them "not in archive". Derived instruments (spreads, flies, relatives) are computed edition by edition from
// archive fields and exist only where every input does.
const allRows = instruments.groups.flatMap(g => g.rows);
// Ops on raw edition values (no carry-forward: a missing day stays empty).
const RAW_OPS = new Set(['coalesce', 'breadth', 'relret', 'geo']);
const operands = e => {
  if (e.op === 'fly') return [e.w1, e.body, e.w2];
  if (e.op === 'coalesce') return e.keys;
  if (e.op === 'breadth') return ['br_adv', 'br_dec'];
  if (e.op === 'relret') return [...e.a, e.b];
  if (e.op === 'geo') return [e.minus];
  return [e.a, e.b];
};
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
/** Raw-value derived series: values only on editions that observed them. */
function rawOp(e) {
  if (e.op === 'coalesce') return eds.map(x => { for (const k of e.keys) { const v = num(x.assets?.[k]); if (v != null) return v; } return null; });
  if (e.op === 'breadth') return eds.map(x => {
    const adv = num(x.assets?.br_adv), dec = num(x.assets?.br_dec);
    // S&P 500 member counts only (about 500 names); the early four-index counts (about 1,500) are not comparable.
    if (adv == null || dec == null || adv + dec === 0 || adv + dec > 700) return null;
    return e.mode === 'ratio' ? (dec ? adv / dec : null) : (adv / (adv + dec)) * 100;
  });
  if (e.op === 'relret') {
    const b = series[e.b]; let lvl = null;
    return eds.map((x, i) => {
      let ra = null; for (const k of e.a) { const v = num(x.assets?.[k]); if (v != null) { ra = v; break; } }
      const rb = i > 0 && b?.[i] != null && b?.[i - 1] != null ? b[i] / b[i - 1] - 1 : null;
      if (ra == null || rb == null) return null;
      lvl = (lvl ?? 100) * (1 + ra / 100) / (1 + rb);
      return lvl;
    });
  }
  if (e.op === 'geo') {
    // G10 layer: geo_state[j][f] (as published on each edition) minus a US series.
    const m = series[e.minus];
    return eds.map((x, i) => { const v = num(x.assets?.geo_state?.[e.j]?.[e.f]); return v == null || m?.[i] == null ? null : (v - m[i]) * (e.scale ?? 1); });
  }
  throw new Error(`unknown raw op ${e.op}`);
}
// Derived rows may build on other derived rows listed earlier (e.g. TSX in USD feeds the TSX pairs).
const derivedKeys = new Set(allRows.filter(r => r.expr).map(r => r.key));
const rawKeys = new Set([
  ...allRows.filter(r => !r.expr).map(r => r.key),
  ...allRows.filter(r => r.expr && !RAW_OPS.has(r.expr.op)).flatMap(r => operands(r.expr)),
  ...allRows.filter(r => r.expr?.op === 'relret').map(r => r.expr.b),
  ...allRows.filter(r => r.expr?.op === 'geo').map(r => r.expr.minus),
  ...instruments.transmission.nodes.map(n => n.key),
]);
const series = {}, coverage = {}, lastObs = {};
for (const k of [...rawKeys].filter(k => !derivedKeys.has(k))) {
  let lastV = null, seen = -1;
  const s = eds.map((e, i) => { const v = e.assets?.[k]; if (typeof v === 'number') { lastV = v; seen = i; } return lastV; });
  const from = s.findIndex(v => v != null);
  if (from < 0) { console.warn(`build-data: series ${k} has no values; skipped`); continue; }
  series[k] = s.map(v => (v == null ? null : +v.toFixed(6)));
  coverage[k] = from; lastObs[k] = seen;
}
for (const r of allRows.filter(r => r.expr && RAW_OPS.has(r.expr.op))) {
  const s = rawOp(r.expr).map(v => (v == null ? null : +v.toFixed(6)));
  const from = s.findIndex(v => v != null);
  if (from < 0) { console.warn(`build-data: ${r.key} has no observations; skipped`); continue; }
  series[r.key] = s; coverage[r.key] = from;
  lastObs[r.key] = s.reduce((m, v, i) => (v != null ? i : m), -1);
  const gaps = s.slice(from).filter(v => v == null).length;
  console.log(`build-data: ${r.key} ${s.length - from - gaps} observations from ${eds[from].date}${gaps ? `, ${gaps} empty editions` : ''}`);
}
for (const r of allRows.filter(r => r.expr && !RAW_OPS.has(r.expr.op))) {
  const e = r.expr, ins = operands(e);
  if (ins.some(k => !series[k])) { console.warn(`build-data: ${r.key} needs ${ins.join(', ')}; skipped`); continue; }
  const at = i => ins.map(k => series[k][i]);
  let base = null;
  series[r.key] = eds.map((_, i) => {
    const v = at(i); if (v.some(x => x == null)) return null;
    let out;
    if (e.op === 'spread') out = (v[0] - v[1]) * (e.scale ?? 1);
    else if (e.op === 'fly') out = (2 * v[1] - v[0] - v[2]) * (e.scale ?? 1);
    else if (e.op === 'pctvs') out = (v[0] / v[1] - 1) * 100;
    else if (e.op === 'ratio') out = v[0] / v[1];
    else if (e.op === 'rel') { const q = v[0] / v[1]; base ??= q; out = (q / base) * 100; }
    else throw new Error(`unknown expr op ${e.op}`);
    return +out.toFixed(6);
  });
  coverage[r.key] = series[r.key].findIndex(v => v != null);
  lastObs[r.key] = Math.min(...ins.map(k => lastObs[k]));
}
for (const [k, from] of Object.entries(coverage)) if (from > 0) console.log(`build-data: ${k} starts at edition ${from + 1} (${eds[from].date}); earlier editions left empty`);

// ---------- formatting ----------
const fmtNum = (v, dp) => v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const DP = { yield: 2, prob: 0, bp: 0, fx: 4, level: 1, pctlvl: 2, index: 2 };
function fmtValue(v, row) {
  const dp = row.dp ?? DP[row.fmt] ?? 2;
  const out = (() => {
    switch (row.fmt) {
      case 'yield': return v.toFixed(dp) + '%';
      case 'prob': return Math.round(v) + '%';
      case 'bp': return Math.round(v) + 'bp';
      case 'pctlvl': return (v > 0 ? '+' : '') + v.toFixed(dp) + '%';
      case 'fx': case 'level': return v.toFixed(dp);
      default: return fmtNum(v, dp);
    }
  })();
  return out.replace(/^-/, MINUS);
}
const signed = (x, s) => (x > 0 ? '+' : x < 0 ? MINUS : '') + s;
// How each instrument moves: differences (scaled into bp / pp / pt) or percent changes.
function moveOf(r) {
  const step = r.freq === 'monthly';
  switch (r.fmt) {
    case 'yield': return step ? { mode: 'diff', scale: 1, unit: 'pp' } : { mode: 'diff', scale: 100, unit: 'bp' };
    case 'bp': return { mode: 'diff', scale: 1, unit: 'bp' };
    case 'prob': case 'pctlvl': return { mode: 'diff', scale: 1, unit: 'pp' };
    case 'level': return { mode: 'diff', scale: 1, unit: 'pt' };
    default: return { mode: 'pct', scale: 1, unit: '%' };
  }
}
function fmtMove(d, unit) {
  const dp = unit === 'bp' ? 0 : unit === '%' ? 2 : 1;
  const r = +d.toFixed(dp);
  return signed(r, Math.abs(r).toFixed(dp) + (unit === 'pt' ? ' pt' : unit));
}
const shortDate = iso => { const d = new Date(iso + 'T12:00:00Z'); return d.getUTCDate() + ' ' + d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }); };
const longDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(',', '');

/** ISO date of the last real observation when the latest edition only carries a value forward, else null. */
function staleAsof(r) {
  if (r.expr && RAW_OPS.has(r.expr.op)) return lastObs[r.key] < N - 1 ? eds[lastObs[r.key]].date : null;
  const keys = r.expr ? operands(r.expr) : [r.key];
  let asof = null;
  for (const k of keys) {
    const own = typeof A[k + '_asof'] === 'string' && A[k + '_asof'] < last.date ? A[k + '_asof'] : null;
    const missing = lastObs[k] < N - 1 ? eds[lastObs[k]].date : null;
    const d = [own, missing].filter(Boolean).sort()[0] ?? null;
    if (d && (!asof || d < asof)) asof = d;
  }
  return asof;
}

const groups = instruments.groups.map(g => ({
  id: g.id, name: g.name,
  rows: g.rows.filter(r => series[r.key]).map(r => {
    const s = series[r.key];
    const v = s[N - 1];
    const freq = ['monthly', 'policy', 'flow'].includes(r.freq) ? r.freq : 'daily';
    const mv = moveOf(r);
    // Latest session move; archive *_prev fields win where they exist (they are the attested prior close).
    // Gappy raw-op series (breadth) compare with their last reading, and say which day that was.
    let prevI = N - 2;
    if (r.expr && RAW_OPS.has(r.expr.op)) while (prevI > 0 && s[prevI] == null) prevI--;
    const prev = (!r.expr && typeof A[r.key + '_prev'] === 'number') ? A[r.key + '_prev'] : s[prevI];
    // Carried, not re-observed: missing from the latest edition, or the archive's own *_asof date is older than the edition.
    const stale = staleAsof(r) != null;
    const chg = freq === 'daily' && !stale && prev != null && v != null
      ? fmtMove(mv.mode === 'pct' ? (v / prev - 1) * 100 : (v - prev) * mv.scale, mv.unit) : null;
    const label = r.label.replace(/\{asof:([a-z0-9_]+)\}/g, (_, f) => (A[f] ? shortDate(A[f]) : 'n/a'));
    return {
      s: label, k: r.key, v, val: fmtValue(v, r), chg, fmt: r.fmt, dp: r.dp ?? DP[r.fmt] ?? 2, ...mv, freq,
      from: coverage[r.key], sub: r.sub ?? null, note: r.note ?? null, derived: !!r.expr,
      asof: staleAsof(r),
      chgRef: chg && prevI < N - 2 ? eds[prevI].date : null,
    };
  }),
}));

// ---------- regime runs ----------
const labelOf = e => e.regime_tags?.composite || e.composite_label || 'Unclassified';
const runs = [];
eds.forEach((e, i) => { const l = labelOf(e); if (!runs.length || runs[runs.length - 1][1] !== l) runs.push([i, l]); });

// ---------- dimensions ----------
const TAG_WORDS = { RISK_OFF: 'Risk-off', RISK_ON: 'Risk-on' };
const prettyTag = t => TAG_WORDS[t] || t.split('_').map((w, i) => (w === 'USD' ? w : i === 0 ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase())).join(' ').replace(/\b(Cost|cost) push\b/, '$1-push');
const cleanData = s => String(s || '').replace(/\s*\[[^\]]*\]/g, '').replace(/(^|[\s(])-(?=\d)/g, '$1' + MINUS).trim();
const dimsRaw = last.regime_tags?.dimensions || {};
const dims = Object.entries(dimsRaw).map(([name, d]) => ({
  name, tag: prettyTag(d.tag), level: String(d.color || 'amber').toUpperCase(), bd: d.boundary_distance,
  data: notes.dimData?.[name] ?? cleanData(d.data),
}));
const weakest = dims.reduce((m, d) => (m == null || d.bd < m.bd ? d : m), null);

// ---------- transmission ----------
const T = instruments.transmission;
const changes = T.nodes.map(n => {
  const s = series[n.key]; const out = [];
  for (let i = 1; i < s.length; i++) if (s[i] != null && s[i - 1] != null) out.push(n.change === 'diff' ? s[i] - s[i - 1] : s[i] / s[i - 1] - 1);
  return out.slice(-T.window);
});
const corr = (x, y) => {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let c = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) { c += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; }
  return vx && vy ? c / Math.sqrt(vx * vy) : 0;
};
const matrix = changes.map(a => changes.map(b => +corr(a, b).toFixed(2)));

// ---------- research assets ----------
const briefDir = rel('assets', 'briefs');
for (const d of research.docs) if (!fs.existsSync(path.join(briefDir, d.file))) fail(`research doc ${d.id} points at missing assets/briefs/${d.file}`);
const docIds = new Set(research.docs.map(d => d.id));
for (const ref of [...research.latest, ...research.issuers.map(i => i.doc).filter(Boolean), positioning.briefDoc])
  if (!docIds.has(ref)) fail(`content references unknown research doc id "${ref}"`);

// Page count and page shapes (height / width) per PDF, so the reader can lay pages out before they render.
const pdfMeta = {};
{
  let pdfjsNode = null;
  // Only page sizes are read, nothing is drawn: stub the canvas globals so pdf.js doesn't try to polyfill them.
  globalThis.DOMMatrix ??= class {}; globalThis.Path2D ??= class {};
  try { pdfjsNode = createRequire(import.meta.url)('pdfjs-dist/legacy/build/pdf.js'); } catch { console.warn('build-data: pdfjs-dist missing; page metadata skipped'); }
  for (const d of research.docs) {
    if (!pdfjsNode || !/\.pdf$/i.test(d.file)) continue;
    const data = new Uint8Array(fs.readFileSync(path.join(briefDir, d.file)));
    const doc = await pdfjsNode.getDocument({ data, isEvalSupported: false, useSystemFonts: true, verbosity: 0 }).promise;
    const aspects = [];
    for (let i = 1; i <= doc.numPages; i++) { const vp = (await doc.getPage(i)).getViewport({ scale: 1 }); aspects.push(+(vp.height / vp.width).toFixed(4)); }
    pdfMeta[d.file] = { pages: doc.numPages, aspects };
    await doc.destroy();
  }
}

{
  const themeIds = new Set((events.themes ?? []).map(t => t.id));
  const keys = new Set(instruments.groups.flatMap(g => g.rows.map(r => r.key)));
  for (const a of events.alerts) {
    if (!themeIds.has(a.theme)) fail(`event ${a.id} has unknown theme "${a.theme}"`);
    for (const k of a.links ?? []) if (!keys.has(k)) fail(`event ${a.id} links unknown instrument "${k}"`);
  }
}
const assetLines = research.docs.map(d => `  ${JSON.stringify(d.file)}: require('../../assets/briefs/${d.file}'),`);
fs.writeFileSync(rel('src', 'data', 'briefAssets.generated.ts'),
  `// GENERATED by scripts/build-data.mjs — do not edit.\n// Static requires so Metro bundles every brief listed in content/research.json.\nexport const BRIEF_ASSETS: Record<string, number> = {\n${assetLines.join('\n')}\n};\n`);

// ---------- vendored pdf.js (reader works offline) ----------
const pdfjsSrc = rel('node_modules', 'pdfjs-dist', 'build');
const pdfjsOut = rel('assets', 'pdfjs');
if (fs.existsSync(pdfjsSrc)) {
  fs.mkdirSync(pdfjsOut, { recursive: true });
  for (const f of ['pdf.min.js', 'pdf.worker.min.js']) fs.copyFileSync(path.join(pdfjsSrc, f), path.join(pdfjsOut, f + '.txt'));
} else if (!fs.existsSync(path.join(pdfjsOut, 'pdf.min.js.txt'))) {
  fail('pdfjs-dist is not installed and assets/pdfjs is empty; run npm install');
}

// ---------- scenario matrix in force (names + SN-1.0 order come from the registry, not the cell keys) ----------
const w = last.scenario_weights || {};
const registry = archive.metadata?.governance?.scenario_matrix || {};
const effectiveDate = m => (m.effective?.match(/\d{4}-\d{2}-\d{2}/)?.[0]) || m.registered || '';
const matrixKey = Object.keys(registry)
  .filter(k => registry[k].cells && effectiveDate(registry[k]) <= last.date && !(registry[k].closed && registry[k].closed < last.date))
  .sort((a, b) => effectiveDate(registry[a]).localeCompare(effectiveDate(registry[b])))
  .pop();
const scen = matrixKey ? registry[matrixKey] : null;
if (!scen) console.warn('build-data: no scenario matrix in force; falling back to cell keys');
const order = scen?.resolution_order ?? Object.keys(scen?.cells ?? w);
// The last revision that moved weights: compare with the most recent edition carrying different weights.
const same = (a, b) => order.every(k => (a?.[k] ?? 0) === (b?.[k] ?? 0));
let revIdx = N - 1;
while (revIdx > 0 && same(eds[revIdx - 1].scenario_weights, w)) revIdx--;
const priorW = revIdx > 0 ? eds[revIdx - 1].scenario_weights : null;
const revNo = String(A.revision ?? '').match(/#\d+/)?.[0] ?? null;
const scenarios = {
  matrix: matrixKey ?? null,
  revision: revNo,
  since: priorW ? shortDate(eds[revIdx].date) : null,
  caption: [matrixKey ? `Matrix ${matrixKey}` : null, revNo ? `revision ${revNo}` : null, priorW ? `since ${shortDate(eds[revIdx].date)}` : null].filter(Boolean).join(' · '),
  cells: order.map(k => ({
    key: k,
    name: scen?.cells?.[k]?.name ?? k[0].toUpperCase() + k.slice(1),
    v: w[k] ?? 0,
    chg: priorW ? Math.round(((w[k] ?? 0) - (priorW[k] ?? 0)) * 100) : 0,
  })),
};
const out = {
  generatedFrom: path.basename(archivePath),
  edition: {
    n: N, date: last.date, dateLong: longDate(last.date), dateShort: shortDate(last.date), day: last.day_of_series,
    regime: labelOf(last), trend: last.regime_tags?.composite_trend ?? '',
    tenure: last.hy_state?.published_tenure ?? null,
    weakest: weakest ? { name: weakest.name, bd: weakest.bd } : null,
    internalStatus: notes.internalStatus ?? `HY-1.0 ${last.hy_state?.mode ?? ''} · gate ${A.hy_gate ?? 'n/a'}`,
    views: { client: last.macro_view_client ?? '', internal: last.strategist_view ?? '' },
    scenarios,
    dims, drivers: notes.drivers ?? [],
  },
  archive: { n: N, first: eds[0].date },
  series, runs, groups,
  transmission: { window: T.window, nodes: T.nodes.map(n => n.name), keys: T.nodes.map(n => n.key), change: T.nodes.map(n => n.change), matrix },
  dates: eds.map(e => e.date),
  regimeTints: instruments.regimeTints,
  dimensionLinks: instruments.dimensionLinks ?? {},
  pdfMeta,
};
fs.writeFileSync(rel('src', 'data', 'edition.generated.json'), JSON.stringify(out) + '\n');
console.log(`build-data: Edition ${N} (${last.date}) from ${path.basename(archivePath)} → src/data/edition.generated.json (${Object.keys(series).length} series, ${runs.length} regime runs, ${research.docs.length} briefs)`);
