import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { openDoc } from '@/components/edition';
import { Close } from '@/components/icons';
import { DocRow, Kicker, Screen } from '@/components/ui';
import { ALL_ROWS, visibleDocs } from '@/data';
import { useApp } from '@/store';
import { C, changeColor, font, MUTED, tabular } from '@/theme';

export default function Watchlist() {
  const role = useApp(s => s.role);
  const watch = useApp(s => s.watch);
  const saved = useApp(s => s.saved);
  const toggleWatch = useApp(s => s.toggleWatch);
  const rows = ALL_ROWS.filter(r => watch.includes(r.s));
  const savedDocs = visibleDocs(role).filter(d => saved.includes(d.id));

  return (
    <Screen pad={[8, 18, 28]} gap={0}>
      {rows.map(r => (
        <View key={r.s} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, borderBottomWidth: 1, borderBottomColor: C.divider }}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/asset', params: { group: r.gk, sym: r.s } })} accessibilityRole="button">
            <Text style={[font(500, 15), { color: C.text }]}>{r.s}</Text>
            <Text style={[font(400, 12), { color: MUTED }]}>{r.group}</Text>
          </Pressable>
          <Text style={[font(500, 13), tabular, { color: changeColor(r.chg) }]}>{r.chg ?? ''}</Text>
          <Text style={[font(500, 15), tabular, { color: C.text }]}>{r.val}</Text>
          <Pressable onPress={() => toggleWatch(r.s)} accessibilityRole="button" accessibilityLabel={`Remove ${r.s}`}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, (pressed || hovered) && { backgroundColor: C.a100 }]}>
            <Close />
          </Pressable>
        </View>
      ))}
      {rows.length === 0 ? (
        <Text style={[font(400, 14), { paddingVertical: 40, textAlign: 'center', color: MUTED }]}>Nothing watched. Star an instrument in Markets to add it.</Text>
      ) : null}
      {savedDocs.length ? (
        <>
          <Kicker style={{ marginTop: 22, marginBottom: 4 }}>Saved research</Kicker>
          {savedDocs.map(d => <DocRow key={d.id} border="bottom" title={d.title} sub={`${d.code} · ${d.date}`} onPress={() => openDoc(d)} />)}
        </>
      ) : null}
    </Screen>
  );
}
