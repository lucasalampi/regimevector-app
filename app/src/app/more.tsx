import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { ChevronRight } from '@/components/icons';
import { Screen, Tap } from '@/components/ui';
import { POSITIONING, visibleIssuers } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED } from '@/theme';

export default function More() {
  const watch = useApp(s => s.watch);
  const saved = useApp(s => s.saved);
  const issuers = visibleIssuers(useApp(s => s.role)).length;
  const links: { t: string; b: string; href: Href }[] = [
    { t: 'Watchlist', b: `${watch.length} instruments · ${saved.length} saved editions`, href: '/watchlist' },
    { t: 'Positioning', b: `Weekly book, week ending ${POSITIONING.weekEnding.replace(/ \d{4}$/, '')}`, href: '/positioning' },
    { t: 'Single-name research', b: `SR-SN 1.0 · ${issuers} issuers`, href: '/names' },
    { t: 'Settings', b: 'Role view, notifications, account', href: '/settings' },
  ];
  return (
    <Screen pad={[8, 18, 28]} gap={0}>
      {links.map(m => (
        <Tap key={m.t} onPress={() => router.push(m.href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 68, borderBottomWidth: 1, borderBottomColor: C.divider }}>
          <View style={{ flex: 1 }}>
            <Text style={[font(700, 17, 1.1), { color: C.text }]}>{m.t}</Text>
            <Text style={[font(400, 13), { color: MUTED }]}>{m.b}</Text>
          </View>
          <ChevronRight />
        </Tap>
      ))}
    </Screen>
  );
}
