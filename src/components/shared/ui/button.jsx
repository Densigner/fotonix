import React from 'react';

export function Button({ children, variant = 'default', className = '', ...p }) {
  const base = 'px-3 py-2 rounded text-sm font-medium';
  // A caller-supplied text-COLOR class in `className` is meant to override
  // the variant's own text color, but both end up as plain same-specificity
  // Tailwind classes — whichever one Tailwind happens to emit later in the
  // stylesheet wins, not whichever comes last in this string. That silently
  // dropped e.g. text-red-600 on a "Remove" button in favor of outline's
  // own near-white text-slate-100, making it unreadable. Skip the variant's
  // text color outright whenever the caller supplies its own.
  // Must only match actual color utilities (text-white, text-red-600,
  // text-[#fff]...) — matching any "text-" prefix also caught size/align
  // utilities like text-sm or text-center, which aren't colors at all. That
  // false positive skipped the text color on any button passing just
  // className="text-sm", leaving it with no text color (inheriting whatever
  // dark ambient color sat above it) on top of a solid dark background —
  // dark text on a dark button, unreadable ("Show Blocks").
  const hasCustomText = /\btext-(white|black|transparent|current|inherit|\[[^\]]+\]|[a-z]+-\d{2,3})\b/.test(className);
  let styles;
  if (variant === 'outline') {
    styles = `border border-slate-700 bg-transparent ${hasCustomText ? '' : 'text-slate-100'}`;
  } else if (variant === 'ghost') {
    // Was falling through to the default branch below (solid bg-slate-800),
    // which is exactly wrong for "ghost" — no background until hovered.
    styles = `bg-transparent hover:bg-gray-100 ${hasCustomText ? '' : 'text-gray-700'}`;
  } else if (variant === 'destructive') {
    // Also fell through to the default branch before — readable (white on
    // dark) but not visually distinct as a destructive action.
    styles = `bg-red-600 hover:bg-red-700 ${hasCustomText ? '' : 'text-white'}`;
  } else {
    styles = `bg-slate-800 ${hasCustomText ? '' : 'text-white'}`;
  }
  return (
    <button {...p} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export default Button;
