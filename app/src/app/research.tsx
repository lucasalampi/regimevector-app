import { useState } from 'react';
import { View } from 'react-native';
import { openDoc } from '@/components/edition';
import { DocRow, ProgrammeBar, Screen, Seg } from '@/components/ui';
import { PROGRAMMES, visibleDocs, type DocKind } from '@/data';
import { useApp } from '@/store';

const FILTERS = ['All', 'Daily', 'Events', 'Executive', 'Special'] as const;

export default function Research() {
  const role = useApp(s => s.role);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const docs = visibleDocs(role).filter(d => filter === 'All' || d.kind === filter);

  return (
    <Screen pad={[14, 18, 28]} gap={14}>
      <Seg options={FILTERS} value={filter} onChange={setFilter} size={12} />
      <View>
        {docs.map((d, i) => {
          const head = i === 0 || docs[i - 1].kind !== d.kind;
          const count = docs.filter(x => x.kind === d.kind).length;
          return (
            <View key={d.id}>
              {head ? <ProgrammeBar label={PROGRAMMES[d.kind as DocKind]} note={`${count} ${count === 1 ? 'edition' : 'editions'}`} style={{ marginTop: 14 }} /> : null}
              <DocRow border="bottom" minHeight={64} kind={d.kind + (d.internal ? ' · Internal' : '')} title={d.title} sub={`${d.code} · ${d.date}`} onPress={() => openDoc(d)} />
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
