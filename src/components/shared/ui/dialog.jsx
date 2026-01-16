import React from 'react';

export function Dialog({ open, children, onOpenChange }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange && onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-4xl px-4">{children}</div>
    </div>
  );
}

export function DialogContent({ children, className = '' }) {
  return (
    <div className={`bg-white shadow-xl rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export default Dialog;
