import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { TransmissionMap } from '@/components/charts';
import { blueprint, Kicker, Screen, Tap } from '@/components/ui';
import { ED, GROUPS, TRANSMISSION } from '@/data';
import { useApp } from '@/store';
import { C, font, LEVEL_TINT, MUTED, tabular } from '@/theme';

export default function Markets() {
  const internal = useApp(s => s.role) === 'Internal';
  const mapStyle = useApp(s => s.mapStyle);

  return (
    <Screen gap={24}>
      <View style={{ gap: 8 }}>
        <Kicker>Regime dimensions</Kicker>
        <View style={[blueprint, { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {ED.dims.map((d, i) => {
            const flagged = d.bd < 0.1;
            const [bg, ink] = LEVEL_TINT[d.level] ?? LEVEL_TINT.AMBER;
            // Inner rules only: the frame draws the outer edge, so an odd last cell still closes cleanly.
            const lastRow = i >= ED.dims.length - (ED.dims.length % 2 || 2);
            return (
              <View key={d.name} style={{ width: '50%', paddingVertical: 10, paddingHorizontal: 12, borderColor: C.divider, borderRightWidth: i % 2 === 0 ? 1 : 0, borderBottomWidth: lastRow ? 0 : 1, backgroundColor: internal ? bg : '#fff' }}>
                <Text style={[font(400, 11), { color: MUTED }]}>{d.name}</Text>
                <Text style={[font(700, 14, 1.15), { color: internal ? ink : flagged ? C.gold : C.navy }]}>{d.tag}{flagged ? ' †' : ''}</Text>
                <Text style={[font(400, 11, 1.35), tabular, { color: MUTED }]}>{d.data}</Text>
                {internal ? <Text style={[font(400, 11), tabular, { color: MUTED }]}>Boundary dist. {d.bd.toFixed(3)} · {d.level}</Text> : null}
              </View>
            );
          })}
        </View>
        <Text style={[font(400, 11), { color: MUTED }]}>† Boundary-flagged. Edition {ED.n}, {ED.dateShort} {ED.date.slice(0, 4)}.</Text>
      </View>

      <View style={{ gap: 10 }}>
        <Kicker>Cross-asset · close {ED.dateShort}</Kicker>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {GROUPS.map(g => (
            <Tap key={g.id} onPress={() => router.push({ pathname: '/asset', params: { group: g.id } })}
              style={[blueprint, { width: '47%', flexGrow: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 6 }]}>
              <Text style={[font(700, 15, 1), { color: C.text }]}>{g.name}</Text>
              {g.rows.slice(0, 3).map(r => (
                <View key={r.s} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                  <Text style={[font(400, 13), { color: MUTED, flexShrink: 1 }]} numberOfLines={1}>{r.s}</Text>
                  <Text style={[font(500, 13), tabular, { color: C.text }]}>{r.val}</Text>
                </View>
              ))}
            </Tap>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Kicker>Transmission map</Kicker>
          <Text style={[font(600, 10), { letterSpacing: 0.8, color: MUTED }]}>{TRANSMISSION.window} EDITIONS · DAILY CHANGES</Text>
        </View>
        <TransmissionMap style={mapStyle} />
      </View>
    </Screen>
  );
}
