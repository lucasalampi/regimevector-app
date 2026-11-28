import edition from './edition.generated.json';
import research from '../../content/research.json';
import events from '../../content/events.json';
import positioning from '../../content/positioning.json';

export type Role = 'Client' | 'Internal';

export interface Row {
  s: string; k: string; v: number; val: string;
  /** Latest session move, formatted; null for step series and values not re-observed in the latest edition. */
  chg: string | null;
  fmt: string; dp: number;
  /** How the instrument moves: differences scaled into bp / pp / pt, or percent changes. */
  mode: 'diff' | 'pct'; scale: number; unit: 'bp' | 'pp' | 'pt' | '%';
  /** daily sessions, monthly prints / policy decisions / irregular revisions (steps), or flow: the value is itself a daily return or spread. */
  freq: 'daily' | 'monthly' | 'policy' | 'revised' | 'flow';
  /** First archive index with an observation. */
  from: number;
  sub: string | null; note: string | null; derived: boolean;
  /** ISO date of the last real observation when the latest edition carried it forward. */
  asof: string | null;
  /** ISO date the latest change is measured against, when that is not the previous edition. */
  chgRef?: string | null;
}
export interface Group { id: string; name: string; rows: Row[] }
export interface Dim { name: string; tag: string; level: string; bd: number; data: string }
export interface Doc {
  id: string; kind: DocKind; title: string; code: string; date: string; pages: string; file: string;
  daily?: boolean; internal?: boolean;
  /** Mid-day orientation note: offered only on its own publication day. */
  midday?: boolean;
}
export type DocKind = 'Daily' | 'Events' | 'Executive' | 'Special';
export interface Issuer { tk: string; co: string; ed: string; status: string; doc?: string; last?: string; lastDate?: string }
export interface Alert {
  id: string; type: 'Event' | 'Policy' | 'Geo'; theme: string;
  /** ISO date of the event. */
  date: string;
  t: string; b: string; internal?: boolean;
  /** Instrument keys shown as live chips. */
  links?: string[];
}
export interface Theme { id: string; name: string; short: string; color: string; key?: string; internal?: boolean }

export const ED = edition.edition as {
  n: number; date: string; dateLong: string; dateShort: string; day: number; regime: string; trend: string;
  tenure: number | null; weakest: { name: string; bd: number } | null; internalStatus: string;
  views: { client: string; internal: string };
  scenarios: { matrix: string | null; revision: string | null; since: string | null; caption: string; cells: { key: string; name: string; v: number; chg: number }[] };
  dims: Dim[]; drivers: { t: string; b: string }[];
};
export const ARCHIVE = edition.archive;
/** Per-edition values; null before an instrument's first observation. */
export const SERIES = edition.series as Record<string, (number | null)[]>;
export const DATES = (edition as unknown as { dates: string[] }).dates;
export const GROUPS = edition.groups as Group[];
export const TRANSMISSION = edition.transmission as { window: number; nodes: string[]; keys: string[]; change: ('pct' | 'diff')[]; matrix: number[][] };

const TINTS = edition.regimeTints as unknown as Record<string, [string, string]>;
export interface RegimeRun { from: number; to: number; name: string; tint: string; solid: string }
export const REGIMES: RegimeRun[] = (edition.runs as [number, string][]).map(([from, name], i, all) => {
  const [tint, solid] = TINTS[name] ?? ['#eef2f6', '#7a8fa3'];
  return { from, to: (all[i + 1] ?? [ARCHIVE.n])[0], name, tint, solid };
});

export const PROGRAMMES = research.programmes as Record<DocKind, string>;
export const DOCS = research.docs as Doc[];
export const LATEST_IDS = research.latest;
export const ISSUERS = research.issuers as Issuer[];
export const ALERTS = events.alerts as Alert[];
export const THEMES = (events as unknown as { themes: Theme[] }).themes;
export const POSITIONING = positioning as unknown as {
  illustrative: boolean; weekEnding: string; briefDoc: string; books: Record<string, [string, number][]>;
};

/** Regime dimension → instrument key it reads (navigation between Markets and Drill-down). */
export const DIM_LINKS = (edition as unknown as { dimensionLinks: Record<string, string> }).dimensionLinks ?? {};

export const ALL_ROWS = GROUPS.flatMap(g => g.rows.map(r => ({ ...r, gk: g.id, group: g.name })));
export type FlatRow = (typeof ALL_ROWS)[number];
export const rowByKey = (k: string) => ALL_ROWS.find(r => r.k === k);

/** Issuers whose edition is internal stay hidden from Client. */
export const visibleIssuers = (role: Role) => ISSUERS.filter(i => role === 'Internal' || !(i.doc && DOCS.find(d => d.id === i.doc)?.internal));
export const visibleDocs = (role: Role) => DOCS.filter(d => role === 'Internal' || !d.internal);
export const visibleThemes = (role: Role) => THEMES.filter(t => role === 'Internal' || !t.internal);
export const visibleAlerts = (role: Role) => ALERTS.filter(a => role === 'Internal' || !a.internal);
export const docById = (id: string) => DOCS.find(d => d.id === id);
const PDF_META = (edition as unknown as { pdfMeta: Record<string, { pages: number; aspects: number[] }> }).pdfMeta ?? {};
/** Build-time page count and page shapes for a PDF edition. */
export const pdfMeta = (d: Pick<Doc, 'file'>) => PDF_META[d.file];
export const docFormat = (d: Doc) => (/\.pdf$/i.test(d.file) ? 'pdf' : /\.html?$/i.test(d.file) ? 'html' : 'other');

const MONTH: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** "24 Nov 2026" → "2026-11-24". */
export const docIso = (d: Pick<Doc, 'date'>) => {
  const [day, mon, year] = d.date.split(' ');
  return `${year}-${MONTH[mon] ?? '01'}-${day.padStart(2, '0')}`;
};
/** Mid-day notes are offered only on the day they were published; everything else is always current. */
export const isCurrent = (d: Doc) => !d.midday || docIso(d) === ED.date;
/** The mid-day note for the current edition's day, if one was issued. */
export const todaysMidday = (role: Role) => visibleDocs(role).find(d => d.midday && docIso(d) === ED.date);
/** The daily brief for the current edition: the internal operating-state brief for Internal, the client brief otherwise. */
export const todaysBrief = (role: Role) => {
  const today = visibleDocs(role).filter(d => d.kind === 'Daily' && docIso(d) === ED.date);
  return (role === 'Internal' ? today.find(d => d.internal) : undefined) ?? today.find(d => !d.internal) ?? today[0];
};
/** Research published on the current edition's day (not daily briefs, not mid-day notes). */
export const todaysResearch = (role: Role) => visibleDocs(role).filter(d => !d.midday && d.kind !== 'Daily' && docIso(d) === ED.date);
/** Today's "Latest research": content order, same-day rule for mid-day notes, first three. */
export const latestDocs = (role: Role) => LATEST_IDS.map(id => visibleDocs(role).find(d => d.id === id)).filter((d): d is Doc => !!d && isCurrent(d)).slice(0, 3);
