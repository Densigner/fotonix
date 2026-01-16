import { useEffect } from 'react';

// Lightweight hook: when ?ref= is present on the URL, POST to /api/trackClick once per session
export default function useAffiliateRef() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (!ref) return;

      // guard: only once per session for this ref
      const key = `aff_tracked_${ref}`;
      if (sessionStorage.getItem(key)) return;

      const payload = { ref };
      // optional productId or linkCustomRatePct could be present on the page and attached by callers
      // callers can also call the track endpoint directly if they need to pass productId

      fetch('/api/trackClick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      }).then((res) => {
        if (res.ok) sessionStorage.setItem(key, '1');
      }).catch(() => {
        // silently ignore network errors
      });
    } catch (e) {
      // ignore in non-browser envs
    }
  }, []);
}
