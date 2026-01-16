import React from "react";
export default function DeviceToolbar({ mode, onChange }) {
  const B = (v, label) => (
    <button type="button" onClick={() => onChange(v)}
      className={`rounded-xl border px-3 py-1 text-sm ${mode === v ? "bg-zinc-900 text-white border-zinc-900" : "bg-white border-zinc-200"}`}>
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      {B("desktop", "Desktop")} {B("tablet", "Tablet")} {B("mobile", "Mobile")}
    </div>
  );
}
