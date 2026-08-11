import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader, AlertCircle } from 'lucide-react';
import { API_URL } from '../../../config/environment';
import { BLOCKS } from './FunnelBuilder';
import { DEFAULT_THEME, deriveThemeVars, useGoogleFont } from '../../store-builder/theme';

/**
 * FunnelViewer - Public facing funnel page
 *
 * Routes: /funnel/:companySlug/:funnelSlug
 *
 * Fetches the real, published funnel from the backend and renders its
 * actual saved blocks using the same BLOCKS registry the editor uses —
 * this used to fabricate placeholder content from the URL params alone;
 * see src/Bible/funnel-builder/gotchas.md for that history.
 */
export default function FunnelViewer() {
  const { companySlug, funnelSlug } = useParams();
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_URL}/api/funnels/public/${companySlug}/${funnelSlug}`);
        if (!mounted) return;
        if (!res.ok) {
          setError('Funnel not found');
          return;
        }
        const data = await res.json();
        setFunnel(data.funnel);
      } catch (err) {
        if (mounted) setError('Failed to load funnel');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [companySlug, funnelSlug]);

  // Called unconditionally (rules of hooks) -- `theme` is just
  // DEFAULT_THEME while `funnel` hasn't loaded yet, which is harmless.
  const theme = { ...DEFAULT_THEME, ...(funnel?.metadata?.theme || {}) };
  useGoogleFont(theme.fonts);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading funnel...</p>
        </div>
      </div>
    );
  }

  if (error || !funnel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md mx-4">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Funnel Not Found</h2>
          <p className="text-slate-600 mb-4">
            The funnel at <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{companySlug}/{funnelSlug}</span> doesn't exist or hasn't been published.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  const blocks = Array.isArray(funnel.blocks) ? funnel.blocks : [];
  const themeVars = deriveThemeVars(theme);

  return (
    <div className="min-h-screen" style={{ ...themeVars, background: "var(--surface)", color: "var(--text)" }}>
      {/* max-w-6xl to match the editor's own full-width canvas -- max-w-4xl
          left huge empty gutters on any normal desktop screen, since every
          block here is styled as a wide card (rounded-2xl, border), not a
          narrow-column-of-text like a blog post. */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
        {blocks.length === 0 ? (
          <p className="text-center text-slate-500 py-16">This funnel doesn't have any content yet.</p>
        ) : (
          blocks.map((block) => {
            const def = BLOCKS[block.type];
            if (!def) return null;
            return (
              <div key={block.id}>
                {def.render({ data: block.data, editable: false, funnelOwnerUid: funnel.user_id })}
              </div>
            );
          })
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          <p>Powered by <a href="https://fotonix.co.uk" className="text-indigo-600 hover:underline">Fotonix</a></p>
        </div>
      </footer>
    </div>
  );
}
