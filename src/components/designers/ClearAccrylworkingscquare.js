import React, { useEffect, useRef, useState } from "react";
// clipper-lib removed (acrylic features removed)
import * as opentype from 'opentype.js';
import Footer from './Footer';
import PreviewModal from './PreviewModal';
import PayPalSDKLoader from './PayPalSDKLoader';
import PayPalButton from './PayPalButton';
import LEDMockupGlass from './LEDMockupGlass';

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
  // locked mode removed — keep state minimal
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
          // transparent canvas for clear acrylic appearance
          backgroundColor: "rgba(0,0,0,0)",
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
        });

        // capture modifications and deletions
        c.on('object:modified', (e) => { const obj = e && e.target; if (!obj) return; if (obj._mirrorLayer || obj._safeArea) return; try { pushHistory(); } catch(e){} });
        c.on('object:removed', (e) => { const obj = e && e.target; if (!obj) return; if (obj._mirrorLayer || obj._safeArea) return; try { pushHistory(); } catch(e){} });

        fabricCanvasRef.current = c;
        setReady(true);
  // auto-update wiring removed
        // (border editing disabled/removed)
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

  // border editing removed

  // Ensure canvas fills its container (fix left-gap / sizing): run after Fabric is ready
  useEffect(() => {
    const c = fabricCanvasRef.current;
    const dom = canvasRef.current;
    if (!c || !dom) return;

    function fitToContainer() {
      try {
  // measure the visible canvas size (do not modify inline CSS)
  const rect = dom.getBoundingClientRect ? dom.getBoundingClientRect() : { width: dom.clientWidth || 900, height: dom.clientHeight || 600 };
        const pxW = Math.max(1, Math.round(rect.width));
        const pxH = Math.max(1, Math.round(rect.height));

        // set the canvas bitmap to match the displayed size
        dom.width = pxW;
        dom.height = pxH;

        if (window.__FOTONIX_DEBUG_CANVAS__) {
          const parent = dom.parentElement || dom;
          parent.style.outline = '2px dashed rgba(255,0,0,0.6)';
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
  // Live mockup PNG data URL (keeps a small, throttled snapshot of the Fabric canvas)
  const [mockSrc, setMockSrc] = useState(null);
  // autoRing state removed

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

  // Keep a small, throttled live PNG of the Fabric canvas for the LED mockup.
  // IMPORTANT: do NOT listen to `after:render` here — that fires every frame and
  // can cause toDataURL -> render feedback loops. Use discrete events and throttle.
  useEffect(() => {
    const c = fabricCanvasRef.current;
    if (!c || !ready) return;

    let raf = null;
    let tmo = null;
    let pending = false;

    const capture = () => {
      pending = false;
      try {
        const w = Math.max(1, c.getWidth() || 900);
        const data = c.toDataURL({ format: "png", multiplier: Math.min(1, 500 / w) });
        setMockSrc(data);
      } catch (e) {
        // swallow — non-critical
      }
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      if (tmo) clearTimeout(tmo);
      tmo = setTimeout(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(capture);
      }, 120); // ~8 FPS throttle
    };

    // initial capture
    schedule();

    // discrete events only
    const onAdd = schedule;
    const onMod = schedule;
    const onRem = schedule;
    const onPath = schedule;

    try {
      c.on && c.on('object:added', onAdd);
      c.on && c.on('object:modified', onMod);
      c.on && c.on('object:removed', onRem);
      c.on && c.on('path:created', onPath);
    } catch (e) { /* ignore binding errors */ }

    return () => {
      try {
        c.off && c.off('object:added', onAdd);
        c.off && c.off('object:modified', onMod);
        c.off && c.off('object:removed', onRem);
        c.off && c.off('path:created', onPath);
      } catch (e) {}
      if (raf) cancelAnimationFrame(raf);
      if (tmo) clearTimeout(tmo);
    };
  }, [ready]);

  // Border feature removed

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

  // Border helpers removed

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

  // Lock mode removed — simpler UX preferred

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
    const { size = '512x512', backendUrl = '/api/generate-image' } = opts;
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
      const dataURL = await generateImageFromPrompt(p, { size: '512x512', backendUrl: '/api/generate-image' });
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
  // Acrylic features removed per pivot

  // --- OpenType font mapping & loaders (used for precise glyph outlines) ---
  // Provide URLs for the font families you use. Replace with your hosted TTF/OTF files.
  const FONT_URLS = {
    'Dancing Script': '/fonts/DancingScript-Regular.ttf',
    'Great Vibes': '/fonts/GreatVibes-Regular.ttf',
    'Pacifico': '/fonts/Pacifico-Regular.ttf',
    'Roboto': '/fonts/Roboto-Regular.ttf',
    'Inter': '/fonts/Inter-Regular.otf',
    'Chelsea Market': '/fonts/ChelseaMarket-Regular.ttf',
  };
  const __FONT_CACHE = new Map();
  async function loadFontForFamily(family = 'Roboto') {
    const key = (family || '').trim();
    if (__FONT_CACHE.has(key)) return __FONT_CACHE.get(key);
    const url = FONT_URLS[key] || FONT_URLS['Roboto'];
    if (!url) throw new Error(`No font URL mapped for "${family}"`);
    // debug: show which URL we attempt to load
    // eslint-disable-next-line no-console
    console.log('[loadFontForFamily] loading', key, '->', url);
    const font = await opentype.load(url);
    __FONT_CACHE.set(key, font);
    return font;
  }

  // --- OpenType flattening and conversion helpers ---------------------------
  function cubicEval(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return {
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    };
  }
  function quadEval(p0, p1, p2, t) {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    };
  }

  function commandsToPolylines(commands, tolPx = 1.5) {
    const paths = [];
    let current = [];
    let pen = { x: 0, y: 0 };
    let subStart = { x: 0, y: 0 };

    const push = (pt) => {
      if (!current.length || current[current.length - 1].x !== pt.x || current[current.length - 1].y !== pt.y) {
        current.push(pt);
      }
    };

    for (const cmd of commands) {
      if (cmd.type === 'M') {
        if (current.length) { paths.push(current); current = []; }
        pen = { x: cmd.x, y: cmd.y };
        subStart = { ...pen };
        push(pen);
      } else if (cmd.type === 'L') {
        const dx = cmd.x - pen.x, dy = cmd.y - pen.y;
        const len = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(len / Math.max(0.5, tolPx)));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          push({ x: pen.x + dx * t, y: pen.y + dy * t });
        }
        pen = { x: cmd.x, y: cmd.y };
      } else if (cmd.type === 'Q') {
        const p0 = { ...pen }, p1 = { x: cmd.x1, y: cmd.y1 }, p2 = { x: cmd.x, y: cmd.y };
        const approxLen = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const steps = Math.max(6, Math.ceil(approxLen / Math.max(0.5, tolPx)));
        for (let i = 1; i <= steps; i++) push(quadEval(p0, p1, p2, i / steps));
        pen = { x: cmd.x, y: cmd.y };
      } else if (cmd.type === 'C') {
        const p0 = { ...pen }, p1 = { x: cmd.x1, y: cmd.y1 }, p2 = { x: cmd.x2, y: cmd.y2 }, p3 = { x: cmd.x, y: cmd.y };
        const approxLen = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y);
        const steps = Math.max(8, Math.ceil(approxLen / Math.max(0.5, tolPx)));
        for (let i = 1; i <= steps; i++) push(cubicEval(p0, p1, p2, p3, i / steps));
        pen = { x: cmd.x, y: cmd.y };
      } else if (cmd.type === 'Z') {
        if (current.length && (current[0].x !== current[current.length - 1].x || current[0].y !== current[current.length - 1].y)) {
          current.push({ ...subStart });
        }
        if (current.length) { paths.push(current); current = []; }
        pen = { ...subStart };
      }
    }

    if (current.length) paths.push(current);
    return paths.filter(p => p.length >= 3);
  }

  function centerPolylines(polys) {
    let x1 = +Infinity, y1 = +Infinity, x2 = -Infinity, y2 = -Infinity;
    polys.forEach(poly => poly.forEach(p => { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); }));
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    return polys.map(poly => poly.map(p => ({ x: p.x - cx, y: p.y - cy })));
  }

  function toWorldClipper(poly, obj) {
    const m = obj.calcTransformMatrix();
    return poly.map(pt => {
      const local = new window.fabric.Point(pt.x, pt.y);
      const w = window.fabric.util.transformPoint(local, m);
      return { X: Math.round(w.x), Y: Math.round(w.y) };
    });
  }

  function dedupe(poly) {
    if (!poly || !poly.length) return poly;
    const out = [poly[0]];
    for (let i = 1; i < poly.length; i++) {
      const a = out[out.length - 1], b = poly[i];
      if (a.X !== b.X || a.Y !== b.Y) out.push(b);
    }
    return out;
  }

  async function textToOutlinesWithOpenType(obj, { tolPx = 1.25 } = {}) {
    const fabric = window.fabric;
    const font = await loadFontForFamily(obj.fontFamily);

    const cs = (obj.charSpacing || 0) / 1000;
    const letterSpacingPx = cs * (obj.fontSize || 40);

    const path = font.getPath(obj.text || '', 0, 0, obj.fontSize || 40, { kerning: true });

    if (letterSpacingPx) {
      const glyphs = font.stringToGlyphs(obj.text || '');
      let x = 0, y = 0;
      const p = new opentype.Path();
      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];
        const gp = g.getPath(x, y, obj.fontSize || 40);
        gp.commands.forEach(c => p.commands.push(c));
        const advance = (g.advanceWidth || 0) * (obj.fontSize || 40) / font.unitsPerEm;
        const kern = i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * (obj.fontSize || 40) / font.unitsPerEm : 0;
        x += advance + kern + letterSpacingPx;
      }
      path.commands = p.commands;
    }

    let polys = commandsToPolylines(path.commands, tolPx);
    if (!polys.length) return [];
    polys = centerPolylines(polys);
    const clipperPaths = polys.map(poly => dedupe(toWorldClipper(poly, obj)));
    return clipperPaths.filter(p => p.length >= 3);
  }

  async function objectToPolylinesAsync(obj, tolerance = 1.25) {
    if (!obj || obj._mirrorLayer || obj._safeArea) return [];
    if ((obj.type === 'group' || obj.type === 'activeSelection') && Array.isArray(obj._objects)) {
      const all = [];
      for (const o of obj._objects) { all.push(...(await objectToPolylinesAsync(o, tolerance))); }
      return all;
    }
    if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
      try {
        return await textToOutlinesWithOpenType(obj, { tolPx: tolerance });
      } catch (e) {
        // fallback to existing SVG-based sampler
        return textToPolylines(obj, tolerance);
      }
    }
    // fallback to synchronous sampler for non-text
    return objectToPolylines(obj, tolerance);
  }

  // --- High-quality path flattening (no external deps) -------------------------

  function lerp(a, b, t) { return a + (b - a) * t; }
  function quad(p0, p1, p2, t) {
    const x = lerp(lerp(p0.x, p1.x, t), lerp(p1.x, p2.x, t), t);
    const y = lerp(lerp(p0.y, p1.y, t), lerp(p1.y, p2.y, t), t);
    return { x, y };
  }
  function cubic(p0, p1, p2, p3, t) {
    const ax = lerp(p0.x, p1.x, t), ay = lerp(p0.y, p1.y, t);
    const bx = lerp(p1.x, p2.x, t), by = lerp(p1.y, p2.y, t);
    const cx = lerp(p2.x, p3.x, t), cy = lerp(p2.y, p3.y, t);
    const dx = lerp(ax, bx, t), dy = lerp(ay, by, t);
    const ex = lerp(bx, cx, t), ey = lerp(by, cy, t);
    return { x: lerp(dx, ex, t), y: lerp(dy, ey, t) };
  }

  /**
   * Flatten a Fabric parsed path (fabric.util.parsePath) to a dense polyline.
   * tol = max segment length in px (smaller => more points).
   */
  function flattenParsedPath(commands, tol = 6) {
    const pts = [];
    let cx = 0, cy = 0;        // current point
    let sx = 0, sy = 0;        // subpath start point (for Z)
    let px = 0, py = 0;        // previous control for S/T
    let prevCmd = '';

    const push = (x, y) => { pts.push({ x, y }); cx = x; cy = y; };

    for (const cmd of commands) {
      const op = cmd[0];
      const isRel = (op === op.toLowerCase());
      const code = op.toUpperCase();

      const num = (i) => cmd[i];

      const startX = cx, startY = cy;

      if (code === 'M') {
        const x = (isRel ? cx : 0) + num(1);
        const y = (isRel ? cy : 0) + num(2);
        push(x, y);
        sx = x; sy = y;
      }
      else if (code === 'L') {
        const x = (isRel ? cx : 0) + num(1);
        const y = (isRel ? cy : 0) + num(2);
        // subdivide long lines
        const dx = x - cx, dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, tol)));
        for (let i = 1; i <= steps; i++) {
          const t = i / steps; push(cx + dx * t, cy + dy * t);
        }
      }
      else if (code === 'H') {
        const x = (isRel ? cx : 0) + num(1);
        const y = cy;
        const dist = Math.abs(x - cx);
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, tol)));
        for (let i = 1; i <= steps; i++) push(lerp(cx, x, i/steps), y);
      }
      else if (code === 'V') {
        const x = cx;
        const y = (isRel ? cy : 0) + num(1);
        const dist = Math.abs(y - cy);
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, tol)));
        for (let i = 1; i <= steps; i++) push(x, lerp(cy, y, i/steps));
      }
      else if (code === 'Q') {
        const x1 = (isRel ? cx : 0) + num(1);
        const y1 = (isRel ? cy : 0) + num(2);
        const x =  (isRel ? cx : 0) + num(3);
        const y =  (isRel ? cy : 0) + num(4);
        const p0 = { x: cx, y: cy }, p1 = { x: x1, y: y1 }, p2 = { x, y };
        const len = Math.hypot(x - cx, y - cy);
        const steps = Math.max(6, Math.ceil(len / Math.max(1, tol)));
        for (let i = 1; i <= steps; i++) {
          const pt = quad(p0, p1, p2, i/steps); push(pt.x, pt.y);
        }
        px = x1; py = y1;
      }
      else if (code === 'T') {
        // smooth quadratic
        let x1 = cx + (cx - px), y1 = cy + (cy - py);
        const x = (isRel ? cx : 0) + num(1);
        const y = (isRel ? cy : 0) + num(2);
        const p0 = { x: cx, y: cy }, p1 = { x: x1, y: y1 }, p2 = { x, y };
        const len = Math.hypot(x - cx, y - cy);
        const steps = Math.max(6, Math.ceil(len / Math.max(1, tol)));
        for (let i = 1; i <= steps; i++) { const pt = quad(p0, p1, p2, i/steps); push(pt.x, pt.y); }
        px = x1; py = y1;
      }
      else if (code === 'C') {
        const x1 = (isRel ? cx : 0) + num(1);
        const y1 = (isRel ? cy : 0) + num(2);
        const x2 = (isRel ? cx : 0) + num(3);
        const y2 = (isRel ? cy : 0) + num(4);
        const x =  (isRel ? cx : 0) + num(5);
        const y =  (isRel ? cy : 0) + num(6);
        const p0 = { x: cx, y: cy }, p1 = { x: x1, y: y1 }, p2 = { x: x2, y: y2 }, p3 = { x, y };
        const chord = Math.hypot(x - cx, y - cy);
        const ctrl = Math.hypot(x1 - cx, y1 - cy) + Math.hypot(x2 - x, y2 - y);
        const steps = Math.max(10, Math.ceil((chord + ctrl) / Math.max(1, tol)));
        for (let i = 1; i <= steps; i++) { const pt = cubic(p0, p1, p2, p3, i/steps); push(pt.x, pt.y); }
        px = x2; py = y2;
      }
      else if (code === 'S') {
        // smooth cubic
        const rx = cx + (cx - px), ry = cy + (cy - py);
        const x2 = (isRel ? cx : 0) + num(1);
        const y2 = (isRel ? cy : 0) + num(2);
        const x =  (isRel ? cx : 0) + num(3);
        const y =  (isRel ? cy : 0) + num(4);
        const p0 = { x: cx, y: cy }, p1 = { x: rx, y: ry }, p2 = { x: x2, y: y2 }, p3 = { x, y };
        const chord = Math.hypot(x - cx, y - cy);
        const ctrl = Math.hypot(rx - cx, ry - cy) + Math.hypot(x2 - x, y2 - y);
        const steps = Math.max(10, Math.ceil((chord + ctrl) / Math.max(1, tol)));
        for (let i = 1; i <= steps; i++) { const pt = cubic(p0, p1, p2, p3, i/steps); push(pt.x, pt.y); }
        px = x2; py = y2;
      }
      else if (code === 'Z') {
        // close: ensure we end exactly at subpath start
        if (!pts.length || (pts[pts.length - 1].x !== sx || pts[pts.length - 1].y !== sy)) {
          push(sx, sy);
        }
      }

      prevCmd = code;
    }

    return pts;
  }

  /** Transform local points -> world (Clipper-int scaled) using the object's matrix. */
  function toWorldPts(localPts, obj) {
    const m = obj.calcTransformMatrix();
    return localPts.map(p => {
      const w = window.fabric.util.transformPoint(new window.fabric.Point(p.x, p.y), m);
      return { X: Math.round(w.x), Y: Math.round(w.y) };
    });
  }

  // --- Precise samplers --------------------------------------------------------

  /** Flatten a fabric.Path (its own bezier curves) to one polyline in world coords. */
  function sampleFabricPathToPolyline(obj, tol = 6) {
    try {
      const cmds = window.fabric.util.parsePath(obj.path || obj.pathOffset ? obj.path : (obj.get('path') || ''));
      if (!cmds || !cmds.length) return [];
      const local = flattenParsedPath(cmds, tol);
      return [toWorldPts(local, obj)];
    } catch { return []; }
  }

  /** Convert Text/IText/Textbox to glyph outlines via toSVG, then flatten. */
  function textToPolylines(obj, tol = 6) {
    try {
      const svg = obj.toSVG(); // contains one or many <path d="...">
      const dList = Array.from(svg.matchAll(/ d="([^\"]+)"/g)).map(m => m[1]);
      const polys = [];
      for (const d of dList) {
        const cmds = window.fabric.util.parsePath(d);
        const local = flattenParsedPath(cmds, tol);
        if (local.length >= 3) polys.push(toWorldPts(local, obj));
      }
      return polys.flat();
    } catch (e) {
      console.warn('textToPolylines fallback to box', e);
      const w = (obj.width || 0) * (obj.scaleX || 1);
      const h = (obj.height || 0) * (obj.scaleY || 1);
      const box = [{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
      return [toWorldPts(box, obj)];
    }
  }

  /** Circles/ellipses: dense perimeter sampling */
  function ellipseToPolyline(obj, tol = 6) {
    const rx = (obj.rx ?? obj.radius ?? obj.width/2) * (obj.scaleX || 1);
    const ry = (obj.ry ?? obj.radius ?? obj.height/2) * (obj.scaleY || 1);
    const peri = Math.PI * (3*(rx+ry) - Math.sqrt((3*rx+ry)*(rx+3*ry))); // Ramanujan
    const steps = Math.max(32, Math.ceil(peri / Math.max(1, tol)));
    const local = Array.from({length:steps}, (_,i) => {
      const a = (i/steps) * Math.PI*2; return { x: rx*Math.cos(a), y: ry*Math.sin(a) };
    });
    return [toWorldPts(local, obj)];
  }

  // --- Replace your objectToPolylines with this -------------------------------

  function objectToPolylines(obj, tolerance = 2) {
    if (!obj || obj._mirrorLayer || obj._safeArea) return [];

    // Groups/active selections: recurse
    if ((obj.type === 'group' || obj.type === 'activeSelection') && Array.isArray(obj._objects)) {
      return obj._objects.flatMap(o => objectToPolylines(o, tolerance));
    }

    // Text → real glyph outlines
    if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
      return textToPolylines(obj, tolerance);
    }

    // Paths → flatten their curves
    if (obj.type === 'path') {
      return sampleFabricPathToPolyline(obj, tolerance);
    }

    // Polygons → exact vertices
    if (obj.type === 'polygon' && Array.isArray(obj.points)) {
      return [toWorldPts(obj.points.map(p => ({x:p.x, y:p.y})), obj)];
    }

    // Rects with corner radius → outline with arcs (approx via path)
    if (obj.type === 'rect') {
      const rx = Math.max(0, obj.rx || 0) * (obj.scaleX || 1);
      const ry = Math.max(0, obj.ry || 0) * (obj.scaleY || 1);
      const w = (obj.width  || 0) * (obj.scaleX || 1);
      const h = (obj.height || 0) * (obj.scaleY || 1);
      if (rx > 0 || ry > 0) {
        const rrx = Math.min(rx, w/2), rry = Math.min(ry, h/2);
        const d = [
          `M ${-w/2 + rrx} ${-h/2}`,
          `L ${w/2 - rrx} ${-h/2}`,
          `Q ${w/2} ${-h/2} ${w/2} ${-h/2 + rry}`,
          `L ${w/2} ${h/2 - rry}`,
          `Q ${w/2} ${h/2} ${w/2 - rrx} ${h/2}`,
          `L ${-w/2 + rrx} ${h/2}`,
          `Q ${-w/2} ${h/2} ${-w/2} ${h/2 - rry}`,
          `L ${-w/2} ${-h/2 + rry}`,
          `Q ${-w/2} ${-h/2} ${-w/2 + rrx} ${-h/2}`,
          'Z'
        ].join(' ');
        const cmds = window.fabric.util.parsePath(d);
        const local = flattenParsedPath(cmds, tolerance);
        return [toWorldPts(local, obj)];
      } else {
        const box = [{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
        return [toWorldPts(box, obj)];
      }
    }

    // Circles/Ellipses → sampled perimeter
    if (obj.type === 'circle' || obj.type === 'ellipse') {
      return ellipseToPolyline(obj, tolerance);
    }

    // Images (still a box unless you add vectorization)
    if (obj.type === 'image') {
      const w = (obj.width || 0) * (obj.scaleX || 1);
      const h = (obj.height || 0) * (obj.scaleY || 1);
      const box = [{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
      return [toWorldPts(box, obj)];
    }

    return [];
  }

  // end removal of acrylic helpers

  function buildMirrorFinish(F, c) {
    // acrylic base: transparent main rect, frosted white overlay and subtle vignette
    const base = new F.Rect({ left: 0, top: 0, width: c.getWidth(), height: c.getHeight(), rx: 18, ry: 18, fill: '', selectable: false, evented: false });
    base._mirrorLayer = true;

    // frosted overlay - very low-opacity white to simulate diffused acrylic
    const frost = new F.Rect({ left: 0, top: 0, width: c.getWidth(), height: c.getHeight(), rx: 18, ry: 18, selectable: false, evented: false, opacity: 0.14 });
    frost.set('fill', 'rgba(255,255,255,0.14)');
    frost._mirrorLayer = true;

    // subtle top sheen (much weaker than metallic), small and soft
    const topSheen = new F.Rect({ left: -c.getWidth() * 0.1, top: -c.getHeight() * 0.12, width: c.getWidth() * 1.2, height: c.getHeight() * 0.24, angle: -18, selectable: false, evented: false, opacity: 0.06, rx: 10, ry: 10 });
    topSheen.set('fill', 'rgba(255,255,255,0.6)');
    topSheen._mirrorLayer = true;

    // subtle vignette to ground the panel
    const vignette = new F.Rect({ left: 4, top: 4, width: c.getWidth() - 8, height: c.getHeight() - 8, rx: 16, ry: 16, selectable: false, evented: false });
    vignette.set('fill', 'rgba(0,0,0,0.04)');
    vignette._mirrorLayer = true;

    c.add(base, frost, topSheen, vignette);
    base.sendToBack && base.sendToBack();
  }

  function updateMirrorFinish(c) {
  const layers = c.getObjects().filter((o) => o._mirrorLayer === true);
  const [base, frost, topSheen, vignette] = layers;
  if (!base || !frost || !topSheen || !vignette) return;
  base.set({ width: c.getWidth(), height: c.getHeight() });
  frost.set({ width: c.getWidth(), height: c.getHeight() });
  topSheen.set({ left: -c.getWidth() * 0.1, top: -c.getHeight() * 0.12, width: c.getWidth() * 1.2, height: c.getHeight() * 0.24 });
  vignette.set({ left: 4, top: 4, width: c.getWidth() - 8, height: c.getHeight() - 8 });
  // updateBorder removed
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
            <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur" style={{ display: 'inline-block' }}>
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
                <div className="relative">
                  {/* Floating expand control at top-right of the canvas frame */}
                  {/* floating expand control removed */}
                  <div className="relative">
                    <canvas ref={canvasRef} width={900} height={600} />
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
                  {/* Controls removed per pivot */}
                  {/* Add/Remove Border button removed */}
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
                    className={`w-full px-4 py-2 rounded-lg font-medium shadow text-white ${rainbowRunning ? 'shadow-lg' : ''}`}
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
            {/* NEW: Live LED mock-ups */}
            <LEDMockupGlass
              src={mockSrc}
              title="Lamp Preview"
              ringExpandPx={14}
              ringThicknessPx={10}
              platePaddingPx={18}
              maxArtWidth={260}
            />

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <h3 className="text-lg font-semibold mb-3">Customize</h3>

              <div className="mb-4">
                <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={onFileInput} />
                <button onClick={() => document.getElementById("fileInput")?.click()} className="w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white shadow hover:bg-sky-500">Upload Image</button>
              </div>

              {/* Border controls removed */}

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
                                    className="w-full rounded bg-white/10 px-3 py-2 text-slate-100 hover:bg-white/20 text-left"
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
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g.Angry cat on the moon" rows={2} className="w-full rounded-md bg-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none mb-2 resize-vertical" />

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
                      className={`w-full flex items-center justify-center px-3 py-2 rounded ${aiStyle === s.key ? 'bg-sky-600 text-white' : 'bg-white/5 text-slate-200'} text-sm`}
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
