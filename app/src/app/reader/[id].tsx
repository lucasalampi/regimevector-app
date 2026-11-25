import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { viewTitle, ViewText } from '@/components/edition';
import EditionFrame from '@/components/frame/EditionFrame';
import { Bookmark } from '@/components/icons';
import { Kicker, ProgrammeBar, Screen, Tap } from '@/components/ui';
import { docById, ED } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED } from '@/theme';

export default function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useApp(s => s.role);
  const fs = useApp(s => s.fs);
  const zoom = useApp(s => s.zoom);
  const saved = useApp(s => s.saved);
  const toggleSaved = useApp(s => s.toggleSaved);
  const [note, setNote] = useState('loading');
  const doc = docById(id ?? '');

  // Unknown id, or an internal edition opened under the Client role (e.g. via a stale deep link).
  if (!doc || (doc.internal && role !== 'Internal')) return <Redirect href="/research" />;
  const isSaved = saved.includes(doc.id);
  const btn = { width: 44, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.divider } as const;

  return (
    <Screen pad={[14, 20, 32]} gap={16}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[font(600, 10), { flex: 1, letterSpacing: 0.8, textTransform: 'uppercase', color: C.a700 }]}>{doc.kind} · {doc.code}</Text>
        <Tap onPress={() => zoom(-1)} style={btn} accessibilityLabel="Zoom out"><Text style={[font(500, 13), { color: C.text }]}>A−</Text></Tap>
        <Tap onPress={() => zoom(1)} style={btn} accessibilityLabel="Zoom in"><Text style={[font(500, 17), { color: C.text }]}>A+</Text></Tap>
        <Tap onPress={() => toggleSaved(doc.id)} style={btn} accessibilityLabel={isSaved ? 'Remove from saved' : 'Save to watchlist'} accessibilityState={{ selected: isSaved }}>
          <Bookmark fill={isSaved ? C.a700 : 'none'} />
        </Tap>
      </View>
      <Text style={[font(700, 24, 1.08), { letterSpacing: -0.36, color: C.text }]} accessibilityRole="header">{doc.title}</Text>
      <Text style={[font(400, 13), { color: MUTED }]}>{doc.date} · {doc.pages}</Text>

      {doc.daily ? (
        <View style={{ gap: 14 }}>
          <Kicker>Current regime</Kicker>
          <Text style={[font(700, 18, 1.1), { color: C.text }]}>{ED.regime}</Text>
          <Kicker>{viewTitle(role === 'Internal')}</Kicker>
          <ViewText size={Math.min(22, fs)} pad={[12, 14]} />
          <Kicker>Top market drivers</Kicker>
          {ED.drivers.map((d, i) => (
            <Text key={i} style={[font(400, Math.min(22, fs), 1.55), { color: C.n800 }]}>
              <Text style={[font(500, Math.min(22, fs)), { color: C.text }]}>{i + 1}. {d.t}. </Text>{d.b}
            </Text>
          ))}
        </View>
      ) : null}

      <ProgrammeBar label="Full edition" note={note} />
      <EditionFrame doc={doc} zoom={fs} onNote={setNote} />
    </Screen>
  );
}
