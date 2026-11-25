import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RegimeChart } from '@/components/charts';
import { Star } from '@/components/icons';
import { Screen, Seg, Tap } from '@/components/ui';
import { ARCHIVE, GROUPS, SERIES } from '@/data';
import { useApp } from '@/store';
import { C, changeColor, font, tabular } from '@/theme';

const RANGES = ['1M', '3M', 'All'] as const;
const SPAN: Record<(typeof RANGES)[number], number> = { '1M': 21, '3M': 63, All: Infinity };

export default function Asset() {
  const params = useLocalSearchParams<{ group?: string; sym?: string }>();
  const [groupId, setGroupId] = useState(GROUPS.some(g => g.id === params.group) ? params.group! : GROUPS[0].id);
  const [sym, setSym] = useState<string | undefined>(params.sym);
  const [range, setRange] = useState<(typeof RANGES)[number]>('All');
  const chartStyle = useApp(s => s.chartStyle);
  const watch = useApp(s => s.watch);
  const toggleWatch = useApp(s => s.toggleWatch);

  const g = GROUPS.find(x => x.id === groupId)!;
  const row = g.rows.find(r => r.s === sym) ?? g.rows[0];
  const N = ARCHIVE.n, n = Math.min(N, SPAN[range]);
  const data = SERIES[row.k].slice(N - n);
  const dp = row.v < 10 ? (row.v < 2 ? 4 : 2) : row.v > 1000 ? 0 : 2;

  return (
    <Screen pad={[14, 18, 28]} gap={16}>
      <Seg options={GROUPS.map(x => x.name)} value={g.name} onChange={name => { setGroupId(GROUPS.find(x => x.name === name)!.id); setSym(undefined); }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={[font(400, 12), { color: C.n700 }]}>{row.s}</Text>
          <Text style={[font(700, 29, 1), tabular, { color: C.text }]}>{row.val}</Text>
        </View>
        <Seg options={RANGES} value={range} onChange={setRange} height={32} size={12} itemWidth={44} />
      </View>
      <RegimeChart data={data} start={N - n} dp={dp} style={chartStyle} />
      <View>
        {g.rows.map(r => {
          const on = r.s === row.s;
          const starred = watch.includes(r.s);
          return (
            <Tap key={r.s} onPress={() => setSym(r.s)} accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderTopWidth: 1, borderTopColor: C.divider, paddingLeft: 8, paddingRight: 4, marginHorizontal: -8, backgroundColor: on ? C.a100 : 'transparent' }}>
              <Text style={[font(500, 15), { flex: 1, color: C.text }]}>{r.s}</Text>
              <Text style={[font(500, 13), tabular, { color: changeColor(r.chg) }]}>{r.chg ?? ''}</Text>
              <Text style={[font(500, 15), tabular, { width: 86, textAlign: 'right', color: C.text }]}>{r.val}</Text>
              <Pressable onPress={() => toggleWatch(r.s)} accessibilityRole="button" accessibilityLabel={starred ? `Remove ${r.s} from watchlist` : `Add ${r.s} to watchlist`}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Star fill={starred ? C.a700 : 'none'} />
              </Pressable>
            </Tap>
          );
        })}
      </View>
    </Screen>
  );
}
