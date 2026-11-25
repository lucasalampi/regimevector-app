import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { BRIEF_ASSETS } from '@/data/briefAssets.generated';
import { docFormat, type Doc } from '@/data';
import { C } from '@/theme';
import { pdfHtml, type FrameMsg } from './pdfHtml';
import { PDFJS_LIB, PDFJS_WORKER } from './pdfjsAssets';

export interface FrameProps { doc: Doc; zoom: number; onNote: (note: string) => void }

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
async function buildHtml(file: string, fmt: string) {
  if (fmt !== 'pdf') return readAsset(BRIEF_ASSETS[file], 'text');
  const [b64, lib] = await Promise.all([readAsset(BRIEF_ASSETS[file], 'base64'), loadPdfjs()]);
  return pdfHtml({ b64 }, lib, POST);
}

/** Native: PDFs render page-by-page through pdf.js in a WebView sized to its content; HTML specials run sandboxed. */
export default function EditionFrame({ doc, zoom, onNote }: FrameProps) {
  const fmt = docFormat(doc);
  const [html, setHtml] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(240);

  useEffect(() => {
    let live = true;
    setHtml(null); setHeight(240);
    onNote(fmt === 'html' ? 'interactive' : 'loading');
    buildHtml(doc.file, fmt)
      .then(body => { if (live) setHtml(body); })
      .catch(() => live && onNote('could not render this edition'));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.file]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: FrameMsg;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (!m?.rv) return;
    if (m.type === 'height') setHeight(Math.max(120, Math.ceil(m.h)));
    else if (m.type === 'pages') onNote(`${m.n} ${m.n === 1 ? 'page' : 'pages'}`);
    else onNote('could not render this edition');
  };

  // Keep specials and briefs inside the frame; open real links in the system browser.
  const guard = (req: { url: string; isTopFrame?: boolean }) => {
    if (/^(about:|data:|blob:|file:)/.test(req.url)) return true;
    if (req.isTopFrame !== false && /^https?:/.test(req.url)) { Linking.openURL(req.url); return false; }
    return true;
  };

  if (fmt === 'html') {
    return (
      <View style={{ height: 540, borderWidth: 1, borderColor: C.divider, backgroundColor: '#fff' }}>
        {html ? (
          <WebView originWhitelist={['*']} source={{ html }} javaScriptEnabled nestedScrollEnabled
            onShouldStartLoadWithRequest={guard} setSupportMultipleWindows={false} style={{ flex: 1 }} />
        ) : <ActivityIndicator style={{ marginTop: 40 }} color={C.a700} />}
      </View>
    );
  }

  const frameW = Math.max(0, width - 40) * (zoom / 16);
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ marginHorizontal: -20 }}>
      <ScrollView horizontal scrollEnabled={zoom > 16} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {html && width ? (
          <WebView originWhitelist={['*']} source={{ html }} onMessage={onMessage} javaScriptEnabled
            scrollEnabled={false} onShouldStartLoadWithRequest={guard} style={{ width: frameW, height, backgroundColor: 'transparent' }} />
        ) : <View style={{ width: Math.max(0, width - 40), minHeight: 200, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.a700} /></View>}
      </ScrollView>
    </View>
  );
}
