import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { openDoc } from '@/components/edition';
import { ChevronRight } from '@/components/icons';
import { Kicker, PrimaryButton, Screen } from '@/components/ui';
import { ED, rowByKey, todaysBrief, todaysMidday, todaysResearch, visibleAlerts, visibleThemes, type Alert, type Theme } from '@/data';
import { useApp } from '@/store';
import { C, changeColor, font, MUTED, tabular } from '@/theme';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayLabel = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

const openKey = (key: string) => { const r = rowByKey(key); if (r) router.push({ pathname: '/asset', params: { group: r.gk, sym: r.s } }); };

/** Live instrument chip: level and latest move, opens the drill-down. */
function InstrumentChip({ k, now }: { k: string; now?: boolean }) {
  const r = rowByKey(k);
  if (!r) return null;
  return (
    <Pressable onPress={() => openKey(k)} accessibilityRole="link" accessibilityLabel={`${r.s} ${now ? 'now ' : ''}${r.val}`}
      style={({ pressed }) => [styles.chip, pressed && { backgroundColor: C.a100 }]}>
      {now ? <Text style={[font(700, 8), { letterSpacing: 0.6, color: C.n500 }]}>NOW</Text> : null}
      <Text style={[font(500, 11), { color: C.text }]} numberOfLines={1}>{r.s}</Text>
      <Text style={[font(600, 11), tabular, { color: C.text }]}>{r.val}</Text>
      {r.chg ? <Text style={[font(500, 10), tabular, { color: changeColor(r.chg) }]}>{r.chg}</Text>
        : r.asof ? <Text style={[font(400, 10), { color: C.n500 }]}>as of {r.asof.slice(8)}/{r.asof.slice(5, 7)}</Text> : null}
      <ChevronRight size={11} color={C.n500} />
    </Pressable>
  );
}

function ThemeCard({ theme, count, unread, on, onPress }: { theme: Theme | null; count: number; unread: number; on: boolean; onPress: () => void }) {
  const key = theme?.key ? rowByKey(theme.key) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}
      accessibilityLabel={`${theme ? theme.name : 'All themes'}, ${count} items, ${unread} unread`}
      style={[styles.theme, on && { backgroundColor: C.navy, borderColor: C.navy }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, backgroundColor: theme?.color ?? C.gold }} />
        <Text style={[font(600, 12), { color: on ? '#fff' : C.text, flexShrink: 1 }]} numberOfLines={1}>{theme ? theme.short : 'All themes'}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={[font(700, 18), tabular, { color: on ? '#fff' : C.text }]}>{count}</Text>
        <Text style={[font(400, 11), { color: on ? C.a400 : MUTED }]}>{unread ? `${unread} new` : 'read'}</Text>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: on ? C.navyLine : C.divider, paddingTop: 5, marginTop: 2 }}>
        <Text style={[font(400, 10), { color: on ? C.a400 : MUTED }]} numberOfLines={1}>{key ? key.s : theme ? 'Internal log' : `${ED.dateShort} · Edition ${ED.n}`}</Text>
        {key ? (
          <Text style={[font(600, 11), tabular, { color: on ? '#fff' : C.text }]} numberOfLines={1}>
            {key.val}{key.chg ? <Text style={{ color: on ? C.a400 : changeColor(key.chg) }}>  {key.chg}</Text> : null}
          </Text>
        ) : <Text style={[font(600, 11), { color: on ? '#fff' : C.text }]}> </Text>}
      </View>
    </Pressable>
  );
}

function EventItem({ a, theme, unread, onRead }: { a: Alert; theme?: Theme; unread: boolean; onRead: () => void }) {
  // Chips show live levels; on earlier days, say so.
  const past = a.date !== ED.date;
  return (
    <Pressable onPress={onRead} accessibilityLabel={`${unread ? 'Unread. ' : ''}${theme?.name}. ${a.t}. ${a.b}`}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: C.a100 }]}>
      <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: theme?.color ?? C.a300 }} />
      <View style={{ flex: 1, gap: 4, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.itemKicker, { color: theme?.color ?? C.a700 }]} numberOfLines={1}>{theme?.short ?? a.theme}</Text>
          <Text style={styles.itemKickerMuted}>· {a.type}</Text>
          {a.internal ? <View style={styles.internal}><Text style={[font(700, 8), { color: C.noticeInk, letterSpacing: 0.6 }]}>INTERNAL</Text></View> : null}
          {unread ? <View style={styles.unread} accessibilityLabel="unread" /> : null}
        </View>
        <Text style={[font(unread ? 600 : 500, 15, 1.3), { color: C.text }]}>{a.t}</Text>
        <Text style={[font(400, 13, 1.45), { color: MUTED }]}>{a.b}</Text>
        {a.links?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>{a.links.map(k => <InstrumentChip key={k} k={k} now={past} />)}</View> : null}
      </View>
    </Pressable>
  );
}

export default function Events() {
  const role = useApp(s => s.role);
  const read = useApp(s => s.read);
  const markRead = useApp(s => s.markRead);
  const markAllRead = useApp(s => s.markAllRead);
  const [themeId, setThemeId] = useState<string | null>(null);

  const themes = visibleThemes(role);
  const all = visibleAlerts(role).filter(a => themes.some(t => t.id === a.theme));
  const shown = all.filter(a => !themeId || a.theme === themeId);
  const byId = Object.fromEntries(themes.map(t => [t.id, t]));
  const unreadOf = (xs: Alert[]) => xs.filter(a => !read.includes(a.id)).length;
  const days = useMemo(() => [...new Set(shown.map(a => a.date))].sort().reverse(), [shown]);
  const midday = todaysMidday(role);
  const brief = todaysBrief(role);
  const research = todaysResearch(role)[0];

  return (
    <Screen pad={[14, 0, 28]} gap={18}>
      {/* Themes */}
      <View style={{ gap: 10 }}>
        <View style={[styles.headRow, { paddingHorizontal: 18 }]}>
          <Kicker>Themes · {ED.dateShort}</Kicker>
          {unreadOf(all) ? (
            <Pressable onPress={() => markAllRead(all.map(a => a.id))} hitSlop={8} accessibilityRole="button">
              <Text style={[font(600, 11), { color: C.a700, textDecorationLine: 'underline' }]}>Mark all read</Text>
            </Pressable>
          ) : <Text style={styles.meta}>All read</Text>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 18 }} accessibilityRole="tablist">
          <ThemeCard theme={null} count={all.length} unread={unreadOf(all)} on={!themeId} onPress={() => setThemeId(null)} />
          {themes.map(t => {
            const xs = all.filter(a => a.theme === t.id);
            return xs.length ? <ThemeCard key={t.id} theme={t} count={xs.length} unread={unreadOf(xs)} on={themeId === t.id} onPress={() => setThemeId(themeId === t.id ? null : t.id)} /> : null;
          })}
        </ScrollView>
        {themeId && byId[themeId]?.key ? (
          <View style={{ paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[font(400, 12), { color: MUTED }]}>Tracking</Text>
            <InstrumentChip k={byId[themeId].key!} />
          </View>
        ) : null}
      </View>

      {/* Feed, by day */}
      <View style={{ paddingHorizontal: 18 }}>
        {days.map(day => {
          const items = shown.filter(a => a.date === day);
          const today = day === ED.date;
          return (
            <View key={day} style={{ marginBottom: 14 }}>
              <View style={[styles.dayBar, today && { borderTopColor: C.gold }]}>
                <Text style={[font(700, 11), { letterSpacing: 0.9, textTransform: 'uppercase', color: '#fff' }]}>{today ? 'Today · ' : ''}{dayLabel(day)}</Text>
                <Text style={[font(400, 10), { color: C.a400 }]}>{today ? `Edition ${ED.n} · ` : ''}{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
              </View>
              {items.map(a => <EventItem key={a.id} a={a} theme={byId[a.theme]} unread={!read.includes(a.id)} onRead={() => markRead(a.id)} />)}
            </View>
          );
        })}
        {!shown.length ? <Text style={[font(400, 14), { color: MUTED, textAlign: 'center', paddingVertical: 40 }]}>Nothing in this theme yet.</Text> : null}
      </View>

      {/* Today's edition: the mid-day note only on its own day; otherwise the daily brief and the archive */}
      <View style={styles.edition}>
        <Text style={[font(700, 9), { letterSpacing: 0.9, color: C.gold }]}>TODAY'S EDITION · {ED.dateShort.toUpperCase()}</Text>
        {midday ? (
          <>
            <Text style={[font(600, 15, 1.3), { color: C.text }]}>{midday.title}</Text>
            <Text style={[font(400, 12), { color: MUTED }]}>{midday.code} · published {midday.date}</Text>
            <PrimaryButton label="Open mid-day orientation note" onPress={() => openDoc(midday)} />
          </>
        ) : (
          <>
            <Text style={[font(400, 13, 1.45), { color: MUTED }]}>
              No mid-day orientation note was issued for {ED.dateShort}.{' '}
              {brief ? 'The daily brief carries the session read.' : `The ${ED.dateShort} daily briefs are not in the library yet${research ? `; ${research.code} was published on the close` : ''}.`}
            </Text>
            {brief ? <PrimaryButton label={brief.internal ? 'Open operating-state brief' : "Open today's brief"} onPress={() => openDoc(brief)} />
              : research ? <PrimaryButton label={`Open ${research.code} · ${research.title}`} onPress={() => openDoc(research)} /> : null}
          </>
        )}
        <Pressable onPress={() => router.push({ pathname: '/research', params: { filter: 'Events' } })} accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.divider }}>
          <Text style={[font(500, 13), { color: C.a700 }]}>Event-contingent notes archive</Text>
          <ChevronRight size={14} color={C.a700} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  meta: { ...font(600, 10), letterSpacing: 0.8, textTransform: 'uppercase', color: C.n500 },
  theme: { width: 132, gap: 4, padding: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider },
  dayBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 7, paddingHorizontal: 12, backgroundColor: C.navyMid, borderTopWidth: 2, borderTopColor: C.navyMid },
  item: { flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: C.divider, backgroundColor: 'transparent', paddingRight: 4 },
  itemKicker: { ...font(700, 10), letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1 },
  itemKickerMuted: { ...font(500, 10), letterSpacing: 0.6, textTransform: 'uppercase', color: C.n500 },
  internal: { paddingHorizontal: 4, paddingVertical: 1, backgroundColor: C.noticeBg, borderWidth: 1, borderColor: '#e7d6a8' },
  unread: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold, marginLeft: 'auto' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider },
  edition: { marginHorizontal: 18, gap: 10, padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider, borderLeftWidth: 3, borderLeftColor: C.gold },
});
