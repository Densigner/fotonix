import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Heart,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  Share2,
  Copy,
  Palette,
  Sparkles,
  BadgePercent,
  Plus,
  Minus,
  ChevronDown
} from "lucide-react";

/*************************************************
 * Brand tokens (violet → pink palette)
 *************************************************/
const gradientBtn =
  "bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-700 hover:to-pink-700 focus:ring-2 focus:ring-violet-500 focus:outline-none";
const chipGrad =
  "bg-gradient-to-r from-violet-600 to-pink-600 text-white";
const cardBase =
  "bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl shadow-sm backdrop-blur";
const neon = "#ff2d95"; // accent

/*************************************************
 * Blended strip image generator (from current canvas)
 *************************************************/
export function generateBlendedStripImage(hexValues, width = 880, height = 520, snake = false) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!hexValues || hexValues.length === 0 || !ctx) {
    ctx && (ctx.fillStyle = "#111", ctx.fillRect(0, 0, width, height));
    return canvas.toDataURL("image/png");
  }

  let colors = hexValues.slice();
  if (snake) {
    const cols = Math.floor(Math.sqrt(colors.length)) || 5;
    const rows = Math.ceil(colors.length / cols);
    const reordered = [];
    for (let r = 0; r < rows; r++) {
      const rowColors = colors.slice(r * cols, (r + 1) * cols);
      if (r % 2 === 1) rowColors.reverse();
      reordered.push(...rowColors);
    }
    colors = reordered;
  }

  // draw subtle background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0b0b0b");
  bgGrad.addColorStop(1, "#1a1324");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // blended horizontal gradient
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  const step = colors.length > 1 ? 1 / (colors.length - 1) : 1;
  colors.forEach((c, i) => grad.addColorStop(i * step, c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // soft vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL("image/png");
}

function PatternPreview({ hexValues, snake = true }) {
  const url = useMemo(() => generateBlendedStripImage(hexValues, 1200, 800, snake), [hexValues, snake]);
  return (
    <img
      src={url}
      alt="Pattern preview"
      className="w-full h-full object-cover rounded-2xl"
      draggable={false}
    />
  );
}

/*************************************************
 * BEST‑IN‑CLASS PRODUCT PAGE (React + Tailwind)
 * - Gallery with blended pattern hero
 * - Variant/pattern picker (uses PatternPreview strips)
 * - Price in £, UK notices, trust badges
 * - Sticky mobile buy bar
 * - PayPal Smart Buttons (placeholder client-id)
 * - Reviews + accordions + share/copy
 *************************************************/
export default function ProductPage() {
  // Mock product
  const product = {
    id: "mirror-neo",
    title: "Fotonix Mirror · Neo Edition",
    subtitle: "Sync my light patterns at home",
    priceGBP: 129.0,
    rating: 4.8,
    reviewsCount: 412,
    shippingNote: "UK delivery in 2–4 days",
    creator: "@Iris",
  };

  // Pattern swatches (25 hexes each for a 5×5 logic; blended in hero)
  const patterns = useMemo(
    () => [
      {
        id: "aurora",
        name: "Aurora",
        hexes: ["#7c3aed","#8b5cf6","#a78bfa","#c084fc","#d946ef","#ec4899","#f43f5e","#f97316","#f59e0b","#84cc16","#22c55e","#10b981","#06b6d4","#0ea5e9","#3b82f6","#60a5fa","#93c5fd","#38bdf8","#34d399","#fde047","#f59e0b","#eab308","#84cc16","#14b8a6","#a855f7"],
      },
      {
        id: "neon",
        name: "Neon",
        hexes: ["#ff2d95","#ff6bb1","#ffa1c9","#ffd1e3","#ffe6f0","#cdf0ea","#a5f3fc","#60a5fa","#3b82f6","#0ea5e9","#06b6d4","#14b8a6","#22c55e","#84cc16","#f59e0b","#f97316","#f43f5e","#ec4899","#d946ef","#a78bfa","#8b5cf6","#7c3aed","#6d28d9","#4c1d95","#1f1147"],
      },
      {
        id: "midnight",
        name: "Midnight",
        hexes: ["#0b0b0b","#111827","#1f2937","#312e81","#4f46e5","#7c3aed","#a78bfa","#c084fc","#f472b6","#ec4899","#f43f5e","#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#10b981","#06b6d4","#0ea5e9","#3b82f6","#60a5fa","#93c5fd","#a1a1aa","#52525b","#27272a"],
      },
    ],
    []
  );

  const [selected, setSelected] = useState(patterns[0]);
  const [qty, setQty] = useState(1);
  const [copied, setCopied] = useState(false);

  // PayPal Buttons loader
  const paypalRef = useRef(null);
  useEffect(() => {
    // Load SDK only once
    if (document.getElementById("paypal-sdk")) return;
    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src = "https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=GBP";
    script.async = true;
    script.onload = () => {
      // Render buttons when ready
      if (window.paypal && paypalRef.current) {
        window.paypal.Buttons({
          style: { layout: "horizontal", color: "gold", shape: "pill" },
          createOrder: (_, actions) => actions.order.create({
            purchase_units: [{ amount: { value: (product.priceGBP * qty).toFixed(2) } }],
          }),
          onApprove: async (_, actions) => {
            try { await actions.order.capture(); alert("Payment complete — thank you!"); } catch {}
          },
        }).render(paypalRef.current);
      }
    };
    document.body.appendChild(script);
  }, [product.priceGBP, qty]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "https://yourdomain.com/product";

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Top Hero Section */}
      <section className="px-4 sm:px-6 lg:px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Gallery */}
          <div className={`${cardBase} overflow-hidden p-2`}> 
            <div className="aspect-[3/2] w-full rounded-2xl overflow-hidden">
              <PatternPreview hexValues={selected.hexes} snake />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {patterns.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`rounded-xl overflow-hidden border transition ${
                    selected.id === p.id ? "border-transparent ring-2 ring-violet-500" : "border-neutral-200 dark:border-neutral-800"
                  }`}
                  aria-label={`Select pattern ${p.name}`}
                >
                  <img
                    src={generateBlendedStripImage(p.hexes, 400, 140, true)}
                    alt={p.name}
                    className="w-full h-24 object-cover"
                  />
                  <div className="px-3 py-2 text-sm flex items-center justify-between bg-white/70 dark:bg-neutral-900/70">
                    <span className="font-medium">{p.name}</span>
                    <Palette className="w-4 h-4 text-violet-500" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <div className="mb-4">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{product.title}</h1>
              <p className="mt-1 text-lg text-neutral-600 dark:text-neutral-300">{product.subtitle}</p>
            </div>

            {/* Rating + creator */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <a href="https://endorsed.reviews" target="_blank" rel="noopener noreferrer" aria-label="Endorsed.Reviews">
                  <img src="/endorsed.svg" alt="Endorsed.Review" className="h-8 inline-block mr-2" />
                </a>
              <div className="flex items-center gap-1 text-amber-400" aria-label={`${product.rating} stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-5 h-5 ${i < Math.round(product.rating) ? "fill-current" : ""}`} />
                ))}
              </div>
              <span className="text-sm text-neutral-500"><a href="https://endorsed.review/#/biz/fotonix" target="_blank" rel="noopener noreferrer" className="underline">{product.rating} · {product.reviewsCount} reviews</a></span>
              <span className="ml-auto inline-flex items-center gap-1 text-sm text-neutral-500"><Sparkles className="w-4 h-4 text-pink-500"/> by {product.creator}</span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3 mb-5">
              <div className="text-3xl font-extrabold">£{product.priceGBP.toFixed(2)}</div>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${chipGrad}`}>
                <BadgePercent className="w-4 h-4"/> UK Only
              </span>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center border border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden">
                <button className="px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus className="w-4 h-4"/></button>
                <div className="px-4 py-2 text-sm font-semibold w-10 text-center">{qty}</div>
                <button className="px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => setQty(q => q + 1)} aria-label="Increase quantity"><Plus className="w-4 h-4"/></button>
              </div>
              <button className={`px-5 py-3 rounded-xl font-semibold ${gradientBtn}`}>Add to cart</button>
              <button className="px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700">
                <Heart className="w-5 h-5"/>
              </button>
            </div>

            {/* PayPal */}
            <div className={`${cardBase} p-4 mb-5`}>
              <p className="text-sm text-neutral-500 mb-2">Or buy now with PayPal</p>
              <div ref={paypalRef} />
              <p className="mt-2 text-xs text-neutral-500">Replace <code>YOUR_CLIENT_ID</code> with your PayPal client ID.</p>
            </div>

            {/* Trust & shipping */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className={`${cardBase} p-3 flex items-center gap-2`}><ShieldCheck className="w-5 h-5 text-green-500"/> <span className="text-sm">12‑month warranty</span></div>
              <div className={`${cardBase} p-3 flex items-center gap-2`}><Truck className="w-5 h-5 text-blue-500"/> <span className="text-sm">{product.shippingNote}</span></div>
              <div className={`${cardBase} p-3 flex items-center gap-2`}><RotateCcw className="w-5 h-5 text-neutral-500"/> <span className="text-sm">30‑day returns</span></div>
            </div>

            {/* Share */}
            <div className="flex items-center gap-2 mb-8">
              <button onClick={copyLink} className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 inline-flex items-center gap-2"><Copy className="w-4 h-4"/> Copy link</button>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(product.title)}`} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 inline-flex items-center gap-2"><Share2 className="w-4 h-4"/> Share</a>
              <AnimatePresence>{copied && (<motion.span initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} className="text-sm text-green-600">Copied!</motion.span>)}</AnimatePresence>
            </div>

            {/* Accordions */}
            <Accordion title="What’s inside">
              <ul className="list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-300 space-y-1">
                <li>Fotonix Mirror · Neo Edition</li>
                <li>UK power adapter</li>
                <li>Quick start card</li>
              </ul>
            </Accordion>
            <Accordion title="Details & specs">
              <ul className="list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-300 space-y-1">
                <li>Live sync with creator patterns</li>
                <li>Community likes & comments on patterns</li>
                <li>AI customisation support</li>
              </ul>
            </Accordion>
            <Accordion title="Shipping & returns">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">UK‑only shipping, 2–4 business days. 30‑day returns.</p>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="px-4 sm:px-6 lg:px-10 pb-16">
        <div className="mb-4 flex items-end gap-3">
          <a href="https://endorsed.reviews" target="_blank" rel="noopener noreferrer" aria-label="Endorsed.Reviews">
            <img src="/endorsed.svg" alt="Endorsed.Review" className="h-8 inline-block mr-2" />
          </a>
          <h2 className="text-xl font-bold">Reviews</h2>
          <span className="text-sm text-neutral-500">{product.rating} average · {product.reviewsCount} total</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {MOCK_REVIEWS.map((r) => (
              <div key={r.id} className={`${cardBase} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-pink-600"/>
                    <div className="text-sm font-medium">{r.author}</div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.stars ? "fill-current" : ""}`} />
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{r.text}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className={`${cardBase} p-4`}>
              <h3 className="font-semibold mb-2">Why people love it</h3>
              <ul className="text-sm text-neutral-600 dark:text-neutral-300 space-y-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Same vibe at home</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Downloadable patterns</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> AI custom ranges</li>
              </ul>
            </div>
            <div className={`${cardBase} p-4`}>
              <h3 className="font-semibold mb-2">Have a question?</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">DM us on TikTok or email support@fotonix.app</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Buy Bar (mobile) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur md:hidden border-t border-neutral-200 dark:border-neutral-800">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="text-lg font-bold">£{product.priceGBP.toFixed(2)}</div>
          <button className={`ml-auto px-4 py-3 rounded-xl font-semibold ${gradientBtn}`}>Add to cart</button>
        </div>
      </div>
    </div>
  );
}

/*************************************************
 * Helpers & mock data
 *************************************************/
function Accordion({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${cardBase} mb-3`}> 
      <button className="w-full px-4 py-3 flex items-center justify-between" onClick={() => setOpen(o => !o)}>
        <span className="font-semibold">{title}</span>
        <ChevronDown className={`w-5 h-5 transition ${open ? "rotate-180" : ""}`}/>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MOCK_REVIEWS = [
  { id: "r1", author: "Alex", stars: 5, text: "Instant vibe. Synced my room during the live and it was unreal." },
  { id: "r2", author: "Sam",  stars: 5, text: "Super easy setup and the patterns look exactly like the creator’s." },
  { id: "r3", author: "Maya", stars: 4, text: "Love the AI custom range — made a matching look for my desk setup." },
];
