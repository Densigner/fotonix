import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * CONFIG — point this at your deployed API + tenant
 */
// Default to empty so the dev server proxy (create-react-app) is used when available.
// Use env var override when needed (deployed API base).
const API_BASE = process.env.REACT_APP_API_BASE || "";
const TENANT_SLUG = process.env.REACT_APP_TENANT_SLUG || "fotonix-prod";

/**
 * Small helpers
 */
function clsx(...xs) { return xs.filter(Boolean).join(" "); }
function timeAgo(d) {
  const dt = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24); if (days < 7) return `${days}d`;
  return dt.toLocaleDateString();
}
function truncate(s, n = 120) { if (!s) return ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }

/**
 * Inbox Screen
 */
export default function InboxScreen() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const listRef = useRef(null);

  // Get current user's memberUid
  const memberUid = localStorage.getItem('memberUID') || null;

  // Fetch inbox page
  async function fetchMessages({ reset = false } = {}) {
    if (loading) return;
    if (!hasMore && !reset) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("tenant", TENANT_SLUG);
    params.set("status", "received");
    params.set("limit", "25");
    if (memberUid) params.set("memberUid", memberUid); // Filter by member's emails
    if (query) params.set("q", query);
    if (cursor && !reset) params.set("cursor", cursor);

    try {
      const res = await fetch(`${API_BASE}/api/email/messages?` + params.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // API may return either an array of rows (legacy / direct DB rows)
      // or an object { items: [...], next_cursor }. Normalize both shapes.
      let itemsArr = [];
      let nextCursor = null;
      if (Array.isArray(data)) {
        itemsArr = data;
        nextCursor = null;
      } else if (data && Array.isArray(data.items)) {
        itemsArr = data.items;
        nextCursor = data.next_cursor || null;
      }

      const newItems = reset ? itemsArr : [...(items || []), ...itemsArr];
      setItems(newItems);
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
      // auto-select the first message when resetting
      if (reset && newItems.length) {
        setActiveId(newItems[0].id);
      }
    } catch (e) {
      setError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  // Initial + whenever query changes
  useEffect(() => {
    fetchMessages({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Load message detail when selection changes
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!activeId) { setDetail(null); return; }
      setDetailLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/email/messages/${activeId}?tenant=${TENANT_SLUG}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) setDetail(data);
      } catch (e) {
        if (!ignore) setDetail({ error: e.message || "Failed to load message" });
      } finally {
        if (!ignore) setDetailLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, [activeId]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    function onScroll() {
      if (loading || !hasMore) return;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
      if (nearBottom) fetchMessages();
    }
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasMore, cursor, items]);

  // Keyboard shortcuts (j/k/r)
  useEffect(() => {
    function onKey(e) {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!items.length) return;
        const idx = items.findIndex(m => m.id === activeId);
        const next = items[Math.min(items.length - 1, idx + 1)] || items[0];
        setActiveId(next?.id);
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        const idx = items.findIndex(m => m.id === activeId);
        const prev = items[Math.max(0, idx - 1)] || items[items.length - 1];
        setActiveId(prev?.id);
      }
      if (e.key === "r") {
        e.preventDefault();
        if (detail) setReplying(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, activeId, detail]);

  const activeItem = useMemo(
    () => items.find(m => m.id === activeId) || null,
    [items, activeId]
  );

  async function sendReply() {
    if (!detail || !activeItem) return;
    const originalFrom = detail.from?.[0]?.address || detail.from || activeItem.from;
    const subject = detail.subject?.startsWith("Re:") ? detail.subject : `Re: ${detail.subject || activeItem.subject || ""}`;

    const payload = {
      tenant_slug: TENANT_SLUG,
      to: originalFrom,                 // reply to original sender
      subject,
      text: replyBody,
      html: `<p>${escapeHtml(replyBody).replace(/\n/g, "<br/>")}</p>`,
      // Optional niceties if your backend supports threading:
      // in_reply_to_id: detail.id,
      // references: detail.headers?.["Message-Id"] ? [detail.headers["Message-Id"]] : undefined,
    };

    try {
      setReplying("sending");
      const res = await fetch(`${API_BASE}/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Send failed: ${res.status} ${t}`);
      }
      setReplyBody("");
      setReplying(false);
      // Optionally refresh the thread pane or add a “sent” bubble locally
      // Here we just show a tiny toast via alert:
      alert("Reply sent ✅");
    } catch (e) {
      setReplying(false);
      alert(e.message || "Failed to send reply");
    }
  }

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-white/5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="text-sm rounded-full px-2 py-1 border border-white/10 bg-white/5">Tenant</div>
          <div className="text-sm font-medium">{TENANT_SLUG}</div>
          <div className="ml-auto flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search from, subject, address..."
              className="w-[280px] rounded-xl bg-white/5 px-3 py-2 text-sm outline-none ring-0 border border-white/10 focus:border-white/20"
            />
            <button
              onClick={() => fetchMessages({ reset: true })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              Search
            </button>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="mx-auto grid h-[calc(100vh-56px)] max-w-7xl grid-cols-1 md:grid-cols-[380px_1fr] gap-4 p-4">
        {/* LIST */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-slate-300">
            <div className="font-medium">Inbox</div>
            <div>{items.length} loaded{hasMore ? "…" : ""}</div>
          </div>

          <div ref={listRef} className="flex-1 overflow-auto">
            {items.map((m, idx) => (
              <button
                key={`${m.id || 'item'}-${idx}`}
                onClick={() => setActiveId(m.id)}
                className={clsx(
                  "w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5",
                  activeId === m.id && "bg-white/10"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold">{m.from_name || m.from || "Unknown"}</div>
                  <div className="ml-auto text-xs text-slate-400">{timeAgo(m.created_at || m.date || m.received_at)}</div>
                </div>
                <div className="mt-0.5 truncate text-sm text-slate-200">{m.subject || "(no subject)"}</div>
                <div className="truncate text-xs text-slate-400">{truncate(m.snippet || m.preview || "")}</div>
              </button>
            ))}

            {loading && (
              <div className="px-4 py-3 text-sm text-slate-400">Loading…</div>
            )}
            {error && (
              <div className="px-4 py-3 text-sm text-rose-300">Error: {error}</div>
            )}
            {!loading && !items.length && !error && (
              <div className="px-4 py-6 text-sm text-slate-400">No messages yet.</div>
            )}
          </div>
        </section>

        {/* DETAIL */}
        <section className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
          {!activeItem ? (
            <div className="m-auto p-6 text-slate-400">Select a message</div>
          ) : (
            <>
              <div className="border-b border-white/10 px-4 py-3">
                <div className="text-sm text-slate-300">
                  <span className="text-slate-400">From:</span>{" "}
                  {detail?.from?.[0]?.name || detail?.from?.[0]?.address || activeItem.from}
                </div>
                <div className="text-sm text-slate-300">
                  <span className="text-slate-400">To:</span>{" "}
                  {detail?.to?.map(t => t.address).join(", ") || activeItem.to}
                </div>
                <div className="mt-1 text-base font-semibold">{detail?.subject || activeItem.subject || "(no subject)"}</div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {detailLoading ? (
                  <div className="text-sm text-slate-400">Loading…</div>
                ) : detail?.error ? (
                  <div className="text-sm text-rose-300">Error: {detail.error}</div>
                ) : (
                  <MessageBody html={detail?.html} text={detail?.text} />
                )}
              </div>

              {/* Reply composer */}
              <div className="border-t border-white/10 p-3">
                {!replying && (
                  <button
                    onClick={() => setReplying(true)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    Reply
                  </button>
                )}
                {replying && (
                  <div className="space-y-2">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write your reply…  (Press Cmd/Ctrl+Enter to send)"
                      className="h-28 w-full resize-y rounded-xl bg-slate-950/40 px-3 py-2 text-sm outline-none ring-0 border border-white/10 focus:border-white/20"
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          sendReply();
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={sendReply}
                        disabled={replying === "sending" || !replyBody.trim()}
                        className={clsx(
                          "rounded-xl px-3 py-2 text-sm",
                          "border border-indigo-400/40 ring-1 ring-inset ring-indigo-400/30",
                          "bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50"
                        )}
                      >
                        {replying === "sending" ? "Sending…" : "Send"}
                      </button>
                      <button
                        onClick={() => { setReplying(false); setReplyBody(""); }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * MessageBody — render HTML safely.
 * NOTE: Ideally sanitize HTML on the server. If you already sanitize,
 * this is fine. If not, consider DOMPurify on the client.
 */
function MessageBody({ html, text }) {
  if (html) {
    return (
      <div
        className="prose prose-invert max-w-none prose-a:underline prose-a:decoration-indigo-400/60"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  if (text) {
    return (
      <pre className="whitespace-pre-wrap text-sm text-slate-200">{text}</pre>
    );
  }
  return <div className="text-sm text-slate-400">No content.</div>;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
