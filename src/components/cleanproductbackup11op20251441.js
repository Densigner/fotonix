import React, { useEffect, useRef, useState } from "react";
import Footer from './Footer';

// Inline fallback header so the file compiles even if ./Header is missing.
// Replace <AppHeader /> with your own Header component later if desired.
const AppHeader = () => (
  <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-slate-900/70 backdrop-blur">
    <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
      <div className="text-xl font-semibold tracking-tight text-slate-100">Fotonix — Mirror Engraving Designer</div>
      <div className="text-slate-300 text-xs">Beta</div>
    </div>
  </header>
);

// Dynamic UMD loader for Fabric.js (robust for preview/bundlers)
async function loadFabric() {
  if (window.fabric && window.fabric.Canvas) return window.fabric;
  const urls = [
    "https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js",
    "https://unpkg.com/fabric@5.3.0/dist/fabric.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js",
  ];
  for (const url of urls) {
    try {
      await injectScript(url, () => !!(window.fabric && window.fabric.Canvas));
      if (window.fabric && window.fabric.Canvas) return window.fabric;
    } catch (e) { console.warn("Fabric load failed from", url, e); }
  }
  throw new Error("Unable to load Fabric.js");
}

function injectScript(src, ready, timeout = 12000) {
  return new Promise((resolve, reject) => {
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

  const [isDrawing, setIsDrawing] = useState(false);
  const [ready, setReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  // Orientation & size controls
  const [orientation, setOrientation] = useState("landscape"); // 'landscape' | 'portrait'
  const sizeOptions = [
    { label: "15cm X 30cm", wCm: 15, hCm: 30, inStock: true },
    { label: "30cm X 60cm (Out of stock)", wCm: 30, hCm: 60, inStock: false },
    { label: "50cm X 100cm (Out of stock)", wCm: 50, hCm: 100, inStock: false },
  ];
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);

  // Popular engraving-friendly fonts
  const FONTS = [
    "Cinzel",
    "Playfair Display",
    "Montserrat",
    "Lora",
    "Great Vibes",
    "Dancing Script",
    "Pinyon Script",
    "Josefin Sans",
    "Roboto",
    "Cormorant Garamond",
    "Merriweather",
  ];

  // Init Fabric + base layers
  useEffect(() => {
    ensureFont("Dancing Script");

    let disposed = false;
    (async () => {
      try {
        const F = await loadFabric();
        if (disposed || !canvasRef.current) return;

        const c = new F.Canvas(canvasRef.current, {
          backgroundColor: "#f4f4f5",
          selection: true,
          renderOnAddRemove: true,
          enableRetinaScaling: false,
        });
        try {
          if (F.Canvas2dFilterBackend) F.filterBackend = new F.Canvas2dFilterBackend();
          if (F.Object && F.Object.prototype) F.Object.prototype.objectCaching = false;
        } catch {}

        buildMirrorFinish(F, c);
        addSafeAreaOverlay(F, c);

        c.on("object:added", (e) => {
          const obj = e && e.target;
          if (obj && obj.type === "image") applyEngraveBlackFilter(F, obj, () => c.requestRenderAll());
          const safe = c.getObjects().find((o) => o._safeArea === true);
          if (safe) safe.bringToFront();
        });

        fabricCanvasRef.current = c;
        setReady(true);
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

  // helper: convert cm to px (assuming 96 DPI)
  const cmToPx = (cm) => Math.max(1, Math.round(cm * (96 / 2.54)));

  function applySelectedSizeToCanvas(c) {
    if (!c) return;
    const opt = sizeOptions[selectedSizeIndex] || sizeOptions[0];
    let wCm = opt.wCm, hCm = opt.hCm;
    // swap if portrait orientation
    if (orientation === 'landscape') {
      // treat first number as short side if label is "15 X 30" => width becomes 30
      // We'll interpret wCm as short side and hCm as long side when label uses that order
      // To keep it simple: if long side > short side, ensure width is long side in landscape
      if (hCm > wCm) { const tmp = wCm; wCm = hCm; hCm = tmp; }
    } else {
      // portrait: make width the short side
      if (wCm > hCm) { const tmp = wCm; wCm = hCm; hCm = tmp; }
    }

  const pxW = cmToPx(wCm);
  const pxH = cmToPx(hCm);
  const scale = expanded ? 1.4 : 1.0;
  // portrait sizes tend to appear very large in the browser; reduce to ~50% for portrait
  const portraitScale = orientation === 'portrait' ? 0.5 : 1.0;
  const finalW = Math.round(pxW * scale * portraitScale);
  const finalH = Math.round(pxH * scale * portraitScale);

    try {
      c.setWidth(finalW);
      c.setHeight(finalH);
      // also update DOM canvas element attributes when present
      if (canvasRef && canvasRef.current) {
        canvasRef.current.width = finalW;
        canvasRef.current.height = finalH;
      }
      c.calcOffset && c.calcOffset();
      updateMirrorFinish(c);
      updateSafeAreaOverlay(c);
      c.requestRenderAll && c.requestRenderAll();
    } catch (e) { console.warn('Failed to apply size to canvas', e); }
  }

  // Resize when expanding/collapsing or orientation/size change
  useEffect(() => {
    const c = fabricCanvasRef.current; if (!c) return;
    applySelectedSizeToCanvas(c);
  }, [expanded, orientation, selectedSizeIndex]);

  const getCanvas = () => fabricCanvasRef.current || null;

  const toggleDraw = () => {
    const c = getCanvas(); if (!c) return;
    const next = !c.isDrawingMode; c.isDrawingMode = next; setIsDrawing(next);
    if (next && c.freeDrawingBrush) { c.freeDrawingBrush.color = "#000"; c.freeDrawingBrush.width = 5; }
    c.requestRenderAll && c.requestRenderAll();
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
      if (!j || !j.image) throw new Error('No image returned from API');
      return j.image;
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

  async function handleGenerateSilhouetteWithPrompt(prompt) {
    const c = getCanvas(); if (!c) return;
    const p = (prompt || aiPrompt || '').trim();
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

      <div className="relative mx-auto max-w-7xl px-6 pb-16">
  <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Left: Canvas & actions */}
          <section className="lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl ring-1 ring-black/5 backdrop-blur">
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
                    {/* Keep DOM canvas attrs static; size changes via Fabric setWidth/Height to avoid resets */}
                    <canvas ref={canvasRef} width={900} height={600} className="block w-full" />
                  </div>
                </div>

                {/* Controls */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium shadow" onClick={toggleDraw}>{isDrawing ? "Exit Draw" : "Draw"}</button>
                  <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow" onClick={() => addText()}>Add Text</button>
                  <button className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium shadow" onClick={deleteSelected}>Delete Selected</button>
                  <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow" onClick={downloadPNG}>Download</button>
                  {/* Orientation select */}
                  <div className="flex items-center">
                    <label className="sr-only">Orientation</label>
                    <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="rounded-md bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10">
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                  {/* left-side size dropdown and run tests removed (sidebar has Size control) */}
                </div>
              </div>
            </div>
          </section>

          {/* Right: Upload + Fonts + AI */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl ring-1 ring-black/5 backdrop-blur">
              <h3 className="text-lg font-semibold mb-3">Customize</h3>

              <div className="mb-4">
                <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={onFileInput} />
                <button onClick={() => document.getElementById("fileInput")?.click()} className="w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white shadow hover:bg-sky-500">Upload Image</button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-200 mb-2">Size</label>
                <select value={selectedSizeIndex} onChange={(e) => setSelectedSizeIndex(Number(e.target.value))} className="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-slate-100 ring-1 ring-white/10">
                  {sizeOptions.map((opt, idx) => (
                    <option key={opt.label} value={idx} disabled={!opt.inStock} style={{ color: opt.inStock ? undefined : '#9ca3af' }}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">Select orientation and size. Out-of-stock sizes are disabled.</p>
              </div>

              <div className={`rounded-lg border p-4 ${dragOver ? "border-sky-400/70 bg-sky-400/10" : "border-white/10 bg-white/0"}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
                <p className="text-sm text-slate-300">Or drag & drop an image here</p>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-200 mb-2">Google Fonts</label>
                <div className="grid grid-cols-2 gap-2">
                  {FONTS.map((family) => (
                    <button
                      key={family}
                      onClick={() => addText(family)}
                      className="rounded bg-white/10 px-3 py-2 text-left text-slate-100 ring-1 ring-white/10 hover:bg-white/20"
                      style={{ fontFamily: `'${family}', system-ui, sans-serif` }}
                      onMouseEnter={() => ensureFont(family)}
                    >
                      {family}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI prompt + generate (stacked: input above button) */}
              <div className="mt-5">
                <label className="block text-sm font-medium text-slate-200 mb-2">Generate silhouette with AI</label>
                <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. oak leaf, wolf head, floral crest" className="w-full rounded-md bg-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 ring-1 ring-white/10 focus:outline-none mb-2" />
                <div className="flex">
                  <button className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium shadow hover:bg-blue-500 disabled:opacity-60" disabled={generating} onClick={() => handleGenerateSilhouetteWithPrompt()}>{generating ? 'Generating…' : 'Generate'}</button>
                </div>
                <p className="mt-2 text-xs text-slate-400">Uses your server’s /api/generate-image (key stays server-side). Result is added to canvas and filtered for engraving.</p>
              </div>
            </div>
            {/* Sidebar orientation select removed (left-hand select is authoritative) */}
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import Footer from './Footer';

// Inline fallback header so the file compiles even if ./Header is missing.
// Replace <AppHeader /> with your own Header component later if desired.
const AppHeader = () => (
  <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-slate-900/70 backdrop-blur">
    <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
      <div className="text-xl font-semibold tracking-tight text-slate-100">Fotonix — Mirror Engraving Designer</div>
      <div className="text-slate-300 text-xs">Beta</div>
    </div>
  </header>
);

// Dynamic UMD loader for Fabric.js (robust for preview/bundlers)
async function loadFabric() {
  if (window.fabric && window.fabric.Canvas) return window.fabric;
  const urls = [
    "https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js",
    "https://unpkg.com/fabric@5.3.0/dist/fabric.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js",
  ];
  for (const url of urls) {
    try {
      await injectScript(url, () => !!(window.fabric && window.fabric.Canvas));
      if (window.fabric && window.fabric.Canvas) return window.fabric;
    } catch (e) { console.warn("Fabric load failed from", url, e); }
  }
  throw new Error("Unable to load Fabric.js");
}

function injectScript(src, ready, timeout = 12000) {
  return new Promise((resolve, reject) => {
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

  const [isDrawing, setIsDrawing] = useState(false);
  const [ready, setReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  // Orientation & size controls
  const [orientation, setOrientation] = useState("landscape"); // 'landscape' | 'portrait'
  const sizeOptions = [
    { label: "15cm X 30cm", wCm: 15, hCm: 30, inStock: true },
    { label: "30cm X 60cm (Out of stock)", wCm: 30, hCm: 60, inStock: false },
    { label: "50cm X 100cm (Out of stock)", wCm: 50, hCm: 100, inStock: false },
  ];
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);

  // Popular engraving-friendly fonts
  const FONTS = [
    "Cinzel",
    "Playfair Display",
    "Montserrat",
    "Lora",
    "Great Vibes",
    "Dancing Script",
    "Pinyon Script",
    "Josefin Sans",
    "Roboto",
    "Cormorant Garamond",
    "Merriweather",
  ];

  // Init Fabric + base layers
  useEffect(() => {
    ensureFont("Dancing Script");

    let disposed = false;
    (async () => {
      try {
        const F = await loadFabric();
        if (disposed || !canvasRef.current) return;

        const c = new F.Canvas(canvasRef.current, {
          backgroundColor: "#f4f4f5",
          selection: true,
          renderOnAddRemove: true,
          enableRetinaScaling: false,
        });
        try {
          if (F.Canvas2dFilterBackend) F.filterBackend = new F.Canvas2dFilterBackend();
          if (F.Object && F.Object.prototype) F.Object.prototype.objectCaching = false;
        } catch {}

        buildMirrorFinish(F, c);
        addSafeAreaOverlay(F, c);

        c.on("object:added", (e) => {
          const obj = e && e.target;
          if (obj && obj.type === "image") applyEngraveBlackFilter(F, obj, () => c.requestRenderAll());
          const safe = c.getObjects().find((o) => o._safeArea === true);
          if (safe) safe.bringToFront();
        });

        fabricCanvasRef.current = c;
        setReady(true);
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

  // helper: convert cm to px (assuming 96 DPI)
  const cmToPx = (cm) => Math.max(1, Math.round(cm * (96 / 2.54)));

  function applySelectedSizeToCanvas(c) {
    if (!c) return;
    const opt = sizeOptions[selectedSizeIndex] || sizeOptions[0];
    let wCm = opt.wCm, hCm = opt.hCm;
    // swap if portrait orientation
    if (orientation === 'landscape') {
      // treat first number as short side if label is "15 X 30" => width becomes 30
      // We'll interpret wCm as short side and hCm as long side when label uses that order
      // To keep it simple: if long side > short side, ensure width is long side in landscape
      if (hCm > wCm) { const tmp = wCm; wCm = hCm; hCm = tmp; }
    } else {
      // portrait: make width the short side
      if (wCm > hCm) { const tmp = wCm; wCm = hCm; hCm = tmp; }
    }

  const pxW = cmToPx(wCm);
  const pxH = cmToPx(hCm);
  const scale = expanded ? 1.4 : 1.0;
  // portrait sizes tend to appear very large in the browser; reduce to ~50% for portrait
  const portraitScale = orientation === 'portrait' ? 0.5 : 1.0;
  const finalW = Math.round(pxW * scale * portraitScale);
  const finalH = Math.round(pxH * scale * portraitScale);

    try {
      c.setWidth(finalW);
      c.setHeight(finalH);
      // also update DOM canvas element attributes when present
      if (canvasRef && canvasRef.current) {
        canvasRef.current.width = finalW;
        canvasRef.current.height = finalH;
      }
      c.calcOffset && c.calcOffset();
      updateMirrorFinish(c);
      updateSafeAreaOverlay(c);
      c.requestRenderAll && c.requestRenderAll();
    } catch (e) { console.warn('Failed to apply size to canvas', e); }
  }

  // Resize when expanding/collapsing or orientation/size change
  useEffect(() => {
    const c = fabricCanvasRef.current; if (!c) return;
    applySelectedSizeToCanvas(c);
  }, [expanded, orientation, selectedSizeIndex]);

  const getCanvas = () => fabricCanvasRef.current || null;

  const toggleDraw = () => {
    const c = getCanvas(); if (!c) return;
    const next = !c.isDrawingMode; c.isDrawingMode = next; setIsDrawing(next);
    if (next && c.freeDrawingBrush) { c.freeDrawingBrush.color = "#000"; c.freeDrawingBrush.width = 5; }
    c.requestRenderAll && c.requestRenderAll();
  };

  const addText = (family = "Dancing Script") => {
    const c = getCanvas(); if (!c) return;
    ensureFont(family);
    const t = new window.fabric.IText("Your Text", {
      left: c.getWidth() / 2,
      top: c.getHeight() / 2,
