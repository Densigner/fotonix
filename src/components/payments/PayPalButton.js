import React, { useEffect, useRef, useState } from 'react';
import { API_URL } from '../../config/environment';

function PayPalButton({ amount = '0.00', productName = '', productId = null, ownerId = null, onSuccess, onError, onCancel }) {
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  // Poll for PayPal SDK availability (non-blocking)
  useEffect(() => {
    let mounted = true;
    const intervalMs = 200;
    const maxMs = 15000;
    const start = Date.now();

    const check = () => {
      if (!mounted) return;
      if (window.paypal && typeof window.paypal.Buttons === 'function') {
        setIsSDKReady(true);
        return;
      }
      if (Date.now() - start > maxMs) {
        setTimedOut(true);
        setError(new Error('PayPal SDK not available after timeout'));
        return;
      }
      setTimeout(check, intervalMs);
    };

    check();
    return () => { mounted = false; };
  }, []);

  // Try reloading/injecting the SDK script with a cache-buster. This should
  // only be invoked by the user (retry) — not automatically on timeout.
  const tryReloadSdk = () => {
    setTimedOut(false);
    setError(null);
    try {
      const existing = Array.from(document.querySelectorAll('script[src*="paypal.com/sdk/js"]'));
      existing.forEach(s => { try { s.remove(); } catch (e) {} });

      const cacheBuster = `cb=${Date.now()}`;
      const script = document.createElement('script');
      // NOTE: Keep client-id / currency in sync with your loader or prefer loader-managed insertion
      script.src = `https://www.paypal.com/sdk/js?client-id=Aab6IHfog5quDJp4kfy5sqiuo4YcTZaQ3SR8VpwUgDoDphLXmrKwqhog_u-cktkgIaSrsXwxH8HNE-Jf&currency=GBP&intent=capture&${cacheBuster}`;
      script.async = true;
      script.onload = () => { try { script.dataset.paypalLoaded = '1'; } catch (e) {} ; setIsSDKReady(true); };
      script.onerror = (e) => {
        setError(new Error('Failed to reload PayPal SDK'));
        // collect diagnostics
        try {
          const scripts = Array.from(document.querySelectorAll('script[src*="paypal.com/sdk/js"]')).map(s => ({ src: s.src, id: s.id, dataset: { ...s.dataset } }));
          setDiagnostics({ windowPaypal: !!window.paypal, scriptCount: scripts.length, scripts });
        } catch (e2) { console.error('diagnostics collection failed', e2); }
        setTimedOut(true);
      };
      document.head.appendChild(script);
    } catch (e) {
      setError(e);
      setTimedOut(true);
    }
  };

  if (!isSDKReady) {
    return (
      <div className="paypal-loading">
        <p>Loading PayPal... If this takes long, ensure the PayPal SDK script is available in the page.</p>
        <div className="loading-spinner" aria-hidden="true" />
        {timedOut && (
          <div className="paypal-retry">
            <p>PayPal failed to initialise. This can happen when the script is blocked by an adblocker or CSP.</p>
            <button onClick={tryReloadSdk} className="btn btn-primary">Retry PayPal SDK</button>
            {error && <div className="error">{String(error.message || error)}</div>}
            {diagnostics && (
              <div style={{ marginTop: 8, fontSize: 12, textAlign: 'left', background: 'rgba(0,0,0,0.05)', padding: 8 }}>
                <div style={{ fontWeight: 600 }}>Debug info (copy & paste):</div>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(diagnostics, null, 2)}</pre>
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(diagnostics, null, 2))} className="btn">Copy debug info</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="paypal-button-container">
      <PayPalButtonRenderer
        amount={amount}
        productName={productName}
        productId={productId}
        ownerId={ownerId}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </div>
  );
}

function PayPalButtonRenderer({ amount, productName, productId, ownerId, onSuccess, onError, onCancel }) {
  const containerRef = useRef(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!window.paypal || typeof window.paypal.Buttons !== 'function') return;
    if (!containerRef.current) {
      console.warn('PayPal Buttons container not present — skipping render');
      return;
    }

    // Safety: if the container already contains a PayPal render (e.g. HMR or
    // previous render), skip. We check a dataset marker and any child nodes.
    try {
      const c = containerRef.current;
      if (c.dataset && (c.dataset.fotonixPaypal === '1' || c.children.length > 0)) {
        console.warn('PayPal container already populated — skipping render');
        return;
      }
    } catch (e) { /* ignore DOM check errors */ }

    // Use per-container tracking so multiple independent PayPalButton
    // components can render on the same page. Keep a global "in-progress"
    // flag to avoid races when two mounts occur simultaneously (React 18
    // StrictMode double-mount or HMR). This reduces spurious "already
    // rendered" warnings while still preventing concurrent renders.
    const G = window;
    G.__FOTONIX_PAYPAL_RENDERED_CONTAINERS = G.__FOTONIX_PAYPAL_RENDERED_CONTAINERS || new Set();
    G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS = G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS || 0;

    // Ensure this container has a stable id so we can track it in the Set
    let containerId = null;
    try {
      if (containerRef.current && containerRef.current.dataset) {
        containerId = containerRef.current.dataset.fotonixPaypalId;
        if (!containerId) {
          containerId = `fotonix-paypal-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
          containerRef.current.dataset.fotonixPaypalId = containerId;
        }
      }
    } catch (e) { /* ignore dataset errors */ }

    // If this exact container was already rendered, skip; otherwise allow
    // other containers to render concurrently (subject to the in-progress guard).
    if (containerId && G.__FOTONIX_PAYPAL_RENDERED_CONTAINERS.has(containerId)) {
      console.warn('PayPal container already populated — skipping render (container tracked)');
      return;
    }
    if (G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS) {
      console.warn('PayPal render in progress on this page — skipping until in-progress completes');
      return;
    }

    let isMounted = true;
    // mark render in-progress immediately to avoid race with another mount
    G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS = 1;

    try {
      const Buttons = window.paypal.Buttons({
        style: { layout: 'vertical' },
        createOrder: (data, actions) => {
          // Create order on server so aff_click custom_id is attached server-side.
          // Also send the ref explicitly from localStorage — this is a fallback
          // in case the earlier click-tracking beacon (fired on page load) was
          // blocked or never landed; the server backfills a click record from
          // this if no aff_click cookie is present.
          let ref = null;
          try { ref = localStorage.getItem('fotonix_aff_ref'); } catch (e) {}
          return fetch(`${API_URL}/api/paypal/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ items: [{ name: productName || 'Product', unitAmount: amount, quantity: 1 }], currency: 'GBP', ref })
          }).then(r => r.json()).then(j => j.id);
        },
        onApprove: async (data, actions) => {
          try {
            // Use server-side capture so we can send owner notification emails
            const response = await fetch(`${API_URL}/api/paypal/capture-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                orderId: data.orderID,
                productId: productId || null,
                ownerId: ownerId || null,
                productName: productName || null
              })
            });
            
            if (!response.ok) {
              throw new Error('Failed to capture order');
            }
            
            const details = await response.json();
            if (!isMounted) return;
            if (onSuccess) onSuccess(details);
          } catch (err) {
            if (onError) onError(err);
            console.error('capture error', err);
          }
        },
        onError: (err) => {
          if (onError) onError(err);
          console.error('PayPal Buttons error', err);
        },
        onCancel: (data) => {
          if (onCancel) onCancel(data);
        }
      });

      if (Buttons) {
        // mark container as in-use so other mounts skip
        try { containerRef.current.dataset.fotonixPaypal = '1'; } catch (e) {}
        Buttons.render(containerRef.current)
          .then(() => {
            renderedRef.current = true;
            try { if (containerId) G.__FOTONIX_PAYPAL_RENDERED_CONTAINERS.add(containerId); } catch (e) {}
            G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS = 0;
          })
          .catch(e => {
            console.error('Buttons.render failed', e);
            G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS = 0;
            try { containerRef.current.dataset.fotonixPaypal = '0'; } catch (er) {}
            if (onError) onError(e);
          });
      } else {
        G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS = 0;
      }
    } catch (e) {
      console.error('Error rendering PayPal Buttons', e);
      if (onError) onError(e);
    }

    return () => {
      isMounted = false;
      try {
        if (renderedRef.current) {
          try { if (containerId) G.__FOTONIX_PAYPAL_RENDERED_CONTAINERS.delete(containerId); } catch(e){}
        }
        // clear any lingering in-progress flag
        if (G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS) G.__FOTONIX_PAYPAL_RENDER_IN_PROGRESS = 0;
        // clear container marker so future renders can run
        try { if (containerRef.current && containerRef.current.dataset) containerRef.current.dataset.fotonixPaypal = '0'; } catch (er) {}
      } catch (err) {
        /* ignore */
      }
    };
  }, [amount, productName, productId, ownerId, onSuccess, onError, onCancel]);

  return <div ref={containerRef} />;
}

export default PayPalButton;
