import React from 'react';

export default function AffiliateClickCard({ src, alt = 'Clicks & Conversions', className = '', targetHash = 'affiliate-clicks' }) {
  const handleClick = (e) => {
    e.preventDefault();
    try { window.location.hash = targetHash; } catch (err) { /* ignore */ }
  };

  return (
    <a href={`#${targetHash}`} onClick={handleClick} className={`inline-block cursor-pointer ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="rounded-lg shadow-md w-full h-auto" />
      ) : (
        <div className="rounded-lg shadow-md bg-gray-100 dark:bg-gray-800 w-full h-48 flex items-center justify-center text-gray-500">{alt}</div>
      )}
    </a>
  );
}
