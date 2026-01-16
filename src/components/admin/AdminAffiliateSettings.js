import React, { useEffect, useState } from 'react';

export default function AdminAffiliateSettings() {
  const [pct, setPct] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/affiliates/settings')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j && typeof j.programDefaultCommissionPct === 'number') {
          setPct(String(j.programDefaultCommissionPct));
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const body = { programDefaultCommissionPct: Number(pct) };
      const r = await fetch('/api/affiliates/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('save failed');
      setMsg('Saved');
    } catch (err) {
      setMsg('Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md rounded-2xl border p-6 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
      <h3 className="text-lg font-semibold">Affiliate Settings</h3>
      <p className="mt-1 text-sm text-zinc-500">Global program defaults for affiliate commissions.</p>

      <form onSubmit={save} className="mt-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">Program Default Commission (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          className="mt-2 w-40 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
        />
        <div className="mt-4 flex items-center gap-2">
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Save
          </button>
          {msg && <span className="text-sm text-zinc-500">{msg}</span>}
        </div>
      </form>
    </div>
  );
}
