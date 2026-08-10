import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
import { API_URL } from '../../../config/environment';
import { getStarterBlocks } from './templateRegistry';

/** --- Utilities --------------------------------------------------------- */
const fmt = (d) =>
  new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const slugify = (name) =>
  (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);

/** --- Create Funnel Modal ---------------------------------------------- */
function CreateFunnelModal({ open, onClose, onCreate, existingCompanySlug, creating, error }) {
  const [form, setForm] = useState({
    name: "",
    companyName: existingCompanySlug || "",
    goal: "",
    currency: "GBP",
  });

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, companyName: existingCompanySlug || f.companyName }));
  }, [open, existingCompanySlug]);

  const funnelSlug = slugify(form.name);
  const companySlug = slugify(form.companyName);
  const funnelDomain = funnelSlug && companySlug
    ? `fotonix.co.uk/funnel/${companySlug}/${funnelSlug}`
    : 'fotonix.co.uk/funnel/your-company/your-funnel';

  const goals = [
    { id: "audience", title: "Build an audience", desc: "Collect emails." },
    { id: "sell", title: "Sell", desc: "Sell a product or service." },
    { id: "custom", title: "Custom", desc: "Start from scratch." },
    {
      id: "webinar",
      title: "Run an evergreen webinar",
      desc: "Automate your funnel.",
    },
  ];

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h3 className="text-xl font-semibold">Create funnel</h3>
          <p className="text-sm text-neutral-500">
            Name your funnel and choose a goal to get started.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-neutral-600">Funnel Name</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="e.g. Summer Launch"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600">
              Company/Brand Name
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="e.g. MyBrand"
              value={form.companyName}
              disabled={!!existingCompanySlug}
              onChange={(e) =>
                setForm((s) => ({ ...s, companyName: e.target.value }))
              }
            />
            {existingCompanySlug && (
              <p className="mt-1 text-xs text-neutral-500">
                Your funnels are all published under this same company slug
                — every one of your funnels shares this URL prefix.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600">
              Your Funnel URL
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-sm font-medium text-indigo-600">{funnelDomain}</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              This will be your public funnel link once you publish it
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600">
              Choose your funnel goal
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {goals.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setForm((s) => ({ ...s, goal: g.id }))}
                  className={`rounded-xl border p-3 text-left transition ${
                    form.goal === g.id
                      ? "border-indigo-500 ring-2 ring-indigo-100"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="text-sm font-medium">{g.title}</div>
                  <div className="mt-1 text-xs text-neutral-600">{g.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600">
              Currency
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              value={form.currency}
              onChange={(e) =>
                setForm((s) => ({ ...s, currency: e.target.value }))
              }
            >
              <option>GBP</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </div>

          {form.currency !== 'GBP' && (
            <p className="text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
              Prices may be displayed in your local currency. The final amount
              can vary slightly due to exchange rates or fees charged by your
              bank or payment provider. International delivery charges,
              import VAT, customs duties or handling fees may also apply
              depending on the customer's country.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <p className="text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
            This creates the funnel and opens the editor — it starts as a draft
            that only you can see. Nobody can visit the URL above until you
            click <span className="font-medium">Publish</span> in the editor's
            top-right corner.
          </p>

          <div className="mt-2 flex justify-end gap-2">
            <button
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              disabled={!form.name || !form.companyName || !form.goal || creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onCreate({ ...form, slug: funnelSlug, companySlug })}
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** --- Row status pill --------------------------------------------------- */
function StatusPill({ published }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        published
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200"
      }`}
    >
      {published ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {published ? "Published" : "Draft"}
    </span>
  );
}

/** --- Actions menu ------------------------------------------------------ */
function RowActions({ funnel, onRename, onDuplicate, onTogglePublish, onDelete }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const item = (icon, label, handler, danger) => (
    <button
      onClick={(e) => { e.stopPropagation(); setOpen(false); handler(); }}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${danger ? "text-red-600" : "text-neutral-700"}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} className="relative inline-block text-left">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded-md p-2 hover:bg-neutral-100"
      >
        <MoreVertical className="h-4 w-4 text-neutral-600" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
          {item(<Pencil className="h-3.5 w-3.5" />, "Rename", () => onRename(funnel))}
          {item(<Copy className="h-3.5 w-3.5" />, "Duplicate", () => onDuplicate(funnel))}
          {funnel.published
            ? item(<XCircle className="h-3.5 w-3.5" />, "Unpublish", () => onTogglePublish(funnel))
            : item(<CheckCircle2 className="h-3.5 w-3.5" />, "Publish", () => onTogglePublish(funnel))}
          <div className="my-1 border-t border-neutral-100" />
          {item(<Trash2 className="h-3.5 w-3.5" />, "Delete", () => onDelete(funnel), true)}
        </div>
      )}
    </div>
  );
}

/** --- Main Page --------------------------------------------------------- */
export default function FunnelsListPage({ currentUserId, onOpenFunnel }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all"); // "all" | "published" | "draft"
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [companySlug, setCompanySlug] = useState(null);

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'x-member-uid': currentUserId || 'test_user_1',
  }), [currentUserId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [funnelsRes, slugRes] = await Promise.all([
          fetch(`${API_URL}/api/funnels`, { headers: authHeaders }),
          fetch(`${API_URL}/api/funnels/company-slug/mine`, { headers: authHeaders }),
        ]);
        if (!mounted) return;
        if (funnelsRes.ok) {
          const data = await funnelsRes.json();
          setRows(data.funnels || []);
        }
        if (slugRes.ok) {
          const data = await slugRes.json();
          setCompanySlug(data.companySlug || null);
        }
      } catch (e) {
        // leave rows empty — the empty state below handles this gracefully
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [authHeaders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQ = !q || (r.name || '').toLowerCase().includes(q);
      const matchesS =
        status === "all" ? true : status === "published" ? r.published : !r.published;
      return matchesQ && matchesS;
    });
  }, [rows, query, status]);

  async function handleCreate(form) {
    setCreating(true);
    setCreateError(null);
    try {
      // Claim (or reconfirm) the company slug this user's funnels live under.
      const slugRes = await fetch(`${API_URL}/api/funnels/company-slug`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ companySlug: form.companySlug }),
      });
      if (!slugRes.ok) {
        const err = await slugRes.json().catch(() => ({}));
        setCreateError(err.error || 'That company slug is already taken.');
        setCreating(false);
        return;
      }
      const slugData = await slugRes.json();
      setCompanySlug(slugData.companySlug);

      const createRes = await fetch(`${API_URL}/api/funnels`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: form.name, slug: form.slug, blocks: getStarterBlocks(form.goal) }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        setCreateError(err.error || 'You already have a funnel with that name.');
        setCreating(false);
        return;
      }
      const { funnel } = await createRes.json();
      setRows((s) => [funnel, ...s]);
      setOpenCreate(false);
      setCreating(false);
      onOpenFunnel?.(funnel, slugData.companySlug);
    } catch (e) {
      setCreateError('Something went wrong creating this funnel.');
      setCreating(false);
    }
  }

  async function handleRename(funnel) {
    const next = window.prompt('Rename funnel', funnel.name);
    if (next == null) return; // cancelled
    const trimmed = next.trim();
    if (!trimmed || trimmed === funnel.name) return;
    try {
      const res = await fetch(`${API_URL}/api/funnels/${funnel.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      const { funnel: updated } = await res.json();
      setRows((s) => s.map((r) => (r.id === funnel.id ? updated : r)));
    } catch (e) {
      window.alert('Could not rename this funnel — please try again.');
    }
  }

  async function handleDuplicate(funnel) {
    try {
      // Same slug-collision handling as manual creation: try the plain
      // "name (copy)" slug first, then fall back to a timestamp suffix if
      // that's already taken too (e.g. duplicating the same funnel twice).
      const attempt = async (name) => fetch(`${API_URL}/api/funnels`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name, blocks: funnel.blocks }),
      });
      let res = await attempt(`${funnel.name} (copy)`);
      if (res.status === 409) {
        res = await attempt(`${funnel.name} (copy ${Date.now().toString().slice(-4)})`);
      }
      if (!res.ok) throw new Error();
      const { funnel: created } = await res.json();
      setRows((s) => [created, ...s]);
    } catch (e) {
      window.alert('Could not duplicate this funnel — please try again.');
    }
  }

  async function handleTogglePublish(funnel) {
    try {
      const res = await fetch(`${API_URL}/api/funnels/${funnel.id}/${funnel.published ? 'unpublish' : 'publish'}`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error();
      const { funnel: updated } = await res.json();
      setRows((s) => s.map((r) => (r.id === funnel.id ? updated : r)));
    } catch (e) {
      window.alert(`Could not ${funnel.published ? 'unpublish' : 'publish'} this funnel — please try again.`);
    }
  }

  async function handleDelete(funnel) {
    if (!window.confirm(`Delete "${funnel.name}"? This can't be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/funnels/${funnel.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) throw new Error();
      setRows((s) => s.filter((r) => r.id !== funnel.id));
    } catch (e) {
      window.alert('Could not delete this funnel — please try again.');
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Funnels</h2>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            className="w-64 rounded-xl border border-neutral-200 bg-white pl-9 pr-3 py-2 text-sm shadow-sm outline-none placeholder:text-neutral-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Status select (pill-like) */}
        <select
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>

        <button className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50">
          <Filter className="h-4 w-4" />
          Filter
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          onClick={() => { setCreateError(null); setOpenCreate(true); }}
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>

      {/* Card wrapper around table, to match your dashboard style */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* Header strip */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <div className="text-sm font-medium text-neutral-700">
            {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? "Funnel" : "Funnels"}`}
          </div>
          <div className="text-xs text-neutral-500">
            Click a row to open the funnel.
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-100">
            <thead className="bg-neutral-50/60">
              <tr className="text-left text-xs font-semibold text-neutral-600">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Public URL</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10">
                    <div className="grid place-items-center text-center">
                      <div className="mb-2 text-base font-medium">
                        No records yet.
                      </div>
                      <div className="mb-4 text-sm text-neutral-600">
                        Create your first funnel to start tracking performance.
                      </div>
                      <button
                        onClick={() => { setCreateError(null); setOpenCreate(true); }}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                      >
                        <Plus className="h-4 w-4" />
                        Create funnel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="group cursor-pointer hover:bg-neutral-50/60"
                    onClick={() => onOpenFunnel?.(r, companySlug)}
                  >
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-indigo-700 group-hover:underline">
                        {r.name}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {companySlug ? (
                        <a
                          href={`/funnel/${companySlug}/${r.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-indigo-600 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          fotonix.co.uk/funnel/{companySlug}/{r.slug}
                        </a>
                      ) : (
                        <span className="text-sm text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill published={r.published} />
                    </td>
                    <td className="px-5 py-4 text-sm text-neutral-700">
                      {fmt(r.updated_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <RowActions
                          funnel={r}
                          onRename={handleRename}
                          onDuplicate={handleDuplicate}
                          onTogglePublish={handleTogglePublish}
                          onDelete={handleDelete}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <CreateFunnelModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={handleCreate}
        existingCompanySlug={companySlug}
        creating={creating}
        error={createError}
      />
    </div>
  );
}
