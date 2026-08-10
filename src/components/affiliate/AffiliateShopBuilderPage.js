import React, { useEffect, useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref as dbRef, get, set, runTransaction } from "firebase/database";
import { getStorage, ref as stRef, uploadBytes, getDownloadURL } from "firebase/storage";
import ProductCard from '../products/ProductCard';
import StoreCanvasBuilder, { SHOP_BLOCKS } from '../store-builder/StoreCanvasBuilder';
import { API_URL } from '../../config/environment';
import CommandPalette from '../shared/CommandPalette';
import DeviceToolbar from '../shared/DeviceToolbar';
import { createSection } from '../shared/sections';
import { saveSnapshot, listSnapshots } from '../shared/versions';
import { DEFAULT_THEME, FONT_PAIRINGS, deriveThemeVars, useGoogleFont, Reveal } from '../store-builder/theme';

// ==============================
// Affiliate Storefront — Editable Page for Affiliates
// URL style toggle, curated vs all products, banner upload, theme editor
// ==============================

const firebaseConfig = {
  apiKey: "AIzaSyB9ehjykma-ZIrOavYvhYyZBIc98B73tac",
  authDomain: "fotonix-97544.firebaseapp.com",
  projectId: "fotonix-97544",
  storageBucket: "fotonix-97544.firebasestorage.app",
  databaseURL: "https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app",
  messagingSenderId: "1003654054250",
  appId: "1:1003654054250:web:e5c905e6a194f1d4202513",
  measurementId: "G-8B0PPFCRTD",
};

function ensureFirebase() {
  if (!getApps().length) initializeApp(firebaseConfig);
  return { auth: getAuth(), db: getDatabase(), storage: getStorage() };
}

export function sanitizeHandle(handle) {
  const h = (handle || "").toLowerCase().trim();
  const cleaned = h.replace(/[^a-z0-9-]/g, "").slice(0, 30);
  return cleaned.length >= 3 ? cleaned : "";
}
function uidOrThrow(uid) { if (!uid) throw new Error("Must be signed in to edit storefront"); return uid; }
async function claimHandle(db, handle, uid) {
  const mappingRef = dbRef(db, `storefrontHandles/${handle}`);
  const res = await runTransaction(mappingRef, (current) => { if (current === null || current === uid) { return uid; } return; });
  return res.committed && res.snapshot.val() === uid;
}

// Always /@handle now — /u/handle was offered as a style choice but was
// never actually a real route anywhere in App.js (only pathname.startsWith
// ('/@') is handled), so picking it silently gave affiliates a broken link
// to their own storefront.
export function buildPublicUrl(origin, handle) {
  const h = sanitizeHandle(handle); if (!h) return "";
  const base = origin.replace(/\/$/, "");
  return `${base}/@${h}`;
}

// createSection() only ever produces its own default data — this makes a
// block of a given type with specific data instead, reusing createSection
// purely for its id-generation. Used by the legacy-fields migration below.
function makeBlock(type, data) {
  const base = createSection(type);
  return { ...base, data: { ...base.data, ...data } };
}

// One-time migration for storefronts saved before Theme/Banner/Bio/Links/
// Products became blocks: synthesizes the equivalent heading/paragraph/
// button/collection-grid blocks from the old top-level fields so existing
// content doesn't just disappear. Purely additive to in-memory state —
// nothing is written back to Firebase until the owner next hits Save.
// Safe to call on every load: it only adds a block for a legacy field the
// first time (skips if a block of that type already exists), so re-running
// it after the owner has already saved through the new editor is a no-op.
function migrateLegacyFieldsToBlocks(raw) {
  const sections = Array.isArray(raw.pageSections) ? [...raw.pageSections] : [];
  const hasType = (t) => sections.some((s) => s.type === t);
  const extra = [];

  if (raw.displayName && !hasType("heading")) {
    extra.push(makeBlock("heading", { text: raw.displayName, size: 32, align: "center" }));
  }
  if (raw.bio && !hasType("paragraph")) {
    extra.push(makeBlock("paragraph", { text: raw.bio, width: 700, align: "center" }));
  }
  if (Array.isArray(raw.links) && raw.links.length && !hasType("button")) {
    raw.links.forEach((l) => {
      if (!l.url) return;
      extra.push(makeBlock("button", { label: l.label || l.provider || "Link", href: l.url, style: "default", full: false, actionType: "link" }));
    });
  }

  // Fold the legacy "Products shown on your page" fields into the first
  // collection-grid block rather than keeping a second, parallel system.
  const hadLegacyProducts = raw.productDisplayMode || (raw.productIds && raw.productIds.length) || raw.featuredLayout;
  if (hadLegacyProducts) {
    const gridIdx = sections.findIndex((s) => s.type === "collection-grid");
    const patch = {
      displayMode: raw.productDisplayMode === "all" ? "all" : "curated",
      productIds: raw.productIds || [],
      featured: !!raw.featuredLayout,
      featuredProductId: raw.featuredProductId || "",
      title: raw.productsHeading || (gridIdx >= 0 ? sections[gridIdx].data.title : "Featured"),
    };
    if (gridIdx >= 0) {
      sections[gridIdx] = { ...sections[gridIdx], data: { ...sections[gridIdx].data, ...patch } };
    } else {
      extra.push(makeBlock("collection-grid", patch));
    }
  }

  return extra.length ? [...extra, ...sections] : sections;
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Auto-derives page <title>/meta description/OG image from the actual
// blocks instead of a separately-typed-in SEO form, so it can never drift
// out of sync with what's really on the page. `fallback` covers storefronts
// with no matching block yet (e.g. only a hero, no heading block).
function deriveSeo(pageSections, fallback = {}) {
  const sections = pageSections || [];
  const heading = sections.find((s) => s.type === "heading");
  const hero = sections.find((s) => s.type === "hero");
  const textBlock = sections.find((s) => s.type === "paragraph" || s.type === "rich-text");
  const imageBlock = sections.find((s) => s.type === "image" && s.data?.url);

  const title = heading?.data?.text || hero?.data?.title || fallback.title || "My Storefront";

  let description = "";
  if (textBlock) {
    description = textBlock.type === "rich-text" ? stripHtml(textBlock.data.html) : (textBlock.data.text || "");
  }
  if (!description) description = fallback.description || "";
  description = description.slice(0, 160);

  const ogImage = hero?.data?.bgImage || imageBlock?.data?.url || fallback.ogImage || "";

  return { title, description, ogImage };
}

export function AffiliateStorefrontEditor({ currentUserId, siteOrigin = "https://example.com" }) {
  const { db, storage } = ensureFirebase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [data, setData] = useState({
    handle: "",
    displayName: "",
    bio: "",
    bannerUrl: "",
    theme: DEFAULT_THEME,
    motion: { reveal: "none" },
    links: [],
    linkAlignment: "center",
    linkStyle: "bordered",
    linksHeading: "Find me online",
    linksDescription: "",
    productDisplayMode: "all",
    productIds: [],
  featuredLayout: false,
  featuredProductId: "",
    productsHeading: "Products",
    productsDescription: "",
    published: false,
    // new page sections and seo defaults
    pageSections: [createSection("hero"), createSection("collection-grid"), createSection("rich-text")],
    seo: { title: "", description: "", ogImage: "" },
  });

  useEffect(() => { (async () => {
    try {
      setErr(null);
      const uid = uidOrThrow(currentUserId);
      const snap = await get(dbRef(db, `storefronts/${uid}`));
      if (snap.exists()) {
        const raw = snap.val();
        setData((d) => ({
          ...d,
          ...raw,
          pageSections: migrateLegacyFieldsToBlocks({ ...raw, pageSections: Array.isArray(raw.pageSections) ? raw.pageSections : d.pageSections }),
        }));
      }
    } catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  })(); }, [currentUserId]);

  // Load products for the current user (editor side)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setProductsLoading(true);
      try {
        const uid = uidOrThrow(currentUserId);
        const snap = await get(dbRef(db, `products/${uid}`));
        if (!mounted) return;
        if (snap.exists()) {
          const productsData = snap.val();
          const productsArray = Object.entries(productsData).map(([id, product]) => ({ id, ...product }));
          setProducts(productsArray);
        } else {
          setProducts([]);
        }
      } catch (e) {
        setProducts([]);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [currentUserId, db]);

  // Uploads an image for a section and sets it into that section's data —
  // `image` blocks store it as `url`, every other image-bearing block
  // (currently just `hero`) as `bgImage`.
  const uploadSectionImage = async (sectionId, file) => {
    if (!file) return;
    try {
      setSaving(true);
      const uid = uidOrThrow(currentUserId);
      const key = `storefronts/${uid}/section_${sectionId}_${Date.now()}.${file.name.split('.').pop()}`;
      const r = stRef(storage, key);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      const fieldForType = { image: "url", testimonial: "photo" };
      setData((d) => ({
        ...d,
        pageSections: (d.pageSections || []).map((s) => (s.id === sectionId ? { ...s, data: { ...s.data, [fieldForType[s.type] || "bgImage"]: url } } : s)),
      }));
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      setErr(null);
      const uid = uidOrThrow(currentUserId);
      const handle = sanitizeHandle(data.handle);
      if (!handle) throw new Error("Please choose a handle (3–30 letters/numbers/dashes)");
      const ok = await claimHandle(getDatabase(), handle, uid);
      if (!ok) throw new Error("That handle is already taken. Try another.");
      // Legacy pre-block fields (still present in local state because the
      // load effect spreads the raw Firebase record wholesale) must not be
      // written back out here. If they were, migrateLegacyFieldsToBlocks()
      // would keep reading e.g. the old displayName/bio on every future
      // load and re-synthesizing a heading/paragraph block for it forever
      // -- deleting that block in the editor would never actually stick,
      // since the very next load would resurrect it from the still-present
      // legacy field.
      // NOTE: `theme` is NOT in this strip list -- it looked like a dead
      // legacy field when this list was first written (the old gradient/
      // bgType shape), but the Design panel repurposed it for real
      // (brand/mood/fonts/radius/density) afterward. Stripping it here
      // would silently discard every Design-panel change on every save.
      const {
        displayName, bio, bannerUrl, links, linkAlignment, linkStyle,
        linksHeading, linksDescription, productDisplayMode, productIds,
        featuredLayout, featuredProductId, productsHeading, productsDescription,
        seo, urlStyle,
        ...cleanData
      } = data;
      const payload = { ...cleanData, handle, updatedAt: Date.now() };
      await set(dbRef(db, `storefronts/${uid}`), payload);
      setErr("Storefront saved successfully!");
      setTimeout(() => {
        window.location.hash = 'affiliates';
      }, 1500);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = buildPublicUrl(siteOrigin, data.handle);

  if (loading) return <div className="p-4 text-sm text-zinc-500">Loading storefront…</div>;

  return (
    <div className="space-y-4">
      {/* Editor — the "Page sections" canvas below is now the live preview,
          same as the Funnel Builder: no separate static preview pane. */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">Storefront Basics</h3>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="text-xs text-zinc-600">Handle (unique)</label>
            <input value={data.handle} onChange={(e) => setData({ ...data, handle: e.target.value })} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="your-name" />
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"><LinkIcon className="h-4 w-4" /> {publicUrl || "Choose a handle to see your URL"}</div>
          </div>
        </section>

        {/* Design: one brand color drives every color on the page (see
            store-builder/theme.js) -- no more per-block color pickers or a
            page-wide gradient/image "Theme" strip. */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">Design</h3>
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-600">Brand color</label>
              <input type="color" value={data.theme?.brand || DEFAULT_THEME.brand} onChange={(e) => setData((d) => ({ ...d, theme: { ...d.theme, brand: e.target.value } }))} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex flex-col gap-1 text-zinc-600">
                Mood
                <select value={data.theme?.mood || DEFAULT_THEME.mood} onChange={(e) => setData((d) => ({ ...d, theme: { ...d.theme, mood: e.target.value } }))} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <option value="editorial">Editorial</option>
                  <option value="warm">Warm</option>
                  <option value="bold">Bold</option>
                  <option value="clinical">Clinical</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-zinc-600">
                Fonts
                <select value={data.theme?.fonts || DEFAULT_THEME.fonts} onChange={(e) => setData((d) => ({ ...d, theme: { ...d.theme, fonts: e.target.value } }))} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                  {Object.entries(FONT_PAIRINGS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-zinc-600">
                Corner radius
                <select value={data.theme?.radius || DEFAULT_THEME.radius} onChange={(e) => setData((d) => ({ ...d, theme: { ...d.theme, radius: e.target.value } }))} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="lg">Large</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-zinc-600">
                Spacing
                <select value={data.theme?.density || DEFAULT_THEME.density} onChange={(e) => setData((d) => ({ ...d, theme: { ...d.theme, density: e.target.value } }))} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <option value="airy">Airy</option>
                  <option value="tight">Tight</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-zinc-600">
              Scroll animation
              <select value={data.motion?.reveal || "none"} onChange={(e) => setData((d) => ({ ...d, motion: { ...d.motion, reveal: e.target.value } }))} className="w-48 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                <option value="none">None</option>
                <option value="fade">Fade in</option>
                <option value="fade-up">Fade up</option>
              </select>
            </label>
          </div>
        </section>

        {/* Everything else — profile text, banner image, social/action
            links, curated products, SEO — is now built as blocks in the
            canvas below, the same way the Funnel Builder handles its own
            pages. Old saved storefronts get their existing content
            migrated into equivalent blocks automatically on load (see
            migrateLegacyFieldsToBlocks). SEO is derived from the blocks
            themselves (see deriveSeo), not a separate form. */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">Page sections</h3>
          <div className="mt-3">
            <StoreCanvasBuilder
              value={data.pageSections}
              products={products}
              currentUserId={currentUserId}
              theme={data.theme}
              onChange={(next) => setData((d) => ({ ...d, pageSections: next }))}
              onPickImage={(sectionId) => {
                // trigger file input and then uploadSectionImage
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (ev) => {
                  const f = ev.target.files && ev.target.files[0];
                  if (f) uploadSectionImage(sectionId, f);
                };
                input.click();
              }}
            />
          </div>
        </section>

        <div className="flex flex-col items-center gap-2 py-2"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50">{saving ? "Saving…" : "Save Storefront"}</button>{err && <span className={`text-xs ${err.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>{err}</span>}</div>
    </div>
  );
}

// DUPLICATE FUNCTION - removed, using the correct one below
// DUPLICATE FUNCTION COMPLETELY REMOVED - using the correct one below

// Used by AffiliateStorefrontViewer (the real public /@handle page).
// Per-type rendering lives in SHOP_BLOCKS (StoreCanvasBuilder.jsx) — the
// same registry the drag-and-drop editor's own canvas uses — so there is
// only ever one copy of what a "hero" or "faq" section looks like.
// editable is always false here (real visitors, real clicks/submissions);
// the canvas passes editable=true at its own call site instead.
function RenderSections({ sections, fullProducts, ownerUid, reveal }) {
  if (!sections || !sections.length) return null;
  return (
    <div className="flex flex-col" style={{ gap: "var(--block-gap, 5rem)" }}>
      {sections.map((s, idx) => {
        const block = SHOP_BLOCKS[s.type];
        if (!block) return null;
        const Renderer = block.Renderer;
        return (
          <Reveal key={s.id} mode={reveal} index={idx} disabled={idx === 0}>
            <Renderer data={s.data} fullProducts={fullProducts} ownerUid={ownerUid} editable={false} />
          </Reveal>
        );
      })}
    </div>
  );
}

export function AffiliateStorefrontViewer({ handle }) {
  const { db } = ensureFirebase();
  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [ownerUid, setOwnerUid] = useState(null);

  useEffect(() => {
    const loadStore = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, look up the user ID from the handle
        const handleRef = dbRef(db, `storefrontHandles/${sanitizeHandle(handle)}`);
        const handleSnap = await get(handleRef);

        if (!handleSnap.exists()) {
          setError("Store not found");
          return;
        }

        const userId = handleSnap.val();
        setOwnerUid(userId);

        // Load the storefront data
        const storeRef = dbRef(db, `storefronts/${userId}`);
        const storeSnap = await get(storeRef);

        if (!storeSnap.exists()) {
          setError("Store not found");
          return;
        }

        const data = storeSnap.val();
        setStoreData({ ...data, pageSections: migrateLegacyFieldsToBlocks(data) });

        // Load the affiliate's products
        const productsRef = dbRef(db, `products/${userId}`);
        const productsSnap = await get(productsRef);

        if (productsSnap.exists()) {
          const productsData = productsSnap.val();
          const productsArray = Object.entries(productsData).map(([id, product]) => ({
            id,
            ...product
          }));
          setProducts(productsArray);
        }

        // Record this as an affiliate click, same as visiting any ?ref= link
        // (see src/hooks/useAffiliateRef.js) — the handle picked for the
        // storefront isn't the same string as the affiliate's referral code,
        // so it has to be resolved via the user profile before it can be
        // attributed to a click/commission.
        try {
          const profileSnap = await get(dbRef(db, `users/${userId}`));
          const affiliateCode = profileSnap.exists() ? profileSnap.val()?.affiliateCode : null;
          if (affiliateCode) {
            try { localStorage.setItem('fotonix_aff_ref', affiliateCode); } catch (e) {}

            const sessionKey = `aff_tracked_${affiliateCode}`;
            if (!sessionStorage.getItem(sessionKey)) {
              sessionStorage.setItem(sessionKey, '1');
              fetch(`${API_URL}/api/clicks/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ affiliateId: affiliateCode }),
                credentials: 'include',
              }).catch(() => {});
            }
          }
        } catch (e) {
          // non-fatal — the storefront itself still renders even if click tracking fails
        }

      } catch (err) {
        console.error("Error loading store:", err);
        setError("Failed to load store");
      } finally {
        setLoading(false);
      }
    };

    if (handle) {
      loadStore();
    }
  }, [handle, db]);

  // SEO: derived from the actual blocks (see deriveSeo), not a separately
  // typed-in form — applied only here (the real page), never in the editor,
  // so mid-edit changes don't rewrite the visitor's tab title.
  useEffect(() => {
    if (!storeData) return undefined;
    const seo = deriveSeo(storeData.pageSections, {
      title: storeData.displayName || `@${handle}`,
      description: storeData.bio,
      ogImage: storeData.bannerUrl,
    });
    const prevTitle = document.title;
    if (seo.title) document.title = `${seo.title} · Fotonix`;

    const upsertMeta = (selector, attrs) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    };
    if (seo.description) upsertMeta('meta[name="description"]', { name: "description", content: seo.description });
    if (seo.ogImage) upsertMeta('meta[property="og:image"]', { property: "og:image", content: seo.ogImage });

    return () => { document.title = prevTitle; };
  }, [storeData, handle]);

  // Real fonts on the public page too, same pairing chosen in the editor.
  useGoogleFont(storeData?.theme?.fonts);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  if (error || !storeData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Store Not Found</h1>
          <p className="text-gray-600 mb-8">{error || "This affiliate store doesn't exist."}</p>
          <a href="#home" className="inline-block bg-gradient-to-r from-pink-500 to-violet-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Everything visible is now driven by the blocks themselves (including
  // any legacy displayName/bio/bannerUrl/theme/links/products migrated into
  // block form on load above) — no bespoke header or product grid of its
  // own, matching how FunnelViewer.js is just "fetch blocks, render via the
  // shared registry." The brand color chosen in the editor drives every
  // color here via CSS custom properties (see deriveThemeVars) — nothing
  // is a hardcoded Tailwind color anymore.
  const themeVars = deriveThemeVars(storeData.theme);
  return (
    <div className="min-h-screen" style={{ ...themeVars, background: "var(--surface)", color: "var(--text)" }}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <RenderSections sections={storeData.pageSections} fullProducts={products} ownerUid={ownerUid} reveal={storeData.motion?.reveal} />
      </div>
    </div>
  );
}