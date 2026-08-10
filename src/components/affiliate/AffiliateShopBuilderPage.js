import React, { useEffect, useMemo, useState } from "react";
import { Link as LinkIcon, Image as ImageIcon } from "lucide-react";
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

// Small social provider helpers
const SOCIAL_PROVIDERS = [
  { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
  { id: 'tiktok', label: 'TikTok', placeholder: 'https://www.tiktok.com/@yourhandle' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourhandle' },
  { id: 'twitter', label: 'Twitter/X', placeholder: 'https://x.com/yourhandle' },
  { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourhandle' },
  { id: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/yourhandle' },
  { id: 'custom', label: 'Custom', placeholder: 'https://example.com' },
];

function getSocialIcon(provider, size = 20) {
  if (!provider) return null;
  switch ((provider || '').toLowerCase()) {
    case 'youtube':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.7 3.5 12 3.5 12 3.5s-7.7 0-9.38.58A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.12C4.3 20.5 12 20.5 12 20.5s7.7 0 9.38-.58A3 3 0 0 0 23.5 17.8 31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8z" fill="#FF0000"/>
          <path d="M10 15l5-3-5-3v6z" fill="#fff"/>
        </svg>
      );
    case 'tiktok':
      return (<img src="/images/hero/tiktok.png" style={{ width: size, height: size, objectFit:'contain' }} alt="TikTok" />);
    case 'instagram':
      return (<img src="/images/hero/instalogo.jpg" alt="Instagram" style={{ width:size, height:size, objectFit:'contain' }} />);
    case 'twitter':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M23 4.5c-.7.3-1.5.6-2.3.7.8-.5 1.4-1.3 1.7-2.3-.8.5-1.7.8-2.6 1-1.5-1.6-4-1.6-5.5 0-1.1 1.1-1.5 2.7-1 4.1C8 8.8 4.6 6.9 2 4.1c-.9 1.6-.2 3.7 1.2 4.7-.6 0-1.2-.2-1.7-.5 0 2 1.4 3.8 3.5 4.2-.6.2-1.2.2-1.8.1.5 1.7 2 3 3.7 3-1.3 1-3 1.5-4.6 1.2 1.7 1.1 3.8 1.7 6 1.7 7.2 0 11.1-6 11.1-11.1v-.5c.8-.6 1.5-1.4 2-2.3-.7.3-1.5.5-2.3.6z" fill="#1DA1F2"/>
        </svg>
      );
    case 'facebook':
      return (<img src="/images/hero/facebook.png" alt="Facebook" style={{ width:size, height:size, objectFit:'contain' }} />);
    case 'linkedin':
      return (<img src="/images/hero/linkedin.png" alt="LinkedIn" style={{ width:size, height:size, objectFit:'contain' }} />);
    case 'pinterest':
      return (<img src="/images/hero/pinterest.png" alt="Pinterest" style={{ width:size, height:size, objectFit:'contain' }} />);
    default:
      return (<svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ccc"/></svg>);
  }
}

// Minimal inline dropdown (no extra deps)
function AddLinkMenu({ onAdd }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      >
        + Add link
      </button>
      {open && (
        <div
          className="absolute z-10 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          onMouseLeave={() => setOpen(false)}
        >
          {SOCIAL_PROVIDERS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onAdd(p.id); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                {getSocialIcon(p.id, 14)}
              </span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Hero product picker button + modal
function HeroProductPickerButton({ products, mode, selectedIds, value, onPick }) {
  const [open, setOpen] = useState(false);
  const available = mode === "all" ? products : products.filter(p => (selectedIds || []).includes(p.id));
  const current = available.find(p => p.id === value) || null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
      >
        {current ? `Change hero: ${current.title}` : "Pick hero product"}
      </button>
      {open && (
        <HeroProductPicker
          products={available}
          value={value}
          onClose={() => setOpen(false)}
          onPick={(id) => { onPick(id); setOpen(false); }}
        />
      )}
    </>
  );
}

function HeroProductPicker({ products, value, onPick, onClose }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter(p =>
      (p.title || "").toLowerCase().includes(t) ||
      (p.sku || "").toLowerCase().includes(t)
    );
  }, [q, products]);

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
          <div className="font-semibold">Pick hero product</div>
          <button onClick={onClose} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">✕</button>
        </div>
        <div className="p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
            placeholder="Search by title or SKU…"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map(p => {
              const active = p.id === value;
              const img = p.imageUrl || (Array.isArray(p.images) && p.images[0]?.url) || null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p.id)}
                  className={[
                    "flex items-center gap-3 rounded-xl border p-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800",
                    active ? "border-pink-400" : "border-zinc-200 dark:border-zinc-800",
                  ].join(" ")}
                >
                  <div className="h-14 w-14 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    {img ? (
                      <img src={img} alt={p.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-zinc-400">No image</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="truncate text-xs text-zinc-500">{p.sku || "—"}</div>
                  </div>
                  <div className="ml-auto text-sm font-semibold">{typeof p.price === "number" ? `£${p.price.toFixed(2)}` : "—"}</div>
                </button>
              );
            })}
            {list.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
                No matches.
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
          <button onClick={onClose} className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">Close</button>
        </div>
      </div>
    </div>
  );
}

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
export function sanitizeUrl(url) {
  if (!url) return ""; try { const u = new URL(url.startsWith("http") ? url : `https://${url}`); if (u.protocol !== "http:" && u.protocol !== "https:") return ""; return u.toString(); } catch { return ""; }
}
function uidOrThrow(uid) { if (!uid) throw new Error("Must be signed in to edit storefront"); return uid; }
async function claimHandle(db, handle, uid) {
  const mappingRef = dbRef(db, `storefrontHandles/${handle}`);
  const res = await runTransaction(mappingRef, (current) => { if (current === null || current === uid) { return uid; } return; });
  return res.committed && res.snapshot.val() === uid;
}

export function buildPublicUrl(origin, handle, style) {
  const h = sanitizeHandle(handle); if (!h) return "";
  const base = origin.replace(/\/$/, "");
  return style === "at" ? `${base}/@${h}` : `${base}/u/${h}`;
}

// Shared by StorefrontView and AffiliateStorefrontViewer. Guards against
// `theme` being missing entirely (a latent crash — every storefront made
// through the real editor includes one, but nothing enforces that on the
// data side) and falls back to the gradient instead of a blank/transparent
// block when bgType is "image" but no image was ever actually uploaded.
function themeBackground(theme) {
  const t = theme || {};
  if (t.bgType === "color") return { background: t.color || "#ffffff" };
  if (t.bgType === "image" && t.imageUrl) {
    return { backgroundImage: `url(${t.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const from = t.gradientFrom || "#ec4899";
  const to = t.gradientTo || "#8b5cf6";
  return { backgroundImage: `linear-gradient(90deg, ${from}, ${to})` };
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
    theme: { bgType: "gradient", gradientFrom: "#ec4899", gradientTo: "#8b5cf6", textColor: "light" },
    links: [],
    linkAlignment: "center",
    linkStyle: "bordered",
    linksHeading: "Find me online",
    linksDescription: "",
    urlStyle: "at",
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

  // Small immutable move helper for reordering links
  const move = (arr, from, to) => {
    const a = (arr || []).slice();
    const [it] = a.splice(from, 1);
    a.splice(to, 0, it);
    return a;
  };

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
          pageSections: Array.isArray(raw.pageSections) ? raw.pageSections : d.pageSections,
          seo: raw.seo || d.seo,
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

    const onBannerSelected = async (file) => { if (!file) return; try { setSaving(true); const uid = uidOrThrow(currentUserId); const key = `storefronts/${uid}/banner_${Date.now()}.${file.name.split('.').pop()}`; const r = stRef(storage, key); await uploadBytes(r, file); const url = await getDownloadURL(r); setData((d) => ({ ...d, bannerUrl: url })); } catch (e) { setErr(e.message || String(e)); } finally { setSaving(false); } };

  const onThemeImageSelected = async (file) => { if (!file) return; try { setSaving(true); const uid = uidOrThrow(currentUserId); const key = `storefronts/${uid}/theme_${Date.now()}.${file.name.split('.').pop()}`; const r = stRef(storage, key); await uploadBytes(r, file); const url = await getDownloadURL(r); setData((d) => ({ ...d, theme: { ...d.theme, imageUrl: url } })); } catch (e) { setErr(e.message || String(e)); } finally { setSaving(false); } };

  // helper to upload an image for a section and set into the section data
  const uploadSectionImage = async (sectionId, file) => {
    if (!file) return;
    try {
      setSaving(true);
      const uid = uidOrThrow(currentUserId);
      const key = `storefronts/${uid}/section_${sectionId}_${Date.now()}.${file.name.split('.').pop()}`;
      const r = stRef(storage, key);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      setData((d) => ({ ...d, pageSections: (d.pageSections || []).map((s) => (s.id === sectionId ? { ...s, data: { ...s.data, bgImage: url } } : s)) }));
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
      const links = (data.links || [])
        .map((l) => ({
          ...l,
          provider: (l.provider || 'custom').toLowerCase(),
          label: (l.label || '').slice(0, 40),
          url: sanitizeUrl(l.url),
        }))
        .filter((l) => l.label && l.url);
      const payload = { ...data, handle, links, updatedAt: Date.now() };
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

  const addLink = () => setData((d) => ({ ...d, links: [...(d.links || []), { id: `${Date.now()}`, provider: 'custom', label: "", url: "" }] }));
  const removeLink = (id) => setData((d) => ({ ...d, links: (d.links || []).filter((x) => x.id !== id) }));
  const addProductsByCsv = (csv) => { const ids = csv.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean); setData((d) => ({ ...d, productIds: Array.from(new Set([...(d.productIds || []), ...ids])) })); };
  const publicUrl = buildPublicUrl(siteOrigin, data.handle, data.urlStyle);

  if (loading) return <div className="p-4 text-sm text-zinc-500">Loading storefront…</div>;

  return (
    <div className="space-y-4">
      {/* Editor — the "Page sections" canvas below is now the live preview,
          same as the Funnel Builder: no separate static preview pane. */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">Storefront Basics</h3>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="text-xs text-zinc-600">Public URL style</label>
            <div className="inline-flex gap-2 text-sm">
              <label className="inline-flex items-center gap-2"><input type="radio" checked={data.urlStyle === "at"} onChange={() => setData({ ...data, urlStyle: "at" })} /> /@handle</label>
              <label className="inline-flex items-center gap-2"><input type="radio" checked={data.urlStyle === "slash"} onChange={() => setData({ ...data, urlStyle: "slash" })} /> /u/handle</label>
            </div>
            <label className="text-xs text-zinc-600">Handle (unique)</label>
            <input value={data.handle} onChange={(e) => setData({ ...data, handle: e.target.value })} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="your-name" />
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"><LinkIcon className="h-4 w-4" /> {publicUrl || "Choose a handle to see your URL"}</div>
            <label className="text-xs text-zinc-600">Display Name</label>
            <input value={data.displayName} onChange={(e) => setData({ ...data, displayName: e.target.value.slice(0, 60) })} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="Your Name" />
            <label className="text-xs text-zinc-600">Bio</label>
            <textarea value={data.bio || ""} onChange={(e) => setData({ ...data, bio: e.target.value.slice(0, 240) })} className="h-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="Short friendly bio (max 240 chars)" />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">Banner</h3>
          <div className="mt-3 flex items-center gap-3"><input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onBannerSelected(f); }} />{saving && <span className="text-xs text-zinc-500">Uploading…</span>}</div>
          {data.bannerUrl && (<img src={data.bannerUrl} alt="Banner preview" className="mt-3 h-32 w-full rounded-xl object-cover" />)}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">Theme</h3>
          <div className="mt-3 space-y-3">
            <div className="flex gap-3 text-sm">
              <label className="inline-flex items-center gap-2"><input type="radio" checked={data.theme.bgType === "gradient"} onChange={() => setData({ ...data, theme: { ...data.theme, bgType: "gradient" } })} /> Gradient</label>
              <label className="inline-flex items-center gap-2"><input type="radio" checked={data.theme.bgType === "color"} onChange={() => setData({ ...data, theme: { ...data.theme, bgType: "color" } })} /> Solid color</label>
              <label className="inline-flex items-center gap-2"><input type="radio" checked={data.theme.bgType === "image"} onChange={() => setData({ ...data, theme: { ...data.theme, bgType: "image" } })} /> Background image</label>
            </div>
            {data.theme.bgType === "gradient" && (<div className="flex items-center gap-3"><div className="flex items-center gap-2 text-xs"><span>From</span><input type="color" value={data.theme.gradientFrom || "#ec4899"} onChange={(e) => setData({ ...data, theme: { ...data.theme, gradientFrom: e.target.value } })} /></div><div className="flex items-center gap-2 text-xs"><span>To</span><input type="color" value={data.theme.gradientTo || "#8b5cf6"} onChange={(e) => setData({ ...data, theme: { ...data.theme, gradientTo: e.target.value } })} /></div></div>)}
            {data.theme.bgType === "color" && (<div className="flex items-center gap-2 text-xs"><span>Color</span><input type="color" value={data.theme.color || "#ffffff"} onChange={(e) => setData({ ...data, theme: { ...data.theme, color: e.target.value } })} /></div>)}
            {data.theme.bgType === "image" && (<div className="space-y-2 text-xs"><span className="block">Background image</span><input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onThemeImageSelected(f); }} />{saving && <span className="text-xs text-zinc-500">Uploading…</span>}<span className="block mt-2">Or enter image URL (must be https)</span><input value={data.theme.imageUrl || ""} onChange={(e) => setData({ ...data, theme: { ...data.theme, imageUrl: e.target.value } })} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900" placeholder="https://…" /></div>)}
            <div className="flex items-center gap-3 text-xs"><span>Text</span><select value={data.theme.textColor || "light"} onChange={(e) => setData({ ...data, theme: { ...data.theme, textColor: e.target.value } })} className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900"><option value="light">Light</option><option value="dark">Dark</option></select></div>
          </div>
        </section>

        {/* SEO panel */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">SEO</h3>
          <div className="mt-3 space-y-2">
            <input placeholder="Meta title" value={data.seo?.title || ""} onChange={(e) => setData({ ...data, seo: { ...(data.seo || {}), title: e.target.value } })} className="w-full rounded-xl border px-3 py-2 text-sm" />
            <textarea placeholder="Meta description" value={data.seo?.description || ""} onChange={(e) => setData({ ...data, seo: { ...(data.seo || {}), description: e.target.value } })} className="h-20 w-full rounded-xl border px-3 py-2 text-sm" />
            <input placeholder="OpenGraph image URL" value={data.seo?.ogImage || ""} onChange={(e) => setData({ ...data, seo: { ...(data.seo || {}), ogImage: e.target.value } })} className="w-full rounded-xl border px-3 py-2 text-sm" />
          </div>
        </section>

        {/* Page sections builder */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">Page sections</h3>
          <div className="mt-3">
            <StoreCanvasBuilder
              value={data.pageSections}
              products={products}
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

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Links</h3>
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <label className="flex items-center gap-1">
                Align:
                <select
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  value={data.linkAlignment}
                  onChange={(e) => setData({ ...data, linkAlignment: e.target.value })}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <label className="flex items-center gap-1">
                Style:
                <select
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  value={data.linkStyle}
                  onChange={(e) => setData({ ...data, linkStyle: e.target.value })}
                >
                  <option value="bordered">Bordered</option>
                  <option value="pill">Pill</option>
                  <option value="minimal">Minimal</option>
                </select>
              </label>
            </div>
          </div>

          {/* Text above the links */}
          <div className="mt-3 grid grid-cols-1 gap-2">
            <input
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Links heading (optional)"
              value={data.linksHeading || ""}
              onChange={(e) => setData({ ...data, linksHeading: e.target.value })}
            />
            <textarea
              className="h-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Short description above your links (optional)"
              value={data.linksDescription || ""}
              onChange={(e) => setData({ ...data, linksDescription: e.target.value })}
            />
          </div>
          {/* Featured layout toggle + picker */}
          <div className="mt-2 flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!data.featuredLayout}
                onChange={(e) => {
                  const on = e.target.checked;
                  setData(d => ({
                    ...d,
                    featuredLayout: on,
                    featuredProductId: on ? (d.featuredProductId || (d.productIds?.[0] ?? "")) : ""
                  }));
                }}
              />
              Use a featured (hero) product
            </label>

            {data.featuredLayout && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">Featured:</span>
                <select
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  value={data.featuredProductId || ""}
                  onChange={(e) => setData(d => ({ ...d, featuredProductId: e.target.value }))}
                >
                  <option value="">(none)</option>
                  {(data.productDisplayMode === "all"
                     ? products
                     : products.filter(p => (data.productIds || []).includes(p.id))
                   ).map(p => (
                     <option key={p.id} value={p.id}>{p.title}</option>
                   ))}
                </select>

                <HeroProductPickerButton
                  products={products}
                  mode={data.productDisplayMode}
                  selectedIds={data.productIds}
                  value={data.featuredProductId}
                  onPick={(id) => setData(d => ({ ...d, featuredProductId: id }))}
                />
              </div>
            )}
          </div>
          {/* Add link menu */}
          <div className="mt-3">
            <AddLinkMenu
              onAdd={(providerId) => {
                const meta = SOCIAL_PROVIDERS.find(p => p.id === providerId) || SOCIAL_PROVIDERS[SOCIAL_PROVIDERS.length - 1];
                setData(d => ({
                  ...d,
                  links: [
                    ...(d.links || []),
                    {
                      id: `${Date.now()}`,
                      provider: providerId,
                      label: meta.id === 'custom' ? '' : meta.label,
                      url: '',
                    },
                  ],
                }));
              }}
            />
          </div>

          <div
            className={[
              "mt-3 space-y-3 md:space-y-2 flex flex-wrap gap-2",
              data.linkAlignment === "center" ? "justify-center" : data.linkAlignment === "right" ? "justify-end" : "justify-start",
            ].join(" ")}
          >
            {(data.links || []).map((l, idx) => {
              const provider = (l.provider || 'custom').toLowerCase();
              const meta = SOCIAL_PROVIDERS.find(p => p.id === provider) || SOCIAL_PROVIDERS[SOCIAL_PROVIDERS.length - 1];

              return (
                <div
                  key={l.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); const to = idx; if (!Number.isNaN(from) && from !== to) { setData(d => ({ ...d, links: move(d.links || [], from, to) })); } }}
                  className="grid grid-cols-1 gap-2 md:grid-cols-[auto_10rem_1fr_1fr_auto] items-center"
                >
                  <div className="flex items-center justify-center">
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      {getSocialIcon(provider, 18)}
                    </div>
                  </div>

                  {/* Provider select */}
                  <select
                    className="rounded-xl border border-zinc-200 bg-white px-2 py-2 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900"
                    value={provider}
                    onChange={(e) => {
                      const nextProvider = e.target.value;
                      const nextMeta = SOCIAL_PROVIDERS.find(p => p.id === nextProvider) || { id:'custom', label:'', placeholder:'https://example.com' };
                      setData(d => ({
                        ...d,
                        links: (d.links || []).map(x =>
                          x.id === l.id
                            ? {
                                ...x,
                                provider: nextProvider,
                                // If label was auto or empty, update it to the provider label
                                label: (!l.label || l.label === meta.label) ? (nextProvider === 'custom' ? '' : nextMeta.label) : l.label,
                              }
                            : x
                        ),
                      }));
                    }}
                  >
                    {SOCIAL_PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>

                  {/* Label */}
                  <input
                    value={l.label || ''}
                    placeholder={meta.id === 'custom' ? 'Label (e.g. Blog)' : meta.label}
                    onChange={(e) =>
                      setData(d => ({
                        ...d,
                        links: (d.links || []).map(x => (x.id === l.id ? { ...x, label: e.target.value } : x)),
                      }))
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
                  />

                  {/* URL */}
                  <input
                    value={l.url || ''}
                    placeholder={meta.placeholder}
                    onChange={(e) =>
                      setData(d => ({
                        ...d,
                        links: (d.links || []).map(x => (x.id === l.id ? { ...x, url: e.target.value } : x)),
                      }))
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
                  />

                  <button
                    onClick={() => setData(d => ({ ...d, links: (d.links || []).filter(x => x.id !== l.id) }))}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">Products shown on your page</h3>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <input
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Products heading (optional)"
              value={data.productsHeading || ""}
              onChange={(e) => setData({ ...data, productsHeading: e.target.value })}
            />
            <textarea
              className="h-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Short description above your products (optional)"
              value={data.productsDescription || ""}
              onChange={(e) => setData({ ...data, productsDescription: e.target.value })}
            />
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <label className="inline-flex items-center gap-2"><input type="radio" checked={data.productDisplayMode === "all"} onChange={() => setData({ ...data, productDisplayMode: "all" })} /> Show all active products</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={data.productDisplayMode === "curated"} onChange={() => setData({ ...data, productDisplayMode: "curated" })} /> Only show my curated list</label>

            {/* Manage products list for curated mode */}
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // quick auto-sort by best-sellers
                    const sorted = (products || []).slice().sort((a, b) => (b.itemsSold || 0) - (a.itemsSold || 0));
                    setData(d => ({ ...d, productDisplayMode: 'curated', productIds: sorted.map(p => p.id) }));
                  }}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  Move bestsellers to top
                </button>
                <button
                  type="button"
                  onClick={() => setData(d => ({ ...d, productDisplayMode: 'curated', productIds: [] }))}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  Clear curated list
                </button>
              </div>

              <div className="mt-3 max-h-48 overflow-y-auto border rounded-lg p-2">
                {productsLoading ? (
                  <div className="text-sm text-zinc-500">Loading products…</div>
                ) : products.length === 0 ? (
                  <div className="text-sm text-zinc-500">No products yet. Upload via the product panel.</div>
                ) : (
                  <div
                    className="space-y-2"
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  >
                    {products.map((p) => {
                      const included = (data.productIds || []).includes(p.id);
                      const curIndex = (data.productIds || []).indexOf(p.id);
                      return (
                        <div
                          key={p.id}
                          className={[
                            "flex items-center gap-2 rounded-lg border px-2 py-1",
                            included ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" : "border-transparent"
                          ].join(" ")}
                          draggable={included}
                          onDragStart={(e) => {
                            if (!included) return;
                            e.dataTransfer.setData('text/plain', String(curIndex));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDrop={(e) => {
                            if (!included) return;
                            e.preventDefault();
                            const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                            const to = (data.productIds || []).indexOf(p.id);
                            if (!Number.isNaN(from) && from !== to) {
                              setData(d => ({ ...d, productIds: move(d.productIds || [], from, to) }));
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(e) => {
                              setData(d => {
                                const cur = d.productIds || [];
                                if (e.target.checked) {
                                  // add to end
                                  return { ...d, productIds: Array.from(new Set([...cur, p.id])) };
                                }
                                // remove keeps the rest in place
                                return { ...d, productIds: cur.filter(x => x !== p.id) };
                              });
                            }}
                          />
                            {data.featuredLayout && (
                              <button
                                type="button"
                                onClick={() => setData(d => ({ ...d, featuredProductId: p.id }))}
                                title="Set as hero"
                                className={[
                                  "rounded p-1",
                                  data.featuredProductId === p.id ? "text-amber-500" : "text-zinc-400 hover:text-zinc-600"
                                ].join(" ")}
                                disabled={!included}
                              >
                                ★
                              </button>
                            )}
                          <div className="cursor-grab select-none text-zinc-400">⋮⋮</div>
                          <div className="flex-1 truncate text-sm">{p.title}</div>
                          <div className="text-xs text-zinc-500">Sold: {p.itemsSold || 0}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50">{saving ? "Saving…" : "Save Storefront"}</button>{err && <span className={`text-xs ${err.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>{err}</span>}</div>
    </div>
  );
}

// DUPLICATE FUNCTION - removed, using the correct one below
// DUPLICATE FUNCTION COMPLETELY REMOVED - using the correct one below

// Shared by both StorefrontView (the editor's live preview) and
// AffiliateStorefrontViewer (the real public /@handle page) so page-builder
// sections render identically in both places instead of drifting apart.
// Per-type rendering itself lives in SHOP_BLOCKS (StoreCanvasBuilder.jsx) —
// the same registry the drag-and-drop editor's canvas uses — so there is
// only ever one copy of what a "hero" or "faq" section looks like.
function RenderSections({ sections, fullProducts }) {
  if (!sections || !sections.length) return null;
  return (
    <div className="space-y-8 mb-6">
      {sections.map((s) => {
        const block = SHOP_BLOCKS[s.type];
        if (!block) return null;
        const Renderer = block.Renderer;
        return <Renderer key={s.id} data={s.data} fullProducts={fullProducts} />;
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
        setStoreData(data);

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

  const bg = themeBackground(storeData.theme);

  const light = (storeData.theme?.textColor || "light") === "light";

  return (
    <div className="min-h-screen" style={bg}>
      {/* Banner */}
      {storeData.bannerUrl && (
        <div className="relative h-64 overflow-hidden">
          <img src={storeData.bannerUrl} alt="Store banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black bg-opacity-30"></div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Store Header */}
        <div className="text-center mb-12">
          <h1 className={`text-4xl font-bold mb-4 ${light ? 'text-white' : 'text-gray-900'}`}>
            {storeData.displayName || `@${handle}`}
          </h1>
          {storeData.bio && (
            <p className={`text-xl ${light ? 'text-white text-opacity-90' : 'text-gray-700'}`}>
              {storeData.bio}
            </p>
          )}
        </div>

        {/* Page-builder sections (hero, rich text, curated grid, FAQ) —
            same renderer the editor's own live preview uses. */}
        <RenderSections sections={storeData.pageSections} fullProducts={products} />

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => {
            const mainImageIndex = product.mainImageIndex || 0;
            const mainImageUrl = product.images && product.images[mainImageIndex] ? product.images[mainImageIndex].url : null;

            return (
              <div key={product.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {mainImageUrl ? (
                    <img
                      src={mainImageUrl}
                      alt={product.title}
                      className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                      <ImageIcon className="h-8 w-8 text-zinc-400" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="min-h-[2.2rem]">
                    <h3 className="line-clamp-2 text-sm font-semibold">{product.title}</h3>
                  </div>
                  {product.description && (
                    <p className="line-clamp-3 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {product.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <div className="text-sm font-semibold">£{product.price?.toFixed?.(2) ?? "-"}</div>
                    <button
                      onClick={() => {
                        try { console.log('[AffiliateShopBuilder] product click', { id: product.id, title: product.title, typeId: product.typeId }); } catch(e) {}
                        // Route based on product type or explicit product title for affiliates
                        // If this exact affiliate product title is clicked, route to the accryl affiliate page
                        try {
                          const title = (product.title || '').toLowerCase();
                          // match common variants, be forgiving about whitespace/casing
                          if (title.includes('fotonix') && title.includes('light up')) {
                            try {
                              const target = `${window.location.origin}${window.location.pathname}#affiliate-product-accryl`;
                              console.log('[AffiliateShopBuilder] navigating to', target);
                              window.location.href = target;
                            } catch (e) {
                              window.location.hash = 'affiliate-product-accryl';
                              try { window.dispatchEvent(new Event('hashchange')); } catch(e) {}
                            }
                              return;
                          }
                        } catch (e) { /* ignore and fall back */ }

                        // existing routing: special designer types go to the accryl affiliate product page
                        if (product.typeId === 'lumina-cut-user' || product.typeId === 'light-up-user') {
                          try {
                            const target = `${window.location.origin}${window.location.pathname}#affiliate-product-accryl`;
                            console.log('[AffiliateShopBuilder] navigating to', target);
                            window.location.href = target;
                          } catch (e) {
                            window.location.hash = 'affiliate-product-accryl';
                            try { window.dispatchEvent(new Event('hashchange')); } catch(e) {}
                          }
                        } else if (ownerUid) {
                          window.location.href = `${window.location.origin}/product/${ownerUid}/${product.id}`;
                        }
                      }}
                      className="rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:translate-y-[1px]"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {products.length === 0 && (
          <div className="text-center py-12">
            <p className={`text-xl ${light ? 'text-white text-opacity-75' : 'text-gray-600'}`}>
              No products available yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}   