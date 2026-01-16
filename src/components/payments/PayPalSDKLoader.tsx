import { useEffect } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

type Props = {
  clientId: string;
  currency?: string;
  components?: string;
  intent?: "capture" | "authorize";
  onLoad?: () => void;
};

export default function PayPalSDKLoader({
  clientId,
  currency = "GBP",
  components = "buttons",
  intent = "capture",
  onLoad,
}: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // If PayPal already present, call onLoad and do nothing
    if (window.paypal) {
      onLoad?.();
      return;
    }

    // If a script with id already exists, assume it's the SDK and wait a tick
    const existing = document.getElementById("paypal-sdk");
    if (existing) {
      // Poll until window.paypal becomes available, then call onLoad
      if (window.paypal) {
        onLoad?.();
        return;
      }
      const waitFor = () => {
        if (window.paypal) return onLoad?.();
        setTimeout(waitFor, 50);
      };
      waitFor();
      return;
    }

    // Normalize components: some older code used `hosted-buttons` which is not
    // a valid top-level components value to pass directly. Map it to `buttons`.
    let normalizedComponents = (components || '').toString();
    if (normalizedComponents.includes('hosted-buttons')) {
      normalizedComponents = normalizedComponents.replace(/hosted-buttons/g, 'buttons');
    }

    // Allow disableFunding to be passed via components string as a convenience
    // (e.g. "buttons&disable-funding=venmo") or supply via dataset in future.
    // We'll keep components focused and append disable-funding separately if needed.
    const script = document.createElement("script");
    script.id = "paypal-sdk";

    const cacheBuster = Date.now();
    const params = new URLSearchParams();
    params.set('client-id', clientId);
    params.set('currency', currency);
    params.set('components', normalizedComponents || 'buttons');
    params.set('intent', intent);
    // small cache-buster to avoid stale CDN copies during development/testing
    params.set('cb', String(cacheBuster));

    const src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.src = src;
    script.async = true;
    script.onload = () => {
      // PayPal SDK should set window.paypal; call onLoad
      try {
        // mark dataset for other loaders to see
        try { script.dataset.paypalLoaded = '1'; } catch (e) {}
        onLoad?.();
      } catch (e) {
        // ignore
      }
    };
    script.onerror = (e) => {
      // eslint-disable-next-line no-console
      console.error("PayPal SDK failed to load", e, 'src=', script.src);
    };
    // append the script
    document.head.appendChild(script);

    // cleanup: nothing to remove because we intentionally inject once
  // mount only
  }, [clientId, currency, components, intent, onLoad]);

  return null;
}
