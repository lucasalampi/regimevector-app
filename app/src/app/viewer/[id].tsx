import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EditionViewer } from '@/components/frame/EditionFrame';
import { FAIL_NOTE } from '@/components/frame/types';
import { Tap } from '@/components/ui';
import { docById, docFormat, pdfMeta } from '@/data';
import { useApp } from '@/store';
import { C, font, MUTED, tabular } from '@/theme';

const STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4];

/** Full-screen edition: own scroll, sharp zoom steps (plus pinch on phones), page counter. */
export default function Viewer() {
  const { id, page } = useLocalSearchParams<{ id: string; page?: string }>();
  const role = useApp(s => s.role);
  const doc = docById(id ?? '');
  const [zoom, setZoom] = useState(1);
  const [cur, setCur] = useState(Math.max(1, Number(page) || 1));
  const [note, setNote] = useState('');
  if (!doc || (doc.internal && role !== 'Internal')) return <Redirect href="/research" />;

  const fmt = docFormat(doc);
  const total = pdfMeta(doc)?.pages;
  const step = (dir: 1 | -1) => setZoom(z => {
    const i = STEPS.findIndex(s => s >= z - 1e-6);
    return STEPS[Math.max(0, Math.min(STEPS.length - 1, (i < 0 ? STEPS.length - 1 : i) + dir))];
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <View style={styles.bar}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[font(600, 13), { color: C.text }]}>{doc.title}</Text>
          <Text numberOfLines={1} style={[font(400, 11), tabular, { color: note === FAIL_NOTE ? C.down : MUTED }]}>
            {note === FAIL_NOTE ? note : fmt === 'html' ? `${doc.code} · Interactive edition` : `${doc.code} · Page ${cur}${total ? ` of ${total}` : ''}`}
          </Text>
        </View>
        {fmt === 'pdf' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="toolbar">
            <Tap onPress={() => step(-1)} disabled={zoom <= 1} accessibilityLabel="Zoom out" style={[styles.btn, zoom <= 1 && { opacity: 0.4 }]}>
              <Text style={[font(500, 18), { color: C.text }]}>−</Text>
            </Tap>
            <Tap onPress={() => setZoom(1)} accessibilityLabel="Fit to width" style={[styles.btn, { width: 58, borderLeftWidth: 0, borderRightWidth: 0 }]}>
              <Text style={[font(600, 12), tabular, { color: C.text }]}>{zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`}</Text>
            </Tap>
            <Tap onPress={() => step(1)} disabled={zoom >= 4} accessibilityLabel="Zoom in" style={[styles.btn, zoom >= 4 && { opacity: 0.4 }]}>
              <Text style={[font(500, 18), { color: C.text }]}>+</Text>
            </Tap>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <EditionViewer doc={doc} zoom={zoom} page={cur} onPage={setCur} onNote={setNote} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.divider },
  btn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.divider, backgroundColor: '#fff' },
});
