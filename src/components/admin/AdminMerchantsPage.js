import React, { useState } from 'react';

export default function AdminMerchantsPage() {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [merchants, setMerchants] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/merchants', { headers: { 'x-admin-secret': secret } });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || resp.statusText);
      }
      const j = await resp.json();
      setMerchants(j);
    } catch (e) {
      setError(String(e));
      setMerchants(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold">Merchants (admin)</h3>
      <p className="text-sm text-zinc-500">Enter admin secret to list connected merchants.</p>
      <div className="mt-3 flex items-center gap-2">
        <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Admin secret" className="rounded-xl border px-3 py-2" />
        <button onClick={load} disabled={loading} className="rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 px-3 py-2 text-white">{loading ? 'Loading…' : 'Load merchants'}</button>
      </div>
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {merchants && (
        <div className="mt-4">
          <pre className="rounded-xl border p-3 text-sm bg-white overflow-auto max-h-96">{JSON.stringify(merchants, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
