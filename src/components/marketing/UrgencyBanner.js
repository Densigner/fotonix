import React, { useEffect, useState } from 'react';

function getNextSundayEnd() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const daysUntilSunday = (7 - day) % 7; // 0 if today is Sunday
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday, 23, 59, 59, 999);
  if (target <= now) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

function formatRemaining(ms) {
  if (ms <= 0) return '0d 00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function UrgencyBanner({ href = '#products' }) {
  const [target] = useState(getNextSundayEnd);
  const [remaining, setRemaining] = useState(target - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(target - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="w-full bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">⚡ 20% OFF this week — Ends Sunday</div>
          <div className="text-xs text-white/90 font-medium px-2 py-0.5 bg-white/10 rounded-md" aria-live="polite">{formatRemaining(remaining)}</div>
        </div>
        <div>
          <a href={href} onClick={(e) => { /* allow in-page nav */ }} className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md text-sm font-semibold">
            Shop Sale
          </a>
        </div>
      </div>
    </div>
  );
}
