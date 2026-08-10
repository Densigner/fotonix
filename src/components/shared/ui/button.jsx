import React from 'react';

export function Button({ children, variant = 'default', className = '', ...p }) {
  const base = 'px-3 py-2 rounded text-sm font-medium';
  // A caller-supplied text-* class in `className` is meant to override the
  // variant's own text color, but both end up as plain same-specificity
  // Tailwind classes — whichever one Tailwind happens to emit later in the
  // stylesheet wins, not whichever comes last in this string. That silently
  // dropped e.g. text-red-600 on a "Remove" button in favor of outline's
  // own near-white text-slate-100, making it unreadable. Skip the variant's
  // text color outright whenever the caller supplies its own.
  const hasCustomText = /\btext-/.test(className);
  const styles = variant === 'outline'
    ? `border border-slate-700 bg-transparent ${hasCustomText ? '' : 'text-slate-100'}`
    : `bg-slate-800 ${hasCustomText ? '' : 'text-white'}`;
  return (
    <button {...p} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export default Button;
