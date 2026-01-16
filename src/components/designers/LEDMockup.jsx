// LEDMockup.jsx
import React, { useMemo, useState } from "react";

/**
 * LEDMockup
 * Props:
 *  - src: dataURL (PNG) of the user's design (transparent bg recommended)
 *  - colors?: array of glow hex strings
 *  - initialIndex?: starting color index
 *  - title?: optional caption
 */
export default function LEDMockup({
  src,
  colors = ["#22D3EE", "#34D399", "#A78BFA", "#F472B6", "#F59E0B", "#EF4444", "#FFFFFF"],
  initialIndex = 0,
  title = "LED Preview"
}) {
  const [idx, setIdx] = useState(initialIndex);
  const color = colors[idx % colors.length];

  // precompute CSS filter for stronger neon effect
  const glowFilter = useMemo(() => {
    // multiple stacked shadows ≈ neon
    const glows = [
      `drop-shadow(0 0 2px ${color})`,
      `drop-shadow(0 0 6px ${color})`,
      `drop-shadow(0 0 12px ${color})`,
      `drop-shadow(0 0 24px ${color})`
    ].join(" ");
    return glows;
  }, [color]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <div className="flex gap-1">
          {colors.map((c, i) => (
            <button
              key={c + i}
              onClick={() => setIdx(i)}
              aria-label={`Set color ${c}`}
              className="h-5 w-5 rounded-full ring-1 ring-black/20"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Scene */}
      <div
        className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-[radial-gradient(ellipse_at_bottom,_rgba(0,0,0,0.35),_rgba(0,0,0,0.85))]"
        style={{ isolation: "isolate" }}
      >
        {/* Back wall texture hint */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.0) 40%)"
          }}
        />
        {/* Table */}
        <div
          aria-hidden
          className="absolute left-0 right-0 bottom-0 h-[28%]"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,20,20,0.6), rgba(0,0,0,0.95))"
          }}
        />

        {/* Acrylic plate (holds the exported design) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[28%] flex flex-col items-center">
          {/* Plate holder slot glow */}
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 bottom-[-6px] w-40 h-2 rounded-full"
            style={{
              background: color,
              filter: "blur(8px)",
              opacity: 0.55
            }}
          />
          {/* The design image with neon-like filter */}
          <img
            src={src}
            alt="Your design preview"
            style={{
              width: 260,
              height: "auto",
              filter: glowFilter,
              // light cyan tint so black strokes become lit lines:
              mixBlendMode: "screen"
            }}
            className="select-none pointer-events-none"
            draggable={false}
          />
        </div>

        {/* LED Base (simple SVG) */}
        <svg
          className="absolute left-1/2 -translate-x-1/2 bottom-0"
          width="280"
          height="120"
          viewBox="0 0 280 120"
          role="img"
          aria-label="Lamp base"
        >
          {/* Top ellipse */}
          <ellipse cx="140" cy="54" rx="120" ry="26" fill="#0B0F14" />
          {/* Body */}
          <rect x="20" y="54" width="240" height="52" rx="26" fill="#0B0F14" />
          {/* Rim highlight */}
          <ellipse cx="140" cy="54" rx="120" ry="26" fill={`url(#rim)`} opacity="0.6" />
          {/* Slot */}
          <rect x="80" y="50" width="120" height="6" rx="3" fill="#05070A" />
          {/* LED indicator */}
          <circle cx="210" cy="85" r="4" fill={color} opacity="0.9" />
          {/* defs */}
          <defs>
            <radialGradient id="rim" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0B0F14" />
            </radialGradient>
          </defs>
        </svg>

        {/* Ambient colored glow on wall */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 bottom-[36%] w-[80%] h-[38%] rounded-[50%]"
          style={{
            background: color,
            filter: "blur(40px)",
            opacity: 0.22
          }}
        />
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center justify-between">
        <button
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
          onClick={() => setIdx((i) => (i + 1) % colors.length)}
        >
          Next color
        </button>
        <div className="text-xs text-slate-400">
          Tip: export with transparent background for best glow.
        </div>
      </div>
    </div>
  );
}
