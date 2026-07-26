import React, { useEffect, useState } from "react";
import { Download, ArrowLeft } from "lucide-react";
import { API_URL } from '../../config/environment';

function toCsv(contacts) {
  const header = ['email', 'source', 'joined'];
  const rows = contacts.map((c) => [
    c.email,
    c.source || '',
    new Date(c.created_at).toISOString(),
  ]);
  return [header, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function AffiliateMailingList({ currentUserId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/api/contacts/mine`, {
          headers: { 'x-member-uid': currentUserId || '' },
        });
        if (!mounted) return;
        if (!res.ok) {
          setError('Failed to load your mailing list.');
          return;
        }
        const data = await res.json();
        setContacts(data.contacts || []);
      } catch (e) {
        if (mounted) setError('Failed to load your mailing list.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [currentUserId]);

  function exportCsv() {
    const csv = toCsv(contacts);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailing-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <button
        onClick={() => { window.location.hash = 'affiliates'; }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your Mailing List</h1>
          <p className="text-sm text-gray-600">
            Everyone who's signed up through one of your funnels.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={contacts.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3 text-sm font-medium text-gray-700">
          {loading ? 'Loading…' : `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`}
        </div>

        {error && <div className="px-5 py-6 text-sm text-red-600">{error}</div>}

        {!loading && !error && contacts.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-gray-500">
            No signups yet — once someone joins your mailing list from one of
            your funnels, they'll show up here.
          </div>
        )}

        {!loading && contacts.length > 0 && (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/60">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{c.email}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{c.source || '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        This list only shows contacts attributed to your account — it's
        yours alone, not shared with other affiliates.
      </p>
    </div>
  );
}
