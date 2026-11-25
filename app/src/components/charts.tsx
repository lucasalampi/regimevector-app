import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TRANSMISSION } from '@/data';
import type { MapStyle } from '@/store';
import { alpha, C, font, MUTED, tabular } from '@/theme';

const sgn = (v: number) => (v > 0 ? '+' : '−') + Math.abs(v).toFixed(2);
const cellBg = (v: number) => (v >= 0 ? alpha(C.a700, v) : alpha(C.down, -v));

/** Correlation of daily changes across the six transmission nodes. */
export function TransmissionMap({ style }: { style: MapStyle }) {
  const { nodes, matrix } = TRANSMISSION;
  const [cell, setCell] = useState<[number, number]>([4, 5]);

  if (style === 'Ranked') {
    const links: [number, number, number][] = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) links.push([i, j, matrix[i][j]]);
    links.sort((a, b) => Math.abs(b[2]) - Math.abs(a[2]));
    return (
      <View>
        {links.slice(0, 8).map(([i, j, v]) => (
          <View key={`${i}-${j}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, borderTopWidth: 1, borderTopColor: C.divider }}>
            <Text style={[font(400, 13), tabular, { width: 112, color: C.text }]}>{nodes[i]} ↔ {nodes[j]}</Text>
            <View style={{ flex: 1 }}><View style={{ height: 8, width: `${Math.abs(v) * 100}%`, backgroundColor: v >= 0 ? C.a700 : C.down }} /></View>
            <Text style={[font(500, 13), tabular, { width: 44, textAlign: 'right', color: C.text }]}>{sgn(v)}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          <View style={{ width: 52 }} />
          {nodes.map(n => <Text key={n} style={[font(500, 11), { flex: 1, textAlign: 'center', color: MUTED, paddingBottom: 2 }]}>{n}</Text>)}
        </View>
        {nodes.map((name, i) => (
          <View key={name} style={{ flexDirection: 'row', gap: 2 }}>
            <Text style={[font(500, 11), { width: 52, alignSelf: 'center', color: MUTED }]}>{name}</Text>
            {nodes.map((col, j) => {
              const sel = cell[0] === i && cell[1] === j;
              return (
                <Pressable key={col} disabled={i === j} onPress={() => setCell([i, j])} accessibilityLabel={`${name} to ${col} ${sgn(matrix[i][j])}`}
                  style={{ flex: 1, aspectRatio: 1, borderWidth: 1, borderColor: C.divider, backgroundColor: i === j ? 'transparent' : cellBg(matrix[i][j]) }}>
                  {sel ? <View style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderWidth: 2, borderColor: C.text }} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[font(500, 14), tabular, { color: C.text }]}>{nodes[cell[0]]} → {nodes[cell[1]]}  {sgn(matrix[cell[0]][cell[1]])}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, backgroundColor: C.a700 }} /><Text style={[font(400, 12), { color: MUTED }]}>with</Text>
          <View style={{ width: 10, height: 10, backgroundColor: C.down }} /><Text style={[font(400, 12), { color: MUTED }]}>against</Text>
        </View>
      </View>
    </>
  );
}
