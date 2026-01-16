import React from "react";
import { AnimatePresence, motion } from "framer-motion";

const OPTIONS = [
  { type: "hero", label: "Hero banner" },
  { type: "collection-grid", label: "Collection grid" },
  { type: "rich-text", label: "Rich text" },
  { type: "faq", label: "FAQ" },
];

export default function CommandPalette({ open, onClose, onChoose }) {
  const [q, setQ] = React.useState("");
  const list = React.useMemo(() => OPTIONS.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())), [q]);

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open ? onClose() : onChoose?.("__OPEN__");
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onChoose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[120]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <motion.div className="absolute left-1/2 top-24 w-[92%] max-w-lg -translate-x-1/2 rounded-2xl bg-white p-3 shadow-2xl"
          initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add section…"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none" />
          <div className="mt-2 max-h-72 overflow-y-auto">
            {list.map((o) => (
              <button key={o.type} onClick={() => onChoose?.(o.type)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-zinc-50">
                <span>{o.label}</span><span className="text-xs text-zinc-500">{o.type}</span>
              </button>
            ))}
            {list.length === 0 && <div className="p-3 text-center text-sm text-zinc-500">No matches</div>}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
