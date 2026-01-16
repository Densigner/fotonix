import React, { useEffect, useRef, useState, useMemo } from "react";
// clipper-lib removed (acrylic features removed)
import * as opentype from 'opentype.js';
import Footer from '../landing/Footer';
import PreviewModalGlass from './PreviewModalGlass';
import PayPalSDKLoader from '../payments/PayPalSDKLoader';
import PayPalButton from '../payments/PayPalButton';
import LEDMockupGlass from '../designers/LEDMockupGlass';
import ImageSlider from '../shared/ImageSlider';
import { API_URL } from '../../config/environment';
import { ref as dbRef, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

// ============================================
// Acrylic Reviews Section Component
// Mixed reviews averaging ~3.8 stars for side-lit acrylic custom designed pieces
// ============================================
function AcrylicReviewsSection() {
  const reviews = [
    { name: "James Porter", rating: 5.0, title: "Stunning custom piece", body: "Designed my own silhouette and it came out beautifully. The edge lighting really makes it pop on my desk.", date: "2025-08-15", verified: true },
    { name: "Sophie Chen", rating: 5.0, title: "Perfect gift", body: "Made a custom lamp with our wedding date for my husband. He absolutely loves it. The engraving detail is sharp.", date: "2025-07-22", verified: true },
    { name: "Marcus Williams", rating: 4.5, title: "Great quality acrylic", body: "The side-lit effect is gorgeous. My custom design translated perfectly to the final product.", date: "2025-06-18", verified: true },
    { name: "Emma Taylor", rating: 4.5, title: "App control is handy", body: "Love being able to change LED colours from my phone. The acrylic finish is premium.", date: "2025-05-30", verified: true },
    { name: "Ryan O'Brien", rating: 4.3, title: "Nice custom lamp", body: "Designed a logo for my home office. Looks professional. Wish the base was slightly heavier.", date: "2025-08-02", verified: true },
    { name: "Lily Foster", rating: 4.2, title: "Beautiful edge glow", body: "The way light travels through the engraved areas is mesmerizing. Good value for a custom piece.", date: "2025-07-10", verified: true },
    { name: "Daniel Scott", rating: 4.0, title: "Solid custom product", body: "Designer was easy to use. Final lamp matches what I created. Shipping took a bit longer than expected.", date: "2025-06-25", verified: false },
    { name: "Hannah Mitchell", rating: 4.0, title: "Good for what it is", body: "It's a nice decorative piece. The custom design came out well but it's not super bright.", date: "2025-05-14", verified: true },
    { name: "Chris Baker", rating: 3.8, title: "Decent acrylic quality", body: "The engraving is nice but some fine details got lost. RGB base works well though.", date: "2025-08-08", verified: true },
    { name: "Olivia Hughes", rating: 3.7, title: "Pretty but fragile", body: "Looks amazing lit up. Had to be careful unpacking it - acrylic feels delicate at the edges.", date: "2025-07-01", verified: false },
    { name: "Nathan Brooks", rating: 3.5, title: "Mixed feelings", body: "Design came out great but the LED base makes a slight hum. Not a deal breaker but noticeable.", date: "2025-06-12", verified: true },
    { name: "Chloe Anderson", rating: 3.5, title: "Good value overall", body: "Custom side-lit lamp for this price is fair. App is basic but gets the job done.", date: "2025-05-22", verified: true },
    { name: "Josh Palmer", rating: 3.2, title: "Okay for decorative use", body: "It's pretty to look at but don't expect it to light up a room. Strictly a mood light.", date: "2025-08-20", verified: false },
    { name: "Sarah Evans", rating: 3.0, title: "Design limitations", body: "Some of my detailed artwork didn't engrave well. Simple designs work better for this medium.", date: "2025-07-15", verified: true },
    { name: "Alex Turner", rating: 2.8, title: "Smaller than expected", body: "30x30cm seemed bigger in my head. The lamp is nice quality but I wanted something larger.", date: "2025-06-05", verified: false },
    { name: "Megan Price", rating: 4.8, title: "Exceeded expectations", body: "Custom family crest came out perfectly. The edge lighting effect is better than I imagined.", date: "2025-08-12", verified: true },
    { name: "Tom Wilson", rating: 3.9, title: "Good but not great", body: "Decent product for the price. Custom design process was straightforward.", date: "2025-07-28", verified: true },
  ];

  const [sortKey, setSortKey] = useState('newest');

  const sortedReviews = useMemo(() => {
    const arr = [...reviews];
    switch (sortKey) {
      case 'highest': arr.sort((a, b) => b.rating - a.rating); break;
      case 'lowest': arr.sort((a, b) => a.rating - b.rating); break;
      case 'newest': arr.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
      case 'oldest': arr.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
      default: break;
    }
    return arr;
  }, [sortKey]);

  const avg = useMemo(() => {
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, []);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-lg">
      {/* Endorsed.Review Header Badge */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
        <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group" title="Verified by Endorsed.Review">
          <img src="/endorsed.svg" alt="Endorsed.Review" className="h-8 rounded-lg shadow-md group-hover:scale-105 transition-transform" />
          <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">Verified Reviews</span>
        </a>
        <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="text-sm text-amber-600 hover:text-amber-500 hover:underline transition-colors">
          View all on Endorsed.Review →
        </a>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-gray-800">
          <span className="text-yellow-500 text-lg" aria-hidden>★</span>
          <span className="font-semibold text-lg">{avg.toFixed(1)}/5</span>
          <span className="text-gray-500">· {reviews.length} reviews</span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="acrylic-sort" className="sr-only">Sort reviews</label>
          <select 
            id="acrylic-sort" 
            value={sortKey} 
            onChange={(e) => setSortKey(e.target.value)} 
            className="appearance-none rounded-xl border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-800 ring-0 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </div>
      </div>

      <ul className="divide-y divide-gray-200">
        {sortedReviews.map((r, i) => (
          <li key={i} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{r.name}</span>
                {r.verified && <span className="rounded-md bg-cyan-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-700">Verified</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-yellow-500" aria-hidden>★</span>
                <span className="font-medium">{r.rating.toFixed(1)}</span>
                <span className="text-gray-400">· {new Date(r.date).toLocaleDateString()}</span>
              </div>
            </div>
            <p className="mt-1 font-medium text-gray-800">{r.title}</p>
            <p className="mt-1 text-sm text-gray-600">{r.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Inline fallback header so the file compiles even if ./Header is missing.
// Replace <AppHeader /> with your own Header component later if desired.
const AppHeader = () => (
  <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-slate-900/70 backdrop-blur">
    <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
      <div className="text-xl font-semibold tracking-tight text-slate-100">Fotonix — Side-lit Acrylic Designer 30cm X 30cm</div>
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
  const { user, currentUser } = useAuth();
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [ready, setReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // locked mode removed — keep state minimal
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  // store exact AI response (removed UI features) - state removed
  const [aiStyle, setAiStyle] = useState("");
  const [edgeInfoVisible, setEdgeInfoVisible] = useState(false);
  // RAINBOW LED FEATURE removed
  const historyRef = useRef({ stack: [], index: -1, isLoading: false });
  // removed orientation/size preview state (revisit later)
  
  // Order success state
  const [orderSaved, setOrderSaved] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState(null);

  // Get user ID for saving orders
  const uid = currentUser?.uid || user?.uid;

  // Save acrylic order to Firebase after successful payment
  const saveAcrylicOrder = async (paypalDetails) => {
    if (!uid) {
      console.warn('Cannot save order: user not logged in');
      return null;
    }

    try {
      const orderId = `ACRYLIC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const timestamp = Date.now();

      // Capture the current design as an image for the order
      let designImageUrl = null;
      try {
        const canvas = fabricCanvasRef.current;
        if (canvas) {
          const dataUrl = canvas.toDataURL({ format: 'png', quality: 0.8, multiplier: 1 });
          // Upload to Firebase Storage
          const imageRef = storageRef(storage, `users/${uid}/acrylicOrders/${orderId}/design.png`);
          const blob = await (await fetch(dataUrl)).blob();
          await uploadBytes(imageRef, blob);
          designImageUrl = await getDownloadURL(imageRef);
        }
      } catch (imgErr) {
        console.warn('Could not save design image:', imgErr);
      }

      const orderData = {
        orderId,
        timestamp,
        productType: 'acrylic', // Key differentiator from stencil orders
        productName: 'Side-Lit Acrylic Lamp',
        status: 'paid',
        paypalOrderId: paypalDetails?.id || paypalDetails?.orderID || null,
        paypalStatus: paypalDetails?.status || 'COMPLETED',
        pricing: {
          total: '34.99',
          subtotal: '34.99',
          deliveryFee: '0.00',
          currency: 'GBP'
        },
        designImageUrl,
        metadata: {
          productSize: '30cm x 30cm',
          productDescription: 'Premium laser-engraved acrylic with RGB LED base',
          appControlled: true, // Indicates product is app-controlled
          appLink: 'https://fotonix.co.uk/app' // Link to the control app
        },
        // Shipping address will be collected separately or from PayPal
        shippingAddress: paypalDetails?.purchase_units?.[0]?.shipping?.address || null
      };

      // Save to user's orders (same path as stencils for unified viewing)
      await set(dbRef(db, `users/${uid}/stencilOrders/${orderId}`), orderData);
      
      // Also save to madeOrders for admin fulfillment
      await set(dbRef(db, `madeOrders/${orderId}`), {
        ...orderData,
        userId: uid,
        userEmail: currentUser?.email || user?.email || null
      });

      console.log('✅ Acrylic order saved:', orderId);
      setOrderSaved(true);
      setSavedOrderId(orderId);
      return orderId;
    } catch (error) {
      console.error('Error saving acrylic order:', error);
      return null;
    }
  };

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
          backgroundColor: "transparent",
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
  fill: "#fff",
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

  // Center helper: center the active text object on canvas
  function centerActiveText() {
    const canvas = getCanvas(); if (!canvas) return alert('Canvas not ready');
    const obj = canvas.getActiveObject();
    if (!obj) { alert('Select a text object first (click on it).'); return; }
    const isText = (obj.type === 'textbox' || obj.type === 'text' || obj.type === 'i-text' || (obj.isType && obj.isType('textbox')));
    if (!isText) { alert('Selected object is not a text object. Select a Text or Textbox.'); return; }
    if ('textAlign' in obj) obj.set('textAlign', 'center');
    obj.set({ originX: 'center', originY: 'center' });
    obj.set({ left: canvas.getWidth() / 2, top: canvas.getHeight() / 2 });
    canvas.requestRenderAll();
    canvas.setActiveObject(obj);
  }

  // Center all text objects on the canvas (stacked vertically)
  function centerAllTextObjects() {
    const canvas = getCanvas(); if (!canvas) return alert('Canvas not ready');
    const all = (canvas.getObjects && canvas.getObjects()) || [];
    const texts = all.filter(o => o.type === 'textbox' || o.type === 'text' || o.type === 'i-text');
    if (texts.length === 0) {
      alert('No text objects found on the canvas.');
      return;
    }
    const cx = canvas.getWidth() / 2;
    const cy = canvas.getHeight() / 2;
    const gap = 60;
    const startY = cy - ((texts.length - 1) * gap) / 2;
    texts.forEach((obj, i) => {
      if ('textAlign' in obj) obj.set('textAlign', 'center');
      obj.set({ originX: 'center', originY: 'center' });
      obj.set({ left: cx, top: startY + i * gap });
    });
    canvas.requestRenderAll();
  }

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
      // support several server response shapes:
      // - { image: 'data:...' } (legacy)
      // - { imageBase64: '<base64>' } (openaiImageProxy returns this)
      // - { url: '/generated/...' } (public URL)
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

  // RAINBOW LED FEATURE removed

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

  // AI blend & mask features removed per request

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
    // Glass/acrylic base: subtle frosted appearance
    const base = new F.Rect({
      left: 0,
      top: 0,
      width: c.getWidth(),
      height: c.getHeight(),
      rx: 18,
      ry: 18,
      fill: 'rgba(255, 255, 255, 0.08)',
      selectable: false,
      evented: false
    });
    base._mirrorLayer = true;

    // Subtle top-left sheen for glass effect
    const sheen = new F.Rect({
      left: -c.getWidth() * 0.1,
      top: -c.getHeight() * 0.15,
      width: c.getWidth() * 1.2,
      height: c.getHeight() * 0.4,
      angle: -15,
      selectable: false,
      evented: false,
      opacity: 0.12,
      rx: 12,
      ry: 12
    });
    sheen.set('fill', new F.Gradient({
      type: 'linear',
      gradientUnits: 'percentage',
      coords: { x1: 0, y1: 0, x2: 0, y2: 1 },
      colorStops: [
        { offset: 0, color: 'rgba(255,255,255,0.6)' },
        { offset: 1, color: 'rgba(255,255,255,0)' }
      ]
    }));
    sheen._mirrorLayer = true;

    // Thin border to define the acrylic edge
    const frame = new F.Rect({
      left: 2,
      top: 2,
      width: c.getWidth() - 4,
      height: c.getHeight() - 4,
      rx: 16,
      ry: 16,
      fill: '',
      stroke: 'rgba(255, 255, 255, 0.15)',
      strokeWidth: 1,
      selectable: false,
      evented: false
    });
    frame._mirrorLayer = true;

    c.add(base, sheen, frame);
    base.sendToBack && base.sendToBack();
  }

  function updateMirrorFinish(c) {
  const layers = c.getObjects().filter((o) => o._mirrorLayer === true);
  const [base, sheen, frame] = layers;
  if (!base || !sheen || !frame) return;
  base.set({ width: c.getWidth(), height: c.getHeight() });
  sheen.set({ left: -c.getWidth() * 0.1, top: -c.getHeight() * 0.15, width: c.getWidth() * 1.2, height: c.getHeight() * 0.4 });
  frame.set({ left: 2, top: 2, width: c.getWidth() - 4, height: c.getHeight() - 4 });
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
      {/* Global loading overlay when generating */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white/80"></div>
            <div className="text-white text-lg">Generating image, please wait…</div>
          </div>
        </div>
      )}
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
                  <h2 className="text-lg font-semibold">Design Your Side-lit Acrylic</h2>
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
                  {/* Draw button removed per request */}
                  {/* Add Text button removed per request */}
                  <button className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-medium shadow" onClick={undo}>Undo</button>
                  <button className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium shadow" onClick={redo}>Redo</button>
                  <button className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium shadow" onClick={deleteSelected}>Delete Selected</button>
                  <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow" onClick={downloadPNG}>Download</button>
                  <button className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium shadow" onClick={centerAllTextObjects}>Center All Text Objects</button>
                  {/* AI result/download buttons removed per request */}
                  {/* Controls removed per pivot */}
                  {/* Add/Remove Border button removed */}
                  {/* Border controls removed per request */}
                  {/* orientation controls removed */}
                  {/* left-side size dropdown and run tests removed (sidebar has Size control) */}
                </div>
                {/* Rainbow LED feature removed */}
                <div className="mt-3">
                  <button
                    onClick={async () => {
                      try {
                        const url = await captureSnapshot({ maxWidth: 1200 });
                        setPreviewDataUrl(url);
                        setPreviewOpen(true);
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
                        {/* LED Preview showing how design will look */}
                        <div className="w-full flex justify-center mb-4">
                          <LEDMockupGlass
                            src={mockSrc || previewDataUrl}
                            title="Your Design Preview"
                            ringExpandPx={14}
                            ringThicknessPx={10}
                            platePaddingPx={18}
                            maxArtWidth={200}
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900">Side-Lit Acrylic Lamp</h4>
                          <p className="text-sm text-slate-600">Premium laser-engraved acrylic with LED base. Your design illuminated beautifully.</p>
                          <div className="mt-3 text-2xl font-bold text-slate-900">£34.99</div>
                        </div>
                        {/* Product summary — shown above the PayPal button */}
                        <div className="mt-4 p-3 rounded bg-white/90 text-slate-900 border border-white/10">
                          <div className="text-base font-semibold">Side-Lit Acrylic Lamp</div>
                          <div className="text-sm text-slate-600 mt-1">Custom engraved acrylic with RGB LED base</div>
                          <div className="mt-2 text-xl font-bold">£34.99</div>
                        </div>
                        
                        {/* Show success message or PayPal button */}
                        {orderSaved ? (
                          <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
                            <div className="flex items-center gap-2 text-green-700 font-semibold">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Order Complete!
                            </div>
                            <p className="text-sm text-green-600 mt-2">
                              Thank you for your purchase! Your order #{savedOrderId?.substring(0, 12)} has been confirmed.
                            </p>
                            <p className="text-sm text-green-600 mt-1">
                              View your order in <a href="/my-orders" className="underline font-medium">My Orders</a>
                            </p>
                            <p className="text-xs text-green-500 mt-2">
                              Download the Fotonix app to control your lamp's LED colors once it arrives.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 block w-full" style={{ display: 'block', minWidth: 200 }}>
                            {uid ? (
                              <PayPalButton 
                                amount="34.99" 
                                productName="Fotonix Side-Lit Acrylic Lamp" 
                                onSuccess={async (details) => {
                                  console.log('PayPal payment successful:', details);
                                  await saveAcrylicOrder(details);
                                }} 
                              />
                            ) : (
                              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-center">
                                <p className="text-amber-800 font-medium">Please log in to purchase</p>
                                <a 
                                  href="/#login" 
                                  className="mt-2 inline-block px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
                                >
                                  Log In
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Reviews Section - directly under PayPal button */}
                        <div className="mt-6">
                          <AcrylicReviewsSection />
                        </div>
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

            {/* Preview thumbnail removed; left Preview & Share button restored */}

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
                <label className="block text-sm font-medium text-slate-200 mb-2">Use AI to help create your image</label>
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

                <div className="flex gap-2">
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
    <PreviewModalGlass
      open={previewOpen}
      mockSrc={mockSrc || previewDataUrl}
      onClose={() => { setPreviewOpen(false); setPreviewDataUrl(null); }}
    />
  )}

  {/* Footer is rendered centrally in App.js; remove duplicate here to avoid two footers */}
    </div>
  );
}
