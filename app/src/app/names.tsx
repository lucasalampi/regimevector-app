import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { blueprint, Screen, Tap } from '@/components/ui';
import { ISSUERS } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED } from '@/theme';

export default function Names() {
  const internal = useApp(s => s.role) === 'Internal';
  const names = ISSUERS.filter(x => internal || x.status !== 'DRAFT');
  return (
    <Screen pad={[14, 18, 28]} gap={0}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {names.map(n => (
          <Tap key={n.tk} onPress={() => router.push({ pathname: '/name/[tk]', params: { tk: n.tk } })}
            style={[blueprint, { width: '46%', flexGrow: 1, padding: 12, gap: 4 }]}>
            <Text style={[font(700, 24, 1), { color: C.text }]}>{n.tk}</Text>
            <Text style={[font(400, 13, 1.3), { color: MUTED }]}>{n.co}</Text>
            <Text style={[font(600, 10), { letterSpacing: 0.8, color: C.a700, marginTop: 6 }]}>{n.ed} · {n.status}</Text>
          </Tap>
        ))}
      </View>
    </Screen>
  );
}
