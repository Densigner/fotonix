import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshCcw, Download, TrendingUp, DollarSign,
  CheckCircle2, Clock, XCircle, ExternalLink, Package,
  MousePointerClick, Filter, Search, Plus, Mail,
  Video, BarChart3, Workflow, ShoppingBag, Database
} from "lucide-react";
import { LinkDashboard, LinkCreator } from '../../features/links';
import EmailVerificationNotice from '../auth/EmailVerificationNotice';
import OrderCenter from '../ordersReceived/OrderCenter';
import { API_URL } from '../../config/environment';

/**
 * MembersDashboard
 * - For MEMBERS (sellers/merchants), not affiliates.
 * - Track-only: shows what they owe to each affiliate, approved, voided, ledger.
 * - "Pay via PayPal" opens PayPal to the affiliate (paypalMe preferred, else email).
 * - "Mark as Paid" just updates status on server; funds never pass through Fotonix.
 * - Shop Builder: Manage products, campaigns, and store tools.
 *
 * TailwindCSS-based. Remove icons or styles if you're not using them.
 *
 * Expected APIs (ownerUid is implied by auth/session on server side):
 *  GET  /api/member/stats
 *      -> { totalSalesCents, pendingCents, approvedCents, voidCents, avgRatePct }
 *  GET  /api/member/attributions
 *      -> [ { id, orderId, affiliateId, affiliateName?, paypalEmail?, paypalMe?, commissionCents, ratePct, status, createdAt } ]
 *  GET  /api/member/products
 *      -> [ { id, title, sku, price, commissionRate, status, clicks, conversions, itemsSold, earnings } ]
 *  POST /api/member/attributions/mark-paid
 *      body: { attributionIds: string[] }  -> 200 { updated: n }
 */
export default function MembersDashboard() {
  const [stats, setStats] = useState(null);
  const [attributions, setAttributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("earnings_desc");
  
  // Link management state
  const [showLinkDashboard, setShowLinkDashboard] = useState(false);
  const [showLinkCreator, setShowLinkCreator] = useState(false);

  const money = (cents) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP" })
      .format((cents || 0) / 100);

  const fmt = (n) => new Intl.NumberFormat(undefined).format(n);

  function computeDerived(products, query, status, sort) {
    const q = (query || "").trim().toLowerCase();
    let list = products.filter(
      (p) => (status === "all" || p.status === status) && (!q || p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    );
    switch (sort) {
      case "earnings_desc":
        list.sort((a, b) => (b.earnings || 0) - (a.earnings || 0));
        break;
      case "earnings_asc":
        list.sort((a, b) => (a.earnings || 0) - (b.earnings || 0));
        break;
      case "sold_desc":
        list.sort((a, b) => (b.itemsSold || 0) - (a.itemsSold || 0));
        break;
      case "sold_asc":
        list.sort((a, b) => (a.itemsSold || 0) - (b.itemsSold || 0));
        break;
      case "conv_desc":
        list.sort((a, b) => (b.conversions || 0) / ((b.clicks || 0) || 1) - (a.conversions || 0) / ((a.clicks || 0) || 1));
        break;
      case "conv_asc":
        list.sort((a, b) => (a.conversions || 0) / ((a.clicks || 0) || 1) - (b.conversions || 0) / ((b.clicks || 0) || 1));
        break;
    }
    return list;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        
        // Default fallback data
        const defaultStats = {
          totalSalesCents: 0,
          pendingCents: 0,
          approvedCents: 0,
          voidCents: 0,
          avgRatePct: 0
        };
        const defaultAttributions = [];
        
        // Try to fetch stats, but use fallback if it fails
        let statsData = defaultStats;
        let attributionsData = defaultAttributions;
        
        try {
          console.log('Fetching member stats...');
          const statsResponse = await fetch(`${API_URL}/api/member/stats`, {
            headers: { 'x-member-uid': 'current-member-id' }
          });
          console.log('Stats response status:', statsResponse.status);
          if (statsResponse.ok) {
            const statsJson = await statsResponse.json();
            console.log('Stats API response:', statsJson);
            if (statsJson && typeof statsJson.totalSalesCents !== 'undefined') {
              statsData = statsJson;
              console.log('Using real stats data:', statsData);
            } else {
              console.log('Invalid stats format, using defaults');
            }
          } else {
            console.log('Stats API failed with status:', statsResponse.status);
          }
        } catch (error) {
          console.log('Stats API error:', error);
          console.log('Stats API not available, using defaults');
        }
        
        try {
          const attributionsResponse = await fetch(`${API_URL}/api/member/attributions`, {
            headers: { 'x-member-uid': 'current-member-id' }
          });
          if (attributionsResponse.ok) {
            const attributionsJson = await attributionsResponse.json();
            if (Array.isArray(attributionsJson)) {
              attributionsData = attributionsJson;
            }
          }
        } catch (error) {
          console.log('Attributions API not available, using defaults');
        }
        
        if (!mounted) return;
        setStats(statsData);
        setAttributions(attributionsData);
      } catch (error) {
        console.error('Error loading member data:', error);
        if (mounted) {
          setStats({
            totalSalesCents: 0,
            pendingCents: 0,
            approvedCents: 0,
            voidCents: 0,
            avgRatePct: 0
          });
          setAttributions([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load products when switching to products tab
  useEffect(() => {
    if (activeTab === 'products' && products.length === 0) {
      loadProducts();
    }
  }, [activeTab, products.length]);

  async function loadProducts() {
    try {
      setProductsLoading(true);
      const response = await fetch(`${API_URL}/api/member/products`, {
        headers: { 'x-member-uid': 'current-member-id' }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      } else {
        console.log('Products API not available, using empty array');
        setProducts([]);
      }
    } catch (error) {
      console.log('Products API not available, using empty array');
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }

  const byAffiliate = useMemo(() => {
    const map = new Map();
    for (const a of attributions) {
      const key = a.affiliateId;
      if (!map.has(key)) {
        map.set(key, {
          affiliateId: a.affiliateId,
          affiliateName: a.affiliateName || a.affiliateId,
          paypalEmail: a.paypalEmail || "",
          paypalMe: a.paypalMe || "",
          pendingCents: 0,
          approvedCents: 0,
          voidCents: 0,
          attributionIdsPending: [],
          ordersCount: 0,
        });
      }
      const row = map.get(key);
      if (a.status === "pending") {
        row.pendingCents += a.commissionCents;
        row.attributionIdsPending.push(a.id);
      } else if (a.status === "approved") {
        row.approvedCents += a.commissionCents;
      } else if (a.status === "void") {
        row.voidCents += a.commissionCents;
      }
      row.ordersCount += 1;
    }
    return Array.from(map.values()).sort((x, y) => y.pendingCents - x.pendingCents);
  }, [attributions]);

  const trendDaily = useMemo(() => {
    // Simple daily aggregation for a tiny inline chart replacement (bars via divs)
    const map = new Map();
    for (const a of attributions) {
      const day = new Date(a.createdAt).toISOString().slice(0, 10);
      map.set(day, (map.get(day) || 0) + a.commissionCents);
    }
    return Array.from(map.entries())
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14); // last 14 days
  }, [attributions]);

  const filteredProducts = useMemo(
    () => computeDerived(products, query, status, sort),
    [products, query, status, sort]
  );

  const productTotals = useMemo(() => {
    const clicks = products.reduce((s, p) => s + (p.clicks || 0), 0);
    const conv = products.reduce((s, p) => s + (p.conversions || 0), 0);
    const sold = products.reduce((s, p) => s + (p.itemsSold || 0), 0);
    const earn = products.reduce((s, p) => s + (p.earnings || 0), 0);
    return { clicks, conv, sold, earn, cr: clicks ? conv / clicks : 0 };
  }, [products]);

  async function markPaid(attributionIds) {
    try {
      setMarking(true);
      const response = await fetch(`${API_URL}/api/member/attributions/mark-paid`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-member-uid": "current-member-id"
        },
        body: JSON.stringify({ attributionIds }),
      });
      
      if (response.ok) {
        // Refetch data after successful update
        window.location.reload();
      } else {
        console.log('Mark paid API not available');
      }
    } catch (error) {
      console.log('Mark paid API not available');
    } finally {
      setMarking(false);
    }
  }

  // Pure — must stay side-effect free. It's called directly in JSX to
  // compute an href, which means React runs it on every render of the
  // affiliate list; a clipboard write used to live here and fired on every
  // one of those renders, not just when someone actually clicked the link.
  function paypalHrefFor(affiliate, amountCents) {
    const amount = (amountCents / 100).toFixed(2);
    if (affiliate.paypalMe) {
      // Clean username (just in case a full url was stored)
      const username = affiliate.paypalMe.replace(/^https?:\/\/(www\.)?paypal\.me\//i, "");
      return `https://www.paypal.com/paypalme/${encodeURIComponent(username)}/${encodeURIComponent(amount)}`;
    }
    if (affiliate.paypalEmail) {
      // No stable public URL param for email on PayPal's generic send page,
      // so the email gets copied to the clipboard for convenience instead —
      // but only from the onClick below, on a real click.
      return `https://www.paypal.com/myaccount/transfer/homepage/send`;
    }
    return `https://www.paypal.com/paypalme/`;
  }

  function exportCsv() {
    const headers = [
      "id","orderId","affiliateId","affiliateName","commissionGBP","ratePct","status","createdAt"
    ];
    const rows = attributions.map(a => ([
      a.id,
      a.orderId,
      a.affiliateId,
      a.affiliateName || "",
      (a.commissionCents/100).toFixed(2),
      a.ratePct?.toFixed?.(2) ?? "",
      a.status,
      a.createdAt
    ]));
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `member_commissions_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportProductsCsv() {
    const headers = [
      "id", "title", "sku", "price", "commissionRate", "status", 
      "clicks", "conversions", "itemsSold", "earnings"
    ];
    const rows = filteredProducts.map((p) => [
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
    const csv = [headers, ...rows]
      .map((r) => r.map(escapeCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `member_products_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent"></div>
          <p className="text-zinc-500">Loading member dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* ===== Email Verification Notice ===== */}
      <EmailVerificationNotice />
      
      {/* ===== KPI row ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard icon={DollarSign} title="Total Sales" value={money((stats?.totalSalesCents || 0))} gradient />
        <KpiCard icon={Clock} title="Owed (Pending)" value={money((stats?.pendingCents || 0))} />
        <KpiCard icon={CheckCircle2} title="Approved/Paid" value={money((stats?.approvedCents || 0))} />
        <KpiCard icon={XCircle} title="Voided" value={money((stats?.voidCents || 0))} />
        <KpiCard icon={TrendingUp} title="Avg Commission" value={`${((stats?.avgRatePct || 0)).toFixed(1)}%`} />
      </div>

      {/* ===== Members Dashboard ===== */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 p-4 text-white rounded-t-2xl">
          <h3 className="text-lg font-semibold">Members Dashboard</h3>
          <p className="text-sm text-white/90 mt-1">Your tools for managing products, affiliates, and marketing</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-4">
            <ShopBuilderButton 
              icon={Package} 
              title="My Products" 
              description="Manage your product catalog"
              onClick={() => setActiveTab('products')}
              gradient
            />
            <ShopBuilderButton 
              icon={Plus} 
              title="Add Product" 
              description="Create new products"
              onClick={() => {
                // Open the Add Product modal/page
                const event = new CustomEvent('openCreateProductModal');
                window.dispatchEvent(event);
              }}
            />
            <ShopBuilderButton
              icon={MousePointerClick}
              title="Click Dashboard" 
              description="Track affiliate clicks & conversions"
              onClick={() => {
                // Navigate to click tracking dashboard
                console.log('Click Dashboard button clicked - navigating to affiliate-clicks');
                window.location.href = '/#affiliate-clicks';
              }}
            />
            <ShopBuilderButton 
              icon={Workflow} 
              title="Store Builder" 
              description="Build your modern drag-and-drop store"
              onClick={() => {
                // Navigate to new store builder page
                window.location.href = '/#store-builder';
              }}
              gradient
            />
            <ShopBuilderButton 
              icon={Mail} 
              title="Mail Campaign" 
              description="Email marketing tools"
              onClick={() => {
                // Navigate to mail campaign builder
                window.location.href = '/#mail-campaign';
              }}
            />
            <ShopBuilderButton 
              icon={Mail} 
              title="Email Automation" 
              description="Automated email campaigns"
              onClick={() => {
                // Navigate to email automation dashboard
                window.location.href = '/#email-automation';
              }}
              gradient
            />
            <ShopBuilderButton 
              icon={Video} 
              title="Review Shorts" 
              description="Video review content"
              onClick={() => {
                // Navigate to short review page
                window.location.href = '/#tools/short-review';
              }}
            />
            <ShopBuilderButton 
              icon={BarChart3} 
              title="Master Dashboard" 
              description="Analytics overview"
              onClick={() => {
                // Open master dashboard in new window/tab or modal
                window.open('#affiliate-dashboard', '_blank');
              }}
            />
            <ShopBuilderButton 
              icon={Workflow} 
              title="Funnel Builder" 
              description="Sales funnel tools"
              onClick={() => {
                // Navigate to funnel builder
                window.location.href = '/#funnel-builder';
              }}
            />
            <ShopBuilderButton 
              icon={Database} 
              title="Modless Subs" 
              description="Find subreddits to take over"
              onClick={() => {
                // Navigate to DeadRed Search
                window.location.href = '/#deadred-search';
              }}
            />
          </div>
        </div>
      </div>

      {/* ===== Tab Navigation ===== */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => {
            setActiveTab('overview');
            setShowLinkDashboard(false);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-t-xl border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-fuchsia-500 text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/20'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Commission Overview
        </button>
        <button
          onClick={() => {
            setActiveTab('products');
            setShowLinkDashboard(false);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-t-xl border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-fuchsia-500 text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/20'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          My Products
        </button>
        <button
          onClick={() => {
            setActiveTab('links');
            setShowLinkDashboard(true);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-t-xl border-b-2 transition-colors ${
            activeTab === 'links'
              ? 'border-fuchsia-500 text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/20'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Affiliate Links
        </button>
        <button
          onClick={() => {
            setActiveTab('orders');
            setShowLinkDashboard(false);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'orders' 
              ? 'border-fuchsia-500 text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/20' 
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Order Center
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* ===== Tiny daily bars (last 14d) ===== */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold mb-2">Commissions (last 14 days)</h3>
            <div className="flex items-end gap-2 h-28">
              {trendDaily.length === 0 && <div className="text-zinc-500 text-sm">No commission events yet.</div>}
              {trendDaily.map(pt => {
                const max = Math.max(...trendDaily.map(p => p.total)) || 1;
                const h = Math.max(6, Math.round((pt.total / max) * 100));
                return (
                  <div key={pt.day} className="flex flex-col items-center">
                    <div className="w-4 rounded bg-gradient-to-b from-fuchsia-500 to-pink-500" style={{ height: `${h}%` }} />
                    <div className="mt-1 text-[10px] text-zinc-500">{pt.day.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== Owed by affiliate ===== */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">What You Owe (by Affiliate)</h3>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {byAffiliate.length === 0 && (
                <div className="p-6 text-sm text-zinc-500">No affiliates or commissions yet.</div>
              )}

              {byAffiliate.map(aff => (
                <div key={aff.affiliateId} className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium">{aff.affiliateName}</div>
                    <div className="text-xs text-zinc-500">
                      Pending {money(aff.pendingCents)} · Approved {money(aff.approvedCents)} · Voided {money(aff.voidCents)} · Orders {aff.ordersCount}
                    </div>
                    {aff.paypalEmail && (
                      <div className="text-[11px] text-zinc-500 mt-0.5">PayPal Email: {aff.paypalEmail}</div>
                    )}
                    {aff.paypalMe && (
                      <div className="text-[11px] text-zinc-500">PayPal.Me: {aff.paypalMe}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={paypalHrefFor(aff, aff.pendingCents)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        if (!aff.paypalMe && aff.paypalEmail) {
                          navigator.clipboard?.writeText(aff.paypalEmail).catch(() => {});
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                      title="Opens PayPal in a new tab (you complete the payment there)"
                    >
                      Pay via PayPal <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    <button
                      disabled={marking || aff.attributionIdsPending.length === 0}
                      onClick={() => markPaid(aff.attributionIdsPending)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Paid
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ===== Ledger ===== */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
              <h3 className="text-sm font-semibold">Commission Ledger</h3>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>

            <div className="grid grid-cols-[1fr_.8fr_.6fr_.6fr_.5fr_.7fr] gap-2 border-b border-zinc-200 px-3 py-2 text-[11px] font-semibold text-zinc-500 dark:border-zinc-800">
              <div>Order</div>
              <div>Affiliate</div>
              <div>Rate</div>
              <div>Commission</div>
              <div>Status</div>
              <div className="text-right">Date</div>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              {attributions.slice(0, 30).map(a => (
                <div key={a.id} className="grid grid-cols-[1fr_.8fr_.6fr_.6fr_.5fr_.7fr] items-center gap-2 px-3 py-2">
                  <div className="truncate">{a.orderId}</div>
                  <div className="truncate text-zinc-600">{a.affiliateName || a.affiliateId}</div>
                  <div>{(a.ratePct || 0).toFixed(1)}%</div>
                  <div>{money(a.commissionCents)}</div>
                  <StatusBadge status={a.status} />
                  <div className="text-right text-xs text-zinc-500">{new Date(a.createdAt).toLocaleString()}</div>
                </div>
              ))}
              {attributions.length === 0 && (
                <div className="p-6 text-sm text-zinc-500">No commission records yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="space-y-8">
          {/* ===== Product KPIs ===== */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard icon={DollarSign} title="Total Earnings" value={money(productTotals.earn * 100)} gradient />
            <KpiCard icon={Package} title="Items Sold" value={fmt(productTotals.sold)} />
            <KpiCard icon={MousePointerClick} title="Clicks" value={fmt(productTotals.clicks)} />
            <KpiCard icon={TrendingUp} title="Conversion Rate" value={`${(productTotals.cr * 100).toFixed(1)}%`} />
          </div>

          {/* ===== Product Controls ===== */}
          <div className="flex flex-wrap items-center gap-2">
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
              <button
                onClick={exportProductsCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>
          </div>

          {/* ===== Products Table ===== */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-sm dark:border-zinc-800">
            <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 p-3 text-xs font-semibold uppercase tracking-wide text-white">Your Products</div>
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
              {productsLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent"></div>
                  <p className="text-sm text-zinc-600">Loading your products...</p>
                </div>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  const convRate = (p.clicks || 0) ? ((p.conversions || 0) / p.clicks) * 100 : 0;
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
                      <div>{money((p.price || 0) * 100)}</div>
                      <div>{fmt(p.clicks || 0)}</div>
                      <div>{fmt(p.conversions || 0)}</div>
                      <div>{fmt(p.itemsSold || 0)}</div>
                      <div>{convRate.toFixed(1)}%</div>
                      <div className="text-right font-semibold">{money((p.earnings || 0) * 100)}</div>
                    </div>
                  );
                })
              ) : products.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
                  <h4 className="mb-2 font-medium text-zinc-900">No products yet</h4>
                  <p className="text-sm text-zinc-500 mb-4">
                    Start by adding products to your store, then they'll appear here for tracking.
                  </p>
                  <button
                    onClick={loadProducts}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                  >
                    <RefreshCcw className="h-4 w-4" /> Check for products
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-zinc-500">No products match your current filters.</div>
              )}
            </div>
          </div>

          {/* ===== Products Footer ===== */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">Showing {filteredProducts.length} of {products.length} products</p>
            <div className="flex items-center gap-2">
              <button
                onClick={loadProducts}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <RefreshCcw className="h-4 w-4" /> Refresh data
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'links' && (
        <div className="space-y-8">
          {showLinkCreator ? (
            <LinkCreator
              userType="member"
              onLinkCreated={() => {
                setShowLinkCreator(false);
                // Refresh link dashboard data if needed
              }}
              onClose={() => setShowLinkCreator(false)}
            />
          ) : (
            <LinkDashboard
              userType="member"
              onCreateLink={() => setShowLinkCreator(true)}
              className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6"
            />
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-8">
          <OrderCenter />
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, gradient }) {
  return (
    <div className={[
      "rounded-2xl border p-4 shadow-sm",
      gradient ? "bg-gradient-to-r from-pink-50 to-violet-50" : "bg-white dark:bg-zinc-900",
      "border-zinc-200 dark:border-zinc-800"
    ].join(" ")}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white shadow">
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

function ShopBuilderButton({ icon: Icon, title, description, onClick, gradient = false }) {
  return (
    <button
      onClick={onClick}
      className={[
        "p-4 rounded-xl border text-left transition-all hover:shadow-md",
        gradient
          ? "bg-gradient-to-r from-pink-50 to-violet-50 border-pink-200 hover:from-pink-100 hover:to-violet-100 dark:from-pink-950/20 dark:to-violet-950/20 dark:border-pink-900/40"
          : "bg-white border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow">
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-center">
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-zinc-500 mt-1">{description}</div>
        </div>
      </div>
    </button>
  );
}

function StatusBadge({ status }) {
  const cls =
    status === "approved" || status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "void"
      ? "bg-red-100 text-red-700"
      : status === "paused"
      ? "bg-yellow-100 text-yellow-700"
      : status === "out_of_stock"
      ? "bg-zinc-100 text-zinc-700"
      : "bg-yellow-100 text-yellow-700";
  const label = 
    status === "approved" ? "Approved" 
    : status === "active" ? "Active"
    : status === "void" ? "Voided" 
    : status === "paused" ? "Paused"
    : status === "out_of_stock" ? "Out of Stock"
    : "Pending";
  return <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}