import React from 'react';

export default function PayPalConnectButton({ returnTo = '/' , children }) {
  const onClick = (e) => {
    e.preventDefault();
    const url = `/api/merchants/connect?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = url;
  };

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-zinc-50"
    >
      {children || 'Connect with PayPal'}
    </button>
  );
}
