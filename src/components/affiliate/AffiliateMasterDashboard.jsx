import React, { useEffect, useMemo, useState } from "react";
import { Download, TrendingUp, CheckCircle2, Clock, MousePointerClick } from "lucide-react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { API_URL } from "../../config/environment";

/**
 * AffiliateMasterDashboard
 * One affiliate's own commission history and trend - despite the name (kept
 * for now to avoid churning the page route/button), this is NOT a
 * cross-affiliate admin view. /api/affiliates/stats and /attributions are
 * both scoped server-side to a single `code`; there's a separate, genuinely
 * admin-only view for seeing every affiliate at once (AdminAffiliatePayouts,
 * gated to the platform-owner account). See src/Bible/affiliates/gotchas.md
 * for the history of this component previously calling both routes with no
 * `code` at all (always 400ed) and reading field names neither route
 * actually returns (ratePct, orderId, createdAt, affiliateId).
 */
export default function AffiliateMasterDashboard({ affiliateCode, apiBase = "" }) {
  const [stats, setStats] = useState(null);
  const [attributions, setAttributions] = useState([]);
  const [loading, setLoading] = useState(true);

  const money = (n) => new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" }).format((n || 0) / 100);

  useEffect(() => {
    if (!affiliateCode) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const base = apiBase || API_URL;
        const headers = { 'x-affiliate-code': affiliateCode };
        const [statsRes, attrRes] = await Promise.all([
          fetch(`${base}/api/affiliates/stats?code=${encodeURIComponent(affiliateCode)}`, { headers }).then((r) => r.json()),
          fetch(`${base}/api/affiliates/attributions?code=${encodeURIComponent(affiliateCode)}`, { headers }).then((r) => r.json()),
        ]);
        setStats(statsRes && !statsRes.error ? statsRes : null);
        setAttributions(Array.isArray(attrRes) ? attrRes : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [affiliateCode, apiBase]);

  const trendData = useMemo(() => {
    if (!stats || !Array.isArray(stats.timeseries)) return [];
    return stats.timeseries.map(t => ({ date: t.date, revenue: t.revenue || 0 }));
  }, [stats]);

  const exportCsv = () => {
    const headers = ["orderNumber", "date", "amountCents", "commissionCents", "status", "notes"];
    const rows = attributions.map((a) => [a.orderNumber, a.date, a.amountCents, a.commissionCents, a.status, a.notes || '']);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my_commissions_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6 text-zinc-500">Loading...</div>;
  if (!stats) return <div className="p-6 text-zinc-500">No data found.</div>;

  return (
    <div className="p-6 space-y-8">
      {/* ===== KPI Section ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={MousePointerClick} title="Clicks" value={stats.clicks || 0} gradient />
        <KpiCard icon={TrendingUp} title="Conversions" value={stats.conversions || 0} />
        <KpiCard icon={Clock} title="Pending" value={money(stats.pendingCommissionCents)} />
        <KpiCard icon={CheckCircle2} title="Approved" value={money(stats.approvedCommissionCents)} />
      </div>

      {/* ===== Revenue Trend ===== */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold mb-2">Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis tickFormatter={(v) => money(v)} fontSize={12} />
            <Tooltip formatter={(v) => money(v)} labelStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="revenue" stroke="#ec4899" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ===== Ledger ===== */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">Your Commissions</h3>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>

        <div className="grid grid-cols-[1fr_0.8fr_0.6fr_0.4fr_0.6fr] gap-2 border-b border-zinc-200 px-3 py-2 text-[11px] font-semibold text-zinc-500 dark:border-zinc-800">
          <div>Order</div>
          <div>Sale Amount</div>
          <div>Commission</div>
          <div>Status</div>
          <div className="text-right">Date</div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
          {attributions.length === 0 ? (
            <div className="p-6 text-center text-zinc-500">No commissions yet.</div>
          ) : (
            attributions.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[1fr_0.8fr_0.6fr_0.4fr_0.6fr] items-center gap-2 px-3 py-2"
              >
                <div className="truncate">{a.orderNumber}</div>
                <div>{money(a.amountCents)}</div>
                <div>{money(a.commissionCents)}</div>
                <StatusBadge status={a.status} />
                <div className="text-right text-xs text-zinc-500">
                  {new Date(a.date).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* === Reusable Components === */
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

export function StatusBadge({ status }) {
  const map = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    void: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
  const label =
    status === "approved"
      ? "Approved"
      : status === "void"
      ? "Voided"
      : "Pending";
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        map[status],
      ].join(" ")}
    >
      {label}
    </span>
  );
}
