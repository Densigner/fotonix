import { useEffect } from 'react';
import { API_URL } from '../config/environment';

// Lightweight hook: when ?ref= is present on the URL, remember it in
// localStorage (first-party, no network call — can't be blocked) and also
// POST to the API's /api/clicks/create so non-converting visits still show
// up in the affiliate's click stats. The localStorage copy is the source of
// truth PayPalButton.js reads from at checkout time, so even if this beacon
// gets dropped (ad blockers, ITP, flaky network) the ref is still sent
// explicitly with the order and create-order.js can backfill the click then.
export default function useAffiliateRef() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (!ref) return;

      try { localStorage.setItem('fotonix_aff_ref', ref); } catch (e) {}

      // guard: only beacon once per session for this ref. Set this *before*
      // the fetch (not in the .then) so a second effect run — e.g. React
      // StrictMode's dev-mode double-invoke — can't race past the check.
      const key = `aff_tracked_${ref}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');

      fetch(`${API_URL}/api/clicks/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: ref }),
        credentials: 'include',
      }).catch(() => {
        // silently ignore network errors; localStorage fallback covers checkout
      });
    } catch (e) {
      // ignore in non-browser envs
    }
  }, []);
}
