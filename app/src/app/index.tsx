import { Text, View } from 'react-native';
import { DriverList, openDoc, RegimeCard, viewTitle, ViewText } from '@/components/edition';
import { DocRow, Kicker, Screen } from '@/components/ui';
import { ED, latestDocs } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED, tabular } from '@/theme';

// Scenario bar fills: the dominant scenario takes the gold, the rest step through the accent ramp.
const WEIGHT_FILLS = [C.a200, C.a300, C.a400, C.a300];
const SC = ED.scenarios;
const pct = (v: number) => Math.round(v * 100) + '%';

export default function Today() {
  const role = useApp(s => s.role);
  const internal = role === 'Internal';
  const top = SC.cells.reduce((m, w, i, a) => (w.v > a[m].v ? i : m), 0);
  const latest = latestDocs(role);

  return (
    <Screen>
      <Text style={[font(400, 13), { color: MUTED }]}>{ED.dateLong} · Day {ED.day} · Edition {ED.n}</Text>
      <RegimeCard />

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Kicker>{viewTitle(internal)}</Kicker>
          {internal ? <Text style={[font(600, 10), { letterSpacing: 0.8, color: C.a700 }]}>EDITION {ED.n}</Text> : null}
        </View>
        <ViewText />
      </View>

      <View style={{ gap: 8 }}>
        <Kicker>Scenario weights</Kicker>
        <View style={{ flexDirection: 'row', height: 14, borderWidth: 1, borderColor: C.divider }} accessibilityLabel={SC.cells.map(w => `${w.name} ${pct(w.v)}`).join(', ')}>
          {SC.cells.map((w, i) => (
            <View key={w.key} style={{ width: `${w.v * 100}%`, backgroundColor: i === top ? C.gold : WEIGHT_FILLS[i % WEIGHT_FILLS.length] }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {SC.cells.map((w, i) => (
            <View key={w.key} style={{ flex: 1, justifyContent: 'space-between' }}>
              <Text style={[font(400, 12, 1.25), { color: MUTED }]}>{w.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                <Text style={[font(700, 16), { color: i === top ? C.a700 : C.text }]}>{pct(w.v)}</Text>
                {w.chg ? <Text style={[font(500, 11), tabular, { color: MUTED }]}>{w.chg > 0 ? '+' : '\u2212'}{Math.abs(w.chg)}</Text> : null}
              </View>
            </View>
          ))}
        </View>
        {SC.caption ? <Text style={[font(400, 11), { color: MUTED }]}>{SC.caption}{SC.since ? '; change in points vs prior revision.' : '.'}</Text> : null}
      </View>

      <DriverList />

      <View style={{ gap: 2 }}>
        <Kicker style={{ marginBottom: 6 }}>Latest research</Kicker>
        {latest.map(d => <DocRow key={d.id} title={d.title} sub={`${d.code} · ${d.date}`} onPress={() => openDoc(d)} />)}
      </View>
    </Screen>
  );
}
