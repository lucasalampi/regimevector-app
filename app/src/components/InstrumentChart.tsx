import { useMemo, useState } from 'react';
import { Platform, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { DATES, REGIMES, SERIES, type Row } from '@/data';
import { fmtValue, monthOf, regimeAt, shortDate, type Window } from '@/lib/analytics';
import type { ChartStyle } from '@/store';
import { C, font, MUTED, tabular } from '@/theme';

const H = 236;          // card height
const TOP = 40;         // room for the read-out
const BOTTOM = 26;      // x-axis labels
const GUTTER = 52;      // y-axis labels and the last-value tag
const PAD_L = 10;
const AXIS_FONT = Platform.select({ web: 'Inter_400Regular, Inter, sans-serif', default: 'Inter_400Regular' });

/** 3–5 round ticks covering [lo, hi]. */
function ticks(lo: number, hi: number) {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return { out, step };
}
const tickDp = (step: number, dp: number) => Math.min(dp, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));

/** Archive time series with regime context, axes, last-value tag, coverage marker and a scrubbable read-out. */
export function InstrumentChart({ row, w, style }: { row: Row; w: Window; style: ChartStyle }) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const s = SERIES[row.k];
  const plotW = Math.max(10, width - GUTTER - PAD_L), plotH = H - TOP - BOTTOM;
  const span = Math.max(1, w.end - w.start);
  const x = (i: number) => PAD_L + ((i - w.start) / span) * plotW;

  const geo = useMemo(() => {
    const vals = s.slice(w.from, w.end + 1).filter((v): v is number => v != null);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo || Math.abs(hi) * 0.01 || 1) * 0.08; lo -= pad; hi += pad;
    const t = ticks(lo, hi);
    lo = Math.min(lo, t.out[0]); hi = Math.max(hi, t.out[t.out.length - 1]);
    const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH;
    // Monthly releases are carried between prints: draw them as steps, not as a trend.
    let d = '';
    for (let i = w.from; i <= w.end; i++) {
      const v = s[i]; if (v == null) continue;
      const X = x(i).toFixed(1), Y = y(v).toFixed(1);
      if (!d) d = `M${X},${Y}`;
      else d += row.freq === 'monthly' ? `H${X}V${Y}` : `L${X},${Y}`;
    }
    // x ticks: month starts, or every fifth session in short windows.
    const xt: { i: number; label: string }[] = [];
    if (span <= 30) for (let i = w.start; i <= w.end; i += 5) xt.push({ i, label: shortDate(DATES[i]) });
    else for (let i = w.start + 1; i <= w.end; i++) if (DATES[i].slice(5, 7) !== DATES[i - 1].slice(5, 7)) xt.push({ i, label: monthOf(DATES[i]) });
    return { y, d, yt: t.out, ydp: tickDp(t.step, row.dp), xt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.k, w.start, w.end, w.from, width]);

  const bands = REGIMES.filter(r => r.to > w.start && r.from <= w.end).map(r => ({ r, a: Math.max(r.from, w.start), b: Math.min(r.to, w.end + 1) }));
  const last = s[w.end]!;
  const strip = style === 'Strip', rules = style === 'Rules';
  // The tag holds ~7 characters: full precision for FX, whole numbers for five-digit index levels.
  const tagDp = row.fmt === 'fx' ? row.dp : Math.abs(last) >= 10000 ? 0 : Math.min(row.dp, 2);

  const pick = (px: number) => {
    let i = Math.round(w.start + ((px - PAD_L) / plotW) * span);
    i = Math.max(w.from, Math.min(w.end, i));
    setScrub(i);
  };
  const onTouch = (e: GestureResponderEvent) => pick(e.nativeEvent.locationX);
  const hover = Platform.OS === 'web'
    ? { onPointerMove: (e: { nativeEvent: { offsetX: number } }) => pick(e.nativeEvent.offsetX), onPointerLeave: () => setScrub(null) }
    : {};

  const si = scrub ?? w.end, sv = s[si] ?? last, sr = regimeAt(si);
  const covered = w.from > w.start;

  return (
    <View style={{ height: H, backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider }}
      onLayout={e => setWidth(e.nativeEvent.layout.width - 2)}
      accessibilityLabel={`${row.s} chart, ${shortDate(DATES[w.from])} to ${shortDate(DATES[w.end])}, last ${fmtValue(last, row)}`}>
      {width ? (
        <Svg width={width} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
          {/* regime context */}
          {bands.map(({ r, a, b }, i) => strip
            ? <Rect key={r.from} x={x(a)} y={TOP + plotH - 6} width={Math.max(0, x(b) - x(a))} height={6} fill={r.solid} />
            : rules
              ? (i > 0 ? <Line key={r.from} x1={x(a)} x2={x(a)} y1={TOP} y2={TOP + plotH} stroke={C.a400} strokeDasharray="3 3" strokeWidth={1} /> : null)
              : <Rect key={r.from} x={x(a)} y={TOP} width={Math.max(0, x(b) - x(a))} height={plotH} fill={r.tint} />)}
          {/* no archive coverage */}
          {covered ? (
            <G>
              <Rect x={PAD_L} y={TOP} width={x(w.from) - PAD_L} height={plotH} fill="#f3f5f7" />
              <Line x1={x(w.from)} x2={x(w.from)} y1={TOP} y2={TOP + plotH} stroke={C.n500} strokeDasharray="2 3" />
            </G>
          ) : null}
          {/* grid + y labels */}
          {geo.yt.map(v => (
            <G key={v}>
              <Line x1={PAD_L} x2={PAD_L + plotW} y1={geo.y(v)} y2={geo.y(v)} stroke={C.divider} strokeWidth={1} />
              {Math.abs(geo.y(v) - geo.y(last)) < 13 ? null : <SvgText x={width - 6} y={geo.y(v) + 3.5} fontSize={10} fontFamily={AXIS_FONT} fill={C.n500} textAnchor="end">
                {v.toLocaleString('en-US', { minimumFractionDigits: geo.ydp, maximumFractionDigits: geo.ydp })}
              </SvgText>}
            </G>
          ))}
          {/* x labels */}
          {geo.xt.map(t => (
            <G key={t.i}>
              <Line x1={x(t.i)} x2={x(t.i)} y1={TOP + plotH} y2={TOP + plotH + 4} stroke={C.a300} />
              <SvgText x={x(t.i)} y={H - 9} fontSize={10} fontFamily={AXIS_FONT} fill={C.n500}
                textAnchor={x(t.i) - PAD_L < 18 ? 'start' : PAD_L + plotW - x(t.i) < 18 ? 'end' : 'middle'}>{t.label}</SvgText>
            </G>
          ))}
          <Line x1={PAD_L} x2={PAD_L + plotW} y1={TOP + plotH} y2={TOP + plotH} stroke={C.a300} />
          {/* series */}
          <Path d={geo.d} fill="none" stroke={C.navy} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
          {/* last value tag */}
          <Line x1={x(w.end)} x2={PAD_L + plotW} y1={geo.y(last)} y2={geo.y(last)} stroke={C.gold} strokeDasharray="2 2" />
          <Rect x={PAD_L + plotW + 2} y={geo.y(last) - 9} width={GUTTER - 4} height={18} fill={C.navy} />
          <SvgText x={width - 6} y={geo.y(last) + 3.5} fontSize={10} fontFamily={AXIS_FONT} fill="#fff" textAnchor="end">
            {last.toLocaleString('en-US', { minimumFractionDigits: tagDp, maximumFractionDigits: tagDp })}
          </SvgText>
          <Circle cx={x(w.end)} cy={geo.y(last)} r={3.5} fill={C.gold} stroke="#fff" strokeWidth={1.5} />
          {/* scrub */}
          {scrub != null && s[scrub] != null ? (
            <G>
              <Line x1={x(scrub)} x2={x(scrub)} y1={TOP} y2={TOP + plotH} stroke={C.text} strokeWidth={1} />
              <Circle cx={x(scrub)} cy={geo.y(s[scrub]!)} r={4} fill="#fff" stroke={C.text} strokeWidth={1.5} />
            </G>
          ) : null}
        </Svg>
      ) : null}

      {/* read-out: latest by default, the scrubbed session while dragging / hovering */}
      <View pointerEvents="none" style={{ position: 'absolute', left: PAD_L, right: 10, top: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={[font(600, 11), tabular, { color: C.text, flexShrink: 0 }]}>{shortDate(DATES[si])}</Text>
        <Text numberOfLines={1} style={[font(700, 12), tabular, { color: C.text, flexShrink: 0 }]}>{fmtValue(sv, row)}</Text>
        <View style={{ width: 8, height: 8, backgroundColor: sr.solid, flexShrink: 0 }} />
        <Text numberOfLines={1} style={[font(400, 11), { color: MUTED, flexShrink: 1 }]}>{sr.name}</Text>
      </View>
      {covered ? (
        <Text pointerEvents="none" style={[font(500, 10, 1.3), { position: 'absolute', left: PAD_L + 6, top: TOP + 8, width: Math.max(60, x(w.from) - PAD_L - 12), color: C.n500 }]}>
          Not in archive before {shortDate(DATES[row.from])}
        </Text>
      ) : null}

      {/* gesture layer over the plot */}
      <View style={{ position: 'absolute', left: 0, top: TOP, width: PAD_L + plotW, height: plotH }}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onTouch} onResponderMove={onTouch} onResponderRelease={() => setScrub(null)} onResponderTerminate={() => setScrub(null)}
        {...(hover as object)} />
    </View>
  );
}

/** 21-session sparkline for list rows. */
export function Sparkline({ row, n = 21, width = 64, height = 22 }: { row: Row; n?: number; width?: number; height?: number }) {
  const s = SERIES[row.k];
  const vals = s.slice(Math.max(row.from, s.length - n)).filter((v): v is number => v != null);
  if (vals.length < 2) return <View style={{ width, height }} />;
  const lo = Math.min(...vals), hi = Math.max(...vals), k = hi - lo || 1;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - lo) / k) * (height - 4)).toFixed(1)}`).join('');
  const up = vals[vals.length - 1] >= vals[0];
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={d} fill="none" stroke={up ? C.up : C.down} strokeWidth={1.25} strokeLinejoin="round" />
    </Svg>
  );
}
