import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { viewTitle, ViewText } from '@/components/edition';
import EditionFrame from '@/components/frame/EditionFrame';
import { Bookmark } from '@/components/icons';
import { Kicker, PrimaryButton, ProgrammeBar, Screen, Tap } from '@/components/ui';
import { docById, docFormat, ED, pdfMeta } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED } from '@/theme';

export default function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useApp(s => s.role);
  const saved = useApp(s => s.saved);
  const toggleSaved = useApp(s => s.toggleSaved);
  const [note, setNote] = useState('');
  const doc = docById(id ?? '');
  const open = useCallback((page: number) => doc && router.push({ pathname: '/viewer/[id]', params: { id: doc.id, page: String(page) } }), [doc]);

  // Unknown id, or an internal edition opened under the Client role (e.g. via a stale deep link).
  if (!doc || (doc.internal && role !== 'Internal')) return <Redirect href="/research" />;
  const isSaved = saved.includes(doc.id);
  const fmt = docFormat(doc);
  const pages = pdfMeta(doc)?.pages;

  return (
    <Screen pad={[14, 20, 32]} gap={16}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[font(600, 10), { flex: 1, letterSpacing: 0.8, textTransform: 'uppercase', color: C.a700 }]}>
          {doc.kind}{doc.internal ? ' · Internal' : ''} · {doc.code}
        </Text>
        <Tap onPress={() => toggleSaved(doc.id)} accessibilityLabel={isSaved ? 'Remove from saved' : 'Save to watchlist'} accessibilityState={{ selected: isSaved }}
          style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.divider }}>
          <Bookmark fill={isSaved ? C.a700 : 'none'} />
        </Tap>
      </View>
      <Text style={[font(700, 24, 1.15), { letterSpacing: -0.36, color: C.text }]} accessibilityRole="header">{doc.title}</Text>
      <Text style={[font(400, 13, 1.4), { color: MUTED }]}>
        {doc.date} · {doc.pages}{fmt === 'pdf' && pages ? ` · ${pages} ${pages === 1 ? 'page' : 'pages'}` : fmt === 'html' && !/interactive/i.test(doc.pages) ? ' · Interactive' : ''}
      </Text>

      {doc.daily ? (
        <View style={{ gap: 12 }}>
          <Kicker>Current regime</Kicker>
          <Text style={[font(700, 18, 1.2), { color: C.text }]}>{ED.regime}</Text>
          <Kicker style={{ marginTop: 4 }}>{viewTitle(role === 'Internal')}</Kicker>
          <ViewText size={15.5} pad={[12, 14]} />
          <Kicker style={{ marginTop: 4 }}>Top market drivers</Kicker>
          {ED.drivers.map((d, i) => (
            <Text key={i} style={[font(400, 15, 1.55), { color: C.n800 }]}>
              <Text style={[font(600, 15, 1.55), { color: C.text }]}>{i + 1}. {d.t}. </Text>{d.b}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <ProgrammeBar label="Full edition" note={note} />
        <PrimaryButton label={fmt === 'html' ? 'Open interactive edition' : 'Read full screen'} onPress={() => open(1)} />
        {fmt === 'pdf' ? <Text style={[font(400, 12), { color: MUTED, textAlign: 'center' }]}>Tap any page to open it full screen, zoom and select text.</Text> : null}
      </View>
      <EditionFrame doc={doc} onOpen={open} onNote={setNote} />
    </Screen>
  );
}
