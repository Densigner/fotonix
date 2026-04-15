import { useEffect } from 'react';

// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID;
const PAYPAL_CURRENCY = 'GBP';

function PayPalSDKLoader({ onLoad }) {
  useEffect(() => {
    // Check if PayPal SDK is already loaded
    if (window.paypal && window.paypal.Buttons) {
      console.log('PayPal SDK already loaded');
      if (onLoad) onLoad();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existingScript) {
      console.log('PayPal SDK script already exists, waiting for load...');
      // If paypal is already available, call onLoad immediately
      if (window.paypal && window.paypal.Buttons) {
        console.log('PayPal SDK already present on window');
        if (onLoad) onLoad();
        return;
      }
      // If script element has previously loaded (dataset marker), call onLoad
      if (existingScript.dataset && existingScript.dataset.paypalLoaded === '1') {
        console.log('PayPal SDK script tag marked loaded');
        if (onLoad) onLoad();
        return;
      }
      // Otherwise attach listeners to resolve when it finishes or fails
      let replaceTimer = null;
      const onExistingLoad = () => {
        try { existingScript.dataset.paypalLoaded = '1'; } catch(e){}
        console.log('PayPal SDK loaded from existing script');
        try { if (replaceTimer) clearTimeout(replaceTimer); } catch(e){}
        if (onLoad) onLoad();
      };
      const onExistingError = (err) => {
        console.error('Existing PayPal SDK script failed to load', err);
        try { if (replaceTimer) clearTimeout(replaceTimer); } catch(e){}
      };
      existingScript.addEventListener('load', onExistingLoad, { once: true });
      existingScript.addEventListener('error', onExistingError, { once: true });

      // If the script tag exists but hasn't produced a global `paypal` within a
      // reasonable window, attempt to reinsert a fresh cache-busted script to
      // recover from stale tags, CDN caching issues, or blocked loads (adblock/CSP).
      // Make this less aggressive (longer delay) and remove the old tag before
      // inserting the replacement to avoid two active SDK instances.
      replaceTimer = setTimeout(() => {
        try {
          if (window.paypal && window.paypal.Buttons) return; // already ready
          if (existingScript.dataset && existingScript.dataset.paypalLoaded === '1') return;
          if (existingScript.dataset && existingScript.dataset.paypalRetry === '1') return; // already tried
          console.warn('Existing PayPal SDK tag present but paypal not on window after wait — inserting replacement script');
          existingScript.dataset.paypalRetry = '1';
          // remove the existing script tag first to avoid having two SDK scripts
          try {
            if (existingScript.parentNode) existingScript.parentNode.removeChild(existingScript);
          } catch (e) { /* ignore removal errors */ }
          const newScript = document.createElement('script');
          // preserve any query portion, add cache-buster
          const src = existingScript.src || `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=${PAYPAL_CURRENCY}&intent=capture`;
          newScript.src = src + (src.includes('?') ? '&' : '?') + 'cb=' + Date.now();
          newScript.async = true;
          newScript.id = existingScript.id ? existingScript.id + '-repl' : 'paypal-sdk-repl';
          newScript.onload = () => { try { newScript.dataset.paypalLoaded = '1'; } catch(e){}; console.log('Replacement PayPal SDK loaded'); if (onLoad) onLoad(); };
          newScript.onerror = (e) => { console.error('Replacement PayPal SDK failed to load', e); };
          document.head.appendChild(newScript);
        } catch (e) { console.error('Error during PayPal SDK replacement attempt', e); }
      }, 12000);
      // No return here — we attached listeners and scheduled replacement if needed
      return;
    }

    console.log('Loading PayPal SDK...');

    // Create script element to load PayPal SDK
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=${PAYPAL_CURRENCY}&intent=capture`;
    script.async = true;
    script.id = 'paypal-sdk';
    
    script.onload = () => {
      try { script.dataset.paypalLoaded = '1'; } catch(e){}
      console.log('PayPal SDK loaded successfully');
      if (onLoad) onLoad();
    };
    
    script.onerror = (error) => {
      console.error('Failed to load PayPal SDK:', error);
    };

    // Add script to document head
    document.head.appendChild(script);

    // Cleanup function: do NOT remove the PayPal SDK script or the global
    // `window.paypal` here. Removing the global or repeatedly removing and
    // re-inserting the SDK can cause PayPal internals to attempt to register
    // the same message listeners multiple times which leads to bootstrap
    // errors like "Request listener already exists". Let the script persist.
    return () => { try { /* noop cleanup to avoid removing paypal globals */ } catch(e){} };
  }, [onLoad]);

  return null; // This component doesn't render anything
}

export default PayPalSDKLoader;
