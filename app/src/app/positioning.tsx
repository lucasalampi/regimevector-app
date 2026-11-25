import { useState } from 'react';
import { Text, View } from 'react-native';
import { openDoc } from '@/components/edition';
import { OutlineButton, Screen, Seg } from '@/components/ui';
import { POSITIONING } from '@/data';
import { C, font, MUTED, tabular } from '@/theme';

const BOOKS = Object.keys(POSITIONING.books);

export default function Positioning() {
  const [who, setWho] = useState(BOOKS[0]);
  return (
    <Screen pad={[14, 18, 28]} gap={16}>
      <Text style={[font(400, 13), { color: MUTED }]}>Weekly book · Saturday edition for week ending {POSITIONING.weekEnding}</Text>
      <Seg options={BOOKS} value={who} onChange={setWho} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[font(600, 10), { letterSpacing: 0.8, color: MUTED }]}>NET POSITION · 1Y PERCENTILE</Text>
        {POSITIONING.illustrative ? <Text style={[font(600, 10), { letterSpacing: 0.8, color: MUTED }]}>ILLUSTRATIVE</Text> : null}
      </View>
      <View>
        {POSITIONING.books[who].map(([name, v]) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 38, borderTopWidth: 1, borderTopColor: C.divider }}
            accessibilityLabel={`${name}, ${v}th percentile`}>
            <Text style={[font(400, 13), { width: 96, color: C.text }]}>{name}</Text>
            <View style={{ flex: 1, height: 10, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.divider }}>
              <View style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 1, backgroundColor: C.n500 }} />
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(v, 50)}%`, width: `${Math.abs(v - 50)}%`, backgroundColor: v >= 50 ? C.a700 : C.n500 }} />
            </View>
            <Text style={[font(500, 13), tabular, { width: 30, textAlign: 'right', color: C.text }]}>{v}</Text>
          </View>
        ))}
      </View>
      <OutlineButton label="Open executive brief" onPress={() => openDoc({ id: POSITIONING.briefDoc })} />
    </Screen>
  );
}
