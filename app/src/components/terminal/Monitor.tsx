// Markets on a computer: every instrument in one sortable, filterable table, with the regime
// dimensions and the transmission map alongside.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TransmissionMap } from '@/components/charts';
import { Sparkline } from '@/components/InstrumentChart';
import { Kicker, Tap } from '@/components/ui';
import { ALL_ROWS, DIM_LINKS, ED, GROUPS, rowByKey, type FlatRow } from '@/data';
import { fmtChange, isFlow, isStep, shortDate, stats, windowFor, type Unit } from '@/lib/analytics';
import { useKeys, useTerminalWide } from '@/lib/terminal';
import { useApp } from '@/store';
import { C, changeColor, font, LEVEL_TINT, MUTED, tabular } from '@/theme';

type Col = 'name' | 'dd' | 'm1' | 'm3' | 'pos' | 'vol';
interface Line { r: FlatRow; dd: number | null; m1: number | null; m3: number | null; pos: number; vol: number | null }

const SHORT: Record<string, string> = { rates: 'Rates', fx: 'FX', equities: 'Eq', inflation: 'Infl', commodities: 'Cmdty' };
const open = (r: Pick<FlatRow, 'gk' | 's'>) => router.push({ pathname: '/asset', params: { group: r.gk, sym: r.s } });
const sign = (v: number | null) => (v == null || Math.abs(v) < 1e-9 ? MUTED : v > 0 ? C.up : C.down);

function lineOf(r: FlatRow): Line {
  const step = isStep(r), flow = isFlow(r);
  const m1 = stats(r, windowFor(r, 21)), m3 = stats(r, windowFor(r, 63)), all = stats(r, windowFor(r, Infinity));
  // The latest move in the row's own unit, when the latest edition observed it.
  const dd = r.chg && !r.asof && !step ? parseFloat(r.chg.replace('−', '-').replace(/[^\d.+-]/g, '')) : null;
  return { r, dd, m1: step || flow ? null : m1.chg, m3: step || flow ? null : m3.chg, pos: all.pos, vol: all.vol?.v ?? null };
}

export function MarketsMonitor() {
  const internal = useApp(s => s.role) === 'Internal';
  const mapStyle = useApp(s => s.mapStyle);
  const [group, setGroup] = useState<string>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 } | null>(null);
  const lines = useMemo(() => ALL_ROWS.map(lineOf), []);
  const side = useTerminalWide();

  const query = q.trim().toLowerCase();
  let shown = lines.filter(l => (group === 'all' || l.r.gk === group) && (!query || `${l.r.s} ${l.r.group} ${l.r.sub ?? ''} ${l.r.k}`.toLowerCase().includes(query)));
  if (sort) {
    const v = (l: Line) => (sort.col === 'name' ? l.r.s : l[sort.col]);
    shown = [...shown].sort((a, b) => {
      const x = v(a), y = v(b);
      if (x == null) return 1; if (y == null) return -1;
      return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
    });
  }
  const clickSort = (col: Col) => setSort(s => (s?.col === col ? (s.dir === -1 ? { col, dir: 1 } : null) : { col, dir: col === 'name' ? 1 : -1 }));
  useKeys(e => {
    const i = ['all', ...GROUPS.map(g => g.id)].indexOf(group);
    if (e.key === '[' || e.key === ']') { const ids = ['all', ...GROUPS.map(g => g.id)]; setGroup(ids[(i + (e.key === ']' ? 1 : -1) + ids.length) % ids.length]); return true; }
    return false;
  });

  const H = ({ col, label, w, left }: { col: Col; label: string; w?: number; left?: boolean }) => (
    <Tap onPress={() => clickSort(col)} accessibilityLabel={`Sort by ${label}`} style={[{ width: w, flex: w ? undefined : 1, height: 30, justifyContent: 'center' }]}>
      <Text style={[st.th, { textAlign: left ? 'left' : 'right' }, sort?.col === col && { color: C.a700 }]}>{label}{sort?.col === col ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</Text>
    </Tap>
  );

  const context = (
    <>
        <View style={{ gap: 8 }}>
          <Kicker>Regime dimensions</Kicker>
          {ED.dims.map(d => {
            const link = DIM_LINKS[d.name], [bg, ink] = LEVEL_TINT[d.level] ?? LEVEL_TINT.AMBER, flagged = d.bd < 0.1;
            const body = (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={[font(400, 11.5), { color: MUTED }]}>{d.name}</Text>
                  {internal ? <Text style={[font(500, 11), tabular, { color: ink }]}>{d.level} · {d.bd.toFixed(3)}</Text> : null}
                </View>
                <Text style={[font(700, 14), { color: internal ? ink : flagged ? C.gold : C.navy }]}>{d.tag}{flagged ? ' †' : ''}</Text>
                <Text style={[font(400, 11.5, 1.35), tabular, { color: MUTED }]}>{d.data}</Text>
              </>
            );
            const style = [st.dim, internal && { backgroundColor: bg }];
            const r = link ? rowByKey(link) : undefined;
            return r ? <Tap key={d.name} onPress={() => open(r)} accessibilityLabel={`${d.name}: ${d.tag}. Open ${r.s}`} style={style}>{body}</Tap> : <View key={d.name} style={style}>{body}</View>;
          })}
          <Text style={[font(400, 11), { color: C.n500 }]}>† Boundary-flagged. Click a dimension to open the instrument it reads.</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Kicker>Transmission map</Kicker>
          <TransmissionMap style={mapStyle} onOpenNode={k => { const r = rowByKey(k); if (r) open(r); }} />
        </View>
    </>
  );

  // Section headers only in the natural (unsorted) order.
  let lastSec = '';
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={st.toolbar}>
          {[{ id: 'all', name: 'All', n: lines.length }, ...GROUPS.map(g => ({ id: g.id, name: g.name, n: g.rows.length }))].map(g => {
            const on = group === g.id;
            return (
              <Tap key={g.id} onPress={() => setGroup(g.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} hoverBg={on ? C.a700 : C.a100}
                style={[st.chip, on && { backgroundColor: C.a700, borderColor: C.a700 }]}>
                <Text style={[font(500, 12), { color: on ? '#fff' : C.text }]}>{g.name} <Text style={{ color: on ? C.a300 : C.n500 }}>{g.n}</Text></Text>
              </Tap>
            );
          })}
          <TextInput value={q} onChangeText={setQ} placeholder="Filter by name, section or key…" placeholderTextColor={C.n500}
            style={[font(400, 13), st.filter, { outlineStyle: 'none' } as object]} />
          <Text style={[font(400, 11), { color: C.n500, marginLeft: 'auto' }]}>{shown.length} of {lines.length} · close {ED.dateShort} · click a column to sort</Text>
        </View>
        <View style={[st.tr, st.head]}>
          <H col="name" label="Instrument" left />
          <View style={{ width: 104 }}><Text style={[st.th, { textAlign: 'right' }]}>Level</Text></View>
          <H col="dd" label="D/D" w={98} />
          <H col="m1" label="1M" w={76} />
          <H col="m3" label="3M" w={76} />
          <H col="pos" label="Range pos." w={96} />
          <H col="vol" label="Vol" w={70} />
          <View style={{ width: 88, paddingLeft: 10 }}><Text style={st.th}>21 sess.</Text></View>
        </View>
        <ScrollView style={{ flex: 1 }}>
          {shown.map(l => {
            const r = l.r, sec = `${r.group} › ${r.sub ?? r.group}`;
            const showSec = !sort && sec !== lastSec; lastSec = sec;
            const unit = r.unit as Unit;
            return (
              <View key={r.gk + r.s}>
                {showSec ? <Text style={st.sec}>{sec}</Text> : null}
                <Tap onPress={() => open(r)} accessibilityLabel={`${r.s} ${r.val}`} style={st.tr}>
                  <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={[font(500, 13), { color: C.text, flexShrink: 1 }]} numberOfLines={1}>{r.s}</Text>
                    {r.derived ? <Text style={st.rv}>RV</Text> : null}
                    {sort ? <Text style={[font(500, 10), { color: C.n500, flexShrink: 0, letterSpacing: 0.4, textTransform: 'uppercase' }]}>{SHORT[r.gk] ?? r.group}</Text> : null}
                  </View>
                  <Text style={[st.td, { width: 104, fontWeight: '600' }]} numberOfLines={1}>{r.val}</Text>
                  <Text style={[st.td, { width: 98, fontSize: r.asof ? 11.5 : 12.5, color: r.asof ? C.noticeInk : isStep(r) || isFlow(r) ? C.n500 : changeColor(r.chg) }]} numberOfLines={1}>
                    {r.asof ? `as of ${shortDate(r.asof)}` : isStep(r) ? r.freq : isFlow(r) ? 'daily' : r.chg ?? '—'}
                  </Text>
                  <Text style={[st.td, { width: 76, color: sign(l.m1) }]}>{l.m1 == null ? '—' : fmtChange(l.m1, unit)}</Text>
                  <Text style={[st.td, { width: 76, color: sign(l.m3) }]}>{l.m3 == null ? '—' : fmtChange(l.m3, unit)}</Text>
                  <View style={{ width: 96, paddingLeft: 14, justifyContent: 'center' }}>
                    <View style={{ height: 4, backgroundColor: C.a200 }}>
                      <View style={{ position: 'absolute', left: `${l.pos * 100}%`, top: -3, width: 2, height: 10, marginLeft: -1, backgroundColor: C.gold }} />
                    </View>
                  </View>
                  <Text style={[st.td, { width: 70, color: MUTED }]}>{l.vol == null ? '—' : unit === '%' ? `${l.vol.toFixed(1)}%` : fmtChange(l.vol, unit, unit === 'bp' ? 1 : 2).replace(/^\+/, '')}</Text>
                  <View style={{ width: 88, paddingLeft: 10 }}><Sparkline row={r} width={74} height={20} /></View>
                </Tap>
              </View>
            );
          })}
          {!side ? <View style={{ padding: 18, gap: 18, borderTopWidth: 1, borderTopColor: C.divider, backgroundColor: '#fff' }}>{context}</View> : null}
        </ScrollView>
        <Text style={st.foot}>D/D: latest session in the instrument's unit (bp for yields and spreads, pp for probabilities, % for prices). 1M / 3M: change over 21 / 63 editions. Range position: latest level within the full archive range (gold tick). Vol: realised, annualised for prices, per session otherwise. Sorting across groups compares raw values in each instrument's own unit; pick a group to compare like with like. [ and ] step through groups.</Text>
      </View>

      {side ? (
        <ScrollView style={{ width: 360, flexGrow: 0, flexShrink: 0, borderLeftWidth: 1, borderLeftColor: C.divider, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 18, gap: 18 }}>
          {context}
        </ScrollView>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider, backgroundColor: '#fff' },
  chip: { paddingHorizontal: 10, height: 30, justifyContent: 'center', borderWidth: 1, borderColor: C.divider },
  filter: { width: 260, height: 30, paddingHorizontal: 10, marginLeft: 10, borderWidth: 1, borderColor: C.divider, color: C.text, backgroundColor: C.bg },
  head: { backgroundColor: C.bg, borderTopWidth: 0, borderBottomWidth: 1, borderBottomColor: C.text, minHeight: 32 },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 34, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: C.a100 },
  th: { ...font(600, 10), letterSpacing: 0.6, textTransform: 'uppercase', color: MUTED },
  td: { ...font(500, 12.5), color: C.text, textAlign: 'right', fontVariant: ['tabular-nums'] },
  sec: { ...font(700, 10), letterSpacing: 0.9, textTransform: 'uppercase', color: C.a700, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4, backgroundColor: C.bg },
  rv: { ...font(600, 9), color: C.gold, borderWidth: 1, borderColor: C.gold, paddingHorizontal: 3 },
  dim: { paddingVertical: 9, paddingHorizontal: 11, gap: 2, borderWidth: 1, borderColor: C.divider, backgroundColor: '#fff' },
  foot: { ...font(400, 11, 1.45), color: C.n500, paddingHorizontal: 18, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.divider, backgroundColor: '#fff' },
});
