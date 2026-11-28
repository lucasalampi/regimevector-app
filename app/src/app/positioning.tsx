import { router } from 'expo-router';
import { ChevronRight } from '@/components/icons';
import { Text, View } from 'react-native';
import { openDoc } from '@/components/edition';
import { Kicker, OutlineButton, PrimaryButton, Screen, Tap } from '@/components/ui';
import { POSITIONING as P, rowByKey, type PosTest } from '@/data';
import { shortDate } from '@/lib/analytics';
import { sessionsToResolve, testState, type TestStatus } from '@/lib/positioning';
import { useApp } from '@/store';
import { alpha, C, font, MUTED, tabular } from '@/theme';

const STATUS: Record<TestStatus, { bg: string; fg: string; label: (n: number) => string }> = {
  Waiting: { bg: C.a100, fg: C.a700, label: () => 'Window opens next session' },
  Holding: { bg: alpha(C.up, 0.12), fg: C.up, label: n => `Holding · ${n} session${n === 1 ? "" : "s"}` },
  Confirmed: { bg: C.up, fg: '#fff', label: () => 'Confirmed' },
  Falsified: { bg: C.down, fg: '#fff', label: () => 'Falsified' },
};
const OUTCOME: Record<string, string> = { Confirmed: C.up, Falsified: C.down, Unresolved: C.n500 };

const Small = ({ children, color = MUTED }: { children: React.ReactNode; color?: string }) => <Text style={[font(400, 12.5, 1.45), { color }]}>{children}</Text>;

function TestCard({ t }: { t: PosTest }) {
  const s = testState(t), st = STATUS[s.status], row = rowByKey(t.key);
  const open = () => row && router.push({ pathname: '/asset', params: { group: row.gk, sym: row.s } });
  return (
    <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: C.divider, borderLeftWidth: 3, borderLeftColor: s.status === 'Falsified' ? C.down : C.gold }}>
      <Tap onPress={open} accessibilityLabel={`${t.name} test: ${st.label(s.sessions.length)}. ${s.cushion}. Open ${row?.s}`} style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={[font(700, 16), { color: C.text }]}>{t.name}</Text>
          <View style={{ backgroundColor: st.bg, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={[font(600, 10), { color: st.fg, letterSpacing: 0.5, textTransform: 'uppercase' }]}>
              {s.status === 'Falsified' && s.failedOn ? `Falsified · ${shortDate(s.failedOn)}` : st.label(s.sessions.length)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={[font(700, 20), tabular, { color: C.text }]}>{s.cushion}</Text>
            <Text style={[font(400, 12), tabular, { color: MUTED }]}>{s.now}{s.tag ? ` · ${t.dim} ${s.tag}` : ''}</Text>
          </View>
          <ChevronRight size={16} color={C.a700} />
        </View>
        {s.sessions.length ? (
          <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {s.sessions.map(x => (
              <View key={x.date} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: x.pass ? alpha(C.up, 0.12) : alpha(C.down, 0.14) }}>
                <Text style={[font(500, 10), tabular, { color: x.pass ? C.up : C.down }]}>{shortDate(x.date)} {x.pass ? '✓' : '✗'}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Small color={C.text}>{t.hypothesis}</Small>
        <Small><Text style={font(600, 12.5)}>Counter. </Text>{t.counter}</Small>
        <View style={{ borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 8 }}>
          <Small><Text style={font(600, 12.5)}>Exit rule. </Text>{t.rule}</Small>
        </View>
      </Tap>
    </View>
  );
}

export default function Positioning() {
  const internal = useApp(s => s.role) === 'Internal';
  const left = sessionsToResolve();
  return (
    <Screen pad={[14, 18, 28]} gap={22}>
      <View style={{ gap: 6 }}>
        <Text style={[font(600, 11), { letterSpacing: 0.8, color: C.a700, textTransform: 'uppercase' }]}>{P.book} · week ending {P.weekEnding} · {P.days}</Text>
        <Text style={[font(700, 22, 1.25), { color: C.text }]}>{P.headline}</Text>
        <Text style={[font(400, 12), { color: MUTED }]}>{P.status}</Text>
      </View>
      <View style={{ backgroundColor: C.cream, borderLeftWidth: 3, borderLeftColor: C.gold, paddingVertical: 14, paddingHorizontal: 16 }}>
        <Text style={[font(400, 15, 1.55), { color: C.text }]}>{P.view}</Text>
      </View>

      {/* Last week's tests */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Kicker>Last week's tests</Kicker>
          <Text style={[font(600, 11), { color: C.text }]}>{P.prior.summary}</Text>
        </View>
        {P.prior.legs.map(l => (
          <View key={l.name} style={{ flexDirection: 'row', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.divider }}>
            <Text style={[font(600, 10), { width: 72, color: OUTCOME[l.outcome], letterSpacing: 0.5, textTransform: 'uppercase', paddingTop: 2 }]}>{l.outcome}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[font(600, 13), { color: C.text }]}>{l.name}</Text>
              <Small>{l.b}</Small>
            </View>
          </View>
        ))}
        <Text style={[font(400, 11), { color: C.n500 }]}>Week ending {P.prior.weekEnding}. {P.prior.note}</Text>
      </View>

      {/* This week's book */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Kicker>In the book · {P.tests.length} dated tests</Kicker>
          <Text style={[font(600, 11), { color: C.text }]}>Resolves {shortDate(P.resolves)}{left > 0 ? ` · ${left} to run` : ''}</Text>
        </View>
        <Small>Each test passes only if it holds on every edition in its window: from the first edition after {shortDate(P.weekIso)} to the first on or after {shortDate(P.resolves)}. Cushions update with every archive edition; tap a test to open its instrument.</Small>
        {P.tests.map(t => <TestCard key={t.id} t={t} />)}
        <Small><Text style={font(600, 12.5)}>Reserve. </Text>{P.reserve}</Small>
      </View>

      {/* Not in the book */}
      <View style={{ gap: 2 }}>
        <Kicker style={{ marginBottom: 6 }}>Not in the book</Kicker>
        {P.notHeld.map(n => (
          <View key={n.t} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.divider }}>
            <Text style={[font(600, 13), { width: 96, color: C.text }]}>{n.t}</Text>
            <View style={{ flex: 1 }}><Small>{n.b}</Small></View>
          </View>
        ))}
      </View>

      <View style={{ gap: 6 }}>
        <Kicker>What to watch</Kicker>
        {P.watch.map(w => <Small key={w} color={C.text}>·  {w}</Small>)}
      </View>

      {internal ? (
        <View style={{ gap: 8, backgroundColor: C.paper, borderWidth: 1, borderColor: C.divider, padding: 14 }}>
          <Kicker color={C.a700}>Internal · regime state 23 → 27 Nov</Kicker>
          {P.internal.stateRows.map(r => (
            <View key={r.dim} style={{ gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.divider }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={[font(600, 13), { color: C.text }]}>{r.dim}</Text>
                <Text style={[font(500, 12), tabular, { color: C.text }]}>{r.from} → {r.to}</Text>
              </View>
              <Small>{r.read}</Small>
            </View>
          ))}
          <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: C.divider, gap: 6 }}>
            <Small color={C.text}><Text style={font(600, 12.5)}>Commodity read. </Text>{P.internal.commodity}</Small>
            <Small color={C.text}><Text style={font(600, 12.5)}>Sizing. </Text>{P.internal.sizing}</Small>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <PrimaryButton label="Open executive brief" onPress={() => openDoc({ id: P.briefDoc })} />
        {internal ? <OutlineButton label="Open research sidecar (internal draft)" onPress={() => openDoc({ id: P.sidecarDoc })} /> : null}
        <Text style={[font(400, 11, 1.45), { color: C.n500 }]}>Shadow book: no notional and no execution path. A research test of classifier output, not a trade or an allocation. Tags and scenario weights are engine output; hypotheses, exits and the not-held list are authored.</Text>
      </View>
    </Screen>
  );
}
