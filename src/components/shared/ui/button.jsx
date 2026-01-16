import React from 'react';

export function Button({ children, variant = 'default', className = '', ...p }) {
  const base = 'px-3 py-2 rounded text-sm font-medium';
  const styles = variant === 'outline' ? 'border border-slate-700 text-slate-100 bg-transparent' : 'bg-slate-800 text-white';
  return (
    <button {...p} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export default Button;
