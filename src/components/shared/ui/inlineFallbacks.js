import React from "react";

// Minimal inline fallbacks for shadcn/ui components not present in this repo.
// These are intentionally simple — replace with full components when available.
// Shared by FunnelBuilder.js and StoreCanvasBuilder.jsx so both editors use
// the exact same building blocks instead of forking a second copy.
export const Input = ({ value, onChange, placeholder, className, ...rest }) => (
  <input value={value} onChange={onChange} placeholder={placeholder} className={className || 'w-full rounded-md border border-gray-200 px-2 py-1'} {...rest} />
);
export const Label = ({ children, className }) => <label className={className || 'block text-xs font-semibold text-gray-600'}>{children}</label>;
export const Switch = ({ checked, onCheckedChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!checked}
    onClick={() => onCheckedChange && onCheckedChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
  </button>
);
export const Tabs = ({ children }) => <div>{children}</div>;
export const TabsList = ({ children }) => <div className="flex gap-2">{children}</div>;
export const TabsTrigger = ({ children, onClick, className }) => <button onClick={onClick} className={className}>{children}</button>;
export const TabsContent = ({ children }) => <div>{children}</div>;
export const Textarea = ({ value, onChange, className, ...rest }) => <textarea value={value} onChange={onChange} className={className || 'w-full rounded-md border p-2'} {...rest} />;
export const Slider = ({ value, onValueChange, min = 0, max = 100 }) => (
  <input type="range" min={min} max={max} value={Array.isArray(value) ? value[0] : value} onChange={(e) => onValueChange && onValueChange([Number(e.target.value)])} />
);
export const Tooltip = ({ children }) => <span>{children}</span>;
export const TooltipProvider = ({ children }) => <>{children}</>;
export const TooltipTrigger = ({ children }) => <span>{children}</span>;
export const TooltipContent = ({ children }) => <div>{children}</div>;
export const Dialog = ({ open, children, onOpenChange }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange && onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md mx-auto px-4">{children}</div>
    </div>
  );
};

export const DialogContent = ({ children, className }) => (
  <div className={`bg-white shadow-xl rounded-2xl ${className || ''}`}>{children}</div>
);
export const DialogFooter = ({ children }) => <div className="mt-4">{children}</div>;
export const DialogHeader = ({ children }) => <div className="mb-2">{children}</div>;
export const DialogTitle = ({ children }) => <h3 className="text-lg font-medium">{children}</h3>;
export const DialogTrigger = ({ children }) => <>{children}</>;
export const DropdownMenu = ({ children }) => <div>{children}</div>;
export const DropdownMenuTrigger = ({ children }) => <>{children}</>;
export const DropdownMenuContent = ({ children }) => <div>{children}</div>;
export const DropdownMenuItem = ({ children }) => <div>{children}</div>;
export const ScrollArea = ({ children, className }) => <div className={className} style={{ maxHeight: '60vh', overflow: 'auto' }}>{children}</div>;
export const Badge = ({ children }) => <span className="inline-block bg-gray-200 px-2 py-1 rounded">{children}</span>;
