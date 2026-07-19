import { useEffect } from 'react';

// Lightweight hook: when ?ref= is present on the URL, POST to /api/clicks/create
// once per session. This creates the click record + sets the signed aff_click
// cookie that server/routes/payments/create-order.js reads to attach custom_id
// on the PayPal order, which is how the webhook (server/routes/webhooks/webhook.js)
// later attributes a completed sale back to this affiliate.
export default function useAffiliateRef() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (!ref) return;

      // guard: only once per session for this ref. Set this *before* the fetch
      // (not in the .then) so a second effect run — e.g. React StrictMode's
      // dev-mode double-invoke — can't race past the check and double-fire.
      const key = `aff_tracked_${ref}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');

      fetch('/api/clicks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: ref }),
        credentials: 'include',
      }).catch(() => {
        // silently ignore network errors; don't retry within this session
      });
    } catch (e) {
      // ignore in non-browser envs
    }
  }, []);
}
