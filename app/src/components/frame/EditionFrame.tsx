import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { BRIEF_ASSETS } from '@/data/briefAssets.generated';
import { docFormat, pdfMeta, type Doc } from '@/data';
import { C } from '@/theme';
import { TapToOpen } from './TapToOpen';
import { pdfHtml, type FrameMsg, type PdfHtmlOptions } from './pdfHtml';
import { PDFJS_LIB, PDFJS_WORKER } from './pdfjsAssets';
import { FAIL_NOTE, pagesNote, type InlineProps, type ViewerProps } from './types';

async function readAsset(mod: number, as: 'base64' | 'text') {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const f = new File(asset.localUri ?? asset.uri);
  return as === 'base64' ? f.base64() : f.text();
}

let pdfjs: Promise<{ lib: string; worker: string }> | null = null;
const loadPdfjs = () => (pdfjs ??= Promise.all([readAsset(PDFJS_LIB, 'text'), readAsset(PDFJS_WORKER, 'text')])
  .then(([lib, worker]) => ({ lib, worker }))
  .catch(e => { pdfjs = null; throw e; }));

const POST = 'function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))}';
async function buildHtml(doc: Doc, opts: PdfHtmlOptions) {
  if (docFormat(doc) !== 'pdf') return readAsset(BRIEF_ASSETS[doc.file], 'text');
  const [b64, lib] = await Promise.all([readAsset(BRIEF_ASSETS[doc.file], 'base64'), loadPdfjs()]);
  return pdfHtml({ b64 }, lib, POST, { ...opts, aspects: pdfMeta(doc)?.aspects });
}

/** Load the edition's HTML once per document. */
function useEditionHtml(doc: Doc, opts: PdfHtmlOptions, onNote: (n: string) => void) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setHtml(null);
    const meta = pdfMeta(doc);
    onNote(docFormat(doc) === 'html' ? 'interactive' : meta ? pagesNote(meta.pages) : 'loading');
    buildHtml(doc, opts).then(h => live && setHtml(h)).catch(() => live && onNote(FAIL_NOTE));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.file]);
  return html;
}

const parse = (e: WebViewMessageEvent): FrameMsg | null => {
  try { const m = JSON.parse(e.nativeEvent.data); return m?.rv ? m : null; } catch { return null; }
};

// Keep editions inside the frame; open real links in the system browser.
const guard = (req: { url: string; isTopFrame?: boolean }) => {
  if (/^(about:|data:|blob:|file:)/.test(req.url)) return true;
  if (req.isTopFrame !== false && /^https?:/.test(req.url)) { Linking.openURL(req.url); return false; }
  return true;
};

const Spinner = ({ h = 200 }: { h?: number }) => (
  <View style={{ minHeight: h, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.a700} /></View>
);

/** Native inline edition: pages laid out at final size up front, sized from build-time aspect ratios. */
export default function EditionFrame({ doc, onOpen, onNote }: InlineProps) {
  const fmt = docFormat(doc);
  const html = useEditionHtml(doc, { mode: 'inline' }, onNote);
  const [width, setWidth] = useState(0);
  const meta = pdfMeta(doc);
  const planned = meta && width ? meta.aspects.reduce((h, a) => h + width * a, 0) + 10 * (meta.pages - 1) : 0;
  const [posted, setPosted] = useState(0);
  const height = Math.max(planned, posted, 200);

  if (fmt === 'html') {
    // Interactive specials are full-page layouts: preview here, interact full screen.
    return (
      <Pressable onPress={() => onOpen(1)} accessibilityRole="button" accessibilityLabel="Open interactive edition full screen"
        style={{ height: 520, borderWidth: 1, borderColor: C.divider, backgroundColor: '#fff', overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ flex: 1 }}>
          {html ? <WebView originWhitelist={['*']} source={{ html }} javaScriptEnabled scrollEnabled={false} style={{ flex: 1 }} /> : <Spinner />}
        </View>
        <TapToOpen label="Open interactive edition" />
      </Pressable>
    );
  }

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {html && width ? (
        <WebView originWhitelist={['*']} source={{ html }} javaScriptEnabled scrollEnabled={false} onShouldStartLoadWithRequest={guard}
          onMessage={e => {
            const m = parse(e); if (!m) return;
            if (m.type === 'height') setPosted(Math.ceil(m.h));
            else if (m.type === 'pages') onNote(pagesNote(m.n));
            else if (m.type === 'open') onOpen(m.page);
            else if (m.type === 'error') onNote(FAIL_NOTE);
          }}
          style={{ width, height, backgroundColor: 'transparent' }} />
      ) : <Spinner h={planned || 200} />}
    </View>
  );
}

/** Native full-screen edition. Pinch zoom is the WebView's; the toolbar zoom re-renders pages sharp. */
export function EditionViewer({ doc, zoom, page, onPage, onNote }: ViewerProps) {
  const fmt = docFormat(doc);
  const html = useEditionHtml(doc, { mode: 'viewer', page, zoom }, onNote);
  // react-native-webview types its ref for older React; the instance is the same.
  const ref = useRef<WebView>(null);
  useEffect(() => { ref.current?.injectJavaScript(`window.rv && window.rv.zoom(${zoom}); true;`); }, [zoom]);
  if (!html) return <Spinner h={400} />;
  return (
    <WebView ref={ref as never} originWhitelist={['*']} source={{ html }} javaScriptEnabled onShouldStartLoadWithRequest={guard}
      setSupportMultipleWindows={false} setBuiltInZoomControls={fmt === 'pdf'} setDisplayZoomControls={false}
      onMessage={e => {
        const m = parse(e); if (!m) return;
        if (m.type === 'page') onPage(m.n);
        else if (m.type === 'pages') onNote(pagesNote(m.n));
        else if (m.type === 'error') onNote(FAIL_NOTE);
      }}
      style={{ flex: 1, backgroundColor: C.surface }} />
  );
}
