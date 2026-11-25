import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { openDoc } from '@/components/edition';
import { Screen, Tap } from '@/components/ui';
import { ALL_ROWS, visibleDocs, visibleIssuers } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED, tabular } from '@/theme';

export default function Search() {
  const role = useApp(s => s.role);
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const needle = q.trim().toLowerCase();

  const pool = [
    ...ALL_ROWS.map(r => ({ kind: r.group.toUpperCase(), label: r.s, sub: r.val + (r.chg ? ' · ' + r.chg : ''), open: () => router.push({ pathname: '/asset', params: { group: r.gk, sym: r.s } }) })),
    ...visibleDocs(role).map(d => ({ kind: 'EDITION', label: d.title, sub: `${d.code} · ${d.date}`, open: () => openDoc(d) })),
    ...visibleIssuers(role).map(n => ({ kind: 'ISSUER', label: `${n.tk} · ${n.co}`, sub: `${n.ed} · ${n.status}`, open: () => router.push({ pathname: '/name/[tk]', params: { tk: n.tk } }) })),
  ];
  const results = needle ? pool.filter(r => `${r.label} ${r.sub} ${r.kind}`.toLowerCase().includes(needle)).slice(0, 12) : [];

  return (
    <Screen pad={[14, 18, 28]} gap={10}>
      <TextInput value={q} onChangeText={setQ} placeholder="Instruments, editions, issuers" placeholderTextColor={C.n500} autoFocus
        autoCorrect={false} autoCapitalize="none" returnKeyType="search" accessibilityLabel="Search"
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={[font(400, 16), { height: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: focus ? C.a700 : C.divider, color: C.text }]} />
      <Text style={[font(400, 12), { color: MUTED }]}>
        {needle ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Try “10Y”, “NVDA”, “positioning” or “FX”.'}
      </Text>
      <View>
        {results.map((r, i) => (
          <Tap key={r.kind + r.label + i} onPress={r.open} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.divider }}>
            <Text style={[font(600, 10), { width: 64, letterSpacing: 0.8, color: C.a700 }]}>{r.kind}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[font(500, 15, 1.3), { color: C.text }]}>{r.label}</Text>
              <Text style={[font(400, 12), tabular, { color: MUTED }]}>{r.sub}</Text>
            </View>
          </Tap>
        ))}
      </View>
    </Screen>
  );
}
