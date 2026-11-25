import { Pressable, Text, View } from 'react-native';
import { Kicker, OutlineButton, Screen, Seg } from '@/components/ui';
import { useApp, type NotifKey } from '@/store';
import { C, font, MUTED, ON } from '@/theme';

const NL: Record<NotifKey, string> = { daily: 'Daily brief published', event: 'Intraday event notes', regime: 'Regime label change', pos: 'Weekly positioning book' };

export default function Settings() {
  const s = useApp();
  return (
    <Screen gap={22}>
      <View style={{ gap: 6 }}>
        <Kicker>View as</Kicker>
        <Seg options={['Client', 'Internal'] as const} value={s.role} onChange={s.setRole} size={14} />
        <Text style={[font(400, 12, 1.45), { color: MUTED }]}>Internal adds classification robustness, boundary distances, held items and internal drafts.</Text>
      </View>

      <View>
        <Kicker style={{ marginBottom: 4 }}>Notifications</Kicker>
        {(Object.keys(NL) as NotifKey[]).map(k => {
          const on = s.notif[k];
          return (
            <Pressable key={k} onPress={() => s.toggleNotif(k)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={NL[k]}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderBottomWidth: 1, borderBottomColor: C.divider }}>
              <Text style={[font(400, 15), { flex: 1, color: C.text }]}>{NL[k]}</Text>
              <View style={{ width: 40, height: 22, borderWidth: 1, borderColor: C.a700, backgroundColor: on ? ON : 'transparent' }}>
                <View style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 16, height: 16, backgroundColor: on ? '#fff' : ON }} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 6 }}>
        <Kicker>Chart display</Kicker>
        <Text style={[font(400, 12), { color: MUTED }]}>Regime context on time series</Text>
        <Seg options={['Timeline', 'Overlay'] as const} value={s.chartStyle} onChange={s.setChartStyle} />
        <Text style={[font(400, 11, 1.4), { color: C.n500 }]}>Timeline keeps the plot clean with a regime ribbon underneath; Overlay tints the plot itself.</Text>
        <Text style={[font(400, 12), { color: MUTED, marginTop: 6 }]}>Transmission map</Text>
        <Seg options={['Matrix', 'Ranked'] as const} value={s.mapStyle} onChange={s.setMapStyle} />
      </View>

      <Text style={[font(400, 13), { color: MUTED }]}>Signed in as {s.email}</Text>
      <OutlineButton label="Sign out" muted onPress={s.signOut} />
    </Screen>
  );
}
