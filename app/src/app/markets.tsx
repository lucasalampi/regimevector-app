import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { TransmissionMap } from '@/components/charts';
import { ChevronRight } from '@/components/icons';
import { blueprint, Kicker, Tap } from '@/components/ui';
import { DIM_LINKS, ED, GROUPS, rowByKey, TRANSMISSION } from '@/data';
import { MarketsMonitor } from '@/components/terminal/Monitor';
import { useTerminal } from '@/lib/terminal';
import { useApp } from '@/store';
import { C, changeColor, font, LEVEL_TINT, MUTED, tabular } from '@/theme';

const openRow = (key: string) => {
  const r = rowByKey(key);
  if (r) router.push({ pathname: '/asset', params: { group: r.gk, sym: r.s } });
};

export default function Markets() {
  if (useTerminal()) return <MarketsMonitor />;
  return <MobileMarkets />;
}

function MobileMarkets() {
  const internal = useApp(s => s.role) === 'Internal';
  const mapStyle = useApp(s => s.mapStyle);
  const scroll = useRef<ScrollViewInstance>(null);
  const anchors = useRef<Record<string, number>>({});
  const jump = (k: string) => scroll.current?.scrollTo({ y: Math.max(0, (anchors.current[k] ?? 0) - 8), animated: true });
  const mark = (k: string) => ({ onLayout: (e: { nativeEvent: { layout: { y: number } } }) => { anchors.current[k] = e.nativeEvent.layout.y; } });

  return (
    <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: 28, gap: 24 }}>
      {/* contextual navigation */}
      <View style={styles.jumpBar} accessibilityRole="tablist">
        {([['dims', 'Dimensions'], ['cross', 'Cross-asset'], ['map', 'Transmission']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => jump(k)} accessibilityRole="link" style={({ pressed }) => [styles.jump, pressed && { backgroundColor: C.a100 }]}>
            <Text style={[font(500, 12), { color: C.text }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 8 }} {...mark('dims')}>
        <View style={styles.headRow}>
          <Kicker>Regime dimensions</Kicker>
          <Text style={styles.meta}>Tap to open</Text>
        </View>
        <View style={[blueprint, { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {ED.dims.map((d, i) => {
            const flagged = d.bd < 0.1;
            const [bg, ink] = LEVEL_TINT[d.level] ?? LEVEL_TINT.AMBER;
            const lastRow = i >= ED.dims.length - (ED.dims.length % 2 || 2);
            const link = DIM_LINKS[d.name];
            const body = (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[font(400, 11), { color: MUTED }]}>{d.name}</Text>
                  {link ? <ChevronRight size={12} color={C.n500} /> : null}
                </View>
                <Text style={[font(700, 14, 1.15), { color: internal ? ink : flagged ? C.gold : C.navy }]}>{d.tag}{flagged ? ' †' : ''}</Text>
                <Text style={[font(400, 11, 1.35), tabular, { color: MUTED }]}>{d.data}</Text>
                {internal ? <Text style={[font(400, 11), tabular, { color: MUTED }]}>Boundary dist. {d.bd.toFixed(3)} · {d.level}</Text> : null}
              </>
            );
            const cell = { width: '50%' as const, paddingVertical: 10, paddingHorizontal: 12, borderColor: C.divider, borderRightWidth: i % 2 === 0 ? 1 : 0, borderBottomWidth: lastRow ? 0 : 1, backgroundColor: internal ? bg : '#fff' };
            return link
              ? <Tap key={d.name} onPress={() => openRow(link)} accessibilityLabel={`${d.name}: ${d.tag}. Open ${rowByKey(link)?.s}`} style={cell}>{body}</Tap>
              : <View key={d.name} style={cell}>{body}</View>;
          })}
        </View>
        <Text style={[font(400, 11), { color: MUTED }]}>† Boundary-flagged. Edition {ED.n}, {ED.dateShort} {ED.date.slice(0, 4)}.</Text>
      </View>

      <View style={{ gap: 10 }} {...mark('cross')}>
        <View style={styles.headRow}>
          <Kicker>Cross-asset · close {ED.dateShort}</Kicker>
          <Text style={styles.meta}>{GROUPS.reduce((n, g) => n + g.rows.length, 0)} instruments</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {GROUPS.map(g => {
            const subs = [...new Set(g.rows.map(r => r.sub).filter(Boolean))];
            return (
              <View key={g.id} style={[blueprint, { width: '47%', flexGrow: 1 }]}>
                <Text style={[font(700, 15, 1), { color: C.text, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 4 }]}>{g.name}</Text>
                {g.rows.slice(0, 3).map(r => (
                  <Tap key={r.s} onPress={() => router.push({ pathname: '/asset', params: { group: g.id, sym: r.s } })} accessibilityLabel={`${r.s} ${r.val}`}
                    style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                      <Text style={[font(400, 13), { color: MUTED, flexShrink: 1 }]} numberOfLines={1}>{r.s}</Text>
                      <Text style={[font(500, 13), tabular, { color: C.text }]}>{r.val}</Text>
                    </View>
                    {r.chg ? <Text style={[font(400, 10), tabular, { color: changeColor(r.chg), textAlign: 'right' }]}>{r.chg}</Text> : null}
                  </Tap>
                ))}
                <Tap onPress={() => router.push({ pathname: '/asset', params: { group: g.id } })} accessibilityLabel={`All ${g.name} instruments`}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.divider }}>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={[font(600, 11), { color: C.a700 }]}>{g.rows.length} instruments</Text>
                    {subs.length > 1 ? <Text style={[font(400, 10, 1.3), { color: C.n500 }]} numberOfLines={2}>{subs.join(' · ')}</Text> : null}
                  </View>
                  <ChevronRight size={14} color={C.a700} />
                </Tap>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }} {...mark('map')}>
        <View style={styles.headRow}>
          <Kicker>Transmission map</Kicker>
          <Text style={styles.meta}>{TRANSMISSION.window} editions · daily changes</Text>
        </View>
        <TransmissionMap style={mapStyle} onOpenNode={openRow} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  jumpBar: { flexDirection: 'row', gap: 8 },
  jump: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.divider, backgroundColor: '#fff' },
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  meta: { ...font(600, 10), letterSpacing: 0.8, textTransform: 'uppercase', color: C.n500, flexShrink: 1, textAlign: 'right' },
});
