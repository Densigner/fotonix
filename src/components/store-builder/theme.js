import React, { useEffect, useRef, useState } from "react";

// One brand hex drives every color a storefront uses — no other colors are
// ever picked directly. Deliberately keeps `surface` close to true white
// (only a faint brand-hue tint) rather than drifting toward cream, and mood
// only ever adjusts three concrete things (text contrast, accent
// saturation, whether borders render at all) rather than vague "vibes" —
// see src/Bible or the plan this shipped under for the reasoning.

function hexToHsl(hex) {
  const clean = (hex || "#2E4B3C").replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

const hsl = (h, s, l) => `hsl(${h.toFixed(1)} ${Math.min(100, Math.max(0, s)).toFixed(1)}% ${Math.min(100, Math.max(0, l)).toFixed(1)}%)`;

const MOODS = {
  editorial: { textL: 12, satShift: 0, border: true, weight: "700", tracking: "-0.02em" },
  warm: { textL: 18, satShift: -10, border: true, weight: "600", tracking: "0em" },
  bold: { textL: 8, satShift: 18, border: false, weight: "800", tracking: "-0.03em" },
  clinical: { textL: 15, satShift: -30, border: true, weight: "600", tracking: "0em" },
};

const RADII = { none: "0px", sm: "10px", lg: "24px" };
const BLOCK_GAP = { tight: "2.5rem", airy: "5rem" };

export const DEFAULT_THEME = { brand: "#2E4B3C", mood: "editorial", fonts: "editorial", radius: "sm", density: "airy" };

// Returns a flat CSS custom-property object, applied via style={} on a
// wrapping element (the canvas's device frame, or the public page's root)
// — every block reads these with inline style rather than a hardcoded
// Tailwind color, so one brand color really does drive the whole page.
export function deriveThemeVars(theme) {
  const t = { ...DEFAULT_THEME, ...(theme || {}) };
  const { h, s, l } = hexToHsl(t.brand);
  const mood = MOODS[t.mood] || MOODS.editorial;

  const accent = hsl(h, s + mood.satShift, l);
  const accentForeground = l > 55 ? "hsl(0 0% 8%)" : "hsl(0 0% 100%)";
  const text = hsl(h, 12, mood.textL);
  const mutedText = hsl(h, 8, mood.textL + 30);
  const surface = hsl(h, 15, 99);
  const mutedSurface = hsl(h, 18, 96);
  const border = mood.border ? hsl(h, 15, 88) : "transparent";

  return {
    "--brand": t.brand,
    "--surface": surface,
    "--muted-surface": mutedSurface,
    "--border": border,
    "--text": text,
    "--muted-text": mutedText,
    "--accent": accent,
    "--accent-foreground": accentForeground,
    "--radius": RADII[t.radius] || RADII.sm,
    "--block-gap": BLOCK_GAP[t.density] || BLOCK_GAP.airy,
    "--heading-weight": mood.weight,
    "--heading-tracking": mood.tracking,
    "--font-display": (FONT_PAIRINGS[t.fonts] || FONT_PAIRINGS.editorial).display,
    "--font-body": (FONT_PAIRINGS[t.fonts] || FONT_PAIRINGS.editorial).body,
  };
}

// A block's background "tone" — the single biggest thing that stops a long
// page reading as one flat scroll, and previously handled inconsistently
// (some blocks hardcoded muted-surface, most set no background at all).
// Every block now reads this instead of picking its own background.
export function toneStyle(tone) {
  if (tone === "muted") return { background: "var(--muted-surface)" };
  if (tone === "contrast") return { background: "var(--accent)", color: "var(--accent-foreground)" };
  return {};
}

// Shared by any block showing an image with a chosen focal point, so
// cropping never cuts through a face or the actual subject. Images only
// for now -- nothing currently needs video -- but kept as its own
// component (not just an inline <img>) so a video/poster prop can be added
// later without every caller changing.
export function Media({ src, alt = "", focal, className, style }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      style={{ objectPosition: focal || "50% 50%", ...style }}
    />
  );
}

// Real, freely-loadable Google Fonts pairings. The user's original spec
// named Canela and Satoshi for two of these pairings; neither is a free/
// Google Font (Canela is commercial, Satoshi ships from Fontshare, not
// Google), so these are close-character substitutes rather than fonts that
// couldn't actually ship.
export const FONT_PAIRINGS = {
  editorial: {
    label: "Editorial — Fraunces + Inter",
    hint: "Fashion, homeware",
    display: "'Fraunces', ui-serif, Georgia, serif",
    body: "'Inter', ui-sans-serif, system-ui, sans-serif",
    googleParams: "Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600",
  },
  grotesk: {
    label: "Grotesk — Space Grotesk + Inter",
    hint: "Tools, tech, gear",
    display: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    body: "'Inter', ui-sans-serif, system-ui, sans-serif",
    googleParams: "Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600",
  },
  classic: {
    label: "Classic — Newsreader + Source Sans 3",
    hint: "Food, wellness, craft",
    display: "'Newsreader', ui-serif, Georgia, serif",
    body: "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
    googleParams: "Newsreader:opsz,wght@6..72,500;6..72,700&family=Source+Sans+3:wght@400;500;600",
  },
  mono: {
    label: "Mono accent — Space Mono + Inter",
    hint: "Niche, technical, indie",
    display: "'Space Mono', ui-monospace, monospace",
    body: "'Inter', ui-sans-serif, system-ui, sans-serif",
    googleParams: "Space+Mono:wght@700&family=Inter:wght@400;500;600",
  },
};

export function googleFontsHref(fontsKey) {
  const pairing = FONT_PAIRINGS[fontsKey] || FONT_PAIRINGS.editorial;
  return `https://fonts.googleapis.com/css2?family=${pairing.googleParams}&display=swap`;
}

// Injects/updates a single <link> tag for the selected pairing. Shared by
// the canvas (so the editor previews the real fonts) and the public page.
export function useGoogleFont(fontsKey) {
  useEffect(() => {
    let link = document.querySelector('link[data-shop-font]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.setAttribute("data-shop-font", "1");
      document.head.appendChild(link);
    }
    link.href = googleFontsHref(fontsKey);
  }, [fontsKey]);
}

// Scroll-reveal, public storefront page only (never the editor canvas —
// content re-animating on every keystroke mid-edit would just be
// annoying). Three rules enforced here regardless of `mode`, not left to
// each call site to remember: content starts visible in the DOM and this
// only ever *removes* visibility on mount (so the page still renders
// correctly if this effect never runs at all — e.g. JS erroring elsewhere),
// prefers-reduced-motion always wins, and the caller is expected to pass
// `disabled` for the first block on the page (nothing above the fold
// should animate in).
export function Reveal({ mode, index = 0, disabled, children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(true);
  const active = !disabled && mode && mode !== "none";

  useEffect(() => {
    if (!active) return undefined;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    setVisible(false);
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisible(true);
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return <div ref={ref}>{children}</div>;

  const delay = Math.min(index * 60, 300);
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : mode === "fade-up" ? "translateY(24px)" : "none",
        transition: "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
