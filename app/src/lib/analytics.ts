// Descriptive statistics for the drill-down. Everything is computed on archive editions (one per session),
// never forecast. Units follow the instrument: yields in bp, probabilities / monthly prints in pp, prices in %.
import { DATES, REGIMES, SERIES, TRANSMISSION, type Row } from '@/data';

export type Unit = 'bp' | 'pp' | 'pt' | '%';
const MINUS = '−';

/** One-period change in the instrument's own unit (bp / pp / pt as scaled differences, or %). */
export function change(a: number, b: number, row: Pick<Row, 'mode' | 'scale'>): number {
  return row.mode === 'pct' ? (b / a - 1) * 100 : (b - a) * row.scale;
}
/** Step series (monthly prints, policy rates) hold between decisions; per-session statistics do not apply. */
export const isStep = (row: Pick<Row, 'freq'>) => row.freq !== 'daily';

export function fmtChange(v: number, unit: Unit, dpOverride?: number): string {
  const dp = dpOverride ?? (unit === 'bp' ? 0 : unit === '%' ? 2 : 1);
  const r = +v.toFixed(dp);
  const sign = r > 0 ? '+' : r < 0 ? MINUS : '';
  return sign + Math.abs(r).toFixed(dp) + (unit === '%' ? '%' : unit === 'pt' ? ' pt' : unit);
}

export function fmtValue(v: number, row: Pick<Row, 'fmt' | 'dp'>): string {
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: row.dp, maximumFractionDigits: row.dp });
  const sign = v < 0 && +s.replace(/,/g, '') !== 0 ? MINUS : row.fmt === 'pctlvl' && v > 0 ? '+' : '';
  return sign + s + (row.fmt === 'yield' || row.fmt === 'prob' || row.fmt === 'pctlvl' ? '%' : row.fmt === 'bp' ? 'bp' : '');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (iso: string) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
export const monthOf = (iso: string) => MONTHS[+iso.slice(5, 7) - 1];

export const regimeAt = (i: number) => REGIMES.find(r => i >= r.from && i < r.to) ?? REGIMES[REGIMES.length - 1];

const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / (x.length || 1);
const sd = (x: number[]) => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, x.length - 1)); };
export function corr(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y); let c = 0, vx = 0, vy = 0;
  for (let i = 0; i < x.length; i++) { c += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; }
  return vx && vy ? c / Math.sqrt(vx * vy) : 0;
}

export interface Window {
  /** First and last archive index in view (inclusive). */
  start: number; end: number;
  /** First index with data for this instrument inside the window. */
  from: number;
}

export function windowFor(row: Row, span: number): Window {
  const end = DATES.length - 1;
  const start = Math.max(0, end - span + 1);
  return { start, end, from: Math.max(start, row.from) };
}

/** Daily changes inside the window, tagged with the edition they land on. */
function dailyChanges(row: Row, w: Window) {
  const s = SERIES[row.k], out: { i: number; c: number }[] = [];
  for (let i = w.from + 1; i <= w.end; i++) { const a = s[i - 1], b = s[i]; if (a != null && b != null) out.push({ i, c: change(a, b, row) }); }
  return out;
}

export interface Stats {
  first: number; last: number; chg: number;
  hi: { v: number; i: number }; lo: { v: number; i: number };
  /** 0..1 position of the last value inside the window's range. */
  pos: number;
  /** Realised volatility: annualised % for prices, per-session sd for bp / pp series. Null for monthly prints. */
  vol: { v: number; label: string } | null;
  big: { c: number; i: number } | null;
  n: number;
}

export function stats(row: Row, w: Window): Stats {
  const s = SERIES[row.k];
  let hi = { v: -Infinity, i: w.from }, lo = { v: Infinity, i: w.from };
  for (let i = w.from; i <= w.end; i++) { const v = s[i]; if (v == null) continue; if (v > hi.v) hi = { v, i }; if (v < lo.v) lo = { v, i }; }
  const first = s[w.from]!, last = s[w.end]!;
  const daily = !isStep(row) ? dailyChanges(row, w) : [];
  const vol = daily.length >= 10
    ? row.unit === '%' ? { v: sd(daily.map(d => d.c)) * Math.sqrt(252), label: 'annualised' } : { v: sd(daily.map(d => d.c)), label: 'per session' }
    : null;
  const big = daily.length ? daily.reduce((m, d) => (Math.abs(d.c) > Math.abs(m.c) ? d : m)) : null;
  return { first, last, chg: change(first, last, row), hi, lo, pos: hi.v > lo.v ? (last - lo.v) / (hi.v - lo.v) : 0.5, vol, big, n: w.end - w.from + 1 };
}

export interface RegimeRow { name: string; tint: string; solid: string; sessions: number; avg: number; cum: number; level: number }

/** Daily changes grouped by the published regime label on the edition each change lands on. */
export function byRegime(row: Row, w: Window): RegimeRow[] {
  const s = SERIES[row.k];
  const acc = new Map<string, RegimeRow & { levels: number[]; chgs: number[] }>();
  for (let i = w.from; i <= w.end; i++) {
    const r = regimeAt(i), v = s[i];
    if (v == null) continue;
    const e = acc.get(r.name) ?? { name: r.name, tint: r.tint, solid: r.solid, sessions: 0, avg: 0, cum: 0, level: 0, levels: [], chgs: [] };
    e.sessions++; e.levels.push(v);
    const p = s[i - 1];
    if (i > w.from && p != null) e.chgs.push(change(p, v, row));
    acc.set(r.name, e);
  }
  return [...acc.values()].map(e => ({ ...e, avg: mean(e.chgs), cum: e.chgs.reduce((a, b) => a + b, 0), level: mean(e.levels) }))
    .sort((a, b) => b.sessions - a.sessions);
}

/** Correlation of this instrument's daily changes with the six transmission nodes over the last `n` editions. */
export function coMovement(row: Row, n = TRANSMISSION.window) {
  if (isStep(row)) return null;
  const end = DATES.length - 1, start = Math.max(row.from + 1, end - n + 1);
  const mine = SERIES[row.k];
  const out = TRANSMISSION.nodes.map((name, j) => {
    const key = TRANSMISSION.keys[j], s = SERIES[key], diff = TRANSMISSION.change[j] === 'diff';
    const x: number[] = [], y: number[] = [];
    for (let i = start; i <= end; i++) {
      const a = mine[i - 1], b = mine[i], c = s[i - 1], d = s[i];
      if (a == null || b == null || c == null || d == null) continue;
      x.push(change(a, b, row)); y.push(diff ? d - c : d / c - 1);
    }
    return { name, key, v: corr(x, y), n: x.length, self: key === row.k };
  });
  return out[0]?.n >= 20 ? out : null;
}
