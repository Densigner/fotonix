import React, { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/** --- Mock data --------------------------------------------------------- */
const seed = [
  {
    id: "f1",
    name: "Punked",
    companyName: "PunkStyle",
    domain: "punked.punkstyle.fotonix.co.uk",
    slug: "punked",
    companySlug: "punkstyle",
    status: "active", // active | archived
    createdAt: new Date(),
  },
  {
    id: "f2",
    name: "Q4 Holiday Promo",
    companyName: "MyBrand",
    domain: "q4-holiday-promo.mybrand.fotonix.co.uk",
    slug: "q4-holiday-promo",
    companySlug: "mybrand",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
  },
  {
    id: "f3",
    name: "Legacy—Spring 2024",
    companyName: "OldCo",
    domain: "legacy-spring-2024.oldco.fotonix.co.uk",
    slug: "legacy-spring-2024",
    companySlug: "oldco",
    status: "archived",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
  },
];

/** --- Utilities --------------------------------------------------------- */
const fmt = (d) =>
  d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** --- Create Funnel Modal ---------------------------------------------- */
function CreateFunnelModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    goal: "",
    currency: "GBP",
  });

  // Generate the funnel slug from name (lowercase, hyphens, no special chars)
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30);
  };

  // Generate the full funnel URL
  const funnelSlug = generateSlug(form.name);
  const companySlug = generateSlug(form.companyName);
  const funnelDomain = funnelSlug && companySlug 
    ? `${funnelSlug}.${companySlug}.fotonix.co.uk`
    : 'your-funnel.your-company.fotonix.co.uk';

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
              onChange={(e) =>
                setForm((s) => ({ ...s, companyName: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-600">
              Your Funnel URL
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-sm text-neutral-500">https://</span>
              <span className="text-sm font-medium text-indigo-600">{funnelDomain}</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              This will be your public funnel link
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

          <div className="mt-2 flex justify-end gap-2">
            <button
              className="rounded-lg border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              disabled={!form.name || !form.companyName || !form.goal}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                onCreate?.({ ...form, domain: funnelDomain, slug: funnelSlug, companySlug });
                onClose?.();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** --- Row status pill --------------------------------------------------- */
function StatusPill({ status }) {
  const ok = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {ok ? "Active" : "Archived"}
    </span>
  );
}

/** --- Actions menu (simple) -------------------------------------------- */
function RowActions() {
  return (
    <button className="rounded-md p-2 hover:bg-neutral-100">
      <MoreVertical className="h-4 w-4 text-neutral-600" />
    </button>
  );
}

/** --- Main Page --------------------------------------------------------- */
export default function FunnelsListPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active"); // "all" | "active" | "archived"
  const [rows, setRows] = useState(seed);
  const [openCreate, setOpenCreate] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQ = !q || r.name.toLowerCase().includes(q);
      const matchesS =
        status === "all" ? true : status === "active" ? r.status === "active" : r.status === "archived";
      return matchesQ && matchesS;
    });
  }, [rows, query, status]);

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
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>

        <button className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50">
          <Filter className="h-4 w-4" />
          Filter
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          onClick={() => setOpenCreate(true)}
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
            {filtered.length} {filtered.length === 1 ? "Funnel" : "Funnels"}
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
                <th className="px-5 py-3">Domain</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {filtered.length === 0 ? (
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
                        onClick={() => setOpenCreate(true)}
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
                    onClick={() => {
                      // navigate to templates chooser first, then user will pick a template and go to editor
                      try { window.location.hash = 'funnel-builder/templates'; } catch(e) {}
                    }}
                  >
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-indigo-700 group-hover:underline">
                        {r.name}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <a
                        href={`/funnel/${r.companySlug}/${r.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-indigo-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {r.domain || 'No domain set'}
                      </a>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-sm text-neutral-700">
                      {fmt(r.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <RowActions />
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
        onCreate={(form) => {
          const newRow = {
            id: crypto.randomUUID().slice(0, 8),
            name: form.name,
            companyName: form.companyName,
            domain: form.domain,
            slug: form.slug,
            companySlug: form.companySlug,
            goal: form.goal,
            currency: form.currency,
            status: "active",
            createdAt: new Date(),
          };
          setRows((s) => [newRow, ...s]);
          // OPTIONALLY: route to builder with modal prefilled
          // router.push(`/funnels/${newRow.id}/builder?name=${encodeURIComponent(form.name)}&goal=${form.goal}`)
        }}
      />
    </div>
  );
}
