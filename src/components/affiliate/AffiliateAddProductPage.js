import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Send, User, TrendingUp, DollarSign, Package, MousePointerClick, RefreshCcw, Filter, Download, Search } from "lucide-react";

/**
 * CommentModal — a child‑friendly, pink→violet styled modal comment section.
 *
 * Props:
 *  - isOpen: boolean — controls modal visibility
 *  - onClose: () => void — called when modal is dismissed
 *  - currentUserId?: string — signed-in user's id (for highlighting their own comments)
 *  - creatorUserId?: string — the creator/owner's id to badge their comments
 *  - initialComments?: Array<{ id: string; userId: string; displayName: string; text: string; createdAt: number }>
 *  - onSubmitComment?: (commentText: string) => Promise<void> | void — optional hook you can use to write to Firebase
 *  - bannedWords?: string[] — optional override list of banned words
 *
 * Notes:
 *  - By default, the component enforces: no links, no images, profanity filter.
 *  - When a violation is detected, it shows a child‑friendly popup and blocks the post.
 *  - You can wire Firebase Realtime Database in onSubmitComment; see TODO at bottom.
 */
export default function AffiliateAddProductPage({
  isOpen,
  onClose,
  currentUserId,
  creatorUserId,
  initialComments = [],
  onSubmitComment,
  bannedWords,
}) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [alert, setAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef(null);

  // Default child‑friendly banned words list. Expand as needed.
  const defaultBanned = useMemo(
    () =>
      [
        // common profanity — keep this list short and extend in your app
        "shit",
        "fuck",
        "bitch",
        "asshole",
        "bastard",
        "dick",
        "piss",
        "crap",
        "damn",
        "hell",
        "slut",
        "whore",
      ],
    []
  );

  const banned = useMemo(
    () => (bannedWords && bannedWords.length ? bannedWords : defaultBanned),
    [bannedWords, defaultBanned]
  );

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // autoscroll to bottom when comments change
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments, isOpen]);

  const hasLinkOrImage = (s) => {
    const linkPattern = /(https?:\/\/|www\.)/i;
    const markdownImg = /!\[[^\]]*\]\([^\)]*\)/i; // ![alt](url)
    const htmlImg = /<\s*img\b[^>]*>/i;
    return linkPattern.test(s) || markdownImg.test(s) || htmlImg.test(s);
  };

  const usesBannedWord = (s) => {
    const cleaned = s.toLowerCase();
    return banned.some((w) =>
      new RegExp(`(^|[^a-z])${escapeRegExp(w)}([^a-z]|$)`, "i").test(cleaned)
    );
  };

  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    // Guardrails
    if (hasLinkOrImage(trimmed)) {
      setAlert("Links and images aren't allowed. Please keep comments text‑only.");
      return;
    }
    if (usesBannedWord(trimmed)) {
      setAlert("Certain banned words used. Post removed.");
      setText("");
      return;
    }

    const newComment = {
      id: `${Date.now()}`,
      userId: currentUserId || "anon",
      displayName: "You",
      text: trimmed,
      createdAt: Date.now(),
    };

    try {
      setSubmitting(true);
      // Optimistic UI
      setComments((prev) => [...prev, newComment]);
      setText("");

      if (onSubmitComment) {
        await onSubmitComment(trimmed);
      }
    } catch (err) {
      // Revert if needed
      setComments((prev) => prev.filter((c) => c.id !== newComment.id));
      setAlert("Sorry, we couldn't save your comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
          >
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 p-5 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Comments (kid‑friendly)</h2>
                </div>
                <button
                  aria-label="Close comments"
                  onClick={onClose}
                  className="rounded-full p-1.5 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-1 text-xs/relaxed text-white/90">
                No links, no images, be kind.
              </p>
            </div>

            {/* Body */}
            <div className="bg-white p-4 dark:bg-zinc-900">
              {/* List */}
              <div
                ref={listRef}
                className="max-h-80 space-y-3 overflow-y-auto pr-1"
              >
                {comments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-violet-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    No comments yet. Be the first to say hi!
                  </div>
                ) : (
                  comments.map((c) => {
                    const isCreator = creatorUserId && c.userId === creatorUserId;
                    const isMe = currentUserId && c.userId === currentUserId;
                    return (
                      <div
                        key={c.id}
                        className={[
                          "rounded-2xl border p-3 shadow-sm",
                          isCreator
                            ? "border-pink-200 bg-pink-50 dark:border-pink-900/40 dark:bg-pink-950/30"
                            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {c.displayName || "User"}
                              </span>
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {new Date(c.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isCreator && (
                              <span className="rounded-full bg-gradient-to-r from-pink-500 to-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                                Creator
                              </span>
                            )}
                            {isMe && !isCreator && (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100">
                          {c.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer */}
              <form onSubmit={handleSubmit} className="mt-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 400))}
                    placeholder="Write a kind, text‑only comment (max 400 chars)…"
                    className="h-24 w-full resize-none rounded-xl p-3 text-sm outline-none placeholder:text-zinc-400 dark:bg-transparent dark:text-zinc-100"
                  />
                  <div className="flex items-center justify-between px-2 pb-1">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {400 - text.length} characters left
                    </span>
                    <button
                      type="submit"
                      disabled={submitting || !text.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" /> Post
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>

          {/* Alert popup */}
          <AnimatePresence>
            {alert && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="fixed bottom-6 left-1/2 z-[110] w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-pink-200 bg-white p-4 text-sm text-zinc-800 shadow-xl dark:border-pink-900/40 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Safety Check</p>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">{alert}</p>
                  </div>
                  <button
                    onClick={() => setAlert(null)}
                    className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/*
  ===== Firebase RTDB wiring (optional) =====

  Example usage in your app:

  const [open, setOpen] = useState(false);

  <CommentModal
    isOpen={open}
    onClose={() => setOpen(false)}
    currentUserId={user?.uid}
    creatorUserId={creatorId}
    initialComments={commentsFromDb}
    onSubmitComment={async (text) => {
      // Write to RTDB under comments/{postId}/{pushId}
      import { getDatabase, ref, push, serverTimestamp, set } from "firebase/database";
      const db = getDatabase();
      const newRef = push(ref(db, `comments/${postId}`));
      await set(newRef, {
        userId: user?.uid,
        displayName: user?.displayName || "Anon",
        text,
        createdAt: Date.now(), // or serverTimestamp()
      });
    }}
  />

  And to live‑subscribe (outside the component), use onValue on comments/{postId} and pass the array as initialComments (or fork this component to manage the subscription internally).
*/


// ==============================
// Affiliate Products Panel (for affiliates, internal dashboard)
// Pink→Violet style to match the app
// ==============================

export function computeDerived(
  products,
  query,
  status,
  sort
) {
  const q = (query || "").trim().toLowerCase();
  let list = products.filter(
    (p) => (status === "all" || p.status === status) && (!q || p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  );
  switch (sort) {
    case "earnings_desc":
      list.sort((a, b) => b.earnings - a.earnings);
      break;
    case "earnings_asc":
      list.sort((a, b) => a.earnings - b.earnings);
      break;
    case "sold_desc":
      list.sort((a, b) => b.itemsSold - a.itemsSold);
      break;
    case "sold_asc":
      list.sort((a, b) => a.itemsSold - b.itemsSold);
      break;
    case "conv_desc":
      list.sort((a, b) => b.conversions / (b.clicks || 1) - a.conversions / (a.clicks || 1));
      break;
    case "conv_asc":
      list.sort((a, b) => a.conversions / (a.clicks || 1) - b.conversions / (b.clicks || 1));
      break;
  }
  return list;
}

export function AffiliateProductsPanel({
  products = [],
  loading = false,
  onRefresh,
  onToggleStatus,
}) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [sort, setSort] = React.useState("earnings_desc");

  const fmt = (n) => new Intl.NumberFormat(undefined).format(n);
  const money = (n) => new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" }).format(n);

  const filtered = React.useMemo(
    () => computeDerived(products, query, status, sort),
    [products, query, status, sort]
  );

  const totals = React.useMemo(() => {
    const clicks = products.reduce((s, p) => s + p.clicks, 0);
    const conv = products.reduce((s, p) => s + p.conversions, 0);
    const sold = products.reduce((s, p) => s + p.itemsSold, 0);
    const earn = products.reduce((s, p) => s + p.earnings, 0);
    return { clicks, conv, sold, earn, cr: clicks ? conv / clicks : 0 };
  }, [products]);

  // Show loading state
  if (loading) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Your Affiliate Products</h3>
          <p className="text-xs text-zinc-500">Internal view for affiliates. Track performance, earnings, and status.</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent"></div>
            <p className="text-sm text-zinc-600">Loading your products...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Your Affiliate Products</h3>
          <p className="text-xs text-zinc-500">Internal view for affiliates. Track performance, earnings, and status.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Developer docs link to the frontend workflow (non-intrusive) */}
          <a
            href="/copilot/frontend-workflow.md"
            target="_blank"
            rel="noopener noreferrer"
            title="Open affiliate frontend workflow"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V7"/><path d="M7 3h10l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>
            Dev Docs
          </a>

          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={DollarSign} title="Total Earnings" value={money(totals.earn)} gradient />
        <KpiCard icon={Package} title="Items Sold" value={fmt(totals.sold)} />
        <KpiCard icon={MousePointerClick} title="Clicks" value={fmt(totals.clicks)} />
        <KpiCard icon={TrendingUp} title="Conversion Rate" value={`${(totals.cr * 100).toFixed(1)}%`} />
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="w-64 rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
            placeholder="Search title or SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <Filter className="h-4 w-4" />
            <select className="bg-transparent outline-none" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span>Sort</span>
            <select className="bg-transparent outline-none" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="earnings_desc">Earnings ↓</option>
              <option value="earnings_asc">Earnings ↑</option>
              <option value="sold_desc">Sold ↓</option>
              <option value="sold_asc">Sold ↑</option>
              <option value="conv_desc">Conv Rate ↓</option>
              <option value="conv_asc">Conv Rate ↑</option>
            </select>
          </div>
          <ExportCsvButton products={filtered} />
        </div>
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800">
        <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 p-3 text-xs font-semibold uppercase tracking-wide text-white">Products</div>
        <div className="grid grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_0.6fr_0.6fr_0.5fr_0.8fr] items-center gap-2 border-b border-zinc-200 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800">
          <div>Title</div>
          <div>SKU</div>
          <div>Price</div>
          <div>Clicks</div>
          <div>Conversions</div>
          <div>Items Sold</div>
          <div>Conv %</div>
          <div className="text-right">Earnings</div>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {filtered.map((p) => {
            const convRate = p.clicks ? (p.conversions / p.clicks) * 100 : 0;
            return (
              <div key={p.id} className="grid grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_0.6fr_0.6fr_0.5fr_0.8fr] items-center gap-2 px-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                    <StatusBadge status={p.status} />
                    <span>{((p.commissionRate || 0) * 100).toFixed(0)}% commission</span>
                  </div>
                </div>
                <div className="truncate text-zinc-600">{p.sku || 'N/A'}</div>
                <div>{money(p.price || 0)}</div>
                <div>{fmt(p.clicks || 0)}</div>
                <div>{fmt(p.conversions || 0)}</div>
                <div>{fmt(p.itemsSold || 0)}</div>
                <div>{convRate.toFixed(1)}%</div>
                <div className="text-right font-semibold">{money(p.earnings || 0)}</div>
              </div>
            );
          })}
          {filtered.length === 0 && products.length === 0 && (
            <div className="p-8 text-center">
              <Package className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
              <h4 className="mb-2 font-medium text-zinc-900">No products yet</h4>
              <p className="text-sm text-zinc-500 mb-4">
                Start by adding products to your store, then they'll appear here for affiliate tracking.
              </p>
              <button
                onClick={onRefresh}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <RefreshCcw className="h-4 w-4" /> Check for products
              </button>
            </div>
          )}
          {filtered.length === 0 && products.length > 0 && (
            <div className="p-6 text-center text-sm text-zinc-500">No products match your current filters.</div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">Showing {filtered.length} of {products.length} products</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh data
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * CommissionRateField
 *
 * Reusable input to edit a product's commission rate (percentage shown, stored as decimal).
 * Props:
 *  - product: object (may contain commissionRate as decimal, e.g. 0.10)
 *  - setProduct: function to update the product object
 *
 * Behavior:
 *  - Fetches program default from /api/affiliates/settings on mount and sets product.commissionRate
 *    to the default if it's currently undefined.
 *  - Shows and accepts percentage value (0–100, step 0.1) and stores it as decimal (e.g. 0.1).
 */
export function CommissionRateField({ product, setProduct }) {
  const [defaultPct, setDefaultPct] = React.useState(null); // decimal (e.g. 0.10)

  React.useEffect(() => {
    let cancelled = false;
    // Fetch program default commission percent (server returns programDefaultCommissionPct as whole number)
    fetch('/api/affiliates/settings')
      .then((r) => r.json())
      .then((s) => {
        if (cancelled) return;
        if (s && typeof s.programDefaultCommissionPct === 'number') {
          const dec = Number(s.programDefaultCommissionPct) / 100;
          setDefaultPct(dec);
          // If product doesn't already have a commissionRate, set it to default
          setProduct((p) => {
            if (!p) return p;
            if (p.commissionRate === undefined || p.commissionRate === null) {
              return { ...p, commissionRate: p.commissionRate ?? dec };
            }
            return p;
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setProduct]);

  const displayPct = (() => {
    const rate = product && product.commissionRate !== undefined && product.commissionRate !== null ? product.commissionRate : defaultPct;
    return typeof rate === 'number' ? (rate * 100).toFixed(1) : '';
  })();

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">Commission Rate (%)</label>
      <input
        type="number"
        min="0"
        max="100"
        step="0.1"
        className="mt-1 w-32 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
        placeholder="10"
        value={displayPct}
        onChange={(e) => {
          const raw = e.target.value;
          const num = parseFloat(raw || '0');
          if (Number.isNaN(num)) return;
          const dec = Math.max(0, Math.min(100, num)) / 100;
          setProduct((p) => ({ ...p, commissionRate: dec }));
        }}
      />
      <p className="mt-1 text-xs text-zinc-500">Affiliates earn this percentage from each sale. Default is 10% if left empty.</p>
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, gradient = false }) {
  return (
    <div
      className={[
        "rounded-2xl border p-4 shadow-sm",
        gradient
          ? "bg-gradient-to-r from-pink-50 to-violet-50 dark:from-pink-950/20 dark:to-violet-950/20"
          : "bg-white dark:bg-zinc-900",
        "border-zinc-200 dark:border-zinc-800",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{title}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const style =
    status === "active"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : status === "paused"
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  const label = status === "active" ? "Active" : status === "paused" ? "Paused" : "Out of stock";
  return <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", style].join(" ")}>{label}</span>;
}

// === CSV utility + tests ===
export function toCsv(products) {
  const headers = [
    "id",
    "title",
    "sku",
    "price",
    "commissionRate",
    "status",
    "clicks",
    "conversions",
    "itemsSold",
    "earnings",
  ];
  const rows = products.map((p) => [
    p.id,
    p.title,
    p.sku,
    p.price,
    p.commissionRate,
    p.status,
    p.clicks,
    p.conversions,
    p.itemsSold,
    p.earnings,
  ]);
  const escapeCell = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
  return [headers, ...rows]
    .map((r) => r.map(escapeCell).join(","))
    .join("\n");
}

function ExportCsvButton({ products }) {
  const onExport = React.useCallback(() => {
    const csv = toCsv(products);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliate_products_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [products]);

  return (
    <button
      onClick={onExport}
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <Download className="h-4 w-4" /> Export CSV
    </button>
  );
}

// --- Inline tests (dev only) ---
function runInlineTests() {
  // CSV tests
  const sample = [
    {
      id: "1",
      title: 'A "Quote", Comma, & More',
      sku: "SKU,1",
      price: 1,
      commissionRate: 0.1,
      status: "active",
      clicks: 10,
      conversions: 2,
      itemsSold: 2,
      earnings: 0.2,
    },
    {
      id: "2",
      title: "Glow Serum",
      sku: "GLW-001",
      price: 19.99,
      commissionRate: 0.15,
      status: "active",
      clicks: 1200,
      conversions: 96,
      itemsSold: 110,
      earnings: 329.7,
    },
  ];
  const csv = toCsv(sample);
  const lines = csv.split("\n");
  console.assert(lines.length === sample.length + 1, "CSV should have header + rows");
  console.assert(lines[0].startsWith('"id","title","sku"'), "Header present");
  console.assert(csv.includes('"A ""Quote"", Comma, & More"'), "Quotes should be doubled");
  console.assert(lines[1].includes('"SKU,1"'), "Comma-containing SKU should be quoted");

  // computeDerived tests
  const derived1 = computeDerived(sample, "glow", "all", "earnings_desc");
  console.assert(derived1.length === 1 && derived1[0].id === "2", "Search should filter to matching title");
  const derived2 = computeDerived(sample, "", "active", "sold_desc");
  console.assert(derived2[0].itemsSold >= derived2[1].itemsSold, "Sort sold_desc should be descending");
  const derived3 = computeDerived(sample, "", "active", "conv_desc");
  const cr0 = sample[0].conversions / sample[0].clicks;
  const cr1 = sample[1].conversions / sample[1].clicks;
  console.assert((derived3[0].id === "1") === (cr0 >= cr1), "Conv sort should rank by conversions/clicks");

  // Edge cases
  console.assert(toCsv([]).split("\n").length === 1, "Empty list should still return header only");
}

// Guarded execution to avoid runtime issues in prod/browsers without process
try {
  // @ts-ignore
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production") {
    runInlineTests();
  }
} catch {}

/*
Usage example:

<AffiliateProductsPanel
  products={[
    { id: "p1", title: "Glow Serum", sku: "GLW-001", price: 19.99, commissionRate: 0.15, status: "active", clicks: 1200, conversions: 96, itemsSold: 110, earnings: 329.7 },
    { id: "p2", title: "Violet Scrub", sku: "VLT-002", price: 14.99, commissionRate: 0.12, status: "paused", clicks: 300, conversions: 12, itemsSold: 13, earnings: 23.4 },
  ]}
  onRefresh={() => console.log('refresh')}
/>

To connect to Firebase Realtime Database, fetch your affiliate-scoped products and map to the props shape above. For security, scope reads to the authenticated affiliate's uid in your rules.
*/
