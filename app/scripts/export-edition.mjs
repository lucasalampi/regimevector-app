#!/usr/bin/env node
// Portable edition report: a self-contained, text-based PDF of the current edition as the app shows it,
// plus CSV companions for external analysis.
//
//   node scripts/export-edition.mjs [--internal] [--no-shots] [--out <dir>]
//
// Reads the same generated data the app uses (src/data/edition.generated.json + content/*.json), so every
// number matches the interface. Interface screenshots are taken from the web export in dist/ when present
// (run `npm run export:web` first). Needs Playwright with Chromium: `npm i -D playwright && npx playwright install chromium`.
//
// Output (default ../exports/): RegimeVector_Edition<N>_<date>_<Client|Internal>.pdf,
//   RegimeVector_Edition<N>_<date>_instruments.csv, RegimeVector_Edition<N>_<date>_series.csv
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => path.join(ROOT, ...p);
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const args = process.argv.slice(2);
const INTERNAL = args.includes('--internal');
const SHOTS = !args.includes('--no-shots');
const OUT = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : rel('..', 'exports'));

let chromium;
try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { /* reported below */ } }
if (!chromium) {
  console.error('export-edition: Playwright is required: npm i -D playwright && npx playwright install chromium'); process.exit(1);
}

const D = readJson(rel('src', 'data', 'edition.generated.json'));
const research = readJson(rel('content', 'research.json'));
const events = readJson(rel('content', 'events.json'));
const ED = D.edition, N = D.dates.length, DATES = D.dates;
const MINUS = '−';
const role = INTERNAL ? 'Internal' : 'Client';

// ---------- formatting + analytics (mirrors src/lib/analytics.ts) ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = iso => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
const signed = (v, s) => (v > 0 ? '+' : v < 0 ? MINUS : '') + s;
function fmtValue(v, r) {
  if (v == null) return '—';
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: r.dp, maximumFractionDigits: r.dp });
  const sign = v < 0 && +s.replace(/,/g, '') !== 0 ? MINUS : r.fmt === 'pctlvl' && v > 0 ? '+' : '';
  return sign + s + (['yield', 'prob', 'pctlvl'].includes(r.fmt) ? '%' : r.fmt === 'bp' ? 'bp' : '');
}
function fmtChange(v, unit, dp) {
  if (v == null || !isFinite(v)) return '—';
  dp ??= unit === 'bp' ? 0 : unit === '%' ? 2 : 1;
  const x = +v.toFixed(dp);
  return signed(x, Math.abs(x).toFixed(dp) + (unit === 'pt' ? ' pt' : unit));
}
const change = (a, b, r) => (r.mode === 'pct' ? (b / a - 1) * 100 : (b - a) * r.scale);
const isStep = r => r.freq !== 'daily';
const mean = x => x.reduce((a, b) => a + b, 0) / (x.length || 1);
const sd = x => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, x.length - 1)); };
const RUNS = D.runs.map(([from, name], i, a) => ({ from, to: (a[i + 1] ?? [N])[0], name, tint: (D.regimeTints[name] ?? ['#eef2f6', '#7a8fa3'])[0], solid: (D.regimeTints[name] ?? ['#eef2f6', '#7a8fa3'])[1] }));
const regimeAt = i => RUNS.find(r => i >= r.from && i < r.to) ?? RUNS[RUNS.length - 1];

function windowStats(r, span) {
  const s = D.series[r.k], end = N - 1, start = Math.max(0, end - span + 1), from = Math.max(start, r.from);
  const first = s[from], last = s[end];
  let hi = -Infinity, lo = Infinity, hiI = from, loI = from;
  const daily = [];
  for (let i = from; i <= end; i++) {
    const v = s[i]; if (v == null) continue;
    if (v > hi) { hi = v; hiI = i; } if (v < lo) { lo = v; loI = i; }
    if (i > from && s[i - 1] != null && !isStep(r)) daily.push(change(s[i - 1], v, r));
  }
  const vol = daily.length >= 10 ? (r.unit === '%' ? sd(daily) * Math.sqrt(252) : sd(daily)) : null;
  return { chg: first != null && last != null ? change(first, last, r) : null, hi, lo, hiI, loI, pos: hi > lo ? (last - lo) / (hi - lo) : 0.5, vol, n: end - from + 1 };
}

// ---------- SVG ----------
function spark(r, n = 21, w = 64, h = 14) {
  const s = D.series[r.k], vals = s.slice(Math.max(r.from, N - n)).filter(v => v != null);
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), k = hi - lo || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (w - 2) + 1, h - 1.5 - ((v - lo) / k) * (h - 3)]);
  const d = pts.map(([x, y], i) => (i ? (isStep(r) ? `H${x.toFixed(1)}V${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`) : `M${x.toFixed(1)},${y.toFixed(1)}`)).join('');
  const up = vals[vals.length - 1] >= vals[0];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${isStep(r) ? '#15304e' : up ? '#185c38' : '#8b2020'}" stroke-width="1"/></svg>`;
}

function chart(r, w = 330, h = 128) {
  const s = D.series[r.k], from = r.from, end = N - 1;
  const vals = s.slice(from).filter(v => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || 1) * 0.08; lo -= pad; hi += pad;
  const L = 6, R = 42, T = 8, B = 30, pw = w - L - R, ph = h - T - B;
  const x = i => L + (i / end) * pw, y = v => T + (1 - (v - lo) / (hi - lo)) * ph;
  let d = '';
  for (let i = from; i <= end; i++) { const v = s[i]; if (v == null) continue; d += !d ? `M${x(i).toFixed(1)},${y(v).toFixed(1)}` : isStep(r) ? `H${x(i).toFixed(1)}V${y(v).toFixed(1)}` : `L${x(i).toFixed(1)},${y(v).toFixed(1)}`; }
  const grid = [hi - pad, (hi + lo) / 2, lo + pad].map(v => `<line x1="${L}" x2="${L + pw}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#d9e0e7" stroke-width="0.6"/><text x="${w - 2}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" class="ax">${esc(fmtValue(v, r).replace(/%|bp/, ''))}</text>`).join('');
  const ribbon = RUNS.map(ru => `<rect x="${x(ru.from).toFixed(1)}" y="${T + ph + 4}" width="${Math.max(0.4, x(ru.to) - x(ru.from) - 0.3).toFixed(1)}" height="6" fill="${ru.solid}"/>`).join('');
  const months = []; for (let i = 1; i <= end; i++) if (DATES[i].slice(5, 7) !== DATES[i - 1].slice(5, 7)) months.push(`<text x="${x(i).toFixed(1)}" y="${h - 4}" text-anchor="middle" class="ax">${MONTHS[+DATES[i].slice(5, 7) - 1]}</text>`);
  const gap = from > 0 ? `<rect x="${L}" y="${T}" width="${(x(from) - L).toFixed(1)}" height="${ph}" fill="#f3f5f7"/><text x="${L + 4}" y="${T + 11}" class="ax">not in archive before ${short(DATES[from])}</text>` : '';
  const last = s[end];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(r.s)} archive chart">
    ${gap}${grid}<line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}" stroke="#c4cdd6" stroke-width="0.6"/>${ribbon}${months.join('')}
    <path d="${d}" fill="none" stroke="#0c1829" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="${x(end).toFixed(1)}" cy="${y(last).toFixed(1)}" r="2.4" fill="#bc9330" stroke="#fff" stroke-width="0.8"/>
    <rect x="${L + pw + 2}" y="${(y(last) - 6).toFixed(1)}" width="${R - 4}" height="12" fill="#0c1829"/>
    <text x="${w - 3}" y="${(y(last) + 3).toFixed(1)}" text-anchor="end" class="ax" fill="#fff" style="fill:#fff">${esc(fmtValue(last, { ...r, dp: r.fmt === 'fx' ? r.dp : Math.abs(last) >= 10000 ? 0 : Math.min(r.dp, 2) }).replace(/%|bp/, ''))}</text>
  </svg>`;
}

function regimeStrip(w = 680, h = 46) {
  const x = i => (i / N) * w;
  const months = []; for (let i = 1; i < N; i++) if (DATES[i].slice(5, 7) !== DATES[i - 1].slice(5, 7)) months.push(`<line x1="${x(i)}" x2="${x(i)}" y1="22" y2="27" stroke="#7a8fa3" stroke-width="0.6"/><text x="${x(i)}" y="38" text-anchor="middle" class="ax">${MONTHS[+DATES[i].slice(5, 7) - 1]}</text>`);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Regime timeline">${RUNS.map(r => `<rect x="${x(r.from).toFixed(1)}" y="2" width="${Math.max(0.6, x(r.to) - x(r.from) - 0.4).toFixed(1)}" height="20" fill="${r.solid}"/>`).join('')}${months.join('')}</svg>`;
}

// ---------- content ----------
const rows = D.groups.flatMap(g => g.rows.map(r => ({ ...r, group: g.name })));
const byKey = k => rows.find(r => r.k === k);
const docs = research.docs.filter(d => INTERNAL || !d.internal);
const themes = events.themes.filter(t => INTERNAL || !t.internal);
const alerts = events.alerts.filter(a => (INTERNAL || !a.internal) && themes.some(t => t.id === a.theme));
const view = INTERNAL ? ED.views.internal : ED.views.client;
const tagCell = d => `<span class="lvl ${INTERNAL ? d.level.toLowerCase() : ''}">${esc(d.tag)}${d.bd < 0.1 ? ' †' : ''}</span>`;
const levelColor = { RED: '#8b2020', AMBER: '#6b4800', GREEN: '#185c38' };
const KEY_CHARTS = ['usy10', 'x_us2s10s', 'x_spx200', 'vix', 'dxy', 'usdcad', 'brent', 'credit_hy_oas'];
const REGIME_KEYS = ['usy10', 'x_us2s10s', 'spx', 'vix', 'dxy', 'brent', 'gold', 'credit_hy_oas'];
const bigRuns = [...new Map(RUNS.map(r => [r.name, r])).values()];

function regimeBehaviour() {
  const names = bigRuns.map(r => r.name).filter(n => RUNS.filter(r => r.name === n).reduce((a, r) => a + r.to - r.from, 0) >= 7);
  // Short codes as used in the brief's transition table; the key follows the table.
  const CODE = { 'Cost-Push Stalemate': 'Stalemate', 'Post-Shock Disinflation Transition': 'Transition', 'Cost-Push / Hawkish Pivot': 'CP-Hawkish', 'Disinflation / Hawkish Pivot': 'Dis-Hawkish', 'Stagflationary Supply Shock': 'Supply-Shk', 'Stagflationary Pressure / Supply Easing': 'Press/Ease', 'Stagflationary Residual / Supply Normalised': 'Resid/Norm', 'Supply Normalisation / Risk Recovery': 'Supply-Norm' };
  const code = n => CODE[n] ?? n;
  const head = names.map(n => { const r = RUNS.find(x => x.name === n); return `<th class="num"><span class="sw" style="background:${r.solid}"></span>${esc(code(n))}</th>`; }).join('');
  const body = REGIME_KEYS.map(k => byKey(k)).filter(Boolean).map(r => {
    const s = D.series[r.k];
    const cells = names.map(n => {
      const c = []; for (let i = Math.max(1, r.from + 1); i < N; i++) if (regimeAt(i).name === n && s[i] != null && s[i - 1] != null) c.push(change(s[i - 1], s[i], r));
      return `<td class="num ${mean(c) > 0 ? 'up' : mean(c) < 0 ? 'down' : ''}">${c.length ? fmtChange(mean(c), r.unit, r.unit === 'bp' ? 1 : 2) : '—'}</td>`;
    }).join('');
    return `<tr><td>${esc(r.s)}</td>${cells}</tr>`;
  }).join('');
  const sessions = names.map(n => `<td class="num muted">${RUNS.filter(r => r.name === n).reduce((a, r) => a + r.to - r.from, 0)}</td>`).join('');
  return `<table class="t small"><thead><tr><th>Avg move / session</th>${head}</tr></thead><tbody>${body}<tr class="foot"><td>Sessions in archive</td>${sessions}</tr></tbody></table>
    <p class="note">Key: ${names.map(n => `<b>${esc(code(n))}</b> ${esc(n)}`).join(' · ')}.</p>`;
}

function instrumentTables() {
  return D.groups.map(g => {
    const subs = [...new Set(g.rows.map(r => r.sub ?? g.name))];
    const body = subs.map(sub => `<tr class="sub"><td colspan="10">${esc(sub)}</td></tr>` + g.rows.filter(r => (r.sub ?? g.name) === sub).map(r => {
      const m1 = windowStats(r, 21), m3 = windowStats(r, 63), all = windowStats(r, Infinity);
      const dd = isStep(r) ? (r.freq === 'policy' ? 'policy' : 'monthly') : r.asof ? `as of ${short(r.asof)}` : r.chg ?? '—';
      const cls = v => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');
      return `<tr><td>${esc(r.s)}${r.derived ? ' <span class="rv">RV</span>' : ''}</td><td class="num b">${esc(r.val)}</td>
        <td class="num ${r.chg && !r.asof ? (r.chg[0] === '+' ? 'up' : r.chg[0] === MINUS ? 'down' : '') : 'muted'}">${esc(dd)}</td>
        <td class="num ${cls(m1.chg)}">${fmtChange(m1.chg, r.unit)}</td><td class="num ${cls(m3.chg)}">${fmtChange(m3.chg, r.unit)}</td>
        <td class="num">${esc(fmtValue(all.hi, r))}</td><td class="num">${esc(fmtValue(all.lo, r))}</td><td class="num">${Math.round(all.pos * 100)}%</td>
        <td class="num">${all.vol == null ? '—' : r.unit === '%' ? all.vol.toFixed(1) + '%' : fmtChange(all.vol, r.unit, r.unit === 'bp' ? 1 : 2).replace(/^\+/, '')}</td><td>${spark(r)}</td></tr>`;
    }).join('')).join('');
    return `<h3>${esc(g.name)} <span class="h-meta">${g.rows.length} instruments</span></h3>
      <table class="t"><thead><tr><th>Instrument</th><th class="num">Level</th><th class="num">D/D</th><th class="num">1M</th><th class="num">3M</th><th class="num">High</th><th class="num">Low</th><th class="num">Pos.</th><th class="num">Vol</th><th>21 sessions</th></tr></thead><tbody>${body}</tbody></table>`;
  }).join('');
}

function transmission() {
  const T = D.transmission;
  const cell = v => { const a = Math.abs(v); const bg = v >= 0 ? `rgba(21,48,78,${a.toFixed(2)})` : `rgba(139,32,32,${a.toFixed(2)})`; return `<td class="num mx" style="background:${bg};color:${a > 0.45 ? '#fff' : '#0b0f1a'}">${(v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toFixed(2)}</td>`; };
  return `<table class="t mxt"><thead><tr><th></th>${T.nodes.map(n => `<th class="num">${n}</th>`).join('')}</tr></thead><tbody>${T.nodes.map((n, i) => `<tr><th>${n}</th>${T.matrix[i].map((v, j) => (i === j ? '<td class="num muted">—</td>' : cell(v))).join('')}</tr>`).join('')}</tbody></table>
    <p class="note">Correlation of daily changes over the last ${T.window} editions. Nodes: ${T.nodes.map((n, i) => `${n} = ${esc(byKey(T.keys[i])?.s ?? T.keys[i])}`).join(' · ')}. Yield and spread nodes use differences; price nodes use percent changes.</p>`;
}

function eventsSection() {
  const days = [...new Set(alerts.map(a => a.date))].sort().reverse();
  const th = Object.fromEntries(themes.map(t => [t.id, t]));
  return days.map(day => `<h3>${day === ED.date ? 'Today · ' : ''}${short(day)} <span class="h-meta">${alerts.filter(a => a.date === day).length} items</span></h3>` +
    alerts.filter(a => a.date === day).map(a => {
      const t = th[a.theme];
      const links = (a.links ?? []).map(k => byKey(k)).filter(Boolean).map(r => `${esc(r.s)} ${esc(r.val)}${r.chg ? ' ' + esc(r.chg) : ''}`).join(' · ');
      return `<div class="ev" style="border-left-color:${t.color}"><div class="ev-k" style="color:${t.color}">${esc(t.name)} <span class="muted">· ${a.type}${a.internal ? ' · INTERNAL' : ''}</span></div>
        <div class="ev-t">${esc(a.t)}</div><div class="ev-b">${esc(a.b)}</div>${links ? `<div class="ev-l">${day === ED.date ? 'Levels' : 'Levels now (25 Nov)'}: ${links}</div>` : ''}</div>`;
    }).join('')).join('');
}

// ---------- screenshots ----------
async function shots(browser) {
  const dist = rel('dist');
  if (!SHOTS || !fs.existsSync(path.join(dist, 'index.html'))) return [];
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.png': 'image/png', '.txt': 'text/plain', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    let p = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(dist) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 })).newPage();
  await page.goto(base + '/');
  await page.evaluate(r => localStorage.setItem('rv-app', JSON.stringify({ state: { authed: true, email: 'analyst@firm.com', role: r }, version: 3 })), role);
  const list = [
    ['Today', '/'], ['Markets', '/markets'], ['Drill-down · S&P vs 200-day', `/asset?group=equities&sym=${encodeURIComponent('S&P vs 200-day')}`],
    ['Events', '/events'], ['Research', '/research'], ['Drill-down · 2s10s', '/asset?group=rates&sym=2s10s'],
  ];
  const out = [];
  for (const [label, url] of list) {
    await page.goto(base + url, { waitUntil: 'networkidle' }); await page.waitForTimeout(700);
    const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
    out.push({ label, src: 'data:image/jpeg;base64,' + buf.toString('base64') });
  }
  server.close();
  return out;
}

// ---------- document ----------
const font = (w, f) => `@font-face{font-family:Inter;font-weight:${w};src:url(data:font/ttf;base64,${fs.readFileSync(rel('node_modules', '@expo-google-fonts', 'inter', f.split('_')[1], f + '.ttf')).toString('base64')}) format('truetype')}`;
const fonts = [font(400, 'Inter_400Regular'), font(500, 'Inter_500Medium'), font(600, 'Inter_600SemiBold'), font(700, 'Inter_700Bold')].join('\n');

function html(screens) {
  const top = ED.scenarios.cells.reduce((m, c, i, a) => (c.v > a[m].v ? i : m), 0);
  const fills = ['#dfe6ee', '#c4cdd6', '#9fb0c2', '#c4cdd6'];
  const runRows = [...RUNS].reverse().map(r => `<tr><td><span class="sw" style="background:${r.solid}"></span>${esc(r.name)}${r.to === N ? ' <b>· current</b>' : ''}</td><td class="num">${short(DATES[r.from])}</td><td class="num">${short(DATES[r.to - 1])}</td><td class="num">${r.to - r.from}</td></tr>`).join('');
  const sha = (() => { try { return fs.readFileSync(rel('..', 'project', 'uploads', D.generatedFrom + '.sha256'), 'utf8').split(/\s/)[0]; } catch { return null; } })();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>RegimeVector · Edition ${ED.n} · ${ED.dateLong} · ${role} edition</title>
<meta name="author" content="RegimeVector"><meta name="subject" content="Cross-asset regime state, Edition ${ED.n}">
<style>
${fonts}
@page{size:Letter;margin:16mm 14mm 16mm 14mm}
*{box-sizing:border-box}
body{font-family:Inter,Helvetica,Arial,sans-serif;font-size:9.2pt;line-height:1.45;color:#0b0f1a;margin:0}
h1{font-size:15pt;margin:0 0 3mm;padding-bottom:2mm;border-bottom:1.6pt solid #bc9330;break-after:avoid}
h2{font-size:11pt;margin:6mm 0 2mm;color:#15304e;break-after:avoid}
h3{font-size:9.5pt;margin:4mm 0 1.5mm;text-transform:uppercase;letter-spacing:.06em;color:#15304e;break-after:avoid}
.h-meta{font-weight:500;color:#7a8fa3;text-transform:none;letter-spacing:0;margin-left:2mm}
section{break-before:page}
p{margin:0 0 2mm}
.muted{color:#5a6e83}.b{font-weight:600}.up{color:#185c38}.down{color:#8b2020}
.cover{background:#0c1829;color:#fff;padding:9mm 10mm 7mm;border-bottom:2.4pt solid #bc9330;margin:-1mm 0 5mm}
.cover .brand{font-size:26pt;font-weight:700;letter-spacing:-.01em}.cover .brand span{color:#bc9330}
.cover .sub{font-size:11pt;margin-top:2mm}.cover .meta{color:#a9b8c8;margin-top:1.5mm}
.badge{display:inline-block;font-size:7.5pt;font-weight:700;letter-spacing:.1em;padding:1mm 2mm;border:.8pt solid #bc9330;color:#bc9330;margin-top:3mm}
.card{border:.6pt solid #d9e0e7;border-left:2.4pt solid #bc9330;background:#fff;padding:3mm 4mm;margin:0 0 3mm;break-inside:avoid}
.kick{font-size:7.2pt;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#5a6e83}
.kick.gold{color:#bc9330}
.regime{font-size:17pt;font-weight:700;letter-spacing:-.01em;margin:.5mm 0}
.view{background:#fbf6ea;border-left:2.4pt solid #bc9330;padding:3mm 4mm;font-size:10pt;line-height:1.55;break-inside:avoid}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:3mm 5mm}
.wbar{display:flex;height:4mm;border:.6pt solid #d9e0e7;margin:1.5mm 0}
.wl{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm}.wl b{font-size:12pt;display:block}
table.t{width:100%;border-collapse:collapse;margin:0 0 2mm;font-variant-numeric:tabular-nums}
.t th{font-size:7pt;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#5a6e83;text-align:left;padding:1.2mm 1.5mm;border-bottom:1pt solid #0b0f1a;vertical-align:bottom}
.t td{padding:1.1mm 1.5mm;border-bottom:.5pt solid #d9e0e7;vertical-align:middle}
.t tr{break-inside:avoid}.t thead{display:table-header-group}
.t .num{text-align:right;white-space:nowrap}
.t tr.sub td{font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15304e;background:#eef2f6;padding-top:1.6mm}
.t tr.foot td{border-top:1pt solid #0b0f1a;border-bottom:0}
.t.small td,.t.small th{font-size:7.6pt}
.t.tight td{padding:.55mm 1.5mm;font-size:7.4pt}
.keep{break-inside:avoid}
.mxt td.mx{width:14%;font-weight:600}.mxt th{text-align:left}
.rv{font-size:6.5pt;font-weight:700;color:#bc9330;border:.5pt solid #bc9330;padding:0 .8mm;margin-left:1mm}
.lvl.red{color:#8b2020}.lvl.amber{color:#6b4800}.lvl.green{color:#185c38}
.sw{display:inline-block;width:2.4mm;height:2.4mm;margin-right:1.5mm;vertical-align:-.2mm}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:4mm 6mm}
.chart{break-inside:avoid}.chart .ct{display:flex;justify-content:space-between;font-size:8.4pt;font-weight:600;margin-bottom:1mm}
.chart .ct span{font-weight:500;color:#5a6e83}
svg .ax{font-family:Inter,Helvetica,sans-serif;font-size:7px;fill:#7a8fa3}
.legend{display:flex;flex-wrap:wrap;gap:1mm 4mm;font-size:7.4pt;color:#5a6e83;margin:1mm 0 3mm}
.ev{border-left:2pt solid;padding:1.5mm 0 1.5mm 3mm;margin:0 0 2mm;break-inside:avoid}
.ev-k{font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.ev-t{font-weight:600;font-size:9.6pt}.ev-b{color:#3a4d61}.ev-l{font-size:7.8pt;color:#15304e;margin-top:.8mm}
.note{font-size:7.6pt;color:#5a6e83}
.shots{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}.shot{break-inside:avoid}.shot img{width:100%;border:.6pt solid #c4cdd6;display:block}.shot div{font-size:7.6pt;font-weight:600;margin-top:1mm}
.toc li{margin:.6mm 0}
.disc{font-size:7.6pt;color:#5a6e83;border-top:.6pt solid #d9e0e7;padding-top:2mm;margin-top:4mm}
</style></head><body>

<div class="cover">
  <div class="brand">Regime<span>Vector</span></div>
  <div class="sub">Cross-asset regime state · Edition ${ED.n}</div>
  <div class="meta">${esc(ED.dateLong)} · Day ${ED.day} · close ${esc(ED.dateShort)} · ${role} edition</div>
  <div class="badge">${INTERNAL ? 'INTERNAL · NOT FOR DISTRIBUTION' : 'CLIENT EDITION · DESCRIPTIVE ANALYTICS · NOT INVESTMENT ADVICE'}</div>
</div>

<div class="grid2">
  <div class="card"><div class="kick gold">Current regime</div><div class="regime">${esc(ED.regime)}</div>
    <div class="muted">Tenure ${ED.tenure} sessions · since ${short(DATES[RUNS[RUNS.length - 1].from])}${INTERNAL && ED.weakest ? ` · weakest boundary ${esc(ED.weakest.name)} ${ED.weakest.bd.toFixed(3)}` : ''}</div>
    ${INTERNAL ? `<div class="note">${esc(ED.internalStatus)}</div>` : ''}</div>
  <div class="card" style="border-left-color:#15304e"><div class="kick">In this report</div>
    <ol class="toc" style="margin:1mm 0 0;padding-left:4mm"><li>Edition summary</li><li>Regime dimensions and timeline</li><li>Cross-asset instruments (${rows.length})</li><li>Charts and regime behaviour</li><li>Transmission map</li><li>Events by theme</li><li>Research library</li>${screens.length ? '<li>Interface</li>' : ''}<li>Methodology and data</li></ol></div>
</div>

<h1>1 · Edition summary</h1>
<div class="kick">${INTERNAL ? "Strategist's view" : "Today's macro view"}</div>
<div class="view">${esc(view)}</div>

<h2>Scenario weights</h2>
<div class="wbar">${ED.scenarios.cells.map((c, i) => `<div style="width:${c.v * 100}%;background:${i === top ? '#bc9330' : fills[i]}"></div>`).join('')}</div>
<div class="wl">${ED.scenarios.cells.map(c => `<div><span class="muted">${esc(c.name)}</span><b>${Math.round(c.v * 100)}%${c.chg ? ` <span class="muted" style="font-size:8pt;font-weight:500">${c.chg > 0 ? '+' : MINUS}${Math.abs(c.chg)}</span>` : ''}</b></div>`).join('')}</div>
<p class="note">${esc(ED.scenarios.caption)}; change in points vs the prior revision. Weights are analyst-assigned, revised only on named catalysts, and not calibrated against outcomes.</p>

<h2>Top market drivers</h2>
<table class="t keep"><tbody>${ED.drivers.map((d, i) => `<tr><td class="b" style="width:5mm;color:#15304e">${i + 1}</td><td><b>${esc(d.t)}</b><br><span class="muted">${esc(d.b)}</span></td></tr>`).join('')}</tbody></table>

<h2>Headline levels · close ${esc(ED.dateShort)}</h2>
<table class="t"><thead><tr><th>Instrument</th><th class="num">Level</th><th class="num">D/D</th><th>Instrument</th><th class="num">Level</th><th class="num">D/D</th></tr></thead><tbody>
${(() => { const ks = ['usy2', 'usy10', 'usy30', 'x_us2s10s', 'fed_hike_prob_dec', 'credit_hy_oas', 'spx', 'x_spx200', 'vix', 'dxy', 'usdcad', 'eurusd', 'wti', 'brent', 'gold', 'core_pce_yoy'].map(byKey).filter(Boolean);
  const c = r => `<td>${esc(r.s)}</td><td class="num b">${esc(r.val)}</td><td class="num ${r.chg && !r.asof ? (r.chg[0] === '+' ? 'up' : r.chg[0] === MINUS ? 'down' : '') : 'muted'}">${esc(r.asof ? 'as of ' + short(r.asof) : isStep(r) ? (r.freq === 'monthly' ? 'monthly' : 'policy') : r.chg ?? '—')}</td>`;
  let out = ''; for (let i = 0; i < ks.length; i += 2) out += `<tr>${c(ks[i])}${ks[i + 1] ? c(ks[i + 1]) : '<td></td><td></td><td></td>'}</tr>`; return out; })()}
</tbody></table>

<section><h1>2 · Regime dimensions and timeline</h1>
<table class="t"><thead><tr><th>Dimension</th><th>Reading</th>${INTERNAL ? '<th>Level</th><th class="num">Boundary dist.</th>' : ''}<th>Data</th></tr></thead><tbody>
${ED.dims.map(d => `<tr><td>${esc(d.name)}</td><td class="b">${tagCell(d)}</td>${INTERNAL ? `<td style="color:${levelColor[d.level] ?? '#0b0f1a'}">${d.level}</td><td class="num">${d.bd.toFixed(3)}</td>` : ''}<td class="muted">${esc(d.data)}</td></tr>`).join('')}
</tbody></table>
<p class="note">† Boundary-flagged: the dimension sits within 0.1 of a change in reading. Edition ${ED.n}, ${esc(ED.dateShort)}.</p>
<h2>Regime timeline · ${N} editions (${short(DATES[0])} – ${short(DATES[N - 1])})</h2>
${regimeStrip()}
<div class="legend">${bigRuns.map(r => `<span><span class="sw" style="background:${r.solid}"></span>${esc(r.name)}</span>`).join('')}</div>
<table class="t small tight"><thead><tr><th>Published label (most recent first)</th><th class="num">From</th><th class="num">To</th><th class="num">Sessions</th></tr></thead><tbody>${runRows}</tbody></table>
</section>

<section><h1>3 · Cross-asset instruments</h1>
<p class="note">Level at the ${esc(ED.dateShort)} close; D/D is the latest session move; 1M / 3M are changes over 21 / 63 editions; High, Low, Position (0% = low, 100% = high) and realised Vol cover the full archive (Vol: annualised for prices, per-session standard deviation for bp / pp series). "as of" marks a value the edition carried forward; RV marks a derived RegimeVector analytic. Units: yields and spreads in bp, probabilities and percent levels in pp, prices in %.</p>
${instrumentTables()}
</section>

<section><h1>4 · Charts and regime behaviour</h1>
<p class="note">Full archive; the ribbon under each plot is the published regime label for each edition (colours as in section 2). Gold marker and tag: latest level.</p>
<div class="charts">${KEY_CHARTS.map(byKey).filter(Boolean).map(r => `<div class="chart"><div class="ct">${esc(r.s)}<span>${esc(r.val)}${r.chg && !r.asof ? ' · ' + esc(r.chg) : r.asof ? ' · as of ' + short(r.asof) : ''}</span></div>${chart(r)}</div>`).join('')}</div>
<div class="keep"><h2>Behaviour by regime</h2>
${regimeBehaviour()}
<p class="note">Descriptive: each session's move is grouped by the regime label published on that edition. Labels with fewer than seven sessions are omitted. Not a forecast.</p></div>
</section>

<section><h1>5 · Transmission map</h1>
${transmission()}
</section>

<section><h1>6 · Events by theme</h1>
<p class="note">Themes: ${themes.map(t => esc(t.name)).join(' · ')}. Mid-day orientation notes are offered only on their publication day; none was issued for ${esc(ED.dateShort)}.</p>
${eventsSection()}
</section>

<section><h1>7 · Research library</h1>
<table class="t small"><thead><tr><th>Programme</th><th>Title</th><th>Code</th><th class="num">Date</th><th class="num">Pages</th><th>Surface</th></tr></thead><tbody>
${docs.map(d => `<tr><td>${esc(research.programmes[d.kind])}</td><td>${esc(d.title)}</td><td>${esc(d.code)}</td><td class="num">${esc(d.date)}</td><td class="num">${D.pdfMeta[d.file]?.pages ?? (/\.html$/.test(d.file) ? 'interactive' : '—')}</td><td class="muted">${esc(d.pages)}${d.internal ? ' · Internal' : ''}</td></tr>`).join('')}
</tbody></table>
</section>

${screens.length ? `<section><h1>8 · Interface</h1><p class="note">${role} view of the RegimeVector app at the ${esc(ED.dateShort)} close (web build, phone width).</p>
<div class="shots">${screens.map(s => `<div class="shot"><img src="${s.src}" alt="${esc(s.label)}"><div>${esc(s.label)}</div></div>`).join('')}</div></section>` : ''}

<section><h1>${screens.length ? 9 : 8} · Methodology and data</h1>
<h3>Source</h3>
<p>RegimeVector macro archive <b>${esc(D.generatedFrom)}</b>${sha ? `, SHA-256 <span style="font-family:monospace;font-size:7.6pt">${sha}</span>` : ''}; ${N} editions from ${esc(D.archive.first)} to ${esc(ED.date)}. Editorial content (drivers, events, research catalogue) from the app's content manifests for this edition.</p>
<h3>Classification</h3>
<p>RegimeVector classifies the macro state daily across seven dimensions under a fixed, deterministic ruleset. Scenario weights are revised only on named, corroborated catalysts; regime labels change only on realised transmission. Readings are rule-based classification robustness, not statistical confidence.</p>
<h3>Instruments and units</h3>
<p>Values are carried forward across an edition that did not re-observe a field, but nothing is filled before an instrument's first observation. Derived (RV) instruments are computed edition by edition from archive fields: ${rows.filter(r => r.derived).map(r => `${esc(r.s)} (${esc((r.note ?? '').replace(/\.$/, ''))})`).join('; ')}.</p>
<p>Monthly releases and policy rates are step series and carry no per-session statistics. Transmission correlations use differences for yield and spread nodes and percent changes for prices.</p>
<h3>Companion files</h3>
<p>RegimeVector_Edition${ED.n}_${ED.date}_instruments.csv (every instrument with the statistics in section 3) and RegimeVector_Edition${ED.n}_${ED.date}_series.csv (one row per edition, one column per instrument, with the published regime label).</p>
<div class="disc">Research content is interpretive commentary on a classified state. It is not investment advice, an offer or a solicitation. All statistics are descriptive. ${INTERNAL ? 'INTERNAL edition: includes internal views, boundary distances, internal research and internal events; not for distribution.' : 'Client edition: internal views, boundary distances, internal research and internal events are excluded. Weekly positioning is omitted while its data is illustrative.'} © ${ED.date.slice(0, 4)} RegimeVector.</div>
</section>
</body></html>`;
}

// ---------- CSV ----------
const csv = rowsArr => rowsArr.map(r => r.map(v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n') + '\n';
function instrumentsCsv() {
  const head = ['group', 'section', 'instrument', 'key', 'derived', 'level', 'unit_of_change', 'dd_change', 'as_of', 'chg_1m', 'chg_3m', 'archive_high', 'archive_low', 'position_in_range', 'realised_vol', 'vol_basis', 'coverage_from', 'frequency', 'note'];
  return csv([head, ...rows.map(r => {
    const m1 = windowStats(r, 21), m3 = windowStats(r, 63), a = windowStats(r, Infinity);
    const dd = r.chg && !r.asof ? r.chg.replace(MINUS, '-') : '';
    return [r.group, r.sub, r.s, r.k, r.derived ? 'yes' : 'no', D.series[r.k][N - 1], r.unit, dd, r.asof ?? '', m1.chg?.toFixed(4), m3.chg?.toFixed(4), a.hi, a.lo, a.pos.toFixed(4), a.vol?.toFixed(4) ?? '', r.unit === '%' ? 'annualised %' : `per-session ${r.unit}`, DATES[r.from], r.freq, r.note ?? ''];
  })]);
}
function seriesCsv() {
  const keys = rows.map(r => r.k);
  return csv([['date', 'edition', 'regime_label', ...keys], ...DATES.map((d, i) => [d, i + 1, regimeAt(i).name, ...keys.map(k => D.series[k][i] ?? '')])]);
}

// ---------- render ----------
fs.mkdirSync(OUT, { recursive: true });
const stem = `RegimeVector_Edition${ED.n}_${ED.date}`;
const browser = await chromium.launch();
const screens = await shots(browser);
const page = await browser.newPage();
await page.setContent(html(screens), { waitUntil: 'load' });
const pdfPath = path.join(OUT, `${stem}_${role}.pdf`);
await page.pdf({
  path: pdfPath, format: 'Letter', printBackground: true, preferCSSPageSize: true, outline: true, tagged: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:7px;color:#7a8fa3;width:100%;padding:0 14mm;display:flex;justify-content:space-between"><span>RegimeVector · Edition ${ED.n} · ${ED.dateShort} ${ED.date.slice(0, 4)} · ${role} edition${INTERNAL ? ' · NOT FOR DISTRIBUTION' : ''}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
});
await browser.close();
fs.writeFileSync(path.join(OUT, `${stem}_instruments.csv`), instrumentsCsv());
fs.writeFileSync(path.join(OUT, `${stem}_series.csv`), seriesCsv());
console.log(`export-edition: ${path.relative(process.cwd(), pdfPath)} (${(fs.statSync(pdfPath).size / 1024).toFixed(0)} KB, ${screens.length} screenshots) + CSV companions`);
