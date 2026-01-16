import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Download, TrendingUp, DollarSign, CheckCircle2, Clock, XCircle } from "lucide-react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

/**
 * AffiliateMasterDashboard
 * Shows total owed to affiliates, paid commissions, voids, and trends.
 * Track-only: no fund custody. Merchants pay affiliates externally.
 */
export default function AffiliateMasterDashboard() {
  const [stats, setStats] = useState(null);
  const [attributions, setAttributions] = useState([]);
  const [loading, setLoading] = useState(true);

  const money = (n) => new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" }).format(n / 100);
  const fmtPct = (n) => `${n.toFixed(1)}%`;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [statsRes, attrRes] = await Promise.all([
          fetch("/api/affiliates/stats").then((r) => r.json()),
          fetch("/api/affiliates/attributions").then((r) => r.json()),
        ]);
        setStats(statsRes);
        setAttributions(attrRes);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Aggregate owed per affiliate
  const byAffiliate = useMemo(() => {
    const map = {};
    attributions.forEach((a) => {
      if (!map[a.affiliateId]) {
        map[a.affiliateId] = { pending: 0, approved: 0, void: 0, totalOrders: 0 };
      }
      if (a.status === "pending") map[a.affiliateId].pending += a.commissionCents;
      else if (a.status === "approved") map[a.affiliateId].approved += a.commissionCents;
      else if (a.status === "void") map[a.affiliateId].void += a.commissionCents;
      map[a.affiliateId].totalOrders++;
    });
    return Object.entries(map).map(([affiliateId, data]) => ({ affiliateId, ...data }));
  }, [attributions]);

  // Simple trend by day
  const trendData = useMemo(() => {
    const map = {};
    attributions.forEach((a) => {
      const day = new Date(a.createdAt).toISOString().slice(0, 10);
      if (!map[day]) map[day] = 0;
      map[day] += a.commissionCents;
    });
    return Object.entries(map).map(([day, total]) => ({ day, total }));
  }, [attributions]);

  const exportCsv = () => {
    const headers = [
      "orderId",
      "affiliateId",
      "commissionCents",
      "ratePct",
      "status",
      "createdAt",
    ];
    const rows = attributions.map((a) =>
      [a.orderId, a.affiliateId, a.commissionCents, a.ratePct, a.status, a.createdAt]
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliate_commissions_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6 text-zinc-500">Loading dashboard...</div>;
  if (!stats) return <div className="p-6 text-zinc-500">No data found.</div>;

  return (
    <div className="p-6 space-y-8">
      {/* ===== KPI Section ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard icon={DollarSign} title="Total Sales" value={money(stats.totalSalesCents || 0)} gradient />
        <KpiCard icon={Clock} title="Owed (Pending)" value={money(stats.pendingCents || 0)} />
        <KpiCard icon={CheckCircle2} title="Approved/Paid" value={money(stats.approvedCents || 0)} />
        <KpiCard icon={XCircle} title="Voided" value={money(stats.voidCents || 0)} />
        <KpiCard icon={TrendingUp} title="Avg Commission Rate" value={fmtPct(stats.avgRatePct || 0)} />
      </div>

      {/* ===== Commission Trend ===== */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold mb-2">Commission Trend (All Affiliates)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis tickFormatter={(v) => money(v)} fontSize={12} />
            <Tooltip formatter={(v) => money(v)} labelStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="total" stroke="#ec4899" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ===== Owed by Affiliate ===== */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">What You Owe to Affiliates</h3>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {byAffiliate.length === 0 ? (
            <div className="p-6 text-center text-zinc-500">No affiliate commissions yet.</div>
          ) : (
            byAffiliate.map((a) => (
              <div key={a.affiliateId} className="flex justify-between items-center px-4 py-3">
                <div>
                  <p className="font-medium">{a.affiliateId}</p>
                  <p className="text-xs text-zinc-500">
                    Orders: {a.totalOrders} · Pending: {money(a.pending)} · Approved: {money(a.approved)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => markAsPaid(a.affiliateId)}
                    className="rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                  >
                    Mark Paid
                  </button>
                  <a
                    href={`https://www.paypal.com/paypalme/${a.affiliateId}`} // optional convenience
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-fuchsia-600 hover:underline"
                  >
                    Pay via PayPal
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== Ledger ===== */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">Recent Commissions Ledger</h3>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>

        <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.4fr_0.6fr] gap-2 border-b border-zinc-200 px-3 py-2 text-[11px] font-semibold text-zinc-500 dark:border-zinc-800">
          <div>Order ID</div>
          <div>Affiliate</div>
          <div>Rate</div>
          <div>Commission</div>
          <div>Status</div>
          <div className="text-right">Date</div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
          {attributions.slice(0, 20).map((a) => (
            <div
              key={a.orderId}
              className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.4fr_0.6fr] items-center gap-2 px-3 py-2"
            >
              <div className="truncate">{a.orderId}</div>
              <div className="truncate text-zinc-600">{a.affiliateId}</div>
              <div>{a.ratePct.toFixed(1)}%</div>
              <div>{money(a.commissionCents)}</div>
              <StatusBadge status={a.status} />
              <div className="text-right text-xs text-zinc-500">
                {new Date(a.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  async function markAsPaid(affiliateId) {
    // Optional: PATCH API call to mark attributions for this affiliate as approved
    await fetch(`/api/affiliates/mark-paid/${affiliateId}`, { method: "POST" });
    window.location.reload();
  }
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

function StatusBadge({ status }) {
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
