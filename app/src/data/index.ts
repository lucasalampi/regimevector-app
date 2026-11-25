import edition from './edition.generated.json';
import research from '../../content/research.json';
import events from '../../content/events.json';
import positioning from '../../content/positioning.json';

export type Role = 'Client' | 'Internal';

export interface Row { s: string; k: string; v: number; val: string; chg: string | null }
export interface Group { id: string; name: string; rows: Row[] }
export interface Dim { name: string; tag: string; level: string; bd: number; data: string }
export interface Doc {
  id: string; kind: DocKind; title: string; code: string; date: string; pages: string; file: string;
  daily?: boolean; internal?: boolean;
}
export type DocKind = 'Daily' | 'Events' | 'Executive' | 'Special';
export interface Issuer { tk: string; co: string; ed: string; status: string; doc?: string; last?: string }
export interface Alert { id: string; type: 'Event' | 'Policy' | 'Geo'; when: string; t: string; b: string; internal?: boolean }

export const ED = edition.edition as {
  n: number; date: string; dateLong: string; dateShort: string; day: number; regime: string; trend: string;
  tenure: number | null; weakest: { name: string; bd: number } | null; internalStatus: string;
  views: { client: string; internal: string };
  scenarios: { matrix: string | null; revision: string | null; since: string | null; caption: string; cells: { key: string; name: string; v: number; chg: number }[] };
  dims: Dim[]; drivers: { t: string; b: string }[];
};
export const ARCHIVE = edition.archive;
export const SERIES = edition.series as Record<string, number[]>;
export const GROUPS = edition.groups as Group[];
export const TRANSMISSION = edition.transmission as { window: number; nodes: string[]; matrix: number[][] };

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
export const MIDDAY_DOC = events.middayDoc;
export const POSITIONING = positioning as unknown as {
  illustrative: boolean; weekEnding: string; briefDoc: string; books: Record<string, [string, number][]>;
};

export const ALL_ROWS = GROUPS.flatMap(g => g.rows.map(r => ({ ...r, gk: g.id, group: g.name })));
export type FlatRow = (typeof ALL_ROWS)[number];

export const visibleDocs = (role: Role) => DOCS.filter(d => role === 'Internal' || !d.internal);
export const visibleAlerts = (role: Role) => ALERTS.filter(a => role === 'Internal' || !a.internal);
export const docById = (id: string) => DOCS.find(d => d.id === id);
export const docFormat = (d: Doc) => (/\.pdf$/i.test(d.file) ? 'pdf' : /\.html?$/i.test(d.file) ? 'html' : 'other');
