// use client
import React, { useEffect, useRef, useState, useMemo } from "react";
import Footer from '../landing/Footer';
import PreviewModal from './PreviewModal';
import PayPalSDKLoader from '../payments/PayPalSDKLoader';
import PayPalButton from '../payments/PayPalButton';
import { API_URL } from '../../config/environment';
import { useAuth } from '../../contexts/AuthContext';

const STANDARD_MIRROR_BASE_PRICE = 1.00;

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Inline fallback header so the file compiles even if ./Header is missing.
// Replace <AppHeader /> with your own Header component later if desired.
const AppHeader = () => (
  <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-slate-900/70 backdrop-blur overflow-x-clip">
    <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
  <div className="text-xl font-semibold tracking-tight text-slate-100">Fotonix - Lumina Mirror 15cm X 30cm</div>
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

// Reviews / FAQ switcher component (plain JS)
function ReviewsFaqSwitch() {
  const [tab, setTab] = useState('reviews');

  return (
    <section
      className={"mx-auto max-w-5xl mt-10 rounded-2xl border border-white/15 bg-[radial-gradient(1200px_600px_at_50%_-200px,rgba(148,163,184,.12),transparent)] from-slate-900 to-[#0b1220] bg-gradient-to-b p-2"}
      aria-label="Customer help"
    >
      <div role="tablist" aria-label="Select reviews or FAQs" className={"relative grid grid-cols-2 gap-2 rounded-xl p-1 bg-white/5 backdrop-blur border border-white/10"}>
        <button role="tab" aria-selected={tab === 'reviews'} onClick={() => setTab('reviews')} className={`group relative w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${tab === 'reviews' ? "bg-[linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : "text-slate-300 hover:text-white hover:bg-white/5"}`}>
          ★ Reviews
          {tab === 'reviews' && <span className="absolute inset-0 rounded-lg ring-2 ring-indigo-400/60 ring-offset-0"></span>}
        </button>

        <button role="tab" aria-selected={tab === 'faqs'} onClick={() => setTab('faqs')} className={`group relative w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${tab === 'faqs' ? "bg-[linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : "text-slate-300 hover:text-white hover:bg-white/5"}`}>
          ❓ FAQs
          {tab === 'faqs' && <span className="absolute inset-0 rounded-lg ring-2 ring-indigo-400/60 ring-offset-0"></span>}
        </button>
      </div>

      <div className={"mt-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4 md:p-6 shadow-[0_8px_32px_rgba(2,6,23,.35)] text-slate-200"}>
        {tab === 'reviews' ? <ReviewsPanel /> : <FaqsPanel />}
      </div>
    </section>
  );
}

// Sortable reviews section (shows exactly 51 reviews)
const SORTS = {
  all: { label: 'All' },
  highest: { label: 'Highest rated' },
  lowest: { label: 'Lowest rated' },
  newest: { label: 'Newest' },
  oldest: { label: 'Oldest' },
  verified: { label: 'Verified first' },
};

function sortReviews(reviews, sortKey) {
  const arr = reviews.slice();
  arr.forEach((r, i) => (r.__i = i));
  switch (sortKey) {
    case 'highest':
      arr.sort((a, b) => b.rating - a.rating || a.__i - b.__i);
      break;
    case 'lowest':
      arr.sort((a, b) => a.rating - b.rating || a.__i - b.__i);
      break;
    case 'newest':
      arr.sort((a, b) => new Date(b.date) - new Date(a.date) || a.__i - b.__i);
      break;
    case 'oldest':
      arr.sort((a, b) => new Date(a.date) - new Date(b.date) || a.__i - b.__i);
      break;
    case 'verified':
      arr.sort((a, b) =>
        ((b.verified === true) - (a.verified === true)) ||
        (new Date(b.date) - new Date(a.date)) ||
        (b.rating - a.rating) ||
        (a.__i - b.__i)
      );
      break;
    default:
      break;
  }
  arr.forEach(r => delete r.__i);
  return arr;
}

function ReviewsSection() {
  const reviews = [
    { name: "Ava Johnson", rating: 5.0, title: "Stunning glow, zero hassle", body: "Setup was painless and the app paired right away. The presets make my bathroom feel like a studio.", date: "2025-08-28", verified: true },
    { name: "Noah Patel", rating: 5.0, title: "Exactly as advertised", body: "Premium finish and bright without being harsh. Creator packs are a fun bonus.", date: "2025-06-02", verified: true },
    { name: "Liam Nguyen", rating: 5.0, title: "Makes mornings better, Should be able to sync it with wifi though", body: ".", date: "2025-07-17", verified: true },
    { name: "Emma Smith", rating: 5.0, title: "Polished from box to wall", body: "Packaging, hardware, instructions—everything felt considered. Looks incredible on the dark wall.", date: "2025-05-09", verified: true },
    { name: "Olivia Brown", rating: 5.0, title: "Gift went down a treat", body: "Bought for my neices. She loves the dimming and night mode.", date: "2025-03-26", verified: true },
    { name: "Ethan Williams", rating: 5.0, title: "Doesnt wok with Alexa, Good otherwise", body: "Voice control and routines worked instantly. The glass looks expensive.", date: "2025-04-20", verified: true },
    { name: "Mia Jones", rating: 5.0, title: "Room changer", body: "Transforms our hallway at night. Guests always comment.", date: "2025-02-11", verified: true },
    { name: "Lucas Garcia", rating: 5.0, title: "Creator patterns are ace", body: "Downloading packs in the app is simple and sync is quick.", date: "2025-01-22", verified: true },
    { name: "Sophia Miller", rating: 5.0, title: "Bright, clean, classy", body: "Skin tones look natural. Exactly the ambience I wanted.", date: "2024-12-12", verified: true },
    { name: "Mason Davis", rating: 5.0, title: "Worth the hype", body: "Build quality and finish rival much pricier mirrors.", date: "2025-07-29", verified: true },
    { name: "Isabella Rodriguez", rating: 4.5, title: "Top notch with minor wishes", body: "Would love more built-in scenes, but community ones cover it.", date: "2025-06-14", verified: true },
    { name: "Logan Martinez", rating: 4.5, title: "Great value", body: "Easy mount with the template. App is intuitive overall.", date: "2025-05-05", verified: true },
    { name: "Amelia Hernandez", rating: 4.5, title: "Lovely finish", body: "Cable channel hides everything. Subtle glow looks premium.", date: "2025-04-27", verified: true },
    { name: "Elijah Lopez", rating: 4.5, title: "Smooth dimming", body: "Night mode is just right. Feels solid.", date: "2025-03-30", verified: true },
    { name: "Harper Gonzalez", rating: 4.5, title: "App keeps improving", body: "Recent update sped up scene changes. Happy days.", date: "2025-02-07", verified: true },
    { name: "Aiden Wilson", rating: 4.5, title: "Kids adore it", body: "We set playful animations for evenings. Big hit.", date: "2025-01-08", verified: true },
    { name: "Chloe Anderson", rating: 4.5, title: "Tasteful ambient light", body: "Subtle glassy look matches our dark walls.", date: "2024-11-18", verified: true },
    { name: "Carter Thomas", rating: 4.5, title: "Does what it promises", body: "Pairing was instant and stable over Wi-Fi.", date: "2025-08-09", verified: true },
    { name: "Layla Taylor", rating: 4.5, title: "Quality feel", body: "Metal frame is sturdy; edges are even.", date: "2025-07-05", verified: true },
    { name: "Jackson Moore", rating: 4.5, title: "Great for renters", body: "Mounted with ease and looks designer.", date: "2025-06-26", verified: true },
    { name: "Zoe Jackson", rating: 4.4, title: "Nearly perfect", body: "One minor hiccup on first update, fine since.", date: "2024-12-24", verified: true },
    { name: "Levi Martin", rating: 4.4, title: "Very happy", body: "Preset switch is snappy. Colours are consistent.", date: "2025-05-21", verified: true },
    { name: "Lily Lee", rating: 4.3, title: "Lovely glow for routines", body: "Tied to my morning alarm—works flawlessly.", date: "2025-03-13", verified: true },
    { name: "Mateo Perez", rating: 4.3, title: "Great makeup lighting", body: "Warm preset keeps things true to tone.", date: "2025-01-30", verified: true },
    { name: "Aria Thompson", rating: 4.3, title: "Solid and sleek", body: "Glass cleans easily and doesn’t smear light.", date: "2025-02-22", verified: true },
    { name: "Sebastian White", rating: 4.2, title: "Impressive overall", body: "Would appreciate a smaller power brick. Otherwise fab.", date: "2024-10-20", verified: true },
    { name: "Ellie Harris", rating: 4.2, title: "Good after update", body: "Firmware fixed a tiny lag on scenes.", date: "2025-08-03", verified: false },
    { name: "Benjamin Sanchez", rating: 4.2, title: "Smart buy", body: "Mounting template lined up perfectly.", date: "2024-11-08", verified: true },
    { name: "Aurora Clark", rating: 4.2, title: "Elegant look", body: "Glass edge glow is chef’s kiss.", date: "2025-04-06", verified: true },
    { name: "James Ramirez", rating: 4.2, title: "Neat cable management", body: "Channels hide the wires well. Clean finish.", date: "2025-06-11", verified: true },
    { name: "Nora Lewis", rating: 4.2, title: "Took a minute to learn", body: "App has depth; once set it’s easy.", date: "2025-03-02", verified: false },
    { name: "Henry Robinson", rating: 4.2, title: "Looks premium", body: "Edges are even and the mirror is flat.", date: "2025-02-16", verified: true },
    { name: "Scarlett Walker", rating: 4.2, title: "Schedules rock", body: "Sunrise fade is my new favourite.", date: "2024-12-03", verified: true },
    { name: "Owen Young", rating: 4.2, title: "Feature light done right", body: "Subtle but effective ambient glow.", date: "2025-07-21", verified: true },
    { name: "Grace Allen", rating: 4.2, title: "Warm presets shine", body: "Great for evening wind-down.", date: "2025-05-27", verified: true },
    { name: "Wyatt King", rating: 4.1, title: "Refined feel", body: "Buttons are responsive; ring accent is tasteful.", date: "2025-07-11", verified: true },
    { name: "Hannah Wright", rating: 4.1, title: "Steady improvements", body: "Updates arrive regularly and actually help.", date: "2025-04-16", verified: true },
    { name: "Jack Scott", rating: 4.1, title: "Polished experience", body: "Onboarding was clear and quick.", date: "2024-10-28", verified: true },
    { name: "Violet Torres", rating: 4.0, title: "Great for daily use", body: "Solid brightness range and quiet operation.", date: "2025-06-05", verified: true },
    { name: "Leo Ng", rating: 4.0, title: "Does the job well", body: "UI could be even simpler, but it’s fine.", date: "2024-12-19", verified: false },
    { name: "Stella Hill", rating: 4.0, title: "Creator packs are fun", body: "Love swapping looks for parties vs work.", date: "2025-05-02", verified: true },
    { name: "Daniel Flores", rating: 4.0, title: "Solid with Alexa", body: "Linked to routine in two taps.", date: "2025-02-28", verified: true },
    { name: "Bella Green", rating: 4.0, title: "Good finish", body: "Feels robust; corners are smooth.", date: "2025-01-15", verified: true },
    { name: "Asher Adams", rating: 3.9, title: "Nice after update", body: "Early lag fixed by firmware.THe", date: "2025-03-21", verified: false },
    { name: "Lucy Nelson", rating: 3.9, title: "Looks expensive", body: "Could use one extra ultra-warm preset, they want your email bad", date: "2025-07-02", verified: true },
    { name: "Caleb Baker", rating: 3.8, title: "Bright and cean", body: "Good spread of light with minimal glare.", date: "2024-11-29", verified: true },
    { name: "Maya Hall", rating: 3.8, title: "Learning curve but fine", body: "Power users will love the depth.", date: "2025-06-18", verified: false },
    { name: "Hudson Rivera", rating: 3.7, title: "Great for ambience", body: "Scene transitions could be faster, still good.", date: "2025-02-10", verified: true },
    { name: "Paisley Campbell", rating: 3.7, title: "Decent brightness", body: "Not the brightest on sunny days but fine at night.", date: "2025-05-14", verified: false },
    { name: "Nathan Mitchell", rating: 3.6, title: "Works well overall", body: "One reboot needed during setup; fine since.", date: "2024-10-06", verified: true },
    { name: "Ruby Carter", rating: 3.5, title: "Support was helpful", body: "Had a pairing question; chat solved it quickly.", date: "2025-01-28", verified: true },
    { name: "Eleanor Brooks", rating: 3.5, title: "Good once configured", body: "Defaults were a bit cool; easy to tweak.", date: "2025-08-15", verified: false },
    { name: "Theo Parker", rating: 3.5, title: "Solid mid-range pick", body: "Feels sturdy; app could be snappier, Constant trying to get your email, I dont have a favourite influencer!.", date: "2025-07-24", verified: true },
    { name: "Penelope Wood", rating: 3.5, title: "Looks great, some quirks", body: "There needs to be more added if you dont want to give your email, Constant trying to grab your email. The button for them email automatically puts you on a mailing list.", date: "2025-03-07", verified: false },
    { name: "Max Foster", rating: 3.5, title: "Nice but not perfect", body: "Wish the app had a simpler quick mode.", date: "2024-12-08", verified: true },
    { name: "Jasmine Reed", rating: 3.2, title: "Okay overall", body: "Light is lovely; onboarding screens felt long.", date: "2025-05-18", verified: false },
    { name: "Rowan Phillips", rating: 3.2, title: "Decent after tweaks", body: "Needed a firmware update right away.", date: "2025-04-03", verified: false },
    { name: "Blake Turner", rating: 3.1, title: "Good, not great", body: "Brightness is fine; app navigation could improve.oter aspps have a music function where lights react to music this doesnt ", date: "2025-02-02", verified: true },
    { name: "Eliza Bennett", rating: 3.0, title: "Works but basic", body: "It works but its just an LED strip at the back of a plastic mirror, Overpriced really.", date: "2025-06-08", verified: false },
    { name: "Harvey Quinn", rating: 3.0, title: "Adequate for the price", body: "Mounting was simple; wish for brighter daytime mode.", date: "2024-11-11", verified: true },
    { name: "Summer Doyle", rating: 3.0, title: "Fine with limitations", body: "Schedules work, but first setup took a while.", date: "2025-03-28", verified: false },
    { name: "Callum Fraser", rating: 3.0, title: "Does the basics, Kids dont bother with it after first try", body: "Looks smart; app occasionally doesnt find it and then youve got keep tuning it off and on which is not ideal when it was for a 6 year old.", date: "2025-01-04", verified: false },
    { name: "Nina Abbott", rating: 2.9, title: "Not bright enough for me", body: "Evening use is lovely, mornings need more punch.", date: "2025-07-08", verified: true },
    { name: "Otis Barrett", rating: 2.8, title: "Returned the first unit", body: "Replacement is fine. First one had a dodgy bracket that didn't stick.", date: "2025-04-25", verified: false },
    { name: "Dylan West", rating: 4.9, title: "Near perfect", body: "Mirror finish and animations are buttery smooth.", date: "2025-08-01", verified: true },
    { name: "Imogen Sharp", rating: 4.6, title: "Refined and modern", body: "Glass edge glow against dark paint is gorgeous.", date: "2025-05-16", verified: true },
    { name: "Reuben Yates", rating: 4.4, title: "Very solid option", body: "Mounting hardware feels quality. App mostly great.", date: "2025-06-20", verified: true },
    { name: "Talia Brooks", rating: 4.2, title: "Nice balance of features", body: "Not overwhelming to use; presets cover my needs.", date: "2025-02-24", verified: true },
    { name: "Quinn Patel", rating: 4.1, title: "Good polish, Cant be used as a mirror", body: "Its okay but the fact that you are engraving on a mirror defeats the purpose of a mirror", date: "2025-01-26", verified: true },
    { name: "Freya Collins", rating: 3.9, title: "Happy overall", body: "One crash during first sync. Fine ever since.", date: "2024-12-01", verified: false },
    { name: "Jude Hamilton", rating: 3.7, title: "Works as a feature light", body: "Great ambience; UI can be simpler.", date: "2025-03-04", verified: true },
    { name: "Ada Morrison", rating: 3.5, title: "Looks premium, app okay", body: "Love the glass, app is fine after learning it.", date: "2025-06-29", verified: false },
    { name: "Rory Stephens", rating: 4.8, title: "Superb finish", body: "Edge diffusion is even with no hotspots.", date: "2025-07-27", verified: true },
    { name: "Sienna Walsh", rating: 4.0, title: "Solid day to day", body: "Toggles are responsive; shipping was quick.", date: "2025-05-23", verified: true },
    { name: "Archer Reid", rating: 4.2, title: "Does everything I need", body: "Love the simple tab layout and glass look.", date: "2025-08-19", verified: true }
  ];

  const [sortKey, setSortKey] = useState('highest');

  const visible = useMemo(() => {
    // 1) sort the full dataset
    const sorted = sortReviews(reviews, sortKey);

    // If 'all' requested, return the full sorted set
    if (sortKey === 'all') return sorted;

    // 2) prune ~40% (keep ~60%) using PRNG if available
    const rnd = typeof window !== 'undefined' && window.__FOTONIX_REVIEW_PRNG ? window.__FOTONIX_REVIEW_PRNG : Math.random;
    const keepRatio = 0.6;
    const pruned = sorted.filter(() => rnd() < keepRatio);

    // 3) anonymize ~33% of the pruned set
    const anonFraction = 1 / 3;
    const anonymized = pruned.map((r) => (rnd() < anonFraction ? { ...r, name: 'Anon' } : r));

    // 4) cap to 51
    return anonymized.slice(0, 51);
  }, [reviews, sortKey]);

  const avg = useMemo(() => {
    if (!visible.length) return 0;
    const sum = visible.reduce((s, r) => s + r.rating, 0);
    return Math.round((sum / visible.length) * 10) / 10;
  }, [visible]);

  return (
    <section className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-4 shadow-xl shadow-black/30">
      {/* Endorsed.Review Header Badge */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
        <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group" title="Verified by Endorsed.Review">
          <img src="/endorsed.svg" alt="Endorsed.Review" className="h-8 rounded-lg shadow-md group-hover:scale-105 transition-transform" />
          <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Verified Reviews</span>
        </a>
        <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:text-amber-300 hover:underline transition-colors">
          View all on Endorsed.Review →
        </a>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-200">
          <span className="text-yellow-400" aria-hidden>★</span>
          <span className="font-semibold">{avg.toFixed(1)}/5</span>
          <span className="text-slate-400">· {visible.length} verified reviews</span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="sr-only">Sort reviews</label>
          <div className="relative">
            <select id="sort" value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="appearance-none rounded-xl border border-white/15 bg-white/5 px-3 py-2 pr-8 text-sm text-white ring-0 focus:outline-none focus:ring-2 focus:ring-indigo-400/60">
              {Object.entries(SORTS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">⌄</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {Object.entries(SORTS).map(([key, { label }]) => (
              <button key={key} onClick={() => setSortKey(key)} className={`rounded-full px-3 py-1.5 text-xs transition ${sortKey === key ? "bg-white/10 ring-2 ring-indigo-400/60 text-white" : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"}`} aria-pressed={sortKey === key}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-white/10">
        {visible.map((r, i) => (
          <li key={i} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{r.name}</span>
                {r.verified && <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">Verified</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-yellow-400" aria-hidden>★</span>
                <span className="font-medium">{r.rating.toFixed(1)}</span>
                <span className="text-slate-500">· {new Date(r.date).toLocaleDateString()}</span>
              </div>
            </div>
            <p className="mt-1 text-slate-200">{r.title}</p>
            <p className="mt-1 text-sm text-slate-300">{r.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Backwards-compatible wrapper so existing code that renders <ReviewsPanel /> keeps working
function ReviewsPanel() {
  return <ReviewsSection />;
}

function FaqsPanel() {
  const faqs = [
    { q: 'How long is shipping?', a: 'Most orders ship in 3–5 business days from the UK.' },
    { q: 'Is there a warranty?', a: 'Yes, 2-year warranty. We’ll repair or replace any manufacturing defect.' },
    { q: 'Can I import creator patterns?', a: 'Yes. Download packs in the app and sync them to your mirror via Wi-Fi.' },
  ];

  return (
    <div className="divide-y divide-white/10">
      {faqs.map((f,i) => (
        <details key={i} className="group py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-white">
            <span className="font-medium">{f.q}</span>
            <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
          </summary>
          <p className="mt-2 text-sm text-slate-300">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

// Reviews header: compute average over first 51 reviews and display verified total
function ReviewsHeader({ reviews }) {
  const visible = (reviews || []).slice(0, 51); // show exactly 51
  const avg = visible.length
    ? Math.round((visible.reduce((s, r) => s + (Number(r.rating) || 0), 0) / visible.length) * 10) / 10
    : 0.0;

  const verifiedTotal = 1218; // if you want to match Endorsed
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1">
        <span className="text-yellow-400" aria-hidden>★</span>
  <strong className="text-white">{avg.toFixed(1)}/5</strong>
  <span className="text-slate-400">51 verified reviews</span>
      </div>
      <a href="https://endorsed.review/biz/fotonix" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-300 hover:text-white hover:underline decoration-[#FFD43B] underline-offset-4">
        View on Endorsed.Review
      </a>
    </div>
  );
}

// robust script injector used by loadFabric and other dynamic loaders
function injectScript(src, ready, timeout = 12000) {
  return new Promise((resolve, reject) => {
    try {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        // if already loaded and ready, resolve immediately
        if (window.fabric && window.fabric.Canvas) return resolve();
        // otherwise attach listeners to the existing tag
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
  const { currentUser, userProfile } = useAuth();
  const isAffiliate = !!userProfile?.affiliateCode;
  const [designTitle, setDesignTitle] = useState("");
  const [savingDesign, setSavingDesign] = useState(false);
  const [saveDesignStatus, setSaveDesignStatus] = useState(null); // { ok, msg }
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null); // { ok, msg }
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
        });

        // capture modifications and deletions
        c.on('object:modified', (e) => { const obj = e && e.target; if (!obj) return; if (obj._mirrorLayer || obj._safeArea) return; try { pushHistory(); } catch(e){} });
        c.on('object:removed', (e) => { const obj = e && e.target; if (!obj) return; if (obj._mirrorLayer || obj._safeArea) return; try { pushHistory(); } catch(e){} });

        fabricCanvasRef.current = c;
        setReady(true);
        // border feature removed: no runtime handler for an editable Fabric border
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

  // border feature removed: no toggleEditBorder

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

  // Save the current design (structured Fabric JSON + thumbnail) so it can be
  // picked later from the affiliate product-creation dropdown
  const saveDesign = async () => {
    const c = fabricCanvasRef.current;
    if (!c) return;
    if (!currentUser) {
      setSaveDesignStatus({ ok: false, msg: 'Please log in to save your design.' });
      return;
    }
    if (!isAffiliate) {
      setSaveDesignStatus({ ok: false, msg: 'Saving designs is available to affiliate accounts.' });
      return;
    }
    if (!designTitle.trim()) {
      setSaveDesignStatus({ ok: false, msg: 'Give your design a name first.' });
      return;
    }

    setSavingDesign(true);
    setSaveDesignStatus(null);
    try {
      const canvasJSON = c.toJSON();
      const dataUrl = await captureSnapshot({ maxWidth: 2000 });

      const designId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const uid = currentUser.uid;

      const stm = await import("firebase/storage");
      const { getStorage, ref: stRef, uploadBytes, getDownloadURL } = stm;
      const storage = getStorage();
      const thumbRef = stRef(storage, `designs/${uid}/${designId}.png`);
      await uploadBytes(thumbRef, dataUrlToBlob(dataUrl));
      const thumbnailUrl = await getDownloadURL(thumbRef);

      const dbm = await import("firebase/database");
      const { getDatabase, ref: dbRef, set } = dbm;
      const db = getDatabase();
      await set(dbRef(db, `designs/${uid}/${designId}`), {
        id: designId,
        title: designTitle.trim(),
        type: 'standard-mirror',
        basePrice: STANDARD_MIRROR_BASE_PRICE,
        thumbnailUrl,
        canvasJSON: JSON.stringify(canvasJSON),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setSaveDesignStatus({ ok: true, msg: 'Design saved! You can now pick it when creating a product.' });
    } catch (e) {
      console.error('Failed to save design:', e);
      setSaveDesignStatus({ ok: false, msg: e?.message || "Couldn't save your design." });
    } finally {
      setSavingDesign(false);
    }
  };

  // Persist the paid order for fulfillment: uploads the actual design the
  // customer built (not just a payment amount) so there's something to
  // manufacture and ship. Runs on successful PayPal capture, works for
  // logged-in AND guest buyers.
  const handleOrderPaid = async (captureDetails) => {
    const c = fabricCanvasRef.current;
    setSubmittingOrder(true);
    setOrderStatus(null);
    try {
      const orderId = captureDetails?.id || `order_${Date.now()}`;
      const buyerEmail = captureDetails?.payer?.email_address || null;
      const buyerName = [captureDetails?.payer?.name?.given_name, captureDetails?.payer?.name?.surname]
        .filter(Boolean).join(' ') || null;

      let designImageUrl = null;
      if (c) {
        const dataUrl = await captureSnapshot({ maxWidth: 2000 });
        const stm = await import("firebase/storage");
        const { getStorage, ref: stRef, uploadBytes, getDownloadURL } = stm;
        const storage = getStorage();
        const imgRef = stRef(storage, `madeOrders/${orderId}/design.png`);
        await uploadBytes(imgRef, dataUrlToBlob(dataUrl));
        designImageUrl = await getDownloadURL(imgRef);
      }

      const orderRecord = {
        orderId,
        productName: 'Fotonix Standard Mirror',
        price: STANDARD_MIRROR_BASE_PRICE,
        currency: 'GBP',
        designImageUrl,
        buyerEmail,
        buyerName,
        status: 'paid',
        fulfilled: false,
        createdAt: Date.now(),
      };

      const dbm = await import("firebase/database");
      const { getDatabase, ref: dbRef, set } = dbm;
      const db = getDatabase();

      // Global fulfillment record (works for guest checkout, no login required)
      await set(dbRef(db, `madeOrders/${orderId}`), orderRecord);

      // Also mirror into the buyer's own order history if they're logged in
      if (currentUser) {
        try {
          await set(dbRef(db, `users/${currentUser.uid}/stencilOrders/${orderId}`), orderRecord);
        } catch (e) {
          console.warn('Failed to mirror order into user history:', e);
        }
      }

      setOrderStatus({ ok: true, msg: 'Order placed! Check your email for confirmation.' });
    } catch (e) {
      console.error('Failed to save order for fulfillment:', e);
      setOrderStatus({ ok: false, msg: "Payment succeeded, but we couldn't save your design. Please contact support with your PayPal order ID." });
    } finally {
      setSubmittingOrder(false);
    }
  };

  // border feature removed

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
        // Get the natural/original image dimensions
        const imgW = img.width || (img._element && img._element.naturalWidth) || (img._element && img._element.width) || 512;
        const imgH = img.height || (img._element && img._element.naturalHeight) || (img._element && img._element.height) || 512;
        
        const canvasW = c.getWidth() || 900;
        const canvasH = c.getHeight() || 600;
        const maxW = canvasW * 0.75;
        const maxH = canvasH * 0.75;
        
        const sc = Math.min(maxW / imgW, maxH / imgH, 1);
        
        // CRITICAL: Disable all caching on this image instance to prevent filter/render clipping
        img.objectCaching = false;
        img.statefullCache = false;
        img.noScaleCache = true;
        if (img._cacheCanvas) img._cacheCanvas = null;
        if (img._cacheContext) img._cacheContext = null;
        if (img._filteredEl) img._filteredEl = null;
        
        // Apply filters FIRST at scale=1
        applyEngraveBlackFilter(window.fabric, img, () => {
          // NOW apply position and scale after filters are baked
          img.set({ originX: "center", originY: "center", left: canvasW / 2, top: canvasH / 2, selectable: true });
          if (sc > 0 && isFinite(sc)) img.scale(sc);
          img.setCoords && img.setCoords();
          
          c.add(img);
          img.setCoords && img.setCoords();
          c.setActiveObject && c.setActiveObject(img);
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
    const c = getCanvas(); if (!c) return;
    try {
      window.fabric.Image.fromURL(dataURL, (img) => {
        // Get the natural/original image dimensions
        const imgW = img.width || (img._element && img._element.naturalWidth) || (img._element && img._element.width) || 512;
        const imgH = img.height || (img._element && img._element.naturalHeight) || (img._element && img._element.height) || 512;
        
        const canvasW = c.getWidth() || 900;
        const canvasH = c.getHeight() || 600;
        const maxW = canvasW * 0.75;
        const maxH = canvasH * 0.75;
        
        const sc = Math.min(maxW / imgW, maxH / imgH, 1);
        
        console.log('[addGeneratedImageToCanvas] img dimensions:', imgW, 'x', imgH, 'canvas:', canvasW, 'x', canvasH, 'scale:', sc);
        
        // CRITICAL: Disable all caching on this image instance to prevent filter/render clipping
        img.objectCaching = false;
        img.statefullCache = false;
        img.noScaleCache = true;
        if (img._cacheCanvas) img._cacheCanvas = null;
        if (img._cacheContext) img._cacheContext = null;
        if (img._filteredEl) img._filteredEl = null;
        
        // Apply filters FIRST at scale=1
        applyEngraveBlackFilter(window.fabric, img, () => {
          // NOW apply position and scale after filters are baked
          img.set({ originX: "center", originY: "center", left: canvasW / 2, top: canvasH / 2, selectable: true });
          if (sc > 0 && isFinite(sc)) img.scale(sc);
          img.setCoords && img.setCoords();
          
          c.add(img);
          img.setCoords && img.setCoords();
          c.setActiveObject && c.setActiveObject(img);
          const safe = c.getObjects().find((o) => o._safeArea === true);
          if (safe) safe.bringToFront && safe.bringToFront();
          c.requestRenderAll && c.requestRenderAll();
        });
      }, { crossOrigin: 'anonymous' });
    } catch (e) { console.warn('addGeneratedImageToCanvas failed', e); }
  }

  function updateSafeAreaOverlay(c) {
  const safe = c.getObjects().find((o) => o._safeArea === true);
  if (!safe) return;
  const margin = 40;
  safe.set({ left: margin, top: margin, width: c.getWidth() - margin * 2, height: c.getHeight() - margin * 2 });
  safe.bringToFront && safe.bringToFront();
  }

  // Build the mirror base and a non-interactive mirror layer so we can animate/colour it safely
  function buildMirrorFinish(F, c) {
    try {
      // remove any previous mirror layer
      const prev = (c.getObjects && c.getObjects().filter(o => o._mirrorLayer === true)) || [];
      prev.forEach(o => { try { c.remove(o); } catch (e) {} });
      const rect = new F.Rect({ left: 0, top: 0, width: c.getWidth(), height: c.getHeight(), fill: '#f4f4f5', selectable: false, evented: false, rx: 12, ry: 12 });
      rect._mirrorLayer = true;
      c.add(rect);
      rect.sendToBack && rect.sendToBack();
    } catch (e) { console.warn('buildMirrorFinish failed', e); }
  }

  function updateMirrorFinish(c) {
    try {
      const mirror = (c.getObjects && c.getObjects().find(o => o._mirrorLayer === true));
      if (mirror) {
        mirror.set({ width: c.getWidth(), height: c.getHeight() });
        mirror.sendToBack && mirror.sendToBack();
      }
      updateSafeAreaOverlay(c);
    } catch (e) { console.warn('updateMirrorFinish failed', e); }
  }

  // Create a non-interactive safe-area overlay if missing
  function addSafeAreaOverlay(F, c) {
    try {
      if (!c || !F) return;
      const existing = (c.getObjects && c.getObjects().find(o => o._safeArea === true));
      if (existing) return;
      const margin = 40;
      const safe = new F.Rect({ left: margin, top: margin, width: Math.max(10, c.getWidth() - margin * 2), height: Math.max(10, c.getHeight() - margin * 2), fill: 'rgba(0,0,0,0)', selectable: false, evented: false, stroke: 'rgba(0,0,0,0.06)', strokeWidth: 2, rx: 8, ry: 8 });
      safe._safeArea = true;
      safe._mirrorLayer = false;
      c.add(safe);
      safe.sendToBack && safe.sendToBack();
    } catch (e) { console.warn('addSafeAreaOverlay failed', e); }
  }

  // Download a PNG snapshot
  function downloadPNG() {
    captureSnapshot({ maxWidth: 2000 }).then((url) => {
      try {
        const a = document.createElement('a');
        a.href = url; a.download = 'fotonix-design.png';
        document.body.appendChild(a); a.click(); a.remove();
      } catch (e) { console.warn('downloadPNG failed', e); }
    }).catch((e) => { alert('Download failed: ' + (e && e.message ? e.message : e)); });
  }

  // Simple rainbow animation over the mirror layer (lightweight, non-destructive)
  const startRainbow = (F, c) => {
    try {
      if (rainbowAnimRef.current) return;
      rainbowHueRef.current = 0;
      rainbowAnimRef.current = setInterval(() => {
        try {
          rainbowHueRef.current = (rainbowHueRef.current + 4) % 360;
          const hue = rainbowHueRef.current;
          const color = `hsl(${hue} 80% 55%)`;
          const mirror = (c.getObjects && c.getObjects().find(o => o._mirrorLayer === true));
          if (mirror) mirror.set('fill', color);
          c.requestRenderAll && c.requestRenderAll();
        } catch (e) { /* ignore per-frame errors */ }
      }, 120);
      setRainbowRunning(true);
    } catch (e) { console.warn('startRainbow failed', e); }
  };

  const stopRainbow = (F, c) => {
    try {
      if (rainbowAnimRef.current) { clearInterval(rainbowAnimRef.current); rainbowAnimRef.current = null; }
      const mirror = (c.getObjects && c.getObjects().find(o => o._mirrorLayer === true));
      if (mirror) mirror.set('fill', '#f4f4f5');
      c.requestRenderAll && c.requestRenderAll();
      setRainbowRunning(false);
    } catch (e) { console.warn('stopRainbow failed', e); }
  };

  // File and drag-drop handlers
  const onFileInput = (e) => {
    try {
      const f = (e && e.target && e.target.files && e.target.files[0]);
      if (f) addImageFile(f);
      // clear input so same file can be re-uploaded
      if (e && e.target) e.target.value = '';
    } catch (err) { console.warn('onFileInput error', err); }
  };

  const onDragOver = (e) => { try { e && e.preventDefault && e.preventDefault(); setDragOver(true); } catch (e) {} };
  const onDragLeave = (e) => { try { e && e.preventDefault && e.preventDefault(); setDragOver(false); } catch (e) {} };
  const onDrop = (e) => {
    try {
      e && e.preventDefault && e.preventDefault(); setDragOver(false);
      const dt = e && (e.dataTransfer || e.target && e.target.files);
      const file = dt && dt.files && dt.files[0];
      if (file) addImageFile(file);
    } catch (err) { console.warn('onDrop error', err); }
  };

  // AI generation handler (simple orchestration)
  const handleGenerateSilhouetteWithPrompt = async () => {
    try {
      if (!aiPrompt || !aiPrompt.trim()) return alert('Please enter an AI prompt');
      setGenerating(true);
      const styleMap = {
        cartoon: 'Cartoon style',
        line: 'Line art',
        sketch: 'Sketch',
        ink: 'Ink drawing',
        minimal: 'Minimalist',
        vector: 'Vector art',
      };
      const styleText = aiStyle && styleMap[aiStyle] ? styleMap[aiStyle] + ': ' : '';
      const prompt = `${styleText}${aiPrompt}`;
      const dataUrl = await generateImageFromPrompt(prompt, { size: '1024x1024' });
      await addGeneratedImageToCanvas(dataUrl, { left: Math.max(80, (getCanvas() ? (getCanvas().getWidth() / 2) : 100)), top: 80 });
      setGenerating(false);
    } catch (e) {
      setGenerating(false);
      console.error('AI generation failed', e);
      alert('Generation failed: ' + (e && e.message ? e.message : e));
    }
  };

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
  {/* Ensure PayPal SDK is injected when this page mounts (load once per page) */}
  <PayPalSDKLoader clientId={process.env.NEXT_PUBLIC_PAYPAL_ID || ''} currency="GBP" components="buttons" />

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
                  {/* Border controls removed */}
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

                {/* Save Design — affiliates only; normal customers just create & buy below */}
                {isAffiliate && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-slate-100 mb-2">Save Your Design</h3>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={designTitle}
                        onChange={(e) => setDesignTitle(e.target.value.slice(0, 80))}
                        placeholder="Name this design…"
                        className="w-full rounded-md bg-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 ring-1 ring-white/10 focus:outline-none"
                      />
                      <button
                        onClick={saveDesign}
                        disabled={savingDesign}
                        className="w-full px-4 py-2 rounded-lg font-medium shadow text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                      >
                        {savingDesign ? 'Saving…' : 'Save Design'}
                      </button>
                      {saveDesignStatus && (
                        <p className={`text-xs ${saveDesignStatus.ok ? 'text-emerald-400' : 'text-red-400'}`}>{saveDesignStatus.msg}</p>
                      )}
                      <p className="text-xs text-slate-400">Saved designs can be picked later when creating a product to sell.</p>
                    </div>
                  </div>
                )}

                {/* Purchase Options (PayPal cards) - moved under the canvas */}
                <div className="mt-6">
                  <div className="max-w-full">
                    <h3 className="text-lg font-semibold mb-4">Purchase Options</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 rounded-lg bg-white/80 border border-white/10 shadow flex flex-col">
                        <div className="flex-1">
                          <h4 className="font-medium">Standard Mirror</h4>
                          <p className="text-sm text-slate-600">Simple engraving, suitable for most designs.</p>
                          <div className="mt-3 text-2xl font-bold">£1.00</div>
                        </div>
                        

                        <div className="mt-4"><InfluencerShowcase /></div>
                        {/* Product summary — shown above the PayPal button */}
                        <div className="mt-4 p-3 rounded bg-white/90 text-slate-900 border border-white/10">
                          <div className="text-base font-semibold">Standard Mirror</div>
                          <div className="text-sm text-slate-600 mt-1">Simple engraving, suitable for most designs.</div>
                          <div className="mt-2 text-xl font-bold">£1.00</div>
                        </div>
                        <div className="mt-4 block w-full" style={{ display: 'block', minWidth: 200 }}>
                          <PayPalButton amount="1.00" productName="Fotonix Standard Mirror" onSuccess={handleOrderPaid} />
                        </div>
                        {submittingOrder && (
                          <p className="mt-2 text-sm text-slate-300">Saving your order…</p>
                        )}
                        {orderStatus && (
                          <p className={`mt-2 text-sm ${orderStatus.ok ? 'text-emerald-400' : 'text-red-400'}`}>{orderStatus.msg}</p>
                        )}
                        <div className="mt-6">
                          <ReviewsFaqSwitch />
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl ring-1 ring-black/5 backdrop-blur">
              <h3 className="text-lg font-semibold mb-3">Customize</h3>

              <div className="mb-4">
                <input id="fileInput" type="file" accept="image/*" className="hidden" onChange={onFileInput} />
                <button onClick={() => document.getElementById("fileInput")?.click()} className="w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white shadow hover:bg-sky-500">Upload Image</button>
              </div>

              {/* Border size control removed */}

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
      isOpen={previewOpen}
      imageDataUrl={previewDataUrl}
      onClose={() => { setPreviewOpen(false); setPreviewDataUrl(null); }}
    />
  )}

  {/* Footer is rendered centrally in App.js; remove duplicate here to avoid two footers */}
    </div>
  );
}

// InfluencerShowcase component — updated visual style per design brief
const InfluencerShowcase = () => {
  const [index, setIndex] = useState(0);

  const slides = [
    { img: '/images/products/lucasroom.jpg', name: 'Luna Glow by @MakeupWithLuna', desc: 'Soft pink ambience pattern used by influencer Luna for daily beauty lighting setups.' },
    { img: '/images/products/tiles.png', name: 'Tech Neon by @JakeGadgets', desc: 'Electric gradient style synced with smart RGB routines — perfect for creators’ studios.' },
    { img: '/images/products/noahsroom.jpg', name: 'Morning Calm by @WellnessAmy', desc: 'Cool blue daylight tones designed for mindfulness sessions and morning skincare.' },
  ];

  const next = () => setIndex((index + 1) % slides.length);
  const prev = () => setIndex((index - 1 + slides.length) % slides.length);

  return (
    <section className="influencer-showcase" role="region">
      <div className="text-section">
        <h2 className="headline">Download Patterns from Your Favourite Creators</h2>
        <p className="body">
          The <strong>Fotonix Lumina App</strong> lets influencers and artists upload custom
          lighting patterns directly to your mirror. Transform your space with trending looks
          from your favourite YouTube and TikTok creators — or design your own.
        </p>
        <div className="paypal-area" aria-label="Checkout methods">
          <h4 className="paypal-header">Checkout</h4>
          <p className="checkout-info">Fast checkout available</p>
        </div>
      </div>

      <div className="slider" role="group" aria-roledescription="carousel" aria-label="Creator patterns">
        <button className="nav outside left" onClick={prev} aria-label="Previous pattern">‹</button>

        <figure className="slide" aria-live="polite">
          <div className="media">
            <img
              src={slides[index].img}
              alt={slides[index].name}
              loading="lazy"
              decoding="async"
              sizes="(max-width: 900px) 92vw, 420px"
            />
          </div>
        </figure>

        <button className="nav outside right" onClick={next} aria-label="Next pattern">›</button>
      </div>

      <style>{`
    /* Container */
    .influencer-showcase{
      display:grid; gap:2rem; grid-template-columns:1fr 1fr; align-items:center;
      padding:2.25rem; background:#F7F8FB; border-radius:22px;
      box-shadow:0 10px 36px rgba(15, 23, 42, 0.08); overflow:clip;
      border:1px solid rgba(15, 23, 42, 0.05);
    }

  /* text-section removed to keep focus on image */

  /* PayPal area */
  .paypal-area{ background:#fff; padding:1rem; border-radius:14px; border:1px solid #EEF2F7; box-shadow:inset 0 1px 0 #fff, 0 2px 8px rgba(15,23,42,.05) }
  .paypal-header{ margin:0 0 .25rem; color:#0F172A; font-size:1rem; font-weight:700 }
  .checkout-info{ margin:0 0 .5rem; color:#0F172A; font-size:.92rem }

    /* Slider */
    .slider{position:relative; display:grid; grid-template-columns:1fr auto 1fr; align-items:center}
    .slide{
      grid-column:2; background:#fff; border-radius:18px; padding:0;
      width:100%; max-width:900px; box-shadow:0 8px 24px rgba(15,23,42,.10);
      border:1px solid rgba(15, 23, 42, 0.06);
    }
    .media{position:relative; border-radius:18px; overflow:hidden; width:100%; aspect-ratio:4/3}
    .media::before{
      content:""; position:absolute; inset:-1px; border-radius:16px;
      padding:1px; background:linear-gradient(135deg,#ff3ba7,#6ea8ff); -webkit-mask:
        linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude; pointer-events:none;
    }
    .media img{
      width:100%; display:block; aspect-ratio:4/3; object-fit:cover;
      transition:transform .35s cubic-bezier(.2,.7,.2,1);
    }
    .media:hover img{ transform:scale(1.01) }
    .media::after{
      content:""; position:absolute; inset:0; border-radius:16px; pointer-events:none;
      box-shadow:0 12px 50px rgba(138, 180, 255, .15), 0 8px 30px rgba(255, 99, 184, .12);
    }
    /* overlay chip and description removed to keep focus on the image */

    /* Arrows outside */
    .nav{
      position:relative; z-index:1; display:inline-flex; align-items:center; justify-content:center;
      width:42px; height:42px; border-radius:50%; background:#111; color:#fff;
      border:none; cursor:pointer; box-shadow:0 6px 18px rgba(15,23,42,.18);
      transition:transform .2s ease, filter .2s ease;
    }
    .nav:hover{ transform:translateY(-1px); filter:brightness(1.05) }
    .nav:focus-visible{ outline:3px solid #60a5fa; outline-offset:2px }
    .nav.outside.left{ justify-self:end; margin-right:.5rem }
    .nav.outside.right{ justify-self:start; margin-left:.5rem }

    @media (max-width:900px){
      .influencer-showcase{ grid-template-columns:1fr; padding:1.25rem }
      .slide{ width:100% }
      .nav.outside.left{ margin-right:.25rem }
      .nav.outside.right{ margin-left:.25rem }
    }

    @media (prefers-reduced-motion:reduce){
      .media img,.nav{ transition:none }
    }
  `}</style>
    </section>
  );
};

