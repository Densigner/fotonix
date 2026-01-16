window.location.hash = 'affiliate-product-accryl';
window.dispatchEvent(new Event('hashchange'));import React, { useEffect, useRef, useState } from "react";
import Footer from './Footer';
import PreviewModal from './PreviewModal';
import PayPalSDKLoader from './PayPalSDKLoader';
import PayPalButton from './PayPalButton';
import { API_URL } from '../../config/environment';

// Inline fallback header so the file compiles even if ./Header is missing.
// Replace <AppHeader /> with your own Header component later if desired.
const AppHeader = () => (
  <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-slate-900/70 backdrop-blur">
    <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
  <div className="text-xl font-semibold tracking-tight text-slate-100">Fotonix — Side-lit Acrylic Designer</div>
      <div className="text-slate-300 text-xs">Beta</div>
    </div>
  </header>
);

// Dynamic UMD loader for Fabric.js (robust for preview/bundlers)
async function loadFabric() {
  if (window.fabric && window.fabric.Canvas) return window.fabric;
  // reuse any in-flight load to avoid injecting the script multiple times (HMR or repeated mounts)
  if (window.__FOTONIX_FABRIC_PROMISE) return window.__FOTONIX_FABRIC_PROMISE;
  const urls = [
    "https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js",
    "https://unpkg.com/fabric@5.3.0/dist/fabric.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js",
  ];
  window.__FOTONIX_FABRIC_PROMISE = (async () => {
    for (const url of urls) {
      try {
        await injectScript(url, () => !!(window.fabric && window.fabric.Canvas));
        if (window.fabric && window.fabric.Canvas) return window.fabric;
      } catch (e) { console.warn("Fabric load failed from", url, e); }
    }
    throw new Error("Unable to load Fabric.js");
  })();
  return window.__FOTONIX_FABRIC_PROMISE;
}

function injectScript(src, ready, timeout = 12000) {
  return new Promise((resolve, reject) => {
    // if the exact script tag already exists, reuse it
    try {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        // if already loaded and fabric is present, resolve immediately
        if (window.fabric && window.fabric.Canvas) return resolve();
        // otherwise, attach listeners to the existing tag
        const onLoad = () => {
          try { if (ready && !ready()) throw new Error('ready check failed'); resolve(); } catch (e) { reject(e); }
        };
        existing.addEventListener('load', onLoad, { once: true });
        existing.addEventListener('error', (e) => reject(e), { once: true });
        return;
      }
    } catch (e) { /* ignore query issues */ }

    const s = document.createElement("script");
    s.src = src; s.async = true; s.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("timeout")), timeout);
    s.onload = () => {
      try {
        if (ready && !ready()) throw new Error("ready check failed");
        clearTimeout(timer); resolve();
      } catch (e) { clearTimeout(timer); reject(e); }
    };
    s.onerror = (e) => { clearTimeout(timer); reject(e); };
    document.head.appendChild(s);
  });
}

function ensureFont(family) {
  const id = `gf-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id; link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, "+")} :wght@400;600;700&display=swap`;
  // small fix: remove accidental space before :wght
  link.href = link.href.replace('%20:wght', ':wght');
  document.head.appendChild(link);
}

export default function ProductPage() {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const aiHelpBtnRef = useRef(null);
  const aiHelpBoxRef = useRef(null);
  const [aiHelpVisible, setAiHelpVisible] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [ready, setReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiStyle, setAiStyle] = useState("");
  const [edgeInfoVisible, setEdgeInfoVisible] = useState(false);
  // RAINBOW LED FEATURE: BEGIN (cordoned block — removable)
  // Toggle animated rainbow overlays on user objects. To remove this feature, delete
  // everything between the BEGIN and END markers below.
  const [rainbowRunning, setRainbowRunning] = useState(false);
  const rainbowAnimRef = useRef(null);
  const rainbowHueRef = useRef(0);
  const rainbowOverlaysRef = useRef(new Map()); // object.id -> overlay
    const borderRef = useRef(null);
  // --- Silhouette / LED border state ---
  const [ledMarginPx, setLedMarginPx] = useState(14); // outward offset for LED channel (px)
  const silhouetteRef = useRef(null);  // fabric.Path for the exact user silhouette
  const ledBorderRef  = useRef(null);  // fabric.Path for LED offset (preview stroke)
  // RAINBOW LED FEATURE: END
  const historyRef = useRef({ stack: [], index: -1, isLoading: false });
  // removed orientation/size preview state (revisit later)

  // Popular engraving-friendly fonts
  // curated, visually-distinct font set (includes a script: Great Vibes)
  const FONTS = [
    // Scripts first (user requested)
    "Great Vibes",
    "Pacifico",
    "Satisfy",

    // Neutral / modern sans
    "Inter",
    "Roboto",
    "Poppins",
    "Open Sans",

    // Humanist / friendly sans
    "Nunito",
    "Figtree",

    // Serifs
    "Playfair Display",
    "Merriweather",
    "Lora",
    "EB Garamond",

    // Display / headline
    "Abril Fatface",
    "Oswald",
    "Bebas Neue",

    // Slab / readable display
    "Bitter",

    // Specialty
    "Cormorant Garamond",
    "Source Sans Pro",
    "Raleway",
  ];

  // Init Fabric + base layers
  useEffect(() => {
    // ensure a helpful font is available
    ensureFont("Dancing Script");

    let disposed = false;
    (async () => {
      try {
        const F = await loadFabric();
        if (disposed || !canvasRef.current) return;

        // detect if Fabric was already initialized by another script instance
        try {
          const scripts = Array.from(document.querySelectorAll('script[src*="fabric"]'));
          if (scripts.length > 1) console.warn('Multiple fabric script tags detected:', scripts.map(s=>s.src));
        } catch(e) {}

        // prevent repeated inits in HMR/fast-refresh environments
        if (window.__FOTONIX_FABRIC_LOADED) {
          console.info('Fabric already initialized in this session; reusing existing instance.');
        }

        const c = new F.Canvas(canvasRef.current, {
          backgroundColor: "#f4f4f5",
          selection: true,
          renderOnAddRemove: true,
          enableRetinaScaling: false,
        });
        // WORKAROUND: Some code/inputs may set an invalid textBaseline value 'alphabetical'
        // which is not a valid CanvasTextBaseline. Patch the context to silently
        // map that common typo to the valid 'alphabetic' value. This block is
        // intentionally isolated and easy to remove.
        try {
          const proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
          if (proto && Object.getOwnPropertyDescriptor(proto, 'textBaseline')) {
            const desc = Object.getOwnPropertyDescriptor(proto, 'textBaseline');
            if (desc && desc.set) {
              const originalSet = desc.set;
              Object.defineProperty(proto, 'textBaseline', {
                configurable: true,
                enumerable: desc.enumerable,
                get: desc.get,
                set(value) {
                  try {
                    if (value === 'alphabetical') value = 'alphabetic';
                  } catch (e) {}
                  return originalSet.call(this, value);
                }
              });
            }
          }
        } catch (e) { /* ignore patch failures */ }
        try {
          if (F.Canvas2dFilterBackend) F.filterBackend = new F.Canvas2dFilterBackend();
          if (F.Object && F.Object.prototype) F.Object.prototype.objectCaching = false;
        } catch {}

  buildMirrorFinish(F, c);
        addSafeAreaOverlay(F, c);

  // mark loaded so subsequent mounts don't re-init unintentionally
  try { window.__FOTONIX_FABRIC_LOADED = true; } catch(e){}

        // push initial snapshot after base layers are added
        setTimeout(() => { try { pushHistory(); } catch(e){} }, 50);

        c.on("object:added", (e) => {
          const obj = e && e.target;
          // ignore internal mirror/safe-area objects
          if (obj && (obj._mirrorLayer === true || obj._safeArea === true)) return;
          // if it's an image, apply engraving filter
          if (obj && obj.type === "image") applyEngraveBlackFilter(F, obj, () => c.requestRenderAll());
          // push user-facing change into history
          try { pushHistory(); } catch (e) { console.warn('pushHistory error', e); }
          const safe = c.getObjects().find((o) => o._safeArea === true);
          if (safe) safe.bringToFront();
          try { refreshSilhouette(); } catch(e){}
        });

        // capture modifications and deletions
        c.on('object:modified', (e) => { const obj = e && e.target; if (!obj) return; if (obj._mirrorLayer || obj._safeArea) return; try { pushHistory(); } catch(e){} });
        c.on('object:removed', (e) => { const obj = e && e.target; if (!obj) return; if (obj._mirrorLayer || obj._safeArea) return; try { pushHistory(); } catch(e){} });

        fabricCanvasRef.current = c;
        setReady(true);
        // ensure border modification handler updates borderSize when user edits the border
            // border feature removed: no-op handler kept out
        // also hook silhouette refresh on object:modified/removed
        try { c.on && c.on('object:modified', () => { try { refreshSilhouette(); } catch(e){} }); } catch(e){}
        try { c.on && c.on('object:removed', () => { try { refreshSilhouette(); } catch(e){} }); } catch(e){}
      } catch (e) {
        console.error("Fabric init failed:", e);
      }
    })();

    return () => {
      disposed = true;
      try { fabricCanvasRef.current && fabricCanvasRef.current.dispose && fabricCanvasRef.current.dispose(); } catch {}
      fabricCanvasRef.current = null;
    };
  }, []);

  // Compute user silhouette + helpers
  async function computeUserSilhouette(F, c, { alphaThreshold = 8, simplifyTolerance = 1.5 } = {}) {
    const w = c.getWidth(), h = c.getHeight();
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.clearRect(0,0,w,h);

    const objs = c.getObjects().filter(o => !o._mirrorLayer && !o._safeArea && !o._isBorder && !o._rainbowOverlay);
    if (objs.length === 0) return null;

    // Render each object to offscreen via Fabric rendering to context if available
    for (const obj of objs) {
      const origVis = obj.visible; try { obj.visible = true; } catch(e){}
      try { if (typeof obj.render === 'function') obj.render(octx); } catch(e) { /* best-effort */ }
      try { obj.visible = origVis; } catch(e){}
    }

    const img = octx.getImageData(0,0,w,h);
    const mask = new Uint8Array(w*h);
    for (let i=0,p=0;i<img.data.length;i+=4,p++){
      const a = img.data[i+3]; mask[p] = a > alphaThreshold ? 1 : 0;
    }

    const contours = traceContours(mask, w, h);
    if (!contours.length) return null;
    const main = contours.sort((a,b)=> Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
    const simplified = rdp(main, simplifyTolerance);
    const d = pathFromPoints(simplified);
    const path = new F.Path(d, { left: 0, top: 0, fill: '', stroke: '#111', strokeWidth: 1, selectable: false, evented: false });
    path._silhouette = true;
    return path;
  }

  // helpers (pathFromPoints, polygonArea, rdp, perpDist, traceContours) — copy from instructions
  function pathFromPoints(pts) {
    if (!pts || pts.length === 0) return '';
    const [x0,y0] = pts[0];
    let d = `M ${x0} ${y0}`;
    for (let i=1;i<pts.length;i++){ const [x,y]=pts[i]; d += ` L ${x} ${y}`; }
    return d + ' Z';
  }
  function polygonArea(pts){ let a=0; for (let i=0,j=pts.length-1;i<pts.length;j=i++){ const [x1,y1]=pts[j], [x2,y2]=pts[i]; a += (x1*y2 - x2*y1);} return a/2; }
  function rdp(points, epsilon) { if (points.length<3) return points; let max=0, idx=0; const [x1,y1]=points[0], [x2,y2]=points[points.length-1]; for (let i=1;i<points.length-1;i++){ const d=perpDist(points[i],[x1,y1],[x2,y2]); if (d>max){ max=d; idx=i; } } if (max>epsilon){ const rec1 = rdp(points.slice(0, idx+1), epsilon); const rec2 = rdp(points.slice(idx), epsilon); return rec1.slice(0,-1).concat(rec2); } else return [points[0], points[points.length-1]]; }
  function perpDist([x0,y0],[x1,y1],[x2,y2]){ const A=x0-x1, B=y0-y1, C=x2-x1, D=y2-y1; const dot=A*C + B*D; const len=C*C + D*D; const t = len ? dot/len : 0; const xx = x1 + t*C, yy = y1 + t*D; const dx = x0 - xx, dy = y0 - yy; return Math.hypot(dx, dy); }

  function traceContours(mask, width, height) {
    const contours = []; const visited = new Uint8Array(width*height);
    function idx(x,y){ return y*width + x; }
    function isSolid(x,y){ if (x<0||y<0||x>=width||y>=height) return 0; return mask[idx(x,y)]; }
    for (let y=0;y<height;y++){
      for (let x=0;x<width;x++){
        if (!mask[idx(x,y)] || visited[idx(x,y)]) continue;
        const contour = [];
        let cx = x, cy = y, dir = 0;
        while (cx>0 && mask[idx(cx-1, cy)]) cx--;
        let sx = cx, sy = cy, first = true, guard = 0;
        do {
          guard++; if (guard > width*height*8) break;
          contour.push([cx, cy]); visited[idx(cx,cy)] = 1;
          const a = isSolid(cx-1, cy-1); const b = isSolid(cx, cy-1); const c = isSolid(cx-1, cy); const d = isSolid(cx, cy);
          const code = (a?8:0)|(b?4:0)|(c?2:0)|(d?1:0);
          if (code === 1 || code === 5 || code === 13) { cx += 1; dir = 0; }
          else if (code === 8 || code === 10 || code === 11){ cy -= 1; dir = 3; }
          else if (code === 4 || code === 12 || code === 14){ cx -= 1; dir = 2; }
          else if (code === 2 || code === 3 || code === 7){ cy += 1; dir = 1; }
          else { if (dir===0) cx+=1; else if (dir===1) cy+=1; else if (dir===2) cx-=1; else cy-=1; }
          if (!first && cx===sx && cy===sy) break; first = false;
        } while (true);
        if (contour.length > 4) contours.push(contour);
      }
    }
    return contours;
  }

  async function refreshSilhouette() {
    const F = window.fabric; const c = fabricCanvasRef.current; if (!F || !c) return;
    try { if (silhouetteRef.current) c.remove(silhouetteRef.current); } catch(e){}
    try { if (ledBorderRef.current) c.remove(ledBorderRef.current); } catch(e){}
    const path = await computeUserSilhouette(F, c);
    if (!path) { c.requestRenderAll && c.requestRenderAll(); return; }
    path.set({ stroke: '#111', strokeWidth: 1, selectable: false, evented: false });
    silhouetteRef.current = path; c.add(path);
    const ledStroke = Math.max(1, Math.round(ledMarginPx * 2));
    const led = new F.Path(path.path, {
      left: path.left, top: path.top, fill: '',
      stroke: new F.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1:0, y1:0, x2:1, y2:1 }, colorStops: [ { offset: 0.00, color: '#f8fafc' }, { offset: 0.18, color: '#dfe3e8' }, { offset: 0.35, color: '#cbd5e1' }, { offset: 0.65, color: '#e5e7eb' }, { offset: 1.00, color: '#f8fafc' }, ] }),
      strokeWidth: ledStroke, strokeLineJoin: 'round', strokeLineCap: 'round', selectable: false, evented: false, opacity: 0.9
    });
    led._ledPreview = true; ledBorderRef.current = led; c.add(led);
    const safe = c.getObjects().find(o => o._safeArea === true); if (safe) safe.bringToFront();
    c.requestRenderAll && c.requestRenderAll();
  }

  async function exportCutSvg() {
    const c = fabricCanvasRef.current; if (!c) return alert('Canvas not ready'); const F = window.fabric;
    if (!silhouetteRef.current) { await refreshSilhouette(); if (!silhouetteRef.current) return alert('No silhouette available'); }
    const pathObj = silhouetteRef.current;
    const d = pathObj.getSvgPathData ? pathObj.getSvgPathData() : F.util.pathToSVGString(pathObj.path);
    const viewW = c.getWidth(), viewH = c.getHeight();
    let ledPathD = null;
    if (window.ClipperLib) {
      try {
        const scale = 100;
        const poly = svgPathToPolygon(d, 2.0);
        const subj = [poly.map(([x,y]) => ({X: Math.round(x*scale), Y: Math.round(y*scale)}))];
        const co = new window.ClipperLib.ClipperOffset(2, 2);
        co.AddPaths(subj, window.ClipperLib.JoinType.jtRound, window.ClipperLib.EndType.etClosedPolygon);
        const solution = new window.ClipperLib.Paths();
        co.Execute(solution, Math.round(ledMarginPx*scale));
        if (solution.length) { const out = solution[0].map(p => [p.X/scale, p.Y/scale]); ledPathD = pathFromPoints(out); }
      } catch (e) { console.warn('Clipper offset failed, falling back to stroke preview method', e); }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewW}" height="${viewH}" viewBox="0 0 ${viewW} ${viewH}">\n  <path d="${d}" fill="none" stroke="#FF0000" stroke-width="0.1"/>\n  ${ledPathD ? `<path d="${ledPathD}" fill="none" stroke="#0000FF" stroke-width="0.1"/>` : `<path d="${d}" fill="none" stroke="#0000FF" stroke-width="${(ledMarginPx*2).toFixed(2)}"/>`}\n</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'fotonix_cut.svg'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  function svgPathToPolygon(d, step=2) {
    const cmds = d.match(/[a-df-z][^a-df-z]*/ig) || []; let x=0,y=0, start=[0,0]; const points=[];
    for (const cmd of cmds) {
      const c = cmd[0]; const nums = cmd.slice(1).trim().split(/[ ,]+/).map(Number).filter(n=>!isNaN(n));
      if (c==='M' || c==='m') { x = (c==='m') ? x+nums[0] : nums[0]; y = (c==='m') ? y+nums[1] : nums[1]; start=[x,y]; points.push([x,y]); for (let i=2;i<nums.length;i+=2){ x = (c==='m') ? x+nums[i] : nums[i]; y = (c==='m') ? y+nums[i+1] : nums[i+1]; points.push([x,y]); } }
      else if (c==='L' || c==='l') { for (let i=0;i<nums.length;i+=2){ const nx = (c==='l') ? x+nums[i] : nums[i]; const ny = (c==='l') ? y+nums[i+1] : nums[i+1]; const dx = nx-x, dy = ny-y; const len = Math.hypot(dx,dy); const segs = Math.max(1, Math.round(len/step)); for (let s=1;s<=segs;s++){ const px = x + dx*(s/segs), py = y + dy*(s/segs); points.push([px,py]); } x=nx; y=ny; } }
      else if (c==='Z' || c==='z') { points.push(start); } else { }
    }
    return points;
  }

  // border editing removed

  // Ensure canvas fills its container (fix left-gap / sizing): run after Fabric is ready
  useEffect(() => {
    const c = fabricCanvasRef.current;
    const dom = canvasRef.current;
    if (!c || !dom) return;

    function fitToContainer() {
      try {
        // use CSS to fill available width visually, then measure the actual displayed size
        dom.style.boxSizing = 'border-box';
        dom.style.width = '100%';
        dom.style.height = '100%';

        // measure the visible canvas size
        const rect = dom.getBoundingClientRect ? dom.getBoundingClientRect() : { width: dom.clientWidth || 900, height: dom.clientHeight || 600 };
        const pxW = Math.max(1, Math.round(rect.width));
        const pxH = Math.max(1, Math.round(rect.height));

        // set the canvas bitmap to match the displayed size
        dom.width = pxW;
        dom.height = pxH;

        if (window.__FOTONIX_DEBUG_CANVAS__) {
          const parent = dom.parentElement || dom;
          parent.style.outline = '2px dashed rgba(255,0,0,0.6)';
          dom.style.outline = '2px dashed rgba(0,255,0,0.6)';
          console.log('[fitToContainer] dom rect', rect.width, rect.height, '-> px', pxW, pxH, 'dom.client', dom.clientWidth, dom.clientHeight);
        }

        // update Fabric internals
        try {
          if (typeof c.setDimensions === 'function') {
            c.setDimensions({ width: pxW, height: pxH });
          } else {
            c.setWidth && c.setWidth(pxW);
            c.setHeight && c.setHeight(pxH);
          }
        } catch (inner) { try { c.setWidth && c.setWidth(pxW); c.setHeight && c.setHeight(pxH); } catch(e){} }

        c.calcOffset && c.calcOffset();
        c.requestRenderAll && c.requestRenderAll();
  // border feature removed
      } catch (e) { console.warn('fitToContainer failed', e); }
    }

    // initial fit
    fitToContainer();
    // re-fit on window resize
    window.addEventListener('resize', fitToContainer);
    return () => { window.removeEventListener('resize', fitToContainer); };
  }, [ready]);

  // helper: convert cm to px (assuming 96 DPI)
  const cmToPx = (cm) => Math.max(1, Math.round(cm * (96 / 2.54)));

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);

  // capture a snapshot of the Fabric canvas (scale down if requested)
  async function captureSnapshot({ maxWidth = 1200 } = {}) {
    const c = fabricCanvasRef.current; if (!c) throw new Error('Canvas not ready');
    try {
      // compute multiplier to limit width
      const w = c.getWidth();
      const multiplier = (maxWidth && w > maxWidth) ? (maxWidth / w) : 1;
      const dataUrl = c.toDataURL({ format: 'png', multiplier });
      return dataUrl;
    } catch (e) {
      console.warn('captureSnapshot failed', e);
      throw e;
    }
  }

  // updateBorder removed

  // When expanded toggles, refresh visual layers
  useEffect(() => {
    const c = fabricCanvasRef.current; if (!c) return;
    try { updateMirrorFinish(c); updateSafeAreaOverlay(c); c.requestRenderAll && c.requestRenderAll(); } catch(e) {}
  }, [expanded]);

  const getCanvas = () => fabricCanvasRef.current || null;

  const toggleDraw = () => {
    const c = getCanvas(); if (!c) return;
    const next = !c.isDrawingMode; c.isDrawingMode = next; setIsDrawing(next);
    if (next && c.freeDrawingBrush) { c.freeDrawingBrush.color = "#000"; c.freeDrawingBrush.width = 5; }
    c.requestRenderAll && c.requestRenderAll();
  };

  // border helpers removed

  const pushHistory = () => {
    const c = getCanvas(); if (!c) return;
    const h = historyRef.current; if (h.isLoading) return;
    try {
      const json = c.toJSON();
      const str = JSON.stringify(json);
      // advance index and truncate any redo states
      h.index = Math.max(-1, h.index) + 1;
      h.stack.splice(h.index, h.stack.length - h.index, str);
      // cap history
      if (h.stack.length > 60) {
        h.stack.shift();
        h.index = h.stack.length - 1;
      }
    } catch (e) { console.warn('pushHistory failed', e); }
  };

  const undo = () => {
    const c = getCanvas(); if (!c) return;
    const h = historyRef.current; if (h.index <= 0) return;
    h.index = h.index - 1;
    const state = h.stack[h.index]; if (!state) return;
    try {
      h.isLoading = true;
      c.loadFromJSON(state, () => { try { c.renderAll(); } catch(e){} h.isLoading = false; });
    } catch (e) { console.warn('undo failed', e); h.isLoading = false; }
  };

  const redo = () => {
    const c = getCanvas(); if (!c) return;
    const h = historyRef.current; if (h.index >= h.stack.length - 1) return;
    h.index = h.index + 1;
    const state = h.stack[h.index]; if (!state) return;
    try {
      h.isLoading = true;
      c.loadFromJSON(state, () => { try { c.renderAll(); } catch(e){} h.isLoading = false; });
    } catch (e) { console.warn('redo failed', e); h.isLoading = false; }
  };

  const addText = (family = "Dancing Script") => {
    const c = getCanvas(); if (!c) return;
    ensureFont(family);
    const t = new window.fabric.IText("Your Text", {
      left: c.getWidth() / 2,
      top: c.getHeight() / 2,
      originX: "center",
      originY: "center",
      fontFamily: family,
      fontSize: expanded ? 60 : 40,
      fill: "#000",
      editable: true,
    });
    c.add(t); c.setActiveObject && c.setActiveObject(t);
    try { t.enterEditing && t.enterEditing(); t.selectAll && t.selectAll(); } catch {}
    c.requestRenderAll && c.requestRenderAll();
  };

  const deleteSelected = () => {
    const c = getCanvas(); if (!c) return;
    const active = (c.getActiveObjects && c.getActiveObjects()) || [];
    if (!active.length) { alert("No objects selected"); return; }
    active.forEach((obj) => { if (!obj._mirrorLayer && !obj._safeArea) c.remove(obj); });
    c.discardActiveObject && c.discardActiveObject();
    const safe = c.getObjects().find((o) => o._safeArea === true);
    if (safe) safe.bringToFront();
    c.requestRenderAll && c.requestRenderAll();
  };

  // Fabric filter chain for engraving-ready B/W (preserve edges)
  const applyEngraveBlackFilter = (F, img, cb) => {
    try {
      const filters = [];
      if (F.Image && F.Image.filters && F.Image.filters.Grayscale) filters.push(new F.Image.filters.Grayscale());
      if (F.Image && F.Image.filters && F.Image.filters.Sharpen)   filters.push(new F.Image.filters.Sharpen());
      if (F.Image && F.Image.filters && F.Image.filters.Contrast)  filters.push(new F.Image.filters.Contrast({ contrast: 0.55 }));
      if (F.Image && F.Image.filters && F.Image.filters.BlackWhite) {
        filters.push(new F.Image.filters.BlackWhite());
      } else if (F.Image && F.Image.filters && F.Image.filters.ColorMatrix) {
        filters.push(new F.Image.filters.ColorMatrix({
          matrix: [
            1.5,1.5,1.5,0,-1.2,
            1.5,1.5,1.5,0,-1.2,
            1.5,1.5,1.5,0,-1.2,
            0,0,0,1,0,
          ],
        }));
      }
      if (F.Image && F.Image.filters && F.Image.filters.RemoveColor) filters.push(new F.Image.filters.RemoveColor({ color: '#FFFFFF', distance: 0.15 }));
      img.filters = filters;
      img.applyFilters && img.applyFilters();
      img.dirty = true;
      cb && cb();
    } catch (e) {
      console.warn("Filter apply failed", e);
      cb && cb();
    }
  };

  const addImageFile = (file) => {
    const c = getCanvas(); if (!c) return;
    if (!file.type || !file.type.startsWith("image/")) { alert("Please choose an image file"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      window.fabric.Image.fromURL(reader.result, (img) => {
        const maxW = c.getWidth() * 0.8; const maxH = c.getHeight() * 0.8;
        const sc = Math.min(maxW / img.width, maxH / img.height, 1);
        img.set({ originX: "center", originY: "center", left: c.getWidth() / 2, top: c.getHeight() / 2, selectable: true });
        if (sc > 0 && isFinite(sc)) img.scale(sc);
        applyEngraveBlackFilter(window.fabric, img, () => {
          c.add(img); c.setActiveObject && c.setActiveObject(img);
          const safe = c.getObjects().find((o) => o._safeArea === true); if (safe) safe.bringToFront();
          c.requestRenderAll && c.requestRenderAll();
        });
      }, { crossOrigin: 'anonymous' });
    };
    reader.readAsDataURL(file);
  };

  // --- AI image generation helpers ---
  async function generateImageFromPrompt(prompt, opts = {}) {
    const { size = '512x512', backendUrl = 'http://51.75.78.118:4000/api/generate-image' } = opts;
    if (!prompt || !prompt.trim()) throw new Error('Prompt required');

    const resp = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size })
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Generation failed: ${resp.status} ${txt}`);
    }

    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await resp.json();
      if (!j) throw new Error('No image returned from API');
      if (j.image) return j.image;
      if (j.imageBase64) return `data:image/png;base64,${j.imageBase64}`;
      if (j.image_base64) return `data:image/png;base64,${j.image_base64}`;
      if (j.url) return j.url;
      throw new Error('No image returned from API');
    }

    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function addGeneratedImageToCanvas(dataURL, { left = 100, top = 80, maxWidth = 400 } = {}) {
    const c = getCanvas(); if (!c) throw new Error('Canvas not available');
    window.fabric.Image.fromURL(dataURL, (img) => {
      const maxW = Math.min(maxWidth, c.getWidth() * 0.8);
      const maxH = c.getHeight() * 0.8;
      const sc = Math.min(maxW / img.width, maxH / img.height, 1);
      img.set({ originX: 'left', originY: 'top', left, top, selectable: true });
      if (sc > 0 && isFinite(sc)) img.scale(sc);
      applyEngraveBlackFilter(window.fabric, img, () => {
        c.add(img); c.setActiveObject && c.setActiveObject(img);
        const safe = c.getObjects().find((o) => o._safeArea === true); if (safe) safe.bringToFront();
        c.requestRenderAll && c.requestRenderAll();
      });
    }, { crossOrigin: 'anonymous' });
  }

  // RAINBOW LED FEATURE: BEGIN
  // helper to create rainbow color stops for a gradient
  function makeRainbowStops(hue) {
    const stops = [];
    const segments = 6;
    for (let i = 0; i <= segments; i++) {
      const h = (hue + (i * 360) / segments) % 360;
      stops.push({ offset: i / segments, color: `hsl(${h} 90% 55%)` });
    }
    return stops;
  }

  async function addRainbowOverlayForObject(F, c, obj) {
    try {
      // clone object to use as clipPath so overlay follows shape
      obj.clone((cloned) => {
        try {
          cloned.set({ selectable: false, evented: false, absolutePositioned: true });
          // full-canvas rect with gradient fill that will be clipped to object
          const overlay = new F.Rect({ left: 0, top: 0, width: c.getWidth(), height: c.getHeight(), selectable: false, evented: false, opacity: 0.6 });
          overlay.excludeFromExport = true;
          overlay.clipPath = cloned;
          overlay._rainbowOverlay = true;
          c.add(overlay);
          // store overlay keyed by object
          rainbowOverlaysRef.current.set(obj.toObject ? obj.toObject().id || obj.__uid || Math.random() : obj.__uid || Math.random(), overlay);
        } catch (e) { console.warn('addRainbowOverlayForObject failed', e); }
      });
    } catch (e) { console.warn('addRainbowOverlayForObject error', e); }
  }

  function clearAllRainbowOverlays(c) {
    try {
      for (const overlay of rainbowOverlaysRef.current.values()) {
        try { c.remove(overlay); } catch (e) {}
      }
      rainbowOverlaysRef.current.clear();
    } catch (e) { console.warn('clearAllRainbowOverlays', e); }
  }

  function animateRainbow(F, c) {
    rainbowHueRef.current = (rainbowHueRef.current + 1) % 360;
    const hue = rainbowHueRef.current;
    for (const overlay of rainbowOverlaysRef.current.values()) {
      try {
        overlay.set('fill', new F.Gradient({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: makeRainbowStops((hue + (Math.random()*40 - 20)) % 360) }));
        overlay.dirty = true;
      } catch (e) {}
    }
    c.requestRenderAll && c.requestRenderAll();
    rainbowAnimRef.current = requestAnimationFrame(() => animateRainbow(F, c));
  }

  function startRainbow(F, c) {
    if (!F || !c) return;
    // create overlays for current user objects (exclude mirror/safe)
    const objs = c.getObjects().filter(o => !o._mirrorLayer && !o._safeArea && !o._rainbowOverlay);
    objs.forEach(o => addRainbowOverlayForObject(F, c, o));
    // start animation loop
    if (rainbowAnimRef.current) cancelAnimationFrame(rainbowAnimRef.current);
    rainbowAnimRef.current = requestAnimationFrame(() => animateRainbow(F, c));
    setRainbowRunning(true);
  }

  function stopRainbow(F, c) {
    if (rainbowAnimRef.current) { cancelAnimationFrame(rainbowAnimRef.current); rainbowAnimRef.current = null; }
    clearAllRainbowOverlays(c);
    setRainbowRunning(false);
    c.requestRenderAll && c.requestRenderAll();
  }
  // RAINBOW LED FEATURE: END

  async function handleGenerateSilhouetteWithPrompt(prompt) {
    const c = getCanvas(); if (!c) return;
    const base = (prompt || aiPrompt || '').trim();
    const styleMap = {
      cartoon: 'Cartoon style (Disney-like, bright colours, playful):',
      line: 'Line art, clean black strokes, high contrast:',
      sketch: 'Pencil sketch, rough texture, hand-drawn:',
      ink: 'Ink drawing, comic ink style, bold lines:',
      minimal: 'Minimalist flat design, simple shapes, limited palette:',
      vector: 'Vector illustration, crisp shapes, flat colours:',
    };
    const stylePrefix = aiStyle && styleMap[aiStyle] ? styleMap[aiStyle] + ' ' : '';
    const p = (stylePrefix + base).trim();
    if (!p) { alert('Please enter a prompt'); return; }
    try {
      setGenerating(true);
      const dataURL = await generateImageFromPrompt(p, { size: '512x512' });
      addGeneratedImageToCanvas(dataURL, { left: 100, top: 80, maxWidth: 480 });
    } catch (err) {
      console.error(err);
      alert('AI generation failed: ' + (err && err.message ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  }

  const onFileInput = (e) => { const f = e.target.files && e.target.files[0]; if (f) addImageFile(f); e.currentTarget.value = ""; };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) addImageFile(f); };
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragOver(false); };

  const downloadPNG = async () => {
    const c = getCanvas(); if (!c) return alert("Canvas not ready");
    const dataUrl = c.toDataURL({ format: "png" });
    const a = document.createElement("a"); a.href = dataUrl; a.download = "mirror.png"; a.click();
  };

  // --- Mirror/metallic finish layers ---
  function buildMirrorFinish(F, c) {
    const gradient = new F.Gradient({
      type: "linear",
      gradientUnits: "percentage",
      coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
      colorStops: [
        { offset: 0, color: "#f8fafc" },
        { offset: 0.25, color: "#dfe3e8" },
        { offset: 0.5, color: "#cbd5e1" },
        { offset: 0.75, color: "#e5e7eb" },
        { offset: 1, color: "#f8fafc" },
      ],
    });

    const base = new F.Rect({ left: 0, top: 0, width: c.getWidth(), height: c.getHeight(), rx: 18, ry: 18, selectable: false, evented: false });
    base.set("fill", gradient);
    base._mirrorLayer = true;

    const sheen = new F.Rect({ left: -c.getWidth() * 0.2, top: -c.getHeight() * 0.2, width: c.getWidth() * 1.4, height: c.getHeight() * 0.5, angle: -20, selectable: false, evented: false, opacity: 0.18, rx: 12, ry: 12 });
    sheen.set("fill", new F.Gradient({ type: "linear", gradientUnits: "percentage", coords: { x1: 0, y1: 0, x2: 1, y2: 0 }, colorStops: [ { offset: 0, color: "rgba(255,255,255,0)" }, { offset: 1, color: "rgba(255,255,255,0.85)" } ] }));
    sheen._mirrorLayer = true;

  // hide the visual frame stroke to keep a clean canvas look; keep layer for layout
  const frame = new F.Rect({ left: 8, top: 8, width: c.getWidth() - 16, height: c.getHeight() - 16, rx: 14, ry: 14, fill: "", stroke: "transparent", strokeWidth: 0, selectable: false, evented: false });
    frame._mirrorLayer = true;

    c.add(base, sheen, frame);
    base.sendToBack && base.sendToBack();
  }

  function updateMirrorFinish(c) {
  const layers = c.getObjects().filter((o) => o._mirrorLayer === true);
  const [base, sheen, frame] = layers;
  if (!base || !sheen || !frame) return;
  base.set({ width: c.getWidth(), height: c.getHeight() });
  sheen.set({ left: -c.getWidth() * 0.2, top: -c.getHeight() * 0.2, width: c.getWidth() * 1.4, height: c.getHeight() * 0.5 });
  frame.set({ left: 8, top: 8, width: c.getWidth() - 16, height: c.getHeight() - 16 });
  try { updateBorder(c); } catch (e) { /* ignore */ }
  }

  // --- Safe engravable area overlay (always sized to canvas) ---
  function addSafeAreaOverlay(F, c) {
    const margin = 40;
    const safe = new F.Rect({
      left: margin,
      top: margin,
      width: c.getWidth() - margin * 2,
      height: c.getHeight() - margin * 2,
  fill: "",
  // keep logical safe-area but hide visual marker by using a transparent stroke
  stroke: "transparent",
  strokeDashArray: null,
  strokeWidth: 0,
      selectable: false,
      evented: false,
    });
    safe._safeArea = true;
    c.add(safe);
    safe.bringToFront && safe.bringToFront();
  }

  function updateSafeAreaOverlay(c) {
  const safe = c.getObjects().find((o) => o._safeArea === true);
  if (!safe) return;
  const margin = 40;
  safe.set({ left: margin, top: margin, width: c.getWidth() - margin * 2, height: c.getHeight() - margin * 2 });
  safe.bringToFront && safe.bringToFront();
  }

  // --- Self tests (on-demand) ---
  function runSelfTests() {
    try {
      const c = getCanvas(); if (!c) throw new Error('no canvas');
      console.groupCollapsed('Fabric self-tests');
      console.assert(c.getWidth() > 0 && c.getHeight() > 0, 'Canvas should have dimensions');
      const safe = c.getObjects().find((o) => o._safeArea === true);
      console.assert(!!safe, 'Safe area overlay should exist');
      if (safe) { const m = 40; console.assert(Math.abs(safe.left - m) < 0.001 && Math.abs(safe.top - m) < 0.001, 'Safe inset margin matches'); }
      const tiny = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgV8vP4kAAAAASUVORK5CYII=";
      window.fabric.Image.fromURL(tiny, (img) => { c.add(img); img.left = 2; img.top = 2; c.requestRenderAll && c.requestRenderAll(); });
      const t = new window.fabric.IText('TEST', { left: 5, top: 5, fill: '#000' }); c.add(t); c.setActiveObject && c.setActiveObject(t);
      console.assert(!!c.getActiveObject(), 'Text should be active after add');
      console.groupEnd();
    } catch (e) {
      console.warn('Self-tests failed:', e);
    }
  }

  // --- UI ---
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <AppHeader />
      {/* Ensure PayPal SDK is injected when this page mounts */}
      <PayPalSDKLoader onLoad={() => { /* PayPal SDK loaded */ }} />

      <div className="relative mx-auto max-w-7xl px-6 pb-16">
  <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Left: Canvas & actions */}
          <section className="lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl ring-1 ring-black/5 backdrop-blur" style={{ display: 'inline-block' }}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_20px_2px_rgba(52,211,153,.5)]" />
                  <h2 className="text-lg font-semibold">Design Your Mirror</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* expand control removed per UX request */}
                </div>
              </div>

              <div className="px-5 pb-5">
                <div className="relative rounded-xl border border-white/10 bg-slate-50 shadow-inner">
                  {/* Floating expand control at top-right of the canvas frame */}
                  {/* floating expand control removed */}
                  <div className="relative overflow-hidden rounded-xl">
                    {/* Edge info: explain reserved LED strip area around the mirror */}
                    <div className="absolute top-3 right-3 z-40">
                      <button
                        className="text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-black/20"
                        aria-label="Edge info"
                        onMouseEnter={() => setEdgeInfoVisible(true)}
                        onFocus={() => setEdgeInfoVisible(true)}
                        onMouseLeave={() => setEdgeInfoVisible(false)}
                        onBlur={() => setEdgeInfoVisible(false)}
                      >
                        i
                      </button>
                      <div className="absolute right-0 mt-10 w-64 p-3 rounded bg-slate-800 text-sm text-slate-200 shadow-lg transition-opacity duration-150"
                        style={{ zIndex: 60, opacity: edgeInfoVisible ? 1 : 0, pointerEvents: edgeInfoVisible ? 'auto' : 'none' }}
                        role="tooltip"
                        aria-hidden={!edgeInfoVisible}
                      >
                        Edges around the mirror are reserved for Fotonix LED strips. Keep critical design elements inside the safe area.
                      </div>
                    </div>
                    {/* Keep DOM canvas attrs static; size changes via Fabric setWidth/Height to avoid resets */}
                    <canvas ref={canvasRef} width={900} height={600} style={{ display: 'block' }} />

                    {/* 1cm inset dashed overlay to indicate reserved border (non-interactive) */}
                    <div aria-hidden="true" style={{ position: 'absolute', left: '0.5cm', top: '0.5cm', right: '0.5cm', bottom: '0.5cm', border: '2px dashed rgba(0,0,0,0.85)', borderRadius: 12, pointerEvents: 'none' }} />
                  </div>
                </div>

                {/* Controls */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium shadow" onClick={toggleDraw}>{isDrawing ? "Exit Draw" : "Draw"}</button>
                  {/* Add Text button removed per request */}
                  <button className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-medium shadow" onClick={undo}>Undo</button>
                  <button className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium shadow" onClick={redo}>Redo</button>
                  <button className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium shadow" onClick={deleteSelected}>Delete Selected</button>
                  <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow" onClick={downloadPNG}>Download</button>
                  {/* Border controls removed per request */}
                  {/* orientation controls removed */}
                  {/* left-side size dropdown and run tests removed (sidebar has Size control) */}
                </div>
                {/* Rainbow LED toggle button (cordoned feature) */}
                <div className="mt-3">
                  <button
                    onClick={() => {
                      const F = window.fabric; const c = fabricCanvasRef.current;
                      if (!F || !c) return alert('Canvas not ready for rainbow animation');
                      // discard any active selection so selection outlines are removed when the rainbow starts
                      try { c.discardActiveObject && c.discardActiveObject(); c.requestRenderAll && c.requestRenderAll(); } catch (e) { console.warn('discardActiveObject failed', e); }
                      if (rainbowRunning) {
                        stopRainbow(F, c);
                        // ensure selection cleared after stopping as well
                        try { c.discardActiveObject && c.discardActiveObject(); c.requestRenderAll && c.requestRenderAll(); } catch (e) { console.warn('discard active after stop failed', e); }
                      } else {
                        startRainbow(F, c);
                      }
                    }}
                    className={`w-full px-4 py-2 rounded-lg font-medium shadow text-white ${rainbowRunning ? 'ring-2 ring-offset-2 ring-sky-400' : ''}`}
                    style={{
                      background: rainbowRunning ? 'linear-gradient(90deg, #ff007f, #ff7a00, #ffd100, #2cff6c, #00e7ff, #7b5cff)' : 'linear-gradient(90deg, #ff7a00, #ffd100, #2cff6c)'
                    }}
                  >
                    {rainbowRunning ? 'Stop Rainbow LEDs' : 'Start Rainbow LEDs'}
                  </button>
                </div>
                <div className="mt-3">
                  <button
                    onClick={async () => {
                      console.log('[Preview] button clicked');
                      try {
                        console.log('[Preview] starting captureSnapshot');
                        const url = await captureSnapshot({ maxWidth: 1200 });
                        console.log('[Preview] captureSnapshot succeeded, url length=', url ? url.length : 0);
                        setPreviewDataUrl(url);
                        setPreviewOpen(true);
                        console.log('[Preview] preview state set, previewOpen=true');
                      } catch (e) {
                        console.error('[Preview] capture failed', e);
                        alert('Preview failed: ' + (e && e.message ? e.message : e));
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg font-medium shadow text-white bg-indigo-600 hover:bg-indigo-500"
                  >
                    Preview & Share
                  </button>
                </div>

                {/* LED margin control + Export SVG */}
                <div className="mt-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-200 mb-2">LED border margin (px)</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={4} max={60} value={ledMarginPx} onChange={(e)=>{ setLedMarginPx(Number(e.target.value||0)); try{ refreshSilhouette(); }catch(e){} }} className="w-full" />
                      <input type="number" min={0} max={200} value={ledMarginPx} onChange={(e)=>{ setLedMarginPx(Math.max(0,Number(e.target.value||0))); try{ refreshSilhouette(); }catch(e){} }} className="w-20 rounded px-2 py-1 text-slate-900" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Visual LED channel preview. Manufacturing offset is applied in the SVG export.</p>
                  </div>

                  <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow" onClick={downloadPNG}>Download</button>
                    <button className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-medium shadow" onClick={exportCutSvg}>Export Cut SVG</button>
                  </div>
                </div>

                {/* Purchase Options (PayPal cards) - moved under the canvas */}
                <div className="mt-6">
                  <div className="max-w-full">
                    <h3 className="text-lg font-semibold mb-4">Purchase Options</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 rounded-lg bg-white/80 border border-white/10 shadow flex flex-col">
                        <div className="flex-1">
                          <h4 className="font-medium">Standard Mirror</h4>
                          <p className="text-sm text-slate-600">Simple engraving, suitable for most designs.</p>
                          <div className="mt-3 text-2xl font-bold">£29.99</div>
                        </div>
                        <div className="mt-4"><PayPalButton amount={"29.99"} productName={"Fotonix Standard Mirror"} onSuccess={(details) => console.log('Paid standard', details)} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* (Removed duplicate Purchase Options sidebar) */}

          {/* Right: Upload + Fonts + AI */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl ring-1 ring-black/5 backdrop-blur">
              <h3 className="text-lg font-semibold mb-3">Customize</h3>

              <div className="mb-4">
                <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={onFileInput} />
                <button onClick={() => document.getElementById("fileInput")?.click()} className="w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white shadow hover:bg-sky-500">Upload Image</button>
              </div>

              {/* Border size control */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-200 mb-2">Border inset (px)</label>
                <div className="flex items-center gap-3">
                  {/* Border size control removed */}
                </div>
                <p className="text-xs text-slate-400 mt-1">Adjust how far the border inset is from the canvas edges. 0 means flush to edge.</p>
              </div>

              {/* Size selection removed; use defaults or implement later */}

              <div className={`rounded-lg border p-4 ${dragOver ? "border-sky-400/70 bg-sky-400/10" : "border-white/10 bg-white/0"}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
                <p className="text-sm text-slate-300">Or drag & drop an image here</p>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-200 mb-2">Google Fonts</label>
                            {/* Single-line horizontally scrollable font picker (keeps same height) */}
                            {/* Vertical stacked font picker with vertical scroll (fixed height) */}
                            <div className="overflow-y-auto no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', maxHeight: 200, overflowX: 'hidden' }}>
                              <div className="flex flex-col space-y-2 py-1">
                                {FONTS.map((family) => (
                                  <button
                                    key={family}
                                    onClick={() => addText(family)}
                                    className="w-full rounded bg-white/10 px-3 py-2 text-slate-100 ring-1 ring-white/10 hover:bg-white/20 text-left"
                                    style={{ fontFamily: `'${family}', system-ui, sans-serif`, height: 40 }}
                                    onMouseEnter={() => ensureFont(family)}
                                    title={family}
                                  >
                                    {family}
                                  </button>
                                ))}
                              </div>
                            </div>
              </div>

              {/* AI prompt + generate (stacked: input above button) */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-200 mb-2">Use AI to help create your image</label>
                  <div className="ml-2 relative">
                    <button
                      ref={aiHelpBtnRef}
                      className="text-slate-400 hover:text-slate-200 px-2 py-1 rounded"
                      aria-label="AI prompt help"
                      aria-describedby="ai-help-box"
                      onMouseEnter={() => setAiHelpVisible(true)}
                      onFocus={() => setAiHelpVisible(true)}
                      onMouseLeave={() => setAiHelpVisible(false)}
                      onBlur={() => setAiHelpVisible(false)}
                    >
                      i
                    </button>
                    <div
                      ref={aiHelpBoxRef}
                      id="ai-help-box"
                      role="tooltip"
                      className="absolute right-0 mt-8 w-64 p-3 rounded bg-slate-800 text-sm text-slate-200 shadow-lg transition-opacity duration-150"
                      style={{ zIndex: 60, opacity: aiHelpVisible ? 1 : 0, pointerEvents: aiHelpVisible ? 'auto' : 'none' }}
                      aria-hidden={!aiHelpVisible}
                    >
                      Tips: Be specific & concise. Include subject, mood. Examples: "Angry cat on the moon, whimsical". Use the style buttons to add a strong visual direction (e.g. "Cartoon style") before your prompt.
                    </div>
                  </div>
                </div>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g.Angry cat on the moon" rows={2} className="w-full rounded-md bg-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 ring-1 ring-white/10 focus:outline-none mb-2 resize-vertical" />

                {/* Style buttons: each will add a style prefix to the prompt when generating */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { key: 'cartoon', label: 'Cartoon style', prompt: 'Cartoon style (Disney-like, Saturday morning cartoons)' },
                    { key: 'line', label: 'Line art', prompt: 'Line art, clean black lines on white background' },
                    { key: 'sketch', label: 'Sketch / Pencil', prompt: 'Sketch, pencil drawing, rough texture' },
                    { key: 'ink', label: 'Ink drawing', prompt: 'Ink drawing, high-contrast comic ink style' },
                    { key: 'minimal', label: 'Minimalist', prompt: 'Minimalist flat design, simple shapes, limited palette' },
                    { key: 'vector', label: 'Vector art', prompt: 'Vector art, clean shapes, scalable illustration' },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => setAiStyle(aiStyle === s.key ? '' : s.key)}
                      className={`w-full flex items-center justify-center px-3 py-2 rounded ${aiStyle === s.key ? 'bg-sky-600 text-white' : 'bg-white/5 text-slate-200'} text-sm ring-1 ring-white/8`}
                      title={s.prompt}
                    >
                      <span className="text-center">{s.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex">
                  <button className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium shadow hover:bg-blue-500 disabled:opacity-60" disabled={generating} onClick={() => handleGenerateSilhouetteWithPrompt()}>{generating ? 'Generating…' : 'Generate'}</button>
                </div>
              </div>
            </div>
            {/* Sidebar orientation select removed (left-hand select is authoritative) */}
          </aside>
        </div>
      </div>

  {/* Render the preview modal when requested */}
  {previewOpen && (
    <PreviewModal
      open={previewOpen}
      imageDataUrl={previewDataUrl}
      onClose={() => { setPreviewOpen(false); setPreviewDataUrl(null); }}
    />
  )}

  {/* Footer is rendered centrally in App.js; remove duplicate here to avoid two footers */}
    </div>
  );
}
