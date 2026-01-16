import React from 'react';

export function Card({ children, className = '' }) {
  return <div className={`rounded-lg ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = '' }) {
  return <div className={`px-4 py-3 border-b border-slate-800 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }) {
  return <div className={`text-base font-semibold ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export default Card;
