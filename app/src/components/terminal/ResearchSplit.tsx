// Research on a computer: the library on the left, the selected edition open beside it.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DocPane } from '@/components/DocPane';
import { Bookmark } from '@/components/icons';
import { ProgrammeBar, Tap } from '@/components/ui';
import { docById, docFormat, pdfMeta, PROGRAMMES, visibleDocs, type Doc, type DocKind } from '@/data';
import { useKeys, useTerminalWide } from '@/lib/terminal';
import { useApp } from '@/store';
import { C, font, MUTED, tabular } from '@/theme';

export const FILTERS = ['All', 'Daily', 'Events', 'Executive', 'Special'] as const;
export type Filter = (typeof FILTERS)[number];
const extent = (d: Doc) => { const n = pdfMeta(d)?.pages; return docFormat(d) === 'html' ? 'Interactive' : n ? `${n} ${n === 1 ? 'page' : 'pages'}` : ''; };

export function ResearchTerminal({ initialId, initialFilter = 'All' }: { initialId?: string; initialFilter?: Filter }) {
  const role = useApp(s => s.role);
  const wide = useTerminalWide();
  const saved = useApp(s => s.saved), toggleSaved = useApp(s => s.toggleSaved);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const docs = visibleDocs(role).filter(d => filter === 'All' || d.kind === filter);
  const [sel, setSel] = useState<string | undefined>(initialId ?? docs[0]?.id);
  useEffect(() => { if (initialId) setSel(initialId); }, [initialId]);
  const doc = (sel && docById(sel)) || docs[0];
  const pick = (d: Doc) => { setSel(d.id); router.setParams({ id: d.id } as never); };

  useKeys(e => {
    if (e.key === 'j' || e.key === 'k' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const i = docs.findIndex(d => d.id === doc?.id);
      const n = docs[Math.max(0, Math.min(docs.length - 1, i + (e.key === 'j' || e.key === 'ArrowDown' ? 1 : -1)))];
      if (n) setSel(n.id);
      return true;
    }
    if (e.key === 'b' && doc) { toggleSaved(doc.id); return true; }
    return false;
  });

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: wide ? 420 : 340, flexShrink: 0, borderRightWidth: 1, borderRightColor: C.divider, backgroundColor: '#fff' }}>
        <View style={st.filters} accessibilityRole="tablist">
          {FILTERS.map(f => {
            const on = f === filter, n = visibleDocs(role).filter(d => f === 'All' || d.kind === f).length;
            return (
              <Tap key={f} onPress={() => setFilter(f)} accessibilityRole="tab" accessibilityState={{ selected: on }} hoverBg={on ? C.a700 : C.a100}
                style={[st.chip, on && { backgroundColor: C.a700, borderColor: C.a700 }]}>
                <Text style={[font(500, 12), { color: on ? '#fff' : C.text }]}>{f} <Text style={{ color: on ? C.a300 : C.n500 }}>{n}</Text></Text>
              </Tap>
            );
          })}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 16 }}>
          {docs.map((d, i) => {
            const head = i === 0 || docs[i - 1].kind !== d.kind;
            const on = d.id === doc?.id;
            return (
              <View key={d.id}>
                {head ? <ProgrammeBar label={PROGRAMMES[d.kind as DocKind]} note={`${docs.filter(x => x.kind === d.kind).length}`} style={{ marginTop: 14 }} /> : null}
                <Tap onPress={() => pick(d)} accessibilityState={{ selected: on }} style={[st.doc, on && { backgroundColor: C.a100, borderLeftColor: C.gold }]}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[font(on ? 600 : 500, 13), { color: C.text }]} numberOfLines={2}>{d.title}</Text>
                    <Text style={[font(400, 11), tabular, { color: MUTED }]} numberOfLines={1}>{[d.code, d.date, extent(d)].filter(Boolean).join(' · ')}{d.internal ? ' · Internal' : ''}</Text>
                  </View>
                  {saved.includes(d.id) ? <Bookmark size={14} fill={C.a700} /> : null}
                </Tap>
              </View>
            );
          })}
        </ScrollView>
        <Text style={[font(400, 10.5), { color: C.n500, padding: 10, borderTopWidth: 1, borderTopColor: C.divider }]}>j / k or ↓ ↑ to move · b to save · zoom with − / + on the document</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {doc ? (
          <DocPane key={doc.id} doc={doc} extra={
            <Tap onPress={() => toggleSaved(doc.id)} accessibilityLabel={saved.includes(doc.id) ? 'Remove from saved' : 'Save edition'} style={st.save}>
              <Bookmark size={15} fill={saved.includes(doc.id) ? C.a700 : 'none'} />
              <Text style={[font(600, 11), { color: C.a700 }]}>{saved.includes(doc.id) ? 'Saved' : 'Save'}</Text>
            </Tap>
          } />
        ) : <Text style={[font(400, 14), { color: MUTED, padding: 30 }]}>No editions in this filter.</Text>}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, padding: 12, borderBottomWidth: 1, borderBottomColor: C.divider },
  chip: { paddingHorizontal: 10, height: 28, justifyContent: 'center', borderWidth: 1, borderColor: C.divider },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, paddingVertical: 7, paddingHorizontal: 8, borderLeftWidth: 3, borderLeftColor: 'transparent', borderBottomWidth: 1, borderBottomColor: C.a100 },
  save: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 10, marginLeft: 8, borderWidth: 1, borderColor: C.divider, backgroundColor: '#fff' },
});
