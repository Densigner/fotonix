import React, { useEffect, useState } from "react";
import { RefreshCcw, Download, TrendingUp, DollarSign, CheckCircle2, Clock, XCircle } from "lucide-react";
import { API_URL } from "../../config/environment";
import { StatusBadge } from "../affiliate/AffiliateMasterDashboard";

const ADMIN_EMAIL = 'joshmarsden28@gmail.com';

/**
 * AdminAffiliatePayouts
 * The genuine cross-affiliate "what do I owe everyone" view - restricted to
 * the platform-owner account (src/components/shared/Header.js's `isMember`
 * check uses the same hardcoded email). Backed by
 * GET/POST /api/affiliates/admin/* , which are themselves gated server-side
 * the same way - see server/routes/affiliate/affiliates.js.
 */
export default function AdminAffiliatePayouts({ currentUserEmail }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(null);

  const money = (n) => new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" }).format((n || 0) / 100);
  const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/affiliates/admin/overview`, {
        headers: { 'x-admin-email': currentUserEmail || '' },
      });
      const json = await res.json();
      setData(res.ok ? json : null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markPaid = async (affiliateId) => {
    setMarking(affiliateId);
    try {
      await fetch(`${API_URL}/api/affiliates/admin/mark-paid/${encodeURIComponent(affiliateId)}`, {
        method: 'POST',
        headers: { 'x-admin-email': currentUserEmail || '' },
      });
      await load();
    } finally {
      setMarking(null);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const headers = ["orderId", "affiliateId", "ratePct", "commissionCents", "amountCents", "status", "createdAt"];
    const rows = data.ledger.map((a) => [a.orderId, a.affiliateId, a.ratePct, a.commissionCents, a.amountCents, a.status, a.createdAt]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all_affiliate_commissions_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (currentUserEmail !== ADMIN_EMAIL) {
    return <div className="p-6 text-zinc-500">Not authorized.</div>;
  }
  if (loading) return <div className="p-6 text-zinc-500">Loading...</div>;
  if (!data) return <div className="p-6 text-zinc-500">No data found.</div>;

  return (
    <div className="p-6 space-y-8">
      {/* ===== KPI Section ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard icon={DollarSign} title="Total Sales" value={money(data.totalSalesCents)} gradient />
        <KpiCard icon={Clock} title="Owed (Pending)" value={money(data.pendingCents)} />
        <KpiCard icon={CheckCircle2} title="Approved/Paid" value={money(data.approvedCents)} />
        <KpiCard icon={XCircle} title="Voided" value={money(data.voidCents)} />
        <KpiCard icon={TrendingUp} title="Avg Commission Rate" value={fmtPct(data.avgRatePct)} />
      </div>

      {/* ===== Owed by Affiliate ===== */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">What You Owe to Affiliates</h3>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {data.byAffiliate.length === 0 ? (
            <div className="p-6 text-center text-zinc-500">No affiliate commissions yet.</div>
          ) : (
            data.byAffiliate.map((a) => (
              <div key={a.affiliateId} className="flex justify-between items-center px-4 py-3">
                <div>
                  <p className="font-medium">{a.affiliateId}</p>
                  <p className="text-xs text-zinc-500">
                    Orders: {a.totalOrders} · Pending: {money(a.pending)} · Approved: {money(a.approved)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => markPaid(a.affiliateId)}
                    disabled={a.pending === 0 || marking === a.affiliateId}
                    className="rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                  >
                    {marking === a.affiliateId ? 'Marking...' : 'Mark Paid'}
                  </button>
                  <a
                    href={`https://www.paypal.com/paypalme/${a.affiliateId}`}
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
          <h3 className="text-sm font-semibold">All Commissions Ledger</h3>
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
          {data.ledger.slice(0, 50).map((a, i) => (
            <div
              key={`${a.orderId}-${i}`}
              className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.4fr_0.6fr] items-center gap-2 px-3 py-2"
            >
              <div className="truncate">{a.orderId}</div>
              <div className="truncate text-zinc-600">{a.affiliateId}</div>
              <div>{fmtPct(a.ratePct)}</div>
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
