import { Text, View } from 'react-native';
import { DriverList, openDoc, RegimeCard, viewTitle, ViewText } from '@/components/edition';
import { router } from 'expo-router';
import { DocRow, Kicker, Screen, Tap } from '@/components/ui';
import { DIM_LINKS, ED, latestDocs, rowByKey, visibleAlerts, visibleThemes } from '@/data';
import { useTerminal } from '@/lib/terminal';
import { useApp } from '@/store';
import { C, changeColor, font, LEVEL_TINT, MUTED, tabular } from '@/theme';

// Scenario bar fills: the dominant scenario takes the gold, the rest step through the accent ramp.
const WEIGHT_FILLS = [C.a200, C.a300, C.a400, C.a300];
const SC = ED.scenarios;
const pct = (v: number) => Math.round(v * 100) + '%';

export default function Today() {
  const role = useApp(s => s.role);
  const internal = role === 'Internal';
  const top = SC.cells.reduce((m, w, i, a) => (w.v > a[m].v ? i : m), 0);
  const latest = latestDocs(role);
  const terminal = useTerminal();

  const topEl = (
    <>
      <Text style={[font(400, 13), { color: MUTED }]}>{ED.dateLong} · Day {ED.day} · Edition {ED.n}</Text>
      <RegimeCard />

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Kicker>{viewTitle(internal)}</Kicker>
          {internal ? <Text style={[font(600, 10), { letterSpacing: 0.8, color: C.a700 }]}>EDITION {ED.n}</Text> : null}
        </View>
        <ViewText />
      </View>

    </>
  );
  const scenEl = (
    <>
      <View style={{ gap: 8 }}>
        <Kicker>Scenario weights</Kicker>
        <View style={{ flexDirection: 'row', height: 14, borderWidth: 1, borderColor: C.divider }} accessibilityLabel={SC.cells.map(w => `${w.name} ${pct(w.v)}`).join(', ')}>
          {SC.cells.map((w, i) => (
            <View key={w.key} style={{ width: `${w.v * 100}%`, backgroundColor: i === top ? C.gold : WEIGHT_FILLS[i % WEIGHT_FILLS.length] }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {SC.cells.map((w, i) => (
            <Tap key={w.key} onPress={() => { const r = rowByKey(`x_scn_${w.key}`); if (r) router.push({ pathname: '/asset', params: { group: r.gk, sym: r.s } }); }}
              accessibilityLabel={`${w.name} ${pct(w.v)}. Open weight history`} style={{ flex: 1, justifyContent: 'space-between' }}>
              <Text style={[font(400, 12, 1.25), { color: MUTED }]}>{w.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                <Text style={[font(700, 16), { color: i === top ? C.a700 : C.text }]}>{pct(w.v)}</Text>
                {w.chg ? <Text style={[font(500, 11), tabular, { color: MUTED }]}>{w.chg > 0 ? '+' : '\u2212'}{Math.abs(w.chg)}</Text> : null}
              </View>
            </Tap>
          ))}
        </View>
        {SC.caption ? <Text style={[font(400, 11), { color: MUTED }]}>{SC.caption}{SC.since ? '; change in points vs prior revision.' : '.'} Tap a scenario for its weight history.</Text> : null}
      </View>

    </>
  );
  const researchEl = (
    <>
      <View style={{ gap: 2 }}>
        <Kicker style={{ marginBottom: 6 }}>Latest research</Kicker>
        {latest.map(d => <DocRow key={d.id} title={d.title} sub={`${d.code} · ${d.date}`} onPress={() => openDoc(d)} />)}
      </View>
    </>
  );

  if (terminal) {
    const today = visibleAlerts(role).filter(a => a.date === ED.date);
    const themes = Object.fromEntries(visibleThemes(role).map(t => [t.id, t]));
    return (
      <Screen maxWidth={1320} gap={0}>
        <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.35, minWidth: 0, gap: 22 }}>
            {topEl}
            {scenEl}
            <DriverList />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 22 }}>
            <View style={{ gap: 6 }}>
              <Kicker>Regime dimensions</Kicker>
              {ED.dims.map(d => {
                const link = DIM_LINKS[d.name] ? rowByKey(DIM_LINKS[d.name]) : undefined, [bg, ink] = LEVEL_TINT[d.level] ?? LEVEL_TINT.AMBER;
                return (
                  <Tap key={d.name} disabled={!link} onPress={() => link && router.push({ pathname: '/asset', params: { group: link.gk, sym: link.s } })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: C.divider, backgroundColor: internal ? bg : '#fff' }}>
                    <Text style={[font(400, 12), { width: 120, color: MUTED }]}>{d.name}</Text>
                    <Text style={[font(700, 13), { flex: 1, color: internal ? ink : d.bd < 0.1 ? C.gold : C.navy }]} numberOfLines={1}>{d.tag}{d.bd < 0.1 ? ' †' : ''}</Text>
                    <Text style={[font(400, 11.5), tabular, { color: MUTED, maxWidth: 190 }]} numberOfLines={1}>{internal ? `${d.bd.toFixed(3)} · ` : ''}{d.data}</Text>
                  </Tap>
                );
              })}
            </View>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Kicker>Events · {ED.dateShort}</Kicker>
                <Tap onPress={() => router.push('/events')} style={{ paddingHorizontal: 4 }}><Text style={[font(600, 11), { color: C.a700 }]}>All events ›</Text></Tap>
              </View>
              {today.map(a => {
                const t = themes[a.theme];
                const r = a.links?.[0] ? rowByKey(a.links[0]) : undefined;
                return (
                  <View key={a.id} style={{ borderLeftWidth: 3, borderLeftColor: t?.color ?? C.a300, paddingLeft: 10, paddingVertical: 4, gap: 1 }}>
                    <Text style={[font(600, 9), { letterSpacing: 0.7, color: t?.color ?? MUTED, textTransform: 'uppercase' }]}>{t?.name} · {a.type}{a.internal ? ' · internal' : ''}</Text>
                    <Text style={[font(600, 13), { color: C.text }]}>{a.t}</Text>
                    {r ? <Text style={[font(400, 11.5), tabular, { color: MUTED }]}>{r.s} {r.val} <Text style={{ color: changeColor(r.chg) }}>{r.chg ?? ''}</Text></Text> : null}
                  </View>
                );
              })}
            </View>
            {researchEl}
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {topEl}
      {scenEl}
      <DriverList />
      {researchEl}
    </Screen>
  );
}
