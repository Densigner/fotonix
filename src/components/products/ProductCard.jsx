import React from "react";

// Utilities
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function arrayMove(arr, from, to) {
  const a = arr.slice();
  const item = a.splice(from, 1)[0];
  a.splice(to, 0, item);
  return a;
}

export function SortableProductsGrid({
  items,
  render,
  onReorder,
  className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3",
}) {
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);
  const pressTimer = React.useRef(null);

  const onDragStart = (idx, e) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(idx)); } catch {}
  };
  const onDragOver = (idx, e) => {
    e.preventDefault();
    setOverIdx(idx);
    try { e.dataTransfer.dropEffect = "move"; } catch {}
  };
  const onDrop = (idx, e) => {
    e.preventDefault();
    setOverIdx(null);
    if (dragIdx == null || dragIdx === idx) return;
    const next = arrayMove(items, dragIdx, idx);
    onReorder?.(next);
    setDragIdx(null);
  };
  const onDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  const onTouchStart = (idx, e) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setDragIdx(idx), 500);
  };
  const onTouchEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const onKeyDown = (idx, e) => {
    const last = items.length - 1;
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (dragIdx == null) { setDragIdx(idx); setOverIdx(idx); }
      else {
        const next = arrayMove(items, dragIdx, overIdx ?? dragIdx);
        onReorder?.(next);
        setDragIdx(null); setOverIdx(null);
      }
      return;
    }
    if (dragIdx == null) return;
    if (["ArrowUp","ArrowLeft","ArrowDown","ArrowRight","Home","End"].includes(e.key)) {
      e.preventDefault();
      let next = overIdx ?? dragIdx;
      const cols = 3;
      switch (e.key) {
        case "ArrowLeft": next = next - 1; break;
        case "ArrowRight": next = next + 1; break;
        case "ArrowUp": next = next - cols; break;
        case "ArrowDown": next = next + cols; break;
        case "Home": next = 0; break;
        case "End": next = last; break;
      }
      setOverIdx(clamp(next, 0, last));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const next = arrayMove(items, dragIdx, overIdx ?? dragIdx);
      onReorder?.(next);
      setDragIdx(null); setOverIdx(null);
    }
    if (e.key === "Escape") { setDragIdx(null); setOverIdx(null); }
  };

  return (
    <div className={className} role="list">
      {items.map((item, idx) => {
        const isDragging = dragIdx === idx;
        const isOver = overIdx === idx && dragIdx != null && dragIdx !== idx;
        return (
          <div
            key={item.id || idx}
            role="listitem"
            tabIndex={0}
            onKeyDown={(e) => onKeyDown(idx, e)}
            draggable
            onDragStart={(e) => onDragStart(idx, e)}
            onDragOver={(e) => onDragOver(idx, e)}
            onDrop={(e) => onDrop(idx, e)}
            onDragEnd={onDragEnd}
            onTouchStart={(e) => onTouchStart(idx, e)}
            onTouchEnd={onTouchEnd}
            className={[
              "group relative rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900",
              isDragging ? "opacity-70 ring-2 ring-fuchsia-400" : "",
            ].join(" ")}
            aria-grabbed={isDragging}
            aria-dropeffect="move"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex select-none items-center justify-between p-2 text-[10px] text-zinc-500">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">Drag to reorder</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">Space/Enter to drop</span>
            </div>
            {isOver && (
              <div className="absolute inset-0 z-0 rounded-2xl ring-2 ring-fuchsia-400/80" aria-hidden />
            )}
            {render ? render(item) : (
              <ProductCard product={item} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProductCard({ product, onClick }) {
  const img = product.imageUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-fuchsia-400 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative h-40 w-full overflow-hidden">
        {img ? (
          <img src={img} alt={product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-zinc-400"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l6-6 4 4 2-2 6 6"/></svg></div>
        )}
      </div>
      <div className="p-4">
        <div className="line-clamp-2 text-sm font-semibold">{product.title}</div>
        {typeof product.price === "number" && (
          <div className="mt-1 text-pink-600">£{product.price.toFixed(2)}</div>
        )}
        {product.description && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">{product.description}</p>
        )}
      </div>
    </button>
  );
}
