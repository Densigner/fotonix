import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { API_URL } from "../../config/environment";

/**
 * MemberAffiliateLinker
 * - Members can connect a product to an affiliate, optionally set custom commission (%),
 *   and create a managed link (/l/<slug>) stored server-side.
 *
 * Expected APIs:
 *  GET  /api/member/products
 *      -> [ { id, title, sku, priceCents, commissionRate } ] // commissionRate decimal, e.g., 0.15
 *
 *  GET  /api/affiliates/search?q=<query>
 *      -> [ { id, affiliateCode, displayName, paypalEmail?, paypalMe? } ]
 *
 *  GET  /api/member/links
 *      -> [ { id, slug, url, productId, affiliateId, linkCustomRatePct?, createdAt } ]
 *
 *  POST /api/member/links
 *      body: { productId, affiliateId, slug, linkCustomRatePct? }
 *      -> { id, slug, url, ... }
 */
export default function MemberAffiliateLinker() {
  const [products, setProducts] = useState([]);
  const [links, setLinks] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [selAffiliate, setSelAffiliate] = useState(null);

  const [selProductId, setSelProductId] = useState("");
  const [customPct, setCustomPct] = useState(""); // string input (e.g. "20")
  const [slug, setSlug] = useState("");

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [prod, lks] = await Promise.all([
        fetch(`${API_URL}/api/member/products`).then(r => r.json()),
        fetch(`${API_URL}/api/member/links`).then(r => r.json()),
      ]);
      if (!mounted) return;
      setProducts(prod);
      setLinks(lks);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      const r = await fetch(`${API_URL}/api/member/affiliates/search?q=${encodeURIComponent(q)}`).then(res => res.json());
      setResults(r);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selProductId),
    [products, selProductId]
  );

  function autoSlug() {
    if (!selectedProduct || !selAffiliate) return "";
    const base = `${selectedProduct.title}-${selAffiliate.displayName || selAffiliate.affiliateCode || "aff"}`.toLowerCase();
    return base
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48);
  }

  async function createLink() {
    if (!selAffiliate || !selProductId) {
      setNotice("Choose a product and an affiliate first.");
      return;
    }
    const finalSlug = (slug || autoSlug()) || Math.random().toString(36).slice(2, 10);
    const linkCustomRatePct = customPct === "" ? undefined : Number(customPct);
    if (linkCustomRatePct !== undefined && (isNaN(linkCustomRatePct) || linkCustomRatePct < 0 || linkCustomRatePct > 100)) {
      setNotice("Custom commission % must be between 0 and 100.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/api/member/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selProductId,
          affiliateId: selAffiliate.id,
          slug: finalSlug,
          linkCustomRatePct, // optional
        }),
      }).then(r => r.json());

      setLinks(l => [res, ...l]);
      setNotice("Link created successfully.");
      setSlug("");
      setCustomPct("");
    } catch {
      setNotice("Unable to create link. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-8">
      <header>
        <h1 className="text-xl font-semibold">Link a Product with an Affiliate</h1>
        <p className="text-sm text-zinc-500">
          Generate a tracked link with an optional custom commission %. Payments happen off-platform; we only track.
        </p>
      </header>

      {/* Choose product */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold mb-2">1) Choose a Product</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
            value={selProductId}
            onChange={e => setSelProductId(e.target.value)}
          >
            <option value="">— Select —</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.title} ({(p.commissionRate * 100).toFixed(0)}% default)
              </option>
            ))}
          </select>
          {selectedProduct && (
            <div className="text-xs text-zinc-500">
              SKU {selectedProduct.sku} · Price {(selectedProduct.priceCents/100).toFixed(2)} GBP
            </div>
          )}
        </div>
      </section>

      {/* Find affiliate */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold mb-2">2) Pick an Affiliate</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="w-64 rounded-xl border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
              placeholder="Search code or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {selAffiliate && (
            <span className="text-xs text-zinc-600">
              Selected: <b>{selAffiliate.displayName || selAffiliate.affiliateCode}</b>
            </span>
          )}
        </div>
        {results.length > 0 && (
          <div className="mt-3 grid gap-2">
            {results.slice(0, 6).map(a => (
              <button
                key={a.id}
                onClick={() => { setSelAffiliate(a); setResults([]); }}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  <div className="font-medium">{a.displayName || a.affiliateCode}</div>
                  <div className="text-[11px] text-zinc-500">Code {a.affiliateCode}{a.paypalEmail ? ` · ${a.paypalEmail}` : ""}</div>
                </div>
                <Plus className="h-4 w-4" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Custom commission + slug */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold mb-3">3) Commission & Link</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Custom Commission (%) — optional</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder={selectedProduct ? `${(selectedProduct.commissionRate*100).toFixed(0)} (default)` : "e.g. 20"}
              className="w-40 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
              value={customPct}
              onChange={(e) => setCustomPct(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Slug (optional)</label>
            <input
              type="text"
              placeholder={autoSlug() || "my-product-influencer"}
              className="w-64 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <button
            disabled={saving || !selAffiliate || !selProductId}
            onClick={createLink}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            <LinkIcon className="h-4 w-4" />
            Create Link
          </button>
          {notice && (
            <div className="text-xs text-zinc-600">{notice}</div>
          )}
        </div>
      </section>

      {/* Existing links */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold mb-2">Your Affiliate Links</h3>
        <div className="grid gap-2">
          {links.length === 0 && <div className="text-sm text-zinc-500">No links yet.</div>}
          {links.map(l => (
            <div key={l.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="min-w-0">
                <div className="font-medium truncate">{l.url}</div>
                <div className="text-[11px] text-zinc-500">
                  slug: {l.slug} · product: {l.productId} · affiliate: {l.affiliateId}
                  {l.linkCustomRatePct != null ? ` · custom: ${l.linkCustomRatePct}%` : ""}
                </div>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(l.url); }}
                className="rounded-xl border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Success footer hint */}
      <footer className="text-xs text-zinc-500">
        After you share a link: clicks are tracked, orders carry the clickId,
        and commissions are attributed on webhook. Payments happen directly in PayPal.
        Use your <b>Members Dashboard</b> to pay affiliates and mark items as paid.
      </footer>
    </div>
  );
}