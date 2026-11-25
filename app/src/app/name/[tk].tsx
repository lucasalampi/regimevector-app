import { Redirect, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { openDoc } from '@/components/edition';
import { blueprint, PrimaryButton, Screen } from '@/components/ui';
import { docById, ED, visibleIssuers } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED } from '@/theme';

export default function Issuer() {
  const { tk } = useLocalSearchParams<{ tk: string }>();
  const role = useApp(s => s.role);
  const nm = visibleIssuers(role).find(x => x.tk === tk);
  if (!nm) return <Redirect href="/names" />;
  const doc = nm.doc ? docById(nm.doc) : undefined;
  const canOpen = doc && (!doc.internal || role === 'Internal');
  const facts = [
    { k: 'Edition', v: nm.ed }, { k: 'Status', v: nm.status }, { k: 'Programme', v: 'SR-SN 1.0 under ERSM' },
    { k: 'Regime at build', v: ED.regime }, ...(nm.last ? [{ k: `Last close, ${ED.dateShort}`, v: nm.last }] : []),
  ];
  return (
    <Screen gap={18}>
      <View>
        <Text style={[font(700, 42, 1), { letterSpacing: -0.84, color: C.text }]}>{nm.tk}</Text>
        <Text style={[font(400, 15), { color: MUTED }]}>{nm.co}</Text>
      </View>
      <View style={blueprint}>
        {facts.map((f, i) => (
          <View key={f.k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.divider }}>
            <Text style={[font(400, 14), { color: MUTED }]}>{f.k}</Text>
            <Text style={[font(500, 14), { color: C.text, textAlign: 'right', flexShrink: 1 }]}>{f.v}</Text>
          </View>
        ))}
      </View>
      <Text style={[font(400, 14, 1.5), { color: C.n800 }]}>Issuer editions join the macro archive to filings and valuation. Each edition is read against the classified regime on its build date.</Text>
      {canOpen ? <PrimaryButton label="Open edition" onPress={() => openDoc(doc)} />
        : <Text style={[font(600, 11), { letterSpacing: 0.88, textTransform: 'uppercase', color: MUTED, textAlign: 'center' }]}>Edition in build</Text>}
    </Screen>
  );
}
