import { Asset } from 'expo-asset';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BRIEF_ASSETS } from '@/data/briefAssets.generated';
import { docFormat, pdfMeta, type Doc } from '@/data';
import { C } from '@/theme';
import { TapToOpen } from './TapToOpen';
import { pdfHtml, type FrameMsg, type PdfHtmlOptions } from './pdfHtml';
import { PDFJS_LIB, PDFJS_WORKER } from './pdfjsAssets';
import { FAIL_NOTE, pagesNote, type InlineProps, type ViewerProps } from './types';

const abs = (mod: number) => new URL(Asset.fromModule(mod).uri, window.location.href).href;

function srcDoc(doc: Doc, opts: PdfHtmlOptions) {
  return pdfHtml({ url: abs(BRIEF_ASSETS[doc.file]) }, { libUrl: abs(PDFJS_LIB), workerUrl: abs(PDFJS_WORKER) },
    'function(m){window.parent.postMessage(m,"*")}', { ...opts, aspects: pdfMeta(doc)?.aspects });
}

/** Listen to one iframe's messages. */
function useFrameMessages(ref: React.RefObject<HTMLIFrameElement | null>, on: (m: FrameMsg) => void, deps: unknown[]) {
  useEffect(() => {
    const h = (e: MessageEvent) => { const m = e.data as FrameMsg; if (m?.rv && e.source === ref.current?.contentWindow) on(m); };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function initialNote(doc: Doc) {
  const meta = pdfMeta(doc);
  return docFormat(doc) === 'html' ? 'interactive' : meta ? pagesNote(meta.pages) : 'loading';
}

/** Web inline edition: srcdoc iframe sized from build-time page shapes; HTML specials preview behind a tap target. */
export default function EditionFrame({ doc, onOpen, onNote }: InlineProps) {
  const fmt = docFormat(doc);
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [width, setWidth] = useState(0);
  const [posted, setPosted] = useState(0);
  const meta = pdfMeta(doc);
  const planned = meta && width ? meta.aspects.reduce((h, a) => h + width * a, 0) + 10 * (meta.pages - 1) : 0;
  const html = useMemo(() => (fmt === 'pdf' ? srcDoc(doc, { mode: 'inline' }) : ''), [doc, fmt]);

  useEffect(() => { setPosted(0); onNote(initialNote(doc)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doc.file]);
  useFrameMessages(ref, m => {
    if (m.type === 'height') setPosted(Math.ceil(m.h));
    else if (m.type === 'pages') onNote(pagesNote(m.n));
    else if (m.type === 'open') onOpen(m.page);
    else if (m.type === 'error') onNote(FAIL_NOTE);
  }, [doc.file, onOpen]);

  if (fmt === 'html') {
    return (
      <Pressable onPress={() => onOpen(1)} accessibilityRole="button" accessibilityLabel="Open interactive edition full screen"
        style={{ height: 520, borderWidth: 1, borderColor: C.divider, backgroundColor: '#fff', overflow: 'hidden', cursor: 'zoom-in' } as object}>
        {createElement('iframe', {
          src: Asset.fromModule(BRIEF_ASSETS[doc.file]).uri, sandbox: 'allow-scripts', title: doc.title, tabIndex: -1,
          style: { width: '100%', height: '100%', border: 0, pointerEvents: 'none', display: 'block' },
        })}
        <TapToOpen label="Open interactive edition" />
      </Pressable>
    );
  }

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width ? createElement('iframe', {
        key: doc.file, ref, srcDoc: html, title: doc.title,
        style: { width, height: Math.max(planned, posted, 200), border: 0, display: 'block', background: 'transparent' },
      }) : null}
    </View>
  );
}

/** Web full-screen edition: the iframe scrolls itself; toolbar zoom is posted in and re-renders sharp. */
export function EditionViewer({ doc, zoom, page, onPage, onNote }: ViewerProps) {
  const fmt = docFormat(doc);
  const ref = useRef<HTMLIFrameElement | null>(null);
  // Built once per document; zoom changes are posted to the live frame instead of rebuilding it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => (fmt === 'pdf' ? srcDoc(doc, { mode: 'viewer', page, zoom }) : ''), [doc.file]);
  useEffect(() => { onNote(initialNote(doc)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doc.file]);
  useEffect(() => { ref.current?.contentWindow?.postMessage({ rvcmd: 'zoom', z: zoom }, '*'); }, [zoom]);
  useFrameMessages(ref, m => {
    if (m.type === 'page') onPage(m.n);
    else if (m.type === 'pages') onNote(pagesNote(m.n));
    else if (m.type === 'error') onNote(FAIL_NOTE);
  }, [doc.file]);

  const style = { width: '100%', height: '100%', border: 0, display: 'block', background: C.surface };
  return fmt === 'html'
    ? createElement('iframe', { src: Asset.fromModule(BRIEF_ASSETS[doc.file]).uri, sandbox: 'allow-scripts', title: doc.title, style })
    : createElement('iframe', { key: doc.file, ref, srcDoc: html, title: doc.title, style });
}
