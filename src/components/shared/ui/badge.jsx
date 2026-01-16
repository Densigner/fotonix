import React from 'react';

export function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
