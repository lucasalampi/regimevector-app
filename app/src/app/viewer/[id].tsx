import { Redirect, useLocalSearchParams } from 'expo-router';
import { DocPane } from '@/components/DocPane';
import { ResearchTerminal } from '@/components/terminal/ResearchSplit';
import { docById } from '@/data';
import { useTerminal } from '@/lib/terminal';
import { useApp } from '@/store';

/** Full-screen edition (phones); on a computer the Research split view with this edition open. */
export default function Viewer() {
  const { id, page } = useLocalSearchParams<{ id: string; page?: string }>();
  const role = useApp(s => s.role);
  const terminal = useTerminal();
  const doc = docById(id ?? '');
  if (!doc || (doc.internal && role !== 'Internal')) return <Redirect href="/research" />;
  if (terminal) return <ResearchTerminal initialId={doc.id} />;
  return <DocPane doc={doc} page={Math.max(1, Number(page) || 1)} />;
}
