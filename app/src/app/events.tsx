import { useState } from 'react';
import { Text, View } from 'react-native';
import { openDoc } from '@/components/edition';
import { OutlineButton, Screen, Seg, Tap } from '@/components/ui';
import { MIDDAY_DOC, visibleAlerts } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED } from '@/theme';

const FILTERS = ['All', 'Event', 'Policy', 'Geo'] as const;

export default function Events() {
  const role = useApp(s => s.role);
  const read = useApp(s => s.read);
  const markRead = useApp(s => s.markRead);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const alerts = visibleAlerts(role).filter(a => filter === 'All' || a.type === filter);

  return (
    <Screen pad={[14, 18, 28]} gap={14}>
      <Seg options={FILTERS} value={filter} onChange={setFilter} />
      <View>
        {alerts.map(a => {
          const unread = !read.includes(a.id);
          return (
            <Tap key={a.id} onPress={() => markRead(a.id)} accessibilityLabel={`${unread ? 'Unread. ' : ''}${a.type}, ${a.when}. ${a.t}. ${a.b}`}
              style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}>
              <View style={{ width: 8, height: 8, marginTop: 5, borderWidth: 1, borderColor: C.a700, backgroundColor: unread ? C.a700 : 'transparent' }} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[font(600, 10), { letterSpacing: 0.8, textTransform: 'uppercase', color: C.a700 }]}>{a.type}{a.internal ? ' · Internal' : ''}</Text>
                  <Text style={[font(600, 10), { letterSpacing: 0.8, textTransform: 'uppercase', color: MUTED }]}>{a.when}</Text>
                </View>
                <Text style={[font(500, 15, 1.3), { marginTop: 2, color: C.text }]}>{a.t}</Text>
                <Text style={[font(400, 13, 1.45), { color: MUTED }]}>{a.b}</Text>
              </View>
            </Tap>
          );
        })}
      </View>
      <OutlineButton label="Open mid-day orientation note" onPress={() => openDoc({ id: MIDDAY_DOC })} />
    </Screen>
  );
}
