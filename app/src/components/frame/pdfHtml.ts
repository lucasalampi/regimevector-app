// pdf.js page renderer shared by the native WebView and the web iframe.
// pdf.js 3.11.174 (the prototype's build) is vendored in assets/pdfjs, so briefs render offline.

export type FrameMsg = { rv: true; type: 'pages'; n: number } | { rv: true; type: 'height'; h: number } | { rv: true; type: 'error' };

/** Inline text (native) or same-origin URLs to fetch (web). */
export type PdfjsSource = { lib: string; worker: string } | { libUrl: string; workerUrl: string };

// JSON for a <script> body: neutralise "</script" and friends.
const js = (v: unknown) => JSON.stringify(v).replace(/<\//g, '<\\/');

/**
 * @param pdf    `{ b64 }` inline bytes (native) or `{ url }` same-origin URL (web).
 * @param pdfjs  where the pdf.js library and worker come from.
 * @param post   JS function expression that receives each message object.
 */
export function pdfHtml(pdf: { b64: string } | { url: string }, pdfjs: PdfjsSource, post: string): string {
  const load = 'b64' in pdf
    ? `{ data: Uint8Array.from(atob(${js(pdf.b64)}), function(c){ return c.charCodeAt(0); }) }`
    : `{ url: ${js(pdf.url)} }`;
  const text = 'lib' in pdfjs
    ? `Promise.resolve([${js(pdfjs.lib)}, ${js(pdfjs.worker)}])`
    : `Promise.all([fetch(${js(pdfjs.libUrl)}).then(function(r){ return r.text(); }), fetch(${js(pdfjs.workerUrl)}).then(function(r){ return r.text(); })])`;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>html,body{margin:0;padding:0;background:transparent}#p{display:flex;flex-direction:column;gap:10px}
canvas{width:100%;height:auto;display:block;background:#fff;border:1px solid #d9e0e7;box-sizing:border-box}</style>
</head><body><div id="p"></div><script>
(function(){
  var post = ${post};
  var send = function(m){ m.rv = true; try { post(m); } catch (e) {} };
  var host = document.getElementById('p');
  var height = function(){ send({ type: 'height', h: host.scrollHeight }); };
  window.addEventListener('resize', height);
  var blobUrl = function(src){ return URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); };
  ${text}.then(function(t){
    return new Promise(function(ok, bad){
      var s = document.createElement('script'); s.src = blobUrl(t[0]); s.onload = function(){ ok(t[1]); }; s.onerror = bad;
      document.head.appendChild(s);
    });
  }).then(function(worker){
    pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl(worker);
    return pdfjsLib.getDocument(${load}).promise;
  }).then(async function(pdf){
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    for (var i = 1; i <= pdf.numPages; i++) {
      var pg = await pdf.getPage(i);
      var base = pg.getViewport({ scale: 1 });
      var vp = pg.getViewport({ scale: Math.max(1, (host.clientWidth * dpr) / base.width) });
      var c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height; c.style.aspectRatio = vp.width + ' / ' + vp.height;
      host.appendChild(c);
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      height();
    }
    send({ type: 'pages', n: pdf.numPages });
    height();
  }).catch(function(){ send({ type: 'error' }); });
})();
</script></body></html>`;
}
