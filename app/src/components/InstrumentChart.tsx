import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { DATES, REGIMES, SERIES, type Row } from '@/data';
import { fmtValue, isFlow, isStep, monthOf, regimeAt, shortDate, type Window } from '@/lib/analytics';
import type { ChartStyle } from '@/store';
import { C, font, MUTED, tabular } from '@/theme';

const H = 248;          // card height
const TOP = 40;         // read-out row
const RIBBON = 10;      // regime timeline height (Timeline mode)
const AXIS = 22;        // x-axis labels
const GUTTER = 54;      // y-axis labels and value tags
const PAD_L = 10;
const AXIS_FONT = Platform.select({ web: 'Inter_400Regular, Inter, sans-serif', default: 'Inter_400Regular' });
const isWeb = Platform.OS === 'web';
const tick = () => { if (!isWeb) Haptics.selectionAsync().catch(() => {}); };

/** 3–5 round ticks covering [lo, hi], never finer than the instrument's display precision (no 2.5bp steps shown as whole bp). */
function ticks(lo: number, hi: number, dp: number) {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / 4, mag = 10 ** Math.floor(Math.log10(raw)), unit = 10 ** -dp;
  const ok = (st: number) => st >= unit - 1e-12 && Math.abs(st / unit - Math.round(st / unit)) < 1e-9;
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => st >= raw && ok(st)) ?? Math.max(unit, 10 * mag);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return { out, step };
}
const tickDp = (step: number, dp: number) => Math.min(dp, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
const num = (v: number, dp: number) => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/**
 * Archive time series with regime context.
 * - Timeline (default): clean plot, regime ribbon under it.  Overlay: regime tints behind the line.
 * - Touch: a horizontal drag or a short press-and-hold starts reading; vertical swipes keep scrolling the page.
 *   Crosshair, value tag on the axis, date on the x-axis, haptic tick on start and at each regime change.
 * - Web: hover to read.
 */
export function InstrumentChart({ row, w, style }: { row: Row; w: Window; style: ChartStyle }) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const s = SERIES[row.k];
  const overlay = style === 'Overlay';
  const plotW = Math.max(10, width - GUTTER - PAD_L);
  const plotH = H - TOP - AXIS - (overlay ? 0 : RIBBON + 6);
  const plotBottom = TOP + plotH;
  const span = Math.max(1, w.end - w.start);
  const x = (i: number) => PAD_L + ((i - w.start) / span) * plotW;

  const geo = useMemo(() => {
    const vals = s.slice(w.from, w.end + 1).filter((v): v is number => v != null);
    const flow = isFlow(row);
    let lo = Math.min(...vals, ...(flow ? [0] : [])), hi = Math.max(...vals, ...(flow ? [0] : []));
    // Flat or near-flat series (policy settings that have not moved) still get a readable axis.
    const minSpan = 12 * 10 ** -Math.min(row.dp, 2);
    if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const t = ticks(lo, hi, Math.min(row.dp, 2));
    lo = Math.min(lo, t.out[0]); hi = Math.max(hi, t.out[t.out.length - 1]);
    const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * plotH;
    // Step series (monthly prints, policy rates) hold between decisions: draw steps, not a trend.
    // Gappy series break the line at a missing edition instead of bridging it.
    let d = '', pen = false, gappy = false;
    const pts: { i: number; v: number }[] = [];
    for (let i = w.from; i <= w.end; i++) {
      const v = s[i];
      if (v == null) { if (pen) gappy = true; pen = false; continue; }
      pts.push({ i, v });
      if (flow) continue;
      const X = x(i).toFixed(1), Y = y(v).toFixed(1);
      d += !pen ? `M${X},${Y}` : isStep(row) ? `H${X}V${Y}` : `L${X},${Y}`;
      pen = true;
    }
    // Flow series (daily returns / spreads): bars from zero.
    const bw = Math.max(1.5, Math.min(10, (plotW / Math.max(1, span)) * 0.7));
    const bars = flow ? pts.map(p => ({ i: p.i, x: x(p.i) - bw / 2, y: Math.min(y(p.v), y(0)), h: Math.max(0.75, Math.abs(y(p.v) - y(0))), up: p.v >= 0 })) : [];
    const xt: { i: number; label: string }[] = [];
    if (span <= 30) for (let i = w.start; i <= w.end; i += 5) xt.push({ i, label: shortDate(DATES[i]) });
    else for (let i = w.start + 1; i <= w.end; i++) if (DATES[i].slice(5, 7) !== DATES[i - 1].slice(5, 7)) xt.push({ i, label: monthOf(DATES[i]) });
    return { y, d, yt: t.out, ydp: tickDp(t.step, row.dp), xt, zero: lo < 0 && hi > 0 ? y(0) : null, bars, dots: gappy ? pts : [], bw };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.k, w.start, w.end, w.from, width, plotH]);

  const bands = REGIMES.filter(r => r.to > w.start && r.from <= w.end).map(r => ({ r, a: Math.max(r.from, w.start), b: Math.min(r.to, w.end + 1) }));
  let lastI = w.end; while (lastI > w.from && s[lastI] == null) lastI--;
  const last = s[lastI]!;
  const tagDp = row.fmt === 'fx' ? row.dp : Math.abs(last) >= 10000 ? 0 : Math.min(row.dp, 2);
  const covered = w.from > w.start;

  // ---- interaction ----
  // The pan responder is created once; everything it reads must come through refs, or it keeps the
  // instrument that was on screen when the chart mounted (snapping to the wrong series' readings).
  const geoRef = useRef({ plotW, span, w, k: row.k }); geoRef.current = { plotW, span, w, k: row.k };
  const active = useRef(false), hold = useRef<ReturnType<typeof setTimeout> | null>(null), lastRegime = useRef('');
  const pick = (px: number) => {
    const g = geoRef.current;
    let i = Math.max(g.w.from, Math.min(g.w.end, Math.round(g.w.start + ((px - PAD_L) / g.plotW) * g.span)));
    // Snap to the nearest edition with a reading (the current instrument's own series).
    const ser = SERIES[g.k];
    if (ser[i] == null) { for (let d = 1; d < 6; d++) { if (i - d >= g.w.from && ser[i - d] != null) { i -= d; break; } if (i + d <= g.w.end && ser[i + d] != null) { i += d; break; } } }
    const name = regimeAt(i).name;
    if (active.current && lastRegime.current && name !== lastRegime.current) tick();
    lastRegime.current = name;
    setScrub(i);
  };
  const end = () => { if (hold.current) clearTimeout(hold.current); active.current = false; lastRegime.current = ''; setScrub(null); };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: e => {
      const px = e.nativeEvent.locationX;
      hold.current = setTimeout(() => { active.current = true; tick(); pick(px); }, 180);
    },
    onPanResponderMove: (e, g) => {
      if (!active.current) {
        if (Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2) { if (hold.current) clearTimeout(hold.current); active.current = true; tick(); }
        else return;
      }
      pick(e.nativeEvent.locationX);
    },
    // Until reading has started, give the gesture back to the page scroll.
    onPanResponderTerminationRequest: () => !active.current,
    onPanResponderRelease: end, onPanResponderTerminate: end,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  // Hover reading is for a mouse only; touch on mobile web goes through the pan responder like native.
  type PE = { nativeEvent: { offsetX: number; pointerType?: string } };
  const hover = isWeb ? {
    onPointerMove: (e: PE) => { if (e.nativeEvent.pointerType === 'mouse') pick(e.nativeEvent.offsetX); },
    onPointerLeave: (e: PE) => { if (e.nativeEvent.pointerType === 'mouse') end(); },
  } : {};

  const si = scrub ?? w.end, sv = s[si] ?? last, sr = regimeAt(si);
  const sy = scrub != null && s[scrub] != null ? geo.y(s[scrub]!) : null;

  return (
    <View style={{ height: H, backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider }}
      onLayout={e => setWidth(e.nativeEvent.layout.width - 2)}
      accessibilityLabel={`${row.s} chart, ${shortDate(DATES[w.from])} to ${shortDate(DATES[w.end])}, last ${fmtValue(last, row)}`}>
      {width ? (
        <Svg width={width} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
          {overlay ? bands.map(({ r, a, b }) => <Rect key={r.from} x={x(a)} y={TOP} width={Math.max(0, x(b) - x(a))} height={plotH} fill={r.tint} />) : null}
          {covered ? (
            <G>
              <Rect x={PAD_L} y={TOP} width={x(w.from) - PAD_L} height={plotH} fill="#f3f5f7" />
              <Line x1={x(w.from)} x2={x(w.from)} y1={TOP} y2={plotBottom} stroke={C.n500} strokeDasharray="2 3" />
            </G>
          ) : null}
          {geo.yt.map(v => (
            <G key={v}>
              <Line x1={PAD_L} x2={PAD_L + plotW} y1={geo.y(v)} y2={geo.y(v)} stroke={C.divider} strokeWidth={1} />
              {Math.abs(geo.y(v) - geo.y(last)) < 13 || (sy != null && Math.abs(geo.y(v) - sy) < 13) ? null : (
                <SvgText x={width - 6} y={geo.y(v) + 3.5} fontSize={10} fontFamily={AXIS_FONT} fill={C.n500} textAnchor="end">{num(v, geo.ydp)}</SvgText>
              )}
            </G>
          ))}
          {geo.zero != null ? <Line x1={PAD_L} x2={PAD_L + plotW} y1={geo.zero} y2={geo.zero} stroke={C.a400} strokeWidth={1} /> : null}
          <Line x1={PAD_L} x2={PAD_L + plotW} y1={plotBottom} y2={plotBottom} stroke={C.a300} />

          {/* regime timeline ribbon */}
          {!overlay ? bands.map(({ r, a, b }) => (
            <Rect key={'rb' + r.from} x={x(a)} y={plotBottom + 5} width={Math.max(0.5, x(b) - x(a) - 0.5)} height={RIBBON} fill={r.solid}
              opacity={scrub == null || r.name === sr.name ? 1 : 0.28} />
          )) : null}

          {/* x labels */}
          {geo.xt.map(t => (
            <SvgText key={t.i} x={x(t.i)} y={H - 7} fontSize={10} fontFamily={AXIS_FONT} fill={C.n500}
              textAnchor={x(t.i) - PAD_L < 18 ? 'start' : PAD_L + plotW - x(t.i) < 18 ? 'end' : 'middle'}
              opacity={scrub != null ? 0.25 : 1}>{t.label}</SvgText>
          ))}

          {geo.bars.map(b => <Rect key={b.i} x={b.x} y={b.y} width={geo.bw} height={b.h} fill={b.i === lastI ? C.gold : b.up ? C.a700 : C.down} opacity={scrub == null || scrub === b.i ? 1 : 0.55} />)}
          {geo.d ? <Path d={geo.d} fill="none" stroke={C.navy} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {geo.dots.map(p => <Circle key={p.i} cx={x(p.i)} cy={geo.y(p.v)} r={2} fill={C.navy} />)}

          {/* last value */}
          <Line x1={x(lastI)} x2={PAD_L + plotW} y1={geo.y(last)} y2={geo.y(last)} stroke={C.gold} strokeDasharray="2 2" />
          <Rect x={PAD_L + plotW + 2} y={geo.y(last) - 9} width={GUTTER - 4} height={18} fill={C.navy} />
          <SvgText x={width - 6} y={geo.y(last) + 3.5} fontSize={10} fontFamily={AXIS_FONT} fill="#fff" textAnchor="end">{num(last, tagDp)}</SvgText>
          {isFlow(row) ? null : <Circle cx={x(lastI)} cy={geo.y(last)} r={3.5} fill={C.gold} stroke="#fff" strokeWidth={1.5} />}

          {/* crosshair */}
          {scrub != null && sy != null ? (
            <G>
              <Line x1={x(scrub)} x2={x(scrub)} y1={TOP} y2={plotBottom + (overlay ? 0 : RIBBON + 5)} stroke={C.text} strokeWidth={1} />
              <Line x1={PAD_L} x2={PAD_L + plotW} y1={sy} y2={sy} stroke={C.text} strokeWidth={0.75} strokeDasharray="3 3" />
              <Rect x={PAD_L + plotW + 2} y={sy - 9} width={GUTTER - 4} height={18} fill="#fff" stroke={C.text} strokeWidth={1} />
              <SvgText x={width - 6} y={sy + 3.5} fontSize={10} fontFamily={AXIS_FONT} fill={C.text} textAnchor="end">{num(s[scrub]!, tagDp)}</SvgText>
              <Circle cx={x(scrub)} cy={sy} r={4.5} fill="#fff" stroke={C.text} strokeWidth={1.75} />
              <Rect x={Math.min(Math.max(PAD_L, x(scrub) - 26), PAD_L + plotW - 52)} y={H - AXIS + 2} width={52} height={17} fill={C.text} />
              <SvgText x={Math.min(Math.max(PAD_L + 26, x(scrub)), PAD_L + plotW - 26)} y={H - 7} fontSize={10} fontFamily={AXIS_FONT} fill="#fff" textAnchor="middle">{shortDate(DATES[scrub])}</SvgText>
            </G>
          ) : null}
        </Svg>
      ) : null}

      {/* read-out */}
      <View pointerEvents="none" style={{ position: 'absolute', left: PAD_L, right: 10, top: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={[font(600, 11), tabular, { color: C.text, flexShrink: 0 }]}>{shortDate(DATES[si])}</Text>
        <Text numberOfLines={1} style={[font(700, 12), tabular, { color: C.text, flexShrink: 0 }]}>{fmtValue(sv, row)}</Text>
        <View style={{ width: 8, height: 8, backgroundColor: sr.solid, flexShrink: 0 }} />
        <Text numberOfLines={1} style={[font(400, 11), { color: MUTED, flexShrink: 1 }]}>{sr.name}</Text>
      </View>
      {covered && x(w.from) - PAD_L >= 72 ? (
        <Text pointerEvents="none" style={[font(500, 10, 1.3), { position: 'absolute', left: PAD_L + 6, top: TOP + 8, width: Math.max(60, x(w.from) - PAD_L - 12), color: C.n500 }]}>
          Not in archive before {shortDate(DATES[row.from])}
        </Text>
      ) : null}

      {/* gesture layer */}
      <View style={{ position: 'absolute', left: 0, top: TOP, width: PAD_L + plotW, height: H - TOP }} {...pan.panHandlers} {...(hover as object)} />
    </View>
  );
}

/** 21-session sparkline for list rows. */
export function Sparkline({ row, n = 21, width = 60, height = 22 }: { row: Row; n?: number; width?: number; height?: number }) {
  const s = SERIES[row.k];
  const vals = s.slice(Math.max(row.from, s.length - n)).filter((v): v is number => v != null);
  if (vals.length < 2) return <View style={{ width, height }} />;
  if (isFlow(row)) {
    const m = Math.max(...vals.map(Math.abs)) || 1, bw = Math.max(1, (width - 2) / vals.length - 1), mid = height / 2;
    return (
      <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {vals.map((v, i) => { const h = Math.max(0.75, (Math.abs(v) / m) * (mid - 1)); return <Rect key={i} x={1 + i * (bw + 1)} y={v >= 0 ? mid - h : mid} width={bw} height={h} fill={v >= 0 ? C.a700 : C.down} />; })}
      </Svg>
    );
  }
  const lo = Math.min(...vals), hi = Math.max(...vals), k = hi - lo || 1;
  const pts = vals.map((v, i) => [((i / (vals.length - 1)) * (width - 2) + 1), (height - 2 - ((v - lo) / k) * (height - 4))]);
  const d = pts.map(([px, py], i) => (i ? (isStep(row) ? `H${px.toFixed(1)}V${py.toFixed(1)}` : `L${px.toFixed(1)},${py.toFixed(1)}`) : `M${px.toFixed(1)},${py.toFixed(1)}`)).join('');
  const up = vals[vals.length - 1] >= vals[0];
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={d} fill="none" stroke={isStep(row) ? C.a700 : up ? C.up : C.down} strokeWidth={1.25} strokeLinejoin="round" />
    </Svg>
  );
}
