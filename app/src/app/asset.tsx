import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { goTab } from '@/components/Chrome';
import { ChevronRight, Star } from '@/components/icons';
import { InstrumentChart, Sparkline } from '@/components/InstrumentChart';
import { Kicker, Seg, Tap } from '@/components/ui';
import { DATES, DIM_LINKS, ED, GROUPS, REGIMES, TRANSMISSION, type Group, type Row } from '@/data';
import { byRegime, coMovement, flowStats, fmtChange, fmtValue, isFlow, BOARD, MEMBER_BOARD, relBoard, SLEEVE_BOARD, type BoardSpec, isStep, shortDate, stats, windowFor, type Unit } from '@/lib/analytics';
import { useApp, type ChartStyle } from '@/store';
import { alpha, C, changeColor, font, MUTED, tabular } from '@/theme';

const RANGES = ['1M', '3M', 'All'] as const;
type Range = (typeof RANGES)[number];
const SPAN: Record<Range, number> = { '1M': 21, '3M': 63, All: Infinity };
const RANGE_LABEL: Record<Range, string> = { '1M': 'last 21 sessions', '3M': 'last 63 sessions', All: 'full archive' };
const STEP_LABEL = { monthly: 'Monthly print', policy: 'Policy setting', flow: 'Daily spread', daily: '' } as const;
/** Instruments with less history than this open on the 1M view. */
const SHORT_HISTORY = 30;

const signColor = (v: number) => (Math.abs(v) < 1e-9 ? MUTED : v > 0 ? C.up : C.down);
const subsOf = (g: Group) => [...new Set(g.rows.map(r => r.sub ?? g.name))];

function Section({ title, meta, children, gap = 10 }: { title: string; meta?: string; children: ReactNode; gap?: number }) {
  return (
    <View style={{ gap }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Kicker>{title}</Kicker>
        {meta ? <Text numberOfLines={1} style={styles.meta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Stat({ i, label, value, sub, color, children }: { i: number; label: string; value: string; sub?: string; color?: string; children?: ReactNode }) {
  // Inner rules only; the grid frame draws the outside edge.
  return (
    <View style={[styles.stat, { borderRightWidth: i % 2 === 0 ? 1 : 0, borderBottomWidth: i < 4 ? 1 : 0 }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[font(700, 17, 1.15), tabular, { color: color ?? C.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {children}
      {sub ? <Text style={[font(400, 11, 1.3), tabular, { color: MUTED }]} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

export default function Asset() {
  const params = useLocalSearchParams<{ group?: string; sym?: string }>();
  const [groupId, setGroupId] = useState(GROUPS.some(g => g.id === params.group) ? params.group! : GROUPS[0].id);
  const [sym, setSym] = useState<string | undefined>(params.sym);
  const [range, setRange] = useState<Range>('All');
  const [rangeTouched, setRangeTouched] = useState(false);
  const chartStyle = useApp(s => s.chartStyle);
  const setChartStyle = useApp(s => s.setChartStyle);
  const watch = useApp(s => s.watch);
  const toggleWatch = useApp(s => s.toggleWatch);
  const scroll = useRef<ScrollViewInstance>(null);

  // Deep links (search, watchlist, Markets) can land on any instrument.
  useEffect(() => { if (params.group && GROUPS.some(g => g.id === params.group)) setGroupId(params.group); setSym(params.sym); }, [params.group, params.sym]);

  const g = GROUPS.find(x => x.id === groupId)!;
  const row: Row = g.rows.find(r => r.s === sym) ?? g.rows[0];
  const unit = row.unit as Unit;
  const step = isStep(row);
  const flow = isFlow(row);
  // Short histories open on 1M so the chart is not mostly "not in archive"; an explicit choice sticks.
  const short = DATES.length - row.from < SHORT_HISTORY;
  useEffect(() => { if (!rangeTouched) setRange(short ? '1M' : 'All'); }, [row.k, short, rangeTouched]);
  const pickRange = (r: Range) => { setRangeTouched(true); setRange(r); };
  const w = useMemo(() => windowFor(row, SPAN[range]), [row, range]);
  const st = useMemo(() => stats(row, w), [row, w]);
  const fs = useMemo(() => (flow ? flowStats(row, w) : null), [flow, row, w]);
  // Relative-performance boards: indexes under Equities, sleeves and members under Commodities.
  const specs: BoardSpec[] = g.id === 'equities' && (row.sub === 'Relative performance' || row.sub === 'Market structure') ? [BOARD]
    : g.id === 'commodities' && ['Sleeves', 'Breadth', 'Relative performance', 'ETF closes'].includes(row.sub ?? '') ? [SLEEVE_BOARD, MEMBER_BOARD] : [];
  const boards = useMemo(() => specs.map(spec => ({ spec, b: relBoard(spec, { start: DATES.length - Math.min(DATES.length, SPAN[range]), end: DATES.length - 1 }) }))
    .filter((x): x is { spec: BoardSpec; b: NonNullable<ReturnType<typeof relBoard>> } => !!x.b), [specs.map(s => s.id).join(), range]);
  /** Open the pair "a / benchmark" when it exists, else the instrument itself. */
  const openPair = (spec: BoardSpec, key: string) => {
    const pair = g.rows.find(r => r.k === spec.pairs?.[key]) ?? g.rows.find(r => r.k === key);
    if (pair) select(pair);
  };
  const regimes = useMemo(() => byRegime(row, w), [row, w]);
  const co = useMemo(() => coMovement(row), [row]);
  const cur = REGIMES[REGIMES.length - 1];
  const starred = watch.includes(row.s);
  const ribbon = [...new Map(REGIMES.filter(r => r.to > w.from && r.from <= w.end).map(r => [r.name, r])).values()];
  const section = row.sub ?? g.name;
  const related = g.rows.filter(r => (r.sub ?? g.name) === section && r.s !== row.s);
  const feeds = Object.entries(DIM_LINKS).filter(([, k]) => k === row.k).map(([name]) => ED.dims.find(d => d.name === name)).filter(Boolean);

  const select = (r: Row) => { setSym(r.s); scroll.current?.scrollTo({ y: 0, animated: true }); };

  return (
    <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: 32, gap: 22 }}>
      <Seg fit options={GROUPS.map(x => x.name)} value={g.name} onChange={name => { setGroupId(GROUPS.find(x => x.name === name)!.id); setSym(undefined); }} />

      {/* Instrument header */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }} accessibilityRole="header">
              <Pressable onPress={() => goTab('/markets')} hitSlop={6} accessibilityRole="link"><Text style={styles.crumbLink}>Markets</Text></Pressable>
              <Text style={styles.crumbSep}> › </Text>
              <Text style={styles.crumb}>{g.name}</Text>
              {row.sub ? <><Text style={styles.crumbSep}> › </Text><Text style={styles.crumb}>{row.sub}</Text></> : null}
            </View>
            <Text style={[font(600, 17, 1.2), { color: C.text }]} numberOfLines={1}>{row.s}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <Text style={[font(700, 34, 1.05), tabular, { letterSpacing: -0.5, color: C.text }]}>{row.val}</Text>
              {flow ? <Text style={[font(500, 12), { color: MUTED }]}>{row.asof ? `as of ${shortDate(row.asof)}` : `daily spread · ${ED.dateShort}`}</Text>
                : step ? <Text style={[font(500, 12), { color: MUTED }]}>{STEP_LABEL[row.freq]}</Text>
                : row.asof ? <Text style={[font(500, 12), { color: C.noticeInk }]}>as of {shortDate(row.asof)}</Text>
                : row.chg ? <Text style={[font(600, 14), tabular, { color: changeColor(row.chg) }]}>{row.chg} <Text style={[font(400, 12), { color: MUTED }]}>{row.chgRef ? `vs ${shortDate(row.chgRef)}` : 'd/d'}</Text></Text> : null}
            </View>
          </View>
          <Pressable onPress={() => toggleWatch(row.s)} accessibilityRole="button" accessibilityLabel={starred ? `Remove ${row.s} from watchlist` : `Add ${row.s} to watchlist`}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.watch, (pressed || hovered) && { backgroundColor: C.a100 }]}>
            <Star fill={starred ? C.a700 : 'none'} />
            <Text style={[font(600, 9), { letterSpacing: 0.6, color: C.a700 }]}>{starred ? 'WATCHING' : 'WATCH'}</Text>
          </Pressable>
        </View>
        <View style={styles.regimePill}>
          <View style={{ width: 8, height: 8, backgroundColor: cur.solid }} />
          <Text style={[font(500, 12), { color: C.text, flexShrink: 1 }]} numberOfLines={1}>{cur.name}</Text>
          <Text style={[font(400, 12), tabular, { color: MUTED }]}>since {shortDate(DATES[cur.from])}</Text>
        </View>
        {row.note ? (
          <View style={styles.analytic}>
            <Text style={[font(700, 9), { letterSpacing: 0.9, color: C.gold }]}>RV ANALYTIC{row.derived ? ' · DERIVED' : ''}</Text>
            <Text style={[font(400, 12, 1.45), { color: C.n800 }]}>{row.note}</Text>
          </View>
        ) : null}
      </View>

      {/* Chart */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Seg options={RANGES} value={range} onChange={pickRange} height={36} size={12} /></View>
          <Seg options={['Timeline', 'Overlay'] as const} value={chartStyle} onChange={(v: ChartStyle) => setChartStyle(v)} height={36} size={11} itemWidth={70} />
        </View>
        <InstrumentChart row={row} w={w} style={chartStyle} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 5 }}>
          {ribbon.map(r => (
            <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 9, height: 9, backgroundColor: chartStyle === 'Overlay' ? r.tint : r.solid, borderWidth: chartStyle === 'Overlay' ? 1 : 0, borderColor: C.divider }} />
              <Text style={[font(400, 11), { color: r.name === cur.name ? C.text : MUTED }]}>{r.name}</Text>
            </View>
          ))}
        </View>
        <Text style={[font(400, 11, 1.4), { color: C.n500 }]}>
          {shortDate(DATES[w.from])} – {shortDate(DATES[w.end])} · {st.n} editions
          {row.from > 0 ? ` · archive coverage from ${shortDate(DATES[row.from])}` : ''}
          {row.freq === 'monthly' ? ' · monthly release, carried between prints' : row.freq === 'policy' ? ' · policy setting, held between decisions' : flow ? ' · daily values as bars, gold = latest; days without a reading stay empty' : ''}
          {` · ${Platform.OS === 'web' ? 'hover' : 'drag sideways or press and hold'} to read any session`}
        </Text>
      </View>

      {/* Related */}
      {related.length || feeds.length ? (
        <Section title="Related" meta={section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -18 }}>
            <View style={{ width: 10 }} />
            {feeds.map(d => (
              <Pressable key={d!.name} onPress={() => goTab('/markets')} accessibilityRole="link"
                style={({ pressed }) => [styles.chip, { borderLeftWidth: 3, borderLeftColor: C.gold }, pressed && { backgroundColor: C.a100 }]}>
                <Text style={[font(600, 9), { letterSpacing: 0.7, color: C.gold }]}>FEEDS DIMENSION</Text>
                <Text style={[font(600, 13), { color: C.text }]}>{d!.name}</Text>
                <Text style={[font(400, 11), { color: MUTED }]}>{d!.tag}{d!.bd < 0.1 ? ' · boundary-flagged' : ''}</Text>
              </Pressable>
            ))}
            {related.map(r => (
              <Pressable key={r.s} onPress={() => select(r)} accessibilityRole="button"
                style={({ pressed }) => [styles.chip, pressed && { backgroundColor: C.a100 }]}>
                <Text style={[font(600, 13), { color: C.text }]} numberOfLines={1}>{r.s}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[font(500, 12), tabular, { color: C.text }]}>{r.val}</Text>
                  <Text style={[font(500, 11), tabular, { color: changeColor(r.chg) }]}>{r.chg ?? ''}</Text>
                </View>
                <Sparkline row={r} width={96} height={18} />
              </Pressable>
            ))}
            <View style={{ width: 10 }} />
          </ScrollView>
        </Section>
      ) : null}

      {/* Relative-performance boards */}
      {boards.map(({ spec, b: board }) => {
        const m = Math.max(...board.rows.map(r => Math.abs(r.excess)), 0.01);
        const isBench = (k: string) => k === spec.bench;
        const tagged = board.rows.some(r => r.tag);
        return (
          <Section key={spec.id} title={spec.title} meta={`${shortDate(DATES[board.from])} – ${shortDate(DATES[DATES.length - 1])}`}>
            <View style={{ borderTopWidth: 1, borderTopColor: C.text }}>
              <View style={[styles.tr, { borderTopWidth: 0, minHeight: 28 }]}>
                <Text style={[styles.th, { width: 96 }]}>{tagged ? 'ETF' : spec.id === 'index' ? 'Index' : 'Sleeve'}</Text>
                <Text style={[styles.th, styles.num, { width: 62 }]}>Return</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Excess vs {spec.benchName}</Text>
                <Text style={[styles.th, styles.num, { width: 58 }]}>Excess</Text>
              </View>
              {board.rows.map(r => (
                <Tap key={r.key} onPress={() => openPair(spec, r.key)} accessibilityLabel={`${r.name}${r.tag ? `, ${r.tag}` : ''}: ${fmtChange(r.ret, '%')}, ${isBench(r.key) ? 'benchmark' : `${fmtChange(r.excess, '%')} versus ${spec.benchName}`}`}
                  style={[styles.tr, { minHeight: 34 }]}>
                  <View style={{ width: 96, flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                    <Text style={[font(isBench(r.key) ? 600 : 500, 12), { color: C.text, flexShrink: 1 }]} numberOfLines={1}>{r.name}</Text>
                    {r.tag ? <Text style={[font(400, 10), { color: C.n500 }]} numberOfLines={1}>{r.tag}</Text> : null}
                  </View>
                  <Text style={[styles.td, styles.num, { width: 62, color: signColor(r.ret) }]}>{fmtChange(r.ret, '%')}</Text>
                  <View style={{ flex: 1, height: 10, justifyContent: 'center' }}>
                    <View style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 1, backgroundColor: C.a300 }} />
                    {!isBench(r.key) ? <View style={{ position: 'absolute', height: 8, top: 1, backgroundColor: r.excess >= 0 ? C.a700 : C.down,
                      left: r.excess >= 0 ? '50%' : `${50 - (Math.abs(r.excess) / m) * 50}%`, width: `${(Math.abs(r.excess) / m) * 50}%` }} /> : null}
                  </View>
                  <Text style={[styles.td, styles.num, { width: 58, color: isBench(r.key) ? C.n500 : signColor(r.excess) }]}>{isBench(r.key) ? 'bench.' : fmtChange(r.excess, 'pp')}</Text>
                </Tap>
              ))}
            </View>
            <Text style={styles.note}>{tagged ? `${Math.round(board.up * (board.rows.length - 1))} of ${board.rows.length - 1} members up over the range. ` : ''}{spec.note}</Text>
          </Section>
        );
      })}

      {/* Range statistics */}
      <Section title={`Over the ${RANGE_LABEL[range]}`} meta={fs ? `${fs.n} readings` : undefined}>
        {fs ? (
          <View style={styles.grid}>
            <Stat i={0} label="Cumulative" value={fmtChange(fs.sum, unit)} color={signColor(fs.sum)} sub="sum of daily values" />
            <Stat i={1} label="Average / session" value={fmtChange(fs.mean, unit, unit === 'bp' ? 1 : undefined)} color={signColor(fs.mean)} sub={`latest ${fs.last != null ? fmtValue(fs.last, row) : '—'}`} />
            <Stat i={2} label="Positive sessions" value={`${Math.round(fs.up * 100)}%`} sub={`${Math.round(fs.up * fs.n)} of ${fs.n}`}>
              <View style={{ height: 4, backgroundColor: alpha(C.down, 0.35), marginVertical: 3 }}><View style={{ height: 4, width: `${fs.up * 100}%`, backgroundColor: C.a700 }} /></View>
            </Stat>
            <Stat i={3} label="Range" value={`${fmtValue(fs.worst.v, row)} to ${fmtValue(fs.best.v, row)}`} sub="worst to best session" />
            <Stat i={4} label="Best" value={fmtChange(fs.best.v, unit)} color={signColor(fs.best.v)} sub={shortDate(DATES[fs.best.i])} />
            <Stat i={5} label="Worst" value={fmtChange(fs.worst.v, unit)} color={signColor(fs.worst.v)} sub={shortDate(DATES[fs.worst.i])} />
          </View>
        ) : (
        <View style={styles.grid}>
          <Stat i={0} label="Change" value={fmtChange(st.chg, unit)} color={signColor(st.chg)} sub={`${fmtValue(st.first, row)} → ${fmtValue(st.last, row)}`} />
          <Stat i={1} label="High" value={fmtValue(st.hi.v, row)} sub={shortDate(DATES[st.hi.i])} />
          <Stat i={2} label="Low" value={fmtValue(st.lo.v, row)} sub={shortDate(DATES[st.lo.i])} />
          <Stat i={3} label="Position in range" value={`${Math.round(st.pos * 100)}%`} sub="0% = low · 100% = high">
            <View style={{ height: 4, backgroundColor: C.a200, marginVertical: 3 }}>
              <View style={{ position: 'absolute', left: `${st.pos * 100}%`, top: -3, width: 2, height: 10, marginLeft: -1, backgroundColor: C.gold }} />
            </View>
          </Stat>
          <Stat i={4} label="Realised vol" value={st.vol ? (unit === '%' ? `${st.vol.v.toFixed(1)}%` : fmtChange(st.vol.v, unit).replace(/^\+/, '')) : '—'}
            sub={st.vol ? st.vol.label : step ? `n/a for ${row.freq === 'policy' ? 'policy rates' : 'monthly prints'}` : 'too few sessions'} />
          <Stat i={5} label="Largest move" value={st.big ? fmtChange(st.big.c, unit) : '—'} color={st.big ? signColor(st.big.c) : undefined}
            sub={st.big ? `${shortDate(DATES[st.big.i])} · one session` : step ? 'step series' : ''} />
        </View>
        )}
      </Section>

      {/* Behaviour by regime */}
      <Section title="Behaviour by regime" meta={RANGE_LABEL[range]}>
        <View style={{ borderTopWidth: 1, borderTopColor: C.text }}>
          <View style={[styles.tr, { borderTopWidth: 0, minHeight: 30 }]}>
            <Text style={[styles.th, { flex: 1 }]}>Regime label</Text>
            <Text style={[styles.th, styles.num, { width: 40 }]}>Sess.</Text>
            <Text style={[styles.th, styles.num, { width: 66 }]}>{step ? 'Avg level' : 'Avg / sess.'}</Text>
            {!step ? <Text style={[styles.th, styles.num, { width: 64 }]}>Total</Text> : null}
          </View>
          {regimes.map(r => (
            <View key={r.name} style={styles.tr}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <View style={{ width: 8, height: 8, backgroundColor: r.solid }} />
                <Text style={[font(r.name === cur.name ? 600 : 400, 12, 1.25), { color: C.text, flexShrink: 1 }]} numberOfLines={2}>{r.name}</Text>
              </View>
              <Text style={[styles.td, styles.num, { width: 40 }]}>{r.sessions}</Text>
              {step
                ? <Text style={[styles.td, styles.num, { width: 66 }]}>{fmtValue(r.level, row)}</Text>
                : <>
                    <Text style={[styles.td, styles.num, { width: 66, color: signColor(r.avg) }]}>{fmtChange(r.avg, unit, unit === 'bp' ? 1 : undefined)}</Text>
                    <Text style={[styles.td, styles.num, { width: 64, color: signColor(r.cum) }]}>{fmtChange(r.cum, unit)}</Text>
                  </>}
            </View>
          ))}
        </View>
        <Text style={styles.note}>Descriptive: each session is grouped by the regime label published on that edition. Not a forecast.</Text>
      </Section>

      {/* Co-movement */}
      <Section title="Co-movement" meta={co ? `${co[0].n} sessions · daily changes` : undefined}>
        {co ? (
          <View>
            {co.map(c => (
              <View key={c.name} style={[styles.tr, { minHeight: 32 }]}>
                <Text style={[font(500, 12), { width: 56, color: C.text }]}>{c.name}</Text>
                <View style={{ flex: 1, height: 10, justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 1, backgroundColor: C.a300 }} />
                  {!c.self ? <View style={{ position: 'absolute', height: 8, top: 1, backgroundColor: c.v >= 0 ? C.a700 : C.down, left: c.v >= 0 ? '50%' : `${50 + c.v * 50}%`, width: `${Math.abs(c.v) * 50}%` }} /> : null}
                </View>
                <Text style={[font(600, 12), tabular, { width: 48, textAlign: 'right', color: c.self ? C.n500 : C.text }]}>{c.self ? 'self' : (c.v >= 0 ? '+' : '−') + Math.abs(c.v).toFixed(2)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginLeft: 56, marginRight: 48 }}>
              <Text style={[font(400, 10), { color: C.n500 }]}>−1 against</Text>
              <Text style={[font(400, 10), { color: C.n500 }]}>with +1</Text>
            </View>
            <Text style={[styles.note, { marginTop: 6 }]}>Correlation of daily changes with the six transmission-map nodes, same method as Markets ({TRANSMISSION.window}-edition window).</Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={[font(400, 12, 1.4), { color: MUTED }]}>
              {step ? `${row.freq === 'policy' ? 'Policy rates' : 'Monthly prints'} do not move session to session, so daily co-movement is not computed.` : 'Too few overlapping sessions in the archive to compute co-movement.'}
            </Text>
          </View>
        )}
      </Section>

      {/* Group list, by section */}
      <Section title={`${g.name} · ${g.rows.length} instruments`} meta="21-session trend" gap={4}>
        {subsOf(g).map(sub => (
          <View key={sub}>
            <Text style={styles.subhead}>{sub}</Text>
            {g.rows.filter(r => (r.sub ?? g.name) === sub).map(r => {
              const on = r.s === row.s, st2 = watch.includes(r.s);
              return (
                <Tap key={r.s} onPress={() => select(r)} accessibilityState={{ selected: on }} style={[styles.row, on && { backgroundColor: C.a100 }]}>
                  <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: on ? C.gold : 'transparent', marginRight: 8 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[font(on ? 600 : 500, 14), { color: C.text }]} numberOfLines={1}>{r.s}</Text>
                    <Text style={[font(400, 11), tabular, { color: isStep(r) || r.asof ? C.n500 : changeColor(r.chg) }]}>
                      {isStep(r) || isFlow(r) ? STEP_LABEL[r.freq] : r.asof ? `as of ${shortDate(r.asof)}` : r.chg ?? '—'}{r.derived ? '  ·  RV' : ''}
                    </Text>
                  </View>
                  <Sparkline row={r} />
                  <Text style={[font(500, 14), tabular, { width: 80, textAlign: 'right', color: C.text }]}>{r.val}</Text>
                  <Pressable onPress={() => toggleWatch(r.s)} accessibilityRole="button" accessibilityLabel={st2 ? `Remove ${r.s} from watchlist` : `Add ${r.s} to watchlist`}
                    style={{ width: 38, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={16} fill={st2 ? C.a700 : 'none'} />
                  </Pressable>
                </Tap>
              );
            })}
          </View>
        ))}
      </Section>

      <Pressable onPress={() => router.push('/settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' }}>
        <Text style={[font(400, 11), { color: C.n500 }]}>Chart display defaults in Settings</Text><ChevronRight size={12} color={C.n500} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  meta: { ...font(600, 10), letterSpacing: 0.8, textTransform: 'uppercase', color: C.n500, flexShrink: 1, textAlign: 'right' },
  crumb: { ...font(600, 10), letterSpacing: 0.8, textTransform: 'uppercase', color: C.a700 },
  crumbLink: { ...font(600, 10), letterSpacing: 0.8, textTransform: 'uppercase', color: C.a700, textDecorationLine: 'underline' },
  crumbSep: { ...font(600, 10), color: C.n500 },
  watch: { width: 64, height: 52, alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1, borderColor: C.divider, backgroundColor: '#fff' },
  regimePill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider, borderLeftWidth: 3, borderLeftColor: C.gold },
  analytic: { gap: 3, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: C.cream, borderLeftWidth: 3, borderLeftColor: C.gold },
  chip: { width: 136, gap: 3, padding: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider },
  stat: { width: '50%', paddingVertical: 11, paddingHorizontal: 12, gap: 2, borderColor: C.divider },
  statLabel: { ...font(600, 10), letterSpacing: 0.7, textTransform: 'uppercase', color: MUTED, marginBottom: 2 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.divider },
  th: { ...font(600, 10), letterSpacing: 0.6, textTransform: 'uppercase', color: MUTED },
  td: { ...font(500, 12), color: C.text },
  num: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { ...font(400, 11, 1.45), color: C.n500 },
  empty: { padding: 14, backgroundColor: alpha(C.a700, 0.04), borderWidth: 1, borderColor: C.divider },
  subhead: { ...font(700, 10), letterSpacing: 0.9, textTransform: 'uppercase', color: C.a700, paddingTop: 14, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderTopWidth: 1, borderTopColor: C.divider, marginHorizontal: -4, paddingLeft: 4 },
});
