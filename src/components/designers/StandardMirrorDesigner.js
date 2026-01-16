import React, { useEffect, useRef, useState } from "react";
import Footer from '../landing/Footer';
import PreviewModal from '../products/PreviewModal';
import PayPalSDKLoader from '../payments/PayPalSDKLoader';
import PayPalButton from '../payments/PayPalButton';

// Inline fallback header so the file compiles even if ./Header is missing.
// Replace <AppHeader /> with your own Header component later if desired.
const AppHeader = () => (
  <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-slate-900/70 backdrop-blur">
    <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
      <div className="text-xl font-semibold tracking-tight text-slate-100">Fotonix — Standard Mirror Designer</div>
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

export default function StandardMirrorDesigner() {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);

  // Popular engraving-friendly fonts
  const FONTS = [
    "Great Vibes",
    "Pacifico",
    "Satisfy",
    "Inter",
    "Roboto",
    "Poppins",
    "Open Sans",
    "Nunito",
    "Figtree",
    "Playfair Display",
    "Merriweather",
    "Lora",
    "EB Garamond",
    "Abril Fatface",
    "Oswald",
    "Bebas Neue",
    "Bitter",
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
        } catch (e) { /* ignore */ }

        fabricCanvasRef.current = c;
        window.__FOTONIX_FABRIC_LOADED = true;

        // Set up canvas dimensions and background
        const container = canvasRef.current.parentElement;
        const containerWidth = container.clientWidth;
        const aspectRatio = 1; // Square canvas for mirror
        const canvasSize = Math.min(containerWidth - 40, 600);
        c.setDimensions({ width: canvasSize, height: canvasSize });

        // Add a subtle grid background
        const gridSize = 20;
        const gridPattern = new F.Pattern({
          source: (() => {
            const canvas = document.createElement('canvas');
            canvas.width = gridSize;
            canvas.height = gridSize;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, gridSize, gridSize);
            return canvas;
          })(),
          repeat: 'repeat'
        });
        c.setBackgroundColor(gridPattern, c.renderAll.bind(c));

        // Add event listeners
        c.on('selection:created', () => {});
        c.on('selection:cleared', () => {});
        c.on('object:added', () => {});
        c.on('object:modified', () => {});
        c.on('object:removed', () => {});

        setReady(true);
      } catch (e) {
        console.error('Failed to initialize canvas:', e);
      }
    })();

    return () => {
      disposed = true;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []);

  // Add text to canvas
  const addText = (text = "Your Text", fontFamily = "Inter") => {
    if (!fabricCanvasRef.current) return;

    const c = fabricCanvasRef.current;
    const textObj = new window.fabric.IText(text, {
      left: c.width / 2,
      top: c.height / 2,
      fontFamily,
      fontSize: 24,
      fill: '#000000',
      originX: 'center',
      originY: 'center',
      lockScalingFlip: true,
      fontWeight: 'normal',
    });

    c.add(textObj);
    c.setActiveObject(textObj);
    textObj.enterEditing();
    textObj.selectAll();
    c.renderAll();
  };

  // Add image to canvas
  const addImage = (file) => {
    if (!fabricCanvasRef.current || !file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const c = fabricCanvasRef.current;
        const fabricImg = new window.fabric.Image(img, {
          left: c.width / 2,
          top: c.height / 2,
          originX: 'center',
          originY: 'center',
          scaleX: 0.5,
          scaleY: 0.5,
          lockScalingFlip: true,
        });
        c.add(fabricImg);
        c.setActiveObject(fabricImg);
        c.renderAll();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Generate AI image
  const generateAI = async () => {
    if (!aiPrompt.trim()) return;

    setGenerating(true);
    try {
      // This would integrate with an AI image generation service
      // For now, just add placeholder text
      addText(`AI: ${aiPrompt}`, "Inter");
    } catch (e) {
      console.error('AI generation failed:', e);
    } finally {
      setGenerating(false);
    }
  };

  // Export canvas as image
  const exportCanvas = () => {
    if (!fabricCanvasRef.current) return;

    const dataUrl = fabricCanvasRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2 // High resolution
    });

    setPreviewDataUrl(dataUrl);
    setPreviewOpen(true);
  };

  // Drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        addImage(file);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Canvas Area */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Design Your Standard Mirror</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fabricCanvasRef.current?.clear().renderAll()}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div
                className={`relative rounded-xl border-2 border-dashed transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <canvas
                  ref={canvasRef}
                  className="block rounded-lg"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
                {!ready && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-100">
                    <div className="text-center">
                      <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600 mx-auto"></div>
                      <p className="text-sm text-slate-600">Loading canvas...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Drag and drop images or use the tools below to design your mirror
                </p>
                <button
                  onClick={exportCanvas}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Preview Design
                </button>
              </div>
            </div>
          </div>

          {/* Tools Panel */}
          <aside className="space-y-6">
            {/* Text Tools */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Text</h3>
              <div className="space-y-3">
                <select
                  onChange={(e) => addText("Your Text", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Choose a font...</option>
                  {FONTS.map(font => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
                <button
                  onClick={() => addText()}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Add Text
                </button>
              </div>
            </div>

            {/* Image Tools */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Images</h3>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && addImage(e.target.files[0])}
                  className="w-full text-sm"
                />
                <p className="text-xs text-slate-600">Or drag and drop images onto the canvas</p>
              </div>
            </div>

            {/* AI Tools */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">AI Design</h3>
              <div className="space-y-3">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want to create..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                />
                <button
                  onClick={generateAI}
                  disabled={generating || !aiPrompt.trim()}
                  className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-violet-600 px-3 py-2 text-sm font-medium text-white hover:from-pink-600 hover:to-violet-700 disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate with AI'}
                </button>
              </div>
            </div>

            {/* Purchase Section */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Purchase Your Design</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <h4 className="font-medium text-slate-900">Standard Mirror</h4>
                  <p className="text-sm text-slate-600 mt-1">Simple engraving, suitable for most designs.</p>
                  <div className="mt-3 text-2xl font-bold text-slate-900">£29.99</div>
                </div>

                <div className="space-y-3">
                  <PayPalButton
                    amount={"29.99"}
                    productName={"Fotonix Standard Mirror"}
                    onSuccess={(details) => console.log('Paid with PayPal', details)}
                  />

                  <button className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 transition">
                    Pay with Debit/Credit Card
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Render the preview modal when requested */}
      {previewOpen && (
        <PreviewModal
          isOpen={previewOpen}
          imageDataUrl={previewDataUrl}
          onClose={() => { setPreviewOpen(false); setPreviewDataUrl(null); }}
        />
      )}

      {/* Footer is rendered centrally in App.js; remove duplicate here to avoid two footers */}
    </div>
  );
}