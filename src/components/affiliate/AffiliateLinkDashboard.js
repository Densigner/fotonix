import React, { useEffect, useMemo, useState } from 'react';
import Header from './Header';
import { ExternalLink, BarChart2, Copy, Settings, Search, ArrowUpDown } from 'lucide-react';

// Simple mock fallback if API isn't available
function genMockLinks(n = 12) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const created = new Date(now - i * 1000 * 60 * 60 * 24).toISOString();
    out.push({
      id: `link-${i}`,
      slug: `promo-${100 + i}`,
      destination: `https://example.com/product/${100 + i}`,
      clicks: Math.floor(Math.random() * 500),
      unique_visitors: Math.floor(Math.random() * 400),
      created_at: created,
      last_click: i % 3 === 0 ? new Date(now - i * 1000 * 60 * 60).toISOString() : null,
      status: ['active', 'paused'][Math.floor(Math.random() * 2)]
    });
  }
  return out;
}

export default function AffiliateLinkDashboard({ affiliateCode = 'ALEX10', apiBase = '' }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state: sorting, pagination, search
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    (async function fetchLinks() {
      setLoading(true);
      setError(null);
      try {
        const url = `${apiBase || ''}/api/links?user=${encodeURIComponent(affiliateCode)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('No API: ' + res.status);
        const body = await res.json();
        if (!alive) return;
        if (Array.isArray(body)) {
          setLinks(body.map(normalizeLink));
        } else if (body && Array.isArray(body.links)) {
          setLinks(body.links.map(normalizeLink));
        } else {
          // Unexpected but accept it as empty
          setLinks([]);
        }
      } catch (e) {
        // Fall back to mock data locally if API isn't available
        setError(e.message);
        setLinks(genMockLinks(14));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [affiliateCode, apiBase]);

  function normalizeLink(l) {
    return {
      id: l.id || l.slug || Math.random().toString(36).slice(2),
      slug: l.slug,
      destination: l.destination || l.url || l.target || '',
      clicks: Number(l.clicks || l.clicks_count || 0),
      unique_visitors: Number(l.unique_visitors || l.unique || 0),
      created_at: l.created_at || l.created || l.createdAt || null,
      last_click: l.last_click || l.lastClick || l.last || null,
      status: l.status || 'active'
    };
  }

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return links.filter(l => {
      if (!q) return true;
      return (l.slug || '').toLowerCase().includes(q) || (l.destination || '').toLowerCase().includes(q);
    });
  }, [links, query]);

  const sorted = useMemo(() => {
    const s = [...filtered];
    s.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // gracefully handle nulls/dates
      if (sortKey === 'created_at' || sortKey === 'last_click') {
        const ad = av ? new Date(av).getTime() : 0;
        const bd = bv ? new Date(bv).getTime() : 0;
        return sortDir === 'asc' ? ad - bd : bd - ad;
      }
      if (typeof av === 'number' || typeof bv === 'number') {
        return sortDir === 'asc' ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
      }
      const as = (av || '').toString().toLowerCase();
      const bs = (bv || '').toString().toLowerCase();
      if (as < bs) return sortDir === 'asc' ? -1 : 1;
      if (as > bs) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return s;
  }, [filtered, sortKey, sortDir]);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  async function copyLink(slug) {
    const url = `${window.location.origin}/l/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      console.error('copy failed', e);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* reuse the site header so it looks identical across pages */}
      <Header />

      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Links</h1>
            <p className="text-sm text-gray-600">Your tracked links. Create links in the Links tool and monitor clicks here.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 gap-2">
                <Search className="w-4 h-4 text-gray-500" />
                <input placeholder="Search slug or destination" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="w-64 text-sm bg-transparent outline-none" />
              </div>
            </div>
            <button onClick={() => { window.location.hash = 'affiliate-links-create'; }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-105">
              <ExternalLink className="w-4 h-4" /> New Link
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full table-fixed">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('slug')}>Slug <ArrowUpDown className="inline-block w-3 h-3 ml-1" /></th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('clicks')}>Clicks <ArrowUpDown className="inline-block w-3 h-3 ml-1" /></th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('unique_visitors')}>Visitors <ArrowUpDown className="inline-block w-3 h-3 ml-1" /></th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('created_at')}>Created <ArrowUpDown className="inline-block w-3 h-3 ml-1" /></th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('last_click')}>Last click <ArrowUpDown className="inline-block w-3 h-3 ml-1" /></th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t text-sm hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{r.slug}</td>
                  <td className="px-4 py-3 break-words text-sm text-gray-700 max-w-[36rem]">{r.destination}</td>
                  <td className="px-4 py-3">{r.clicks}</td>
                  <td className="px-4 py-3">{r.unique_visitors}</td>
                  <td className="px-4 py-3">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">{r.last_click ? new Date(r.last_click).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${r.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button title="Open link" onClick={() => window.open(`/l/${r.slug}`, '_blank')} className="px-2 py-1 rounded-md bg-white border text-xs hover:bg-gray-50">Open</button>
                      <button title="View stats (JSON)" onClick={() => window.open(`${apiBase || ''}/api/links/${r.slug}/stats`, '_blank')} className="px-2 py-1 rounded-md bg-white border text-xs hover:bg-gray-50">Stats</button>
                      <button title="Copy URL" onClick={() => copyLink(r.slug)} className="px-2 py-1 rounded-md bg-white border text-xs hover:bg-gray-50">Copy</button>
                    </div>
                  </td>
                </tr>
              ))}

              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">{loading ? 'Loading links…' : 'No links found.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</div>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border px-2 py-1 text-sm">
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
            <div className="inline-flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-md border text-sm">Prev</button>
              <div className="text-sm">{page} / {pages}</div>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="px-3 py-1 rounded-md border text-sm">Next</button>
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-amber-700">Error loading from API, using local sample data: {error}</div>}
      </div>
    </div>
  );
}
