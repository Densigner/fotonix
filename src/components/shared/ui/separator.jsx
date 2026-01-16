import React from 'react';

export function Separator({ className = '' }) {
  return <div className={`w-full h-px bg-slate-800 my-4 ${className}`} />;
}

export default Separator;
