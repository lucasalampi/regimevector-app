import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ISSUERS, visibleAlerts } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED, ON } from '@/theme';
import { Bell, ChevronLeft, FileText, Grid, Menu, Search, Sun } from './icons';

export const TABS = [
  { path: '/', label: 'Today', Icon: Sun },
  { path: '/markets', label: 'Markets', Icon: Grid },
  { path: '/research', label: 'Research', Icon: FileText },
  { path: '/events', label: 'Events', Icon: Bell },
  { path: '/more', label: 'More', Icon: Menu },
] as const;

const TITLES: Record<string, string> = {
  '/': 'RegimeVector', '/markets': 'Markets', '/research': 'Research', '/events': 'Events', '/more': 'More',
  '/asset': 'Drill-down', '/reader': 'Reader', '/viewer': 'Edition', '/positioning': 'Positioning', '/watchlist': 'Watchlist',
  '/names': 'Single-name', '/name': 'Issuer', '/search': 'Search', '/settings': 'Settings',
};

const isTab = (p: string) => TABS.some(t => t.path === p);

/** Switch tabs the way the prototype does: clear any pushed screens, then show the tab root. */
export function goTab(path: string) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(path as never);
}

export function Masthead() {
  const path = usePathname();
  const role = useApp(s => s.role);
  const insets = useSafeAreaInsets();
  const seg = '/' + (path.split('/')[1] ?? '');
  let title = TITLES[seg] ?? 'RegimeVector';
  if (seg === '/name') {
    const tk = decodeURIComponent(path.split('/')[2] ?? '');
    title = ISSUERS.find(i => i.tk === tk)?.tk ?? title;
  }
  // Every non-tab screen is pushed from a tab; a deep-linked one falls back to Today.
  const canBack = !isTab(path);
  return (
    <View style={{ backgroundColor: C.navy, paddingTop: insets.top }}>
      <View style={styles.bar}>
        {canBack ? (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : goTab('/'))} accessibilityRole="button" accessibilityLabel="Back"
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.icon, { marginLeft: -12 }, (pressed || hovered) && styles.iconOn]}>
            <ChevronLeft />
          </Pressable>
        ) : null}
        <Text numberOfLines={1} accessibilityRole="header" style={[styles.title, { color: path === '/' ? C.gold : '#fff' }]}>{title}</Text>
        <View style={styles.role}><Text style={styles.roleText}>{role}</Text></View>
        <Pressable onPress={() => path !== '/search' && router.push('/search')} accessibilityRole="button" accessibilityLabel="Search"
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.icon, (pressed || hovered) && styles.iconOn]}>
          <Search />
        </Pressable>
      </View>
    </View>
  );
}

export function TabBar() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const role = useApp(s => s.role);
  const read = useApp(s => s.read);
  const unread = visibleAlerts(role).filter(a => !read.includes(a.id)).length;
  return (
    <View style={[styles.tabs, { paddingBottom: insets.bottom, height: 60 + insets.bottom }]} accessibilityRole="tablist">
      {TABS.map(({ path: p, label, Icon }) => {
        const on = path === p;
        const color = on ? ON : MUTED;
        return (
          <Pressable key={p} onPress={() => goTab(p)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
            style={[styles.tab, { borderTopColor: on ? ON : 'transparent' }]}>
            <Icon color={color} />
            <Text style={[font(500, 11), { color }]}>{label}</Text>
            {p === '/events' && unread > 0 ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 12, borderBottomWidth: 2, borderBottomColor: C.gold },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: 'rgba(255,255,255,.12)' },
  title: { flex: 1, minWidth: 0, ...font(700, 18, 1), letterSpacing: -0.18 },
  role: { borderWidth: 1, borderColor: C.navyLine, paddingVertical: 3, paddingHorizontal: 7 },
  roleText: { ...font(600, 10), letterSpacing: 0.8, textTransform: 'uppercase', color: C.navyInk },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.divider },
  tab: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'center', gap: 3, borderTopWidth: 2, marginTop: -1 },
  badge: { position: 'absolute', top: 8, left: '50%', marginLeft: 6, minWidth: 16, height: 16, paddingHorizontal: 4, backgroundColor: C.a700, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...font(600, 10, 1.6), color: '#fff' },
});
