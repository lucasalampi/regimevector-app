// pdf.js page renderer shared by the native WebView and the web iframe.
// pdf.js 3.11.174 (the prototype's build) is vendored in assets/pdfjs, so briefs render offline.
//
// Two modes:
//  - inline: fit-to-width pages inside the Reader's own scroll. No internal scrolling; tapping a page
//    posts {type:'open', page}. Page boxes are sized from build-time aspect ratios before anything renders.
//  - viewer: full-screen reading. The document scrolls itself, renders pages lazily around the viewport,
//    re-renders sharp on zoom, carries a selectable text layer and reports the current page.

export type FrameMsg =
  | { rv: true; type: 'pages'; n: number }
  | { rv: true; type: 'height'; h: number }
  | { rv: true; type: 'page'; n: number }
  | { rv: true; type: 'open'; page: number }
  | { rv: true; type: 'error' };

/** Inline text (native) or same-origin URLs to fetch (web). */
export type PdfjsSource = { lib: string; worker: string } | { libUrl: string; workerUrl: string };

export interface PdfHtmlOptions {
  mode: 'inline' | 'viewer';
  /** Page height / width for each page, from build-time metadata (optional). */
  aspects?: number[];
  /** 1-based page to open at (viewer). */
  page?: number;
  /** Initial zoom, 1 = fit width (viewer). */
  zoom?: number;
}

// JSON for a <script> body: neutralise "</script" and friends.
const js = (v: unknown) => JSON.stringify(v).replace(/<\//g, '<\\/');

export function pdfHtml(pdf: { b64: string } | { url: string }, pdfjs: PdfjsSource, post: string, opts: PdfHtmlOptions): string {
  const viewer = opts.mode === 'viewer';
  const load = 'b64' in pdf
    ? `{ data: Uint8Array.from(atob(${js(pdf.b64)}), function(c){ return c.charCodeAt(0); }) }`
    : `{ url: ${js(pdf.url)} }`;
  const text = 'lib' in pdfjs
    ? `Promise.resolve([${js(pdfjs.lib)}, ${js(pdfjs.worker)}])`
    : `Promise.all([fetch(${js(pdfjs.libUrl)}).then(function(r){ return r.text(); }), fetch(${js(pdfjs.workerUrl)}).then(function(r){ return r.text(); })])`;
  const viewport = viewer
    ? 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes'
    : 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="${viewport}">
<style>
html,body{margin:0;padding:0;background:${viewer ? '#e4e9ee' : 'transparent'};-webkit-text-size-adjust:none}
body{${viewer ? 'overflow:auto;-webkit-overflow-scrolling:touch' : 'overflow:hidden'}}
#p{display:flex;flex-direction:column;gap:${viewer ? 12 : 10}px;box-sizing:border-box;${viewer ? 'padding:12px;' : ''}width:100%}
.pg{position:relative;width:100%;background:#fff;border:1px solid #d9e0e7;box-sizing:border-box;overflow:hidden;${viewer ? '' : 'cursor:zoom-in;'}-webkit-tap-highlight-color:transparent}
.pg canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.pg .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:500 12px -apple-system,Helvetica,Arial,sans-serif;color:#9fb0c2;letter-spacing:.06em}
.textLayer{position:absolute;inset:0;overflow:hidden;opacity:1;line-height:1;text-align:initial;-webkit-text-size-adjust:none;text-size-adjust:none;forced-color-adjust:none;transform-origin:0 0;z-index:2}
.textLayer span,.textLayer br{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%}
.textLayer span.markedContent{top:0;height:0}
.textLayer ::selection{background:rgba(188,147,48,.35)}
</style>
</head><body><div id="p"></div><script>
(function(){
  var VIEWER = ${viewer}, ASPECTS = ${js(opts.aspects ?? [])}, START = ${Math.max(1, opts.page ?? 1)};
  var zoom = ${viewer ? Math.max(1, opts.zoom ?? 1) : 1};
  var post = ${post};
  var send = function(m){ m.rv = true; try { post(m); } catch (e) {} };
  var host = document.getElementById('p');
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  var pdf = null, slots = [], queue = [], busy = false, gen = 0;

  var height = function(){ send({ type: 'height', h: host.scrollHeight }); };
  var widthFor = function(){ return Math.max(100, (document.documentElement.clientWidth - (VIEWER ? 24 : 0)) * zoom); };

  function makeSlots(n){
    host.innerHTML = ''; slots = [];
    host.style.width = VIEWER ? (widthFor() + 24) + 'px' : '100%';
    for (var i = 0; i < n; i++) {
      var d = document.createElement('div'); d.className = 'pg';
      d.style.aspectRatio = '1 / ' + (ASPECTS[i] || ASPECTS[0] || 1.2941);
      d.innerHTML = '<div class="ph">PAGE ' + (i + 1) + '</div>';
      (function(k){ if (!VIEWER) d.addEventListener('click', function(){ send({ type: 'open', page: k + 1 }); }); })(i);
      host.appendChild(d); slots.push({ el: d, done: -1 });
    }
    height();
  }

  function pump(){
    if (busy || !queue.length) return;
    busy = true;
    var i = queue.shift(), s = slots[i], g = gen;
    if (s.done === g) { busy = false; return pump(); }
    pdf.getPage(i + 1).then(function(pg){
      var base = pg.getViewport({ scale: 1 });
      var cssW = s.el.clientWidth;
      var css = pg.getViewport({ scale: cssW / base.width });
      var vp = pg.getViewport({ scale: (cssW * dpr) / base.width });
      var c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      return pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function(){
        if (g !== gen) return;
        s.el.innerHTML = ''; s.el.appendChild(c); s.done = g;
        if (VIEWER && pdfjsLib.renderTextLayer) {
          var tl = document.createElement('div'); tl.className = 'textLayer';
          tl.style.setProperty('--scale-factor', css.scale);
          s.el.appendChild(tl);
          return pdfjsLib.renderTextLayer({ textContentSource: pg.streamTextContent(), container: tl, viewport: css }).promise.catch(function(){});
        }
      });
    }).catch(function(){}).then(function(){ busy = false; pump(); });
  }

  // Render what is on (or near) screen first; inline mode renders every page in order.
  var io = null;
  function observe(){
    if (io) io.disconnect();
    if (!VIEWER || !('IntersectionObserver' in window)) { queue = slots.map(function(_, i){ return i; }); return pump(); }
    io = new IntersectionObserver(function(es){
      es.forEach(function(e){ var i = slots.findIndex(function(s){ return s.el === e.target; }); if (e.isIntersecting && slots[i].done !== gen && queue.indexOf(i) < 0) queue.unshift(i); });
      pump();
    }, { rootMargin: '150% 0px' });
    slots.forEach(function(s){ io.observe(s.el); });
  }

  // Current page = the slot covering the middle of the viewport.
  var lastPage = 0;
  function reportPage(){
    var mid = window.innerHeight / 2, n = 1;
    for (var i = 0; i < slots.length; i++) { var r = slots[i].el.getBoundingClientRect(); if (r.top <= mid) n = i + 1; else break; }
    if (n !== lastPage) { lastPage = n; send({ type: 'page', n: n }); }
  }

  function setZoom(z){
    if (!VIEWER || !pdf) return;
    z = Math.max(1, Math.min(4, z));
    if (z === zoom) return;
    var se = document.scrollingElement || document.documentElement;
    var fy = se.scrollTop / Math.max(1, se.scrollHeight), fx = se.scrollLeft / Math.max(1, se.scrollWidth);
    zoom = z; gen++;
    host.style.width = (widthFor() + 24) + 'px';
    se.scrollTop = fy * se.scrollHeight; se.scrollLeft = fx * se.scrollWidth;
    queue = []; observe(); height(); reportPage();
  }
  function goPage(n){ var s = slots[n - 1]; if (s) s.el.scrollIntoView({ block: 'start' }); }

  window.rv = { zoom: setZoom, page: goPage };
  window.addEventListener('message', function(e){ var m = e.data; if (m && m.rvcmd === 'zoom') setZoom(m.z); if (m && m.rvcmd === 'page') goPage(m.n); });
  window.addEventListener('scroll', function(){ if (VIEWER) reportPage(); }, { passive: true });
  var rw = 0;
  window.addEventListener('resize', function(){
    var w = document.documentElement.clientWidth; if (w === rw) return; rw = w;
    if (!pdf) return; gen++; host.style.width = VIEWER ? (widthFor() + 24) + 'px' : '100%'; queue = []; observe(); height();
  });

  if (ASPECTS.length) makeSlots(ASPECTS.length);

  var blobUrl = function(src){ return URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); };
  ${text}.then(function(t){
    return new Promise(function(ok, bad){
      var s = document.createElement('script'); s.src = blobUrl(t[0]); s.onload = function(){ ok(t[1]); }; s.onerror = bad;
      document.head.appendChild(s);
    });
  }).then(function(worker){
    pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl(worker);
    return pdfjsLib.getDocument(${load}).promise;
  }).then(function(doc){
    pdf = doc; rw = document.documentElement.clientWidth;
    if (slots.length !== pdf.numPages) makeSlots(pdf.numPages);
    send({ type: 'pages', n: pdf.numPages });
    if (VIEWER && START > 1) goPage(START);
    observe(); reportPage();
  }).catch(function(){ send({ type: 'error' }); });
})();
</script></body></html>`;
}
