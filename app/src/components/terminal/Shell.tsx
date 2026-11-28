// Terminal chrome for computers: status bar + ticker, navigation rail, command palette, shortcut help.
import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { goTab } from '@/components/Chrome';
import { openDoc } from '@/components/edition';
import { Bell, FileText, Grid, Menu, Search, Star, Sun } from '@/components/icons';
import { ALL_ROWS, ED, REGIMES, rowByKey, visibleAlerts, visibleDocs, visibleIssuers, type FlatRow } from '@/data';
import { useApp } from '@/store';
import { alpha, C, changeColor, font, MUTED, tabular } from '@/theme';
import { typing } from '@/lib/terminal';

export const RAIL = [
  { path: '/', label: 'Today', key: 't', Icon: Sun },
  { path: '/markets', label: 'Markets', key: 'm', Icon: Grid },
  { path: '/asset', label: 'Drill-down', key: 'd', Icon: Grid },
  { path: '/events', label: 'Events', key: 'e', Icon: Bell },
  { path: '/research', label: 'Research', key: 'r', Icon: FileText },
  { path: '/positioning', label: 'Positioning', key: 'p', Icon: Menu },
  { path: '/watchlist', label: 'Watchlist', key: 'w', Icon: Star },
  { path: '/names', label: 'Single-name', key: 'n', Icon: FileText },
  { path: '/settings', label: 'Settings', key: 's', Icon: Menu },
] as const;

/** Key levels across the top of the terminal (click to open in Drill-down). */
const TICKER = ['usy2', 'usy10', 'usy30', 'x_2s10s', 'fed_hike_prob_dec', 'dxy', 'eurusd', 'usdjpy', 'usdcad', 'spx', 'nasdaq', 'russell2k', 'vix', 'credit_hy_oas', 'wti', 'brent', 'gold'];

const openRow = (r: Pick<FlatRow, 'gk' | 's'>) => router.push({ pathname: '/asset', params: { group: r.gk, sym: r.s } });
const go = (path: string) => (path === '/asset' ? router.push('/asset') : goTab(path));

function StatusBar({ onSearch }: { onSearch: () => void }) {
  const role = useApp(s => s.role), setRole = useApp(s => s.setRole);
  const internal = role === 'Internal';
  const cur = REGIMES[REGIMES.length - 1];
  const weights = ED.scenarios.cells.map(c => Math.round(c.v * 100)).join(' / ');
  return (
    <View style={s.status}>
      <Pressable onPress={() => goTab('/')} accessibilityRole="link" accessibilityLabel="RegimeVector home">
        <Text style={[font(700, 16), { color: C.gold, letterSpacing: -0.2 }]}>RegimeVector</Text>
      </Pressable>
      <Text style={s.sep}>│</Text>
      <Text style={[s.dim, s.fixed]} numberOfLines={1}>{ED.dateShort} {ED.date.slice(0, 4)} · Day {ED.day} · Ed. {ED.n}</Text>
      <Text style={s.sep}>│</Text>
      <View style={{ width: 9, height: 9, backgroundColor: cur.solid }} />
      <Text style={[font(600, 13), { color: '#fff', flexShrink: 1, minWidth: 80 }]} numberOfLines={1}>{ED.regime}</Text>
      {internal && ED.tenure != null ? <Text style={[s.dim, s.fixed]} numberOfLines={1}>tenure {ED.tenure}</Text> : null}
      <Text style={s.sep}>│</Text>
      <Text style={[s.dim, s.fixed]} numberOfLines={1}>Scenarios {weights}</Text>
      {internal && ED.weakest ? <><Text style={s.sep}>│</Text><Text style={[s.dim, s.fixed, { color: '#e8c97a' }]} numberOfLines={1}>Weakest: {ED.weakest.name} {ED.weakest.bd.toFixed(3)}</Text></> : null}
      <View style={{ flex: 1, minWidth: 8 }} />
      <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel="Search (Ctrl K)"
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.search, hovered && { borderColor: C.navyInk }]}>
        <Search size={15} color={C.navyInk} />
        <Text style={[font(400, 12), { color: C.navyInk }]} numberOfLines={1}>Search everything</Text>
        <Text style={s.kbd}>Ctrl K</Text>
      </Pressable>
      <Pressable onPress={() => setRole(internal ? 'Client' : 'Internal')} accessibilityRole="button" accessibilityLabel={`Role ${role}; switch`}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.role, hovered && { backgroundColor: 'rgba(255,255,255,.08)' }]}>
        <Text style={[font(600, 10), { letterSpacing: 0.8, color: C.navyInk, textTransform: 'uppercase' }]}>{role}</Text>
      </Pressable>
    </View>
  );
}

function Ticker() {
  const rows = TICKER.map(k => rowByKey(k)).filter((r): r is FlatRow => !!r);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.ticker} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 12 }}>
      {rows.map(r => (
        <Pressable key={r.k} onPress={() => openRow(r)} accessibilityRole="link" accessibilityLabel={`${r.s} ${r.val} ${r.chg ?? ''}`}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.tick, hovered && { backgroundColor: C.a100 }]}>
          <Text style={[font(500, 11), { color: MUTED }]}>{r.s}</Text>
          <Text style={[font(600, 12), tabular, { color: C.text }]}>{r.val}</Text>
          <Text style={[font(500, 11), tabular, { color: r.asof ? C.n500 : changeColor(r.chg) }]}>{r.asof ? 'as of' : r.chg ?? ''}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Rail({ onHelp }: { onHelp: () => void }) {
  const path = usePathname();
  const role = useApp(st => st.role), read = useApp(st => st.read);
  const unread = visibleAlerts(role).filter(a => !read.includes(a.id)).length;
  const seg = '/' + (path.split('/')[1] ?? '');
  const active = (p: string) => (p === '/' ? path === '/' : seg === p || (p === '/research' && (seg === '/reader' || seg === '/viewer')) || (p === '/names' && seg === '/name'));
  return (
    <View style={s.rail} accessibilityRole="tablist">
      {RAIL.map(({ path: p, label, key, Icon }) => {
        const on = active(p);
        return (
          <Pressable key={p} onPress={() => go(p)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${label} (g then ${key})`}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.item, on && s.itemOn, !on && hovered && { backgroundColor: C.a100 }]}>
            <Icon size={17} color={on ? C.a700 : MUTED} />
            <Text style={[font(on ? 600 : 500, 13), { color: on ? C.a700 : C.text, flex: 1 }]}>{label}</Text>
            {p === '/events' && unread ? <View style={s.badge}><Text style={[font(600, 10), { color: '#fff' }]}>{unread}</Text></View> : null}
            <Text style={s.hint}>g {key}</Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <Pressable onPress={onHelp} accessibilityRole="button" style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [s.item, hovered && { backgroundColor: C.a100 }]}>
        <Text style={[font(500, 12), { color: MUTED, flex: 1 }]}>Keyboard shortcuts</Text><Text style={s.hint}>?</Text>
      </Pressable>
      <Text style={[font(400, 10, 1.4), { color: C.n500, paddingHorizontal: 14, paddingBottom: 12 }]}>Edition {ED.n} · {ED.dateShort}. Descriptive research, not investment advice.</Text>
    </View>
  );
}

// ---------- command palette ----------
interface Hit { id: string; kind: string; title: string; sub: string; right?: string; rightColor?: string; run: () => void }

function useIndex(): Hit[] {
  const role = useApp(st => st.role);
  return useMemo(() => [
    ...RAIL.map(r => ({ id: 'nav' + r.path, kind: 'Screen', title: r.label, sub: `g ${r.key}`, run: () => go(r.path) })),
    ...ALL_ROWS.map(r => ({ id: 'row' + r.gk + r.s, kind: 'Instrument', title: r.s, sub: `${r.group}${r.sub ? ' › ' + r.sub : ''}`, right: `${r.val}  ${r.asof ? 'as of' : r.chg ?? ''}`, rightColor: changeColor(r.chg), run: () => openRow(r) })),
    ...visibleDocs(role).map(d => ({ id: 'doc' + d.id, kind: 'Research', title: d.title, sub: `${d.code} · ${d.date}${d.internal ? ' · Internal' : ''}`, run: () => openDoc(d) })),
    ...visibleIssuers(role).map(i => ({ id: 'iss' + i.tk, kind: 'Issuer', title: `${i.tk} · ${i.co}`, sub: i.status, run: () => router.push({ pathname: '/name/[tk]', params: { tk: i.tk } }) })),
  ], [role]);
}

function score(h: Hit, q: string) {
  const t = h.title.toLowerCase(), all = `${t} ${h.sub.toLowerCase()} ${h.kind.toLowerCase()}`;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every(w => all.includes(w))) return -1;
  return (t.startsWith(words[0]) ? 3 : t.includes(words[0]) ? 2 : 1) + (h.kind === 'Screen' ? 0.5 : 0) - t.length / 200;
}

function Palette({ onClose }: { onClose: () => void }) {
  const index = useIndex();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const hits = useMemo(() => (q.trim() ? index.map(h => ({ h, v: score(h, q) })).filter(x => x.v >= 0).sort((a, b) => b.v - a.v).map(x => x.h) : index.filter(h => h.kind === 'Screen')).slice(0, 12), [q, index]);
  useEffect(() => setSel(0), [q]);
  const run = (h?: Hit) => { if (!h) return; onClose(); h.run(); };
  return (
    <Overlay onClose={onClose}>
      <View style={[s.panel, { width: 640 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.divider }}>
          <Search size={17} color={MUTED} />
          <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Search instruments, research, issuers, screens…" placeholderTextColor={C.n500}
            style={[font(400, 16), { flex: 1, height: 52, color: C.text, outlineStyle: 'none' } as object]}
            onKeyPress={e => {
              const k = (e.nativeEvent as { key: string }).key;
              if (k === 'ArrowDown') { setSel(i => Math.min(hits.length - 1, i + 1)); (e as unknown as { preventDefault(): void }).preventDefault?.(); }
              else if (k === 'ArrowUp') { setSel(i => Math.max(0, i - 1)); (e as unknown as { preventDefault(): void }).preventDefault?.(); }
              else if (k === 'Enter') run(hits[sel]);
              else if (k === 'Escape') onClose();
            }} />
          <Text style={s.kbdDark}>Esc</Text>
        </View>
        <ScrollView style={{ maxHeight: 460 }}>
          {hits.map((h, i) => (
            <Pressable key={h.id} onPress={() => run(h)} onHoverIn={() => setSel(i)}
              style={[s.hit, i === sel && { backgroundColor: C.a100 }]}>
              <Text style={[font(600, 9), s.kind]}>{h.kind}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[font(i === sel ? 600 : 500, 14), { color: C.text }]} numberOfLines={1}>{h.title}</Text>
                <Text style={[font(400, 11), { color: MUTED }]} numberOfLines={1}>{h.sub}</Text>
              </View>
              {h.right ? <Text style={[font(500, 12), tabular, { color: C.text }]}>{h.right}</Text> : null}
            </Pressable>
          ))}
          {!hits.length ? <Text style={[font(400, 13), { color: MUTED, padding: 18 }]}>No match for “{q}”.</Text> : null}
        </ScrollView>
        <View style={s.paletteFoot}><Text style={[font(400, 11), { color: C.n500 }]}>↑ ↓ to move · Enter to open · Esc to close</Text></View>
      </View>
    </Overlay>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl K  or  /', 'Search everything'],
  ['g then t · m · d · e · r · p · w · n · s', 'Go to Today, Markets, Drill-down, Events, Research, Positioning, Watchlist, Single-name, Settings'],
  ['j / k  or  ↓ / ↑', 'Next / previous instrument (Drill-down) or document (Research)'],
  ['[  /  ]', 'Previous / next instrument group (Drill-down)'],
  ['← / →', 'Step the chart crosshair one session; Esc clears it'],
  ['1 · 3 · a', 'Chart range: 1M, 3M, all'],
  ['o', 'Toggle chart display: Timeline / Overlay'],
  ['w', 'Add or remove the instrument from the watchlist'],
  ['Enter', 'Open the selected document (Research)'],
  ['?', 'This list'],
];

function Help({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <View style={[s.panel, { width: 620, padding: 20, gap: 4 }]}>
        <Text style={[font(700, 16), { color: C.text, marginBottom: 8 }]}>Keyboard shortcuts</Text>
        {SHORTCUTS.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', gap: 16, paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.divider }}>
            <Text style={[font(600, 12), tabular, { width: 210, color: C.a700 }]}>{k}</Text>
            <Text style={[font(400, 13, 1.4), { flex: 1, color: C.text }]}>{v}</Text>
          </View>
        ))}
        <Text style={[font(400, 11), { color: C.n500, marginTop: 8 }]}>Shortcuts pause while you type in a field. Press Esc to close.</Text>
      </View>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <View style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ marginTop: 90 }}>{children}</View>
    </View>
  );
}

/** Terminal frame around the routed screens. */
export function TerminalShell({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const prefix = useRef(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setHelp(false); setPalette(p => !p); return; }
      if (e.key === 'Escape') { setPalette(false); setHelp(false); return; }
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || palette) return;
      if (e.key === '/') { e.preventDefault(); setPalette(true); return; }
      if (e.key === '?') { e.preventDefault(); setHelp(h => !h); return; }
      if (e.key === 'g') { prefix.current = Date.now(); return; }
      if (Date.now() - prefix.current < 1200) {
        const r = RAIL.find(x => x.key === e.key);
        prefix.current = 0;
        if (r) { e.preventDefault(); e.stopImmediatePropagation(); go(r.path); }
      }
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [palette]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar onSearch={() => setPalette(true)} />
      <Ticker />
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        <Rail onHelp={() => setHelp(true)} />
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      </View>
      {palette ? <Palette onClose={() => setPalette(false)} /> : null}
      {help ? <Help onClose={() => setHelp(false)} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  status: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: C.navy, borderBottomWidth: 2, borderBottomColor: C.gold },
  sep: { ...font(400, 13), color: C.navyLine },
  dim: { ...font(400, 12), color: C.navyInk },
  fixed: { flexShrink: 0 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingHorizontal: 10, borderWidth: 1, borderColor: C.navyLine, width: 300, flexShrink: 0 },
  kbd: { ...font(600, 10), color: C.navyInk, borderWidth: 1, borderColor: C.navyLine, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 'auto' },
  kbdDark: { ...font(600, 10), color: MUTED, borderWidth: 1, borderColor: C.divider, paddingHorizontal: 5, paddingVertical: 1 },
  role: { height: 30, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderColor: C.navyLine },
  ticker: { flexGrow: 0, height: 36, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.divider },
  tick: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 10, height: 36, paddingTop: 10, borderRightWidth: 1, borderRightColor: C.a100 },
  rail: { width: 212, flexShrink: 0, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: C.divider, paddingTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 38, paddingHorizontal: 14, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  itemOn: { backgroundColor: C.a100, borderLeftColor: C.gold },
  hint: { ...font(500, 10), color: C.n500, letterSpacing: 0.4 },
  badge: { minWidth: 18, height: 16, paddingHorizontal: 4, backgroundColor: C.a700, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: alpha(C.navy, 0.45), alignItems: 'center', zIndex: 50 },
  panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider, borderTopWidth: 3, borderTopColor: C.gold, maxWidth: '92%' },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.a100 },
  kind: { width: 74, letterSpacing: 0.7, textTransform: 'uppercase', color: C.a700 },
  paletteFoot: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.divider, backgroundColor: C.bg },
});
