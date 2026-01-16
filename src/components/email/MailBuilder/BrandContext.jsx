import React, { createContext, useContext, useEffect, useState } from 'react';

const BrandContext = createContext(null);

export function BrandProvider({ tid = 'default', children }) {
  const [brand, setBrand] = useState({
    primaryColor: '#0ea5a4',
    accentColor: '#06b6d4',
    secondaryColor: '#64748b',
    defaultFontFamily: 'Arial, system-ui, -apple-system',
    baseFontSize: 16,
    bodyBackground: '#ffffff'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/tenants/${tid}/settings/branding`);
        if (!res.ok) {
          // if not found, keep defaults
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (mounted && data) {
          setBrand(Object.assign({}, brand, data));
        }
      } catch (err) {
        if (mounted) setError(err.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  // update local brand state immediately (instant apply)
  function updateLocal(patch) {
    setBrand((prev) => Object.assign({}, prev, patch));
  }

  // persist to server
  async function saveBrand(patch = {}, options = { syncToTemplates: false }) {
    const next = Object.assign({}, brand, patch);
    // optimistic local update
    setBrand(next);
    try {
      const body = Object.assign({}, next, { syncToTemplates: !!options.syncToTemplates });
      const res = await fetch(`/api/tenants/${tid}/settings/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Failed to save branding: ${res.status}`);
      }
      const data = await res.json().catch(() => null);
      if (data) setBrand(Object.assign({}, next, data));
      return { ok: true };
    } catch (err) {
      setError(err.message || String(err));
      return { ok: false, error: err };
    }
  }

  return (
    <BrandContext.Provider value={{ brand, loading, error, updateLocal, saveBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}

export default BrandContext;
