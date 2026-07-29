import React, { useEffect, useMemo, useState } from "react";
import { Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { API_URL } from '../../config/environment';
import { Clipboard, Check, ExternalLink, TrendingUp, MousePointerClick, BadgeCheck, Filter, Store, Package, Mail, DollarSign } from "lucide-react";
import { CAMPAIGN_GATE_ADMIN_EMAIL, computeCampaignSalesGate, campaignGateAlertMessage } from '../../utils/campaignSalesGate';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

// Helper: build referral link
export function buildReferralLink(programUrl, affiliateCode) {
  if (!programUrl) return "";
  const base = programUrl.replace(/\/$/, "");
  return `${base}/?ref=${encodeURIComponent(affiliateCode)}`;
}

export default function AffiliateDashboard({ affiliateCode = "ALEX10", programUrl = "", apiBase = "", onCreateProduct }) {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [copied, setCopied] = useState(false);

  const referralLink = useMemo(() => buildReferralLink(programUrl, affiliateCode), [programUrl, affiliateCode]);

  useEffect(() => {
    let alive = true;
    (async function fetchData() {
      setLoading(true);
      try {
        const headers = { 'x-affiliate-code': affiliateCode };

        // Fetch analytics from the live route (server/routes/affiliate/affiliates.js,
        // mounted at /api/affiliates). It already returns the shape this dashboard
        // uses directly: { clicks, conversions, pendingCommissionCents,
        // approvedCommissionCents, currency, timeseries }
        // `apiBase || API_URL`, never a bare relative path — on fotonix.co.uk
        // (the static frontend host) there's no reverse proxy for /api/*, so a
        // relative fetch here silently hits the SPA's index.html fallback (a
        // 200 OK with HTML, not JSON) instead of erroring. This previously
        // made every affiliate's stats/attributions silently show all-zero
        // in production, indistinguishable from "no clicks yet" - see
        // src/Bible/emails/gotchas.md item 8 for the same bug class.
        const base = apiBase || API_URL;
        const statsRes = await fetch(`${base}/api/affiliates/stats?code=${encodeURIComponent(affiliateCode)}`, { headers });
        if (!statsRes.ok) throw new Error('Failed to load stats');
        const body = await statsRes.json();

        // Fetch per-order attributions (Commissions table) from the same live route
        const attrsRes = await fetch(`${base}/api/affiliates/attributions?code=${encodeURIComponent(affiliateCode)}`, { headers });
        const attrs = attrsRes.ok ? await attrsRes.json() : [];

        if (alive) {
          setStats({
            clicks: body.clicks || 0,
            conversions: body.conversions || 0,
            pendingCommissionCents: body.pendingCommissionCents || 0,
            approvedCommissionCents: body.approvedCommissionCents || 0,
            currency: body.currency || "GBP",
            timeseries: Array.isArray(body.timeseries) ? body.timeseries : [],
          });
          setRows(Array.isArray(attrs) ? attrs : []);
        }
      } catch (e) {
        if (alive) {
          // On error, avoid showing fabricated data — show empty state instead
          setStats({ clicks: 0, conversions: 0, pendingCommissionCents: 0, approvedCommissionCents: 0, currency: 'GBP', timeseries: [] });
          setRows([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [affiliateCode, apiBase]);

  const filteredRows = useMemo(() => Array.isArray(rows) ? rows.filter(r => (filter === "all" ? true : r.status === filter)) : [], [rows, filter]);
  // Force GBP display on the dashboard (show pounds, not dollars)
  const currency = "GBP";
  const fmt = (cents) => (cents / 100).toLocaleString(undefined, { style: "currency", currency });

  // First line of defence for the campaign-sales gate (see
  // AutomationsEditor.js / src/utils/campaignSalesGate.js for the full
  // rule) — reuses the attributions this dashboard already fetches for its
  // own commissions table, so no extra request needed.
  const isCampaignGateAdmin = getAuth().currentUser?.email === CAMPAIGN_GATE_ADMIN_EMAIL;
  const salesGate = useMemo(
    () => (isCampaignGateAdmin ? { unlocked: true, recentSales: 0 } : computeCampaignSalesGate(rows)),
    [rows, isCampaignGateAdmin]
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Affiliate Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, <span className="font-medium">{affiliateCode}</span>. Track your clicks, conversions and commissions.</p>
          </div>
          <div className="flex items-center gap-2">
            <ReferralLinkBox link={referralLink} copied={copied} setCopied={setCopied} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.location.hash = 'affiliate-shop-builder'}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <Store className="h-4 w-4" />
            Shop Builder
          </button>
          <button
            onClick={() => window.location.hash = 'affiliate-add-product'}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <Package className="h-4 w-4" />
            My Products
          </button>
          <button
            onClick={onCreateProduct}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <Package className="h-4 w-4" />
            Add Product
          </button>
          <button
            onClick={() => {
              if (!salesGate.unlocked) {
                alert(campaignGateAlertMessage(salesGate.recentSales));
                return;
              }
              window.location.hash = 'mail-campaign';
            }}
            title={salesGate.unlocked ? undefined : 'Locked — see alert for details'}
            className={salesGate.unlocked
              ? "inline-flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
              : "inline-flex items-center gap-2 rounded-xl bg-gray-300 text-gray-500 px-4 py-2 text-sm font-semibold shadow-sm cursor-not-allowed"}
          >
            <Mail className="h-4 w-4" />
            Mail Campaign
          </button>
          <button
            onClick={() => window.location.hash = 'tools/short-review'}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
          >
            Review Shorts (AI)
          </button>
          <button
            onClick={() => window.location.hash = 'affiliate-clicks'}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <MousePointerClick className="h-4 w-4" />
            View Clicks
          </button>
          <button
            onClick={() => window.location.hash = 'affiliate-master-dashboard'}
            className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <DollarSign className="h-4 w-4" />
            Master Dashboard
          </button>
          <button
            onClick={() => window.location.hash = 'funnel-builder'}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <TrendingUp className="h-4 w-4" />
            Funnel Builder
          </button>
          <button
            onClick={() => window.location.hash = 'affiliate-mailing-list'}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
          >
            <Mail className="h-4 w-4" />
            Your Mailing List
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPI icon={<MousePointerClick className="h-5 w-5" />} label="Clicks" value={stats?.clicks ?? 0} loading={loading} />
          <KPI icon={<BadgeCheck className="h-5 w-5" />} label="Pending Commission" value={fmt(stats?.pendingCommissionCents ?? 0)} loading={loading} />
          <KPI icon={<TrendingUp className="h-5 w-5" />} label="Approved Commission" value={fmt(stats?.approvedCommissionCents ?? 0)} loading={loading} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Clicks (last 30 days)" subtitle="Track your funnel performance">
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={(stats && stats.timeseries) || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="clicks" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Commission by Day" subtitle="Approved + Pending">
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <BarChart data={(stats && stats.timeseries) || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="commissionCents" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card title="Commissions" subtitle="Your attributed orders and payouts">
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>All</FilterPill>
            <FilterPill active={filter === "pending"} onClick={() => setFilter("pending")}>Pending</FilterPill>
            <FilterPill active={filter === "approved"} onClick={() => setFilter("approved")}>Approved</FilterPill>
            <FilterPill active={filter === "void"} onClick={() => setFilter("void")}>Void</FilterPill>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full table-fixed">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Commission</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id} className="border-t text-sm">
                    <td className="px-4 py-3 font-medium">{r.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{fmt(r.amountCents)}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(r.commissionCents)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{r.notes || "—"}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">No records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="How to Promote" subtitle="Share your link, use your coupon, and follow program rules">
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Use your unique link everywhere: websites, YouTube descriptions, social bios.</li>
            <li>Don’t bid on our brand name in ads unless explicitly allowed.</li>
            <li>Commissions approve after the return window closes.</li>
          </ul>
          <a href="/affiliate-terms" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">Program terms <ExternalLink className="h-4 w-4" /></a>
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, loading }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">{icon}</div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-semibold">{loading ? "—" : value}</div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function StatusBadge({ status }) {
  const color = status === "approved" ? "bg-green-100 text-green-800" : status === "pending" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{status}</span>;
}

function FilterPill({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
      {children}
    </button>
  );
}

function ReferralLinkBox({ link, copied, setCopied }) {
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // ignore
    }
  };
  const disabled = !link;
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white">
      <input readOnly value={link} placeholder="Referral link will appear here" className="w-72 truncate px-3 py-2 text-sm outline-none" />
      <button onClick={copy} disabled={disabled} title={disabled ? "No referral link (set programUrl)" : "Copy link"} className={`flex items-center gap-1 px-3 text-sm font-medium ${disabled ? "text-gray-400" : "text-blue-600 hover:bg-blue-50"}`}>
        {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

