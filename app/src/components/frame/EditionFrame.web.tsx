import { Asset } from 'expo-asset';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { BRIEF_ASSETS } from '@/data/briefAssets.generated';
import { docFormat } from '@/data';
import { C } from '@/theme';
import type { FrameProps } from './EditionFrame';
import { pdfHtml, type FrameMsg } from './pdfHtml';
import { PDFJS_LIB, PDFJS_WORKER } from './pdfjsAssets';

/** Web: same pdf.js renderer in a srcdoc iframe; HTML specials in a script-only sandbox, as in the prototype. */
export default function EditionFrame({ doc, zoom, onNote }: FrameProps) {
  const fmt = docFormat(doc);
  const url = useMemo(() => Asset.fromModule(BRIEF_ASSETS[doc.file]).uri, [doc.file]);
  const [height, setHeight] = useState(240);
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setHeight(240);
    onNote(fmt === 'html' ? 'interactive' : 'loading');
    if (fmt !== 'pdf') return;
    const on = (e: MessageEvent) => {
      const m = e.data as FrameMsg;
      if (!m?.rv || e.source !== ref.current?.contentWindow) return;
      if (m.type === 'height') setHeight(Math.max(120, Math.ceil(m.h)));
      else if (m.type === 'pages') onNote(`${m.n} ${m.n === 1 ? 'page' : 'pages'}`);
      else onNote('could not render this edition');
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.file]);

  if (fmt === 'html') {
    return createElement('iframe', {
      src: url, sandbox: 'allow-scripts', title: doc.title,
      style: { width: '100%', height: 540, border: `1px solid ${C.divider}`, background: '#fff', boxSizing: 'border-box' },
    });
  }

  const abs = (u: string) => new URL(u, window.location.href).href;
  const srcDoc = pdfHtml({ url: abs(url) }, { libUrl: abs(Asset.fromModule(PDFJS_LIB).uri), workerUrl: abs(Asset.fromModule(PDFJS_WORKER).uri) },
    'function(m){window.parent.postMessage(m,"*")}');
  const frameW = Math.max(0, width - 40) * (zoom / 16);
  return (
    <View style={{ marginHorizontal: -20 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 20 }}>
        {width ? createElement('iframe', {
          key: doc.file, ref, srcDoc, title: doc.title,
          style: { width: frameW, height, border: 0, display: 'block', background: 'transparent' },
        }) : null}
      </ScrollView>
    </View>
  );
}
