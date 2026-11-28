// Live state of the weekly positioning book's dated tests, read from the archive.
// A test window opens with the first edition after the book's week-ending date and closes on the first
// edition dated on or after the resolution date. Every window edition must pass; one failure falsifies.
import { DATES, ED, POSITIONING, rowByKey, SERIES, TAG_HISTORY, type PosTest } from '@/data';
import { fmtValue } from '@/lib/analytics';

export type TestStatus = 'Waiting' | 'Holding' | 'Confirmed' | 'Falsified';
export interface TestState {
  status: TestStatus;
  /** Window editions so far, each with its pass / fail. */
  sessions: { date: string; pass: boolean }[];
  failedOn: string | null;
  /** Latest reading in the test's own terms. */
  now: string;
  cushion: string;
  tag: string | null;
}

const pretty = (t: string | null) => (t ? t.split('_').map((w, i) => (w === 'USD' ? w : i ? w.toLowerCase() : w[0] + w.slice(1).toLowerCase())).join(' ') : '—');

function passes(t: PosTest, i: number): boolean | null {
  if (t.kind === 'level') { const v = SERIES[t.key]?.[i]; return v == null ? null : v > (t.above ?? -Infinity); }
  const tag = TAG_HISTORY[t.dim!]?.[i] ?? null;
  if (tag == null) return null;
  if (t.passTags) return t.passTags.includes(tag);
  return !(t.failTags ?? []).includes(tag);
}

export function testState(t: PosTest): TestState {
  const sessions: TestState['sessions'] = [];
  let closed = false;
  for (let i = 0; i < DATES.length && !closed; i++) {
    if (DATES[i] <= POSITIONING.weekIso) continue;
    const p = passes(t, i);
    if (p != null) sessions.push({ date: DATES[i], pass: p });
    if (DATES[i] >= POSITIONING.resolves) closed = true;
  }
  const fail = sessions.find(s => !s.pass);
  const status: TestStatus = fail ? 'Falsified' : closed ? 'Confirmed' : sessions.length ? 'Holding' : 'Waiting';

  const N = DATES.length - 1, v = SERIES[t.key]?.[N] ?? null, row = rowByKey(t.key);
  const tag = t.dim ? pretty(TAG_HISTORY[t.dim]?.[N] ?? null) : null;
  let now = v != null && row ? `${row.s} ${fmtValue(v, row)}` : '—', cushion = '—';
  if (v != null) {
    if (t.kind === 'level' && t.above != null) cushion = `${Math.round((v - t.above) * 100)}bp ${v > t.above ? 'above' : 'below'} ${t.above.toFixed(2)}`;
    else if (t.line != null) cushion = `${Math.abs(v - t.line).toFixed(2)}pp ${v > t.line ? 'above' : 'below'} the ${t.line < 0 ? '−' : ''}${Math.abs(t.line)}% line`;
    else if (t.edge != null) cushion = `$${Math.abs(t.edge - v).toFixed(2)} ${v < t.edge ? 'below' : 'above'} $${t.edge}`;
  }
  if (row?.asof) now += ` (as of ${row.asof})`;
  return { status, sessions, failedOn: fail?.date ?? null, now, cushion, tag };
}

/** Weekday sessions after the latest edition, up to and including the resolution date (holidays not excluded). */
export function sessionsToResolve(): number {
  const a = new Date(ED.date + 'T12:00:00Z'), b = new Date(POSITIONING.resolves + 'T12:00:00Z');
  let n = 0; for (const d = new Date(a.getTime() + 864e5); d <= b; d.setUTCDate(d.getUTCDate() + 1)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
