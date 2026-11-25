import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { ED, type Doc } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED, tabular } from '@/theme';
import { blueprint, Kicker } from './ui';

export const viewTitle = (internal: boolean) => (internal ? "Strategist's view" : "Today's macro view");
export const openDoc = (d: Pick<Doc, 'id'>) => router.push({ pathname: '/reader/[id]', params: { id: d.id } });

export function RegimeCard() {
  const internal = useApp(s => s.role) === 'Internal';
  return (
    <View style={[blueprint, { paddingVertical: 14, paddingHorizontal: 16, borderLeftWidth: 3, borderLeftColor: C.gold, gap: 6 }]}>
      <Kicker color={C.gold}>Current regime</Kicker>
      <Text style={[font(700, 24, 1.05), { letterSpacing: -0.36, color: C.text }]}>{ED.regime}</Text>
      {internal ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.divider }}>
            {ED.tenure != null ? <Text style={[font(400, 12), { color: MUTED }]}>Tenure <Text style={[font(700, 12), { color: C.text }]}>{ED.tenure} sessions</Text></Text> : null}
            {ED.weakest ? (
              <Text style={[font(400, 12), { color: MUTED }]}>Weakest boundary <Text style={[font(700, 12), { color: C.text }]}>{ED.weakest.name} {ED.weakest.bd.toFixed(3)}</Text></Text>
            ) : null}
          </View>
          <Text style={[font(400, 11), { color: MUTED }]}>{ED.internalStatus}</Text>
        </>
      ) : null}
    </View>
  );
}

export function ViewText({ size = 15.5, pad = [14, 16] }: { size?: number; pad?: [number, number] }) {
  const internal = useApp(s => s.role) === 'Internal';
  return (
    <View style={{ backgroundColor: C.cream, borderLeftWidth: 3, borderLeftColor: C.gold, paddingVertical: pad[0], paddingHorizontal: pad[1] }}>
      <Text style={[font(400, size, 1.6), { color: C.text }]}>{internal ? ED.views.internal : ED.views.client}</Text>
    </View>
  );
}

export function DriverList() {
  return (
    <View style={{ gap: 2 }}>
      <Kicker style={{ marginBottom: 6 }}>Top market drivers</Kicker>
      {ED.drivers.map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 4, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider }}>
          <Text style={[font(700, 16, 1.1), { width: 26, color: C.a700 }]}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[font(500, 15, 1.3), { color: C.text }]}>{d.t}</Text>
            <Text style={[font(400, 13, 1.45), tabular, { color: MUTED }]}>{d.b}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
