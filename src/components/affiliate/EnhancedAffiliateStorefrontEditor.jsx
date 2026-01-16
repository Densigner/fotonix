import React from "react";
import { Eye, GripVertical, Plus, Trash2 } from "lucide-react";
import { SortableProductsGrid } from "./ProductCard"; // from the DnD ProductCard I gave you

function arrayMove(arr, from, to) {
  const a = arr.slice();
  const item = a.splice(from, 1)[0];
  a.splice(to, 0, item);
  return a;
}

function SortableList({ items, getKey, renderRow, onReorder }) {
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);

  const onDragStart = (idx, e) => {
    setDragIdx(idx);
    try { e.dataTransfer.setData("text/plain", String(idx)); } catch {}
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (idx, e) => { e.preventDefault(); setOverIdx(idx); };
  const onDrop = (idx, e) => {
    e.preventDefault();
    if (dragIdx == null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    onReorder?.(arrayMove(items, dragIdx, idx));
    setDragIdx(null); setOverIdx(null);
  };

  return (
    <div className="space-y-2" role="list">
      {items.map((it, idx) => (
        <div
          role="listitem"
          key={getKey(it, idx)}
          draggable
          onDragStart={(e) => onDragStart(idx, e)}
          onDragOver={(e) => onDragOver(idx, e)}
          onDrop={(e) => onDrop(idx, e)}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
          className={[
            "flex items-center gap-3 rounded-xl border p-2 text-sm shadow-sm",
            overIdx === idx && dragIdx != null && dragIdx !== idx ? "ring-2 ring-fuchsia-400" : "",
            "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 text-zinc-400"><GripVertical className="h-4 w-4" /><span className="text-[11px]">drag</span></div>
          <div className="flex-1 min-w-0">{renderRow(it, idx)}</div>
        </div>
      ))}
    </div>
  );
}

function ResizableSplit({ left, right, minLeft = 260, maxLeft = 720 }) {
  const [w, setW] = React.useState(420);
  const dragging = React.useRef(false);

  React.useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const x = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      if (typeof x !== "number") return;
      const next = Math.max(minLeft, Math.min(maxLeft, x));
      setW(next);
    };
    const stop = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", stop);
    };
  }, [minLeft, maxLeft]);

  return (
    <div className="relative w-full" style={{ display: "grid", gridTemplateColumns: `${w}px 12px 1fr`, gap: 0 }}>
      <div className="min-h-[60vh] overflow-auto p-3">{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        className="cursor-col-resize select-none bg-gradient-to-b from-fuchsia-200 to-pink-200"
        onMouseDown={() => (dragging.current = true)}
        onTouchStart={() => (dragging.current = true)}
        title="Drag to resize"
      />
      <div className="min-h-[60vh] overflow-auto p-3 bg-zinc-50 dark:bg-zinc-950">{right}</div>
    </div>
  );
}

export default function EnhancedAffiliateStorefrontEditor({
  data,
  setData,
  products = [],
  onAddSection,
  onRemoveSection,
}) {

  const visibleProducts = React.useMemo(() => {
    return data.productDisplayMode === "all"
      ? products
      : products.filter((p) => (data.productIds || []).includes(p.id));
  }, [products, data.productDisplayMode, data.productIds]);

  const handleReorderProducts = (nextList) => {
    if (data.productDisplayMode !== "curated") return;
    const nextIds = nextList.map((p) => p.id);
    setData((d) => ({ ...d, productIds: nextIds }));
  };

  const left = (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Page sections</h3>
          <button
            onClick={() => onAddSection?.()}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Plus className="h-4 w-4" /> Add section
          </button>
        </div>
        <SortableList
          items={data.pageSections || []}
          getKey={(s) => s.id}
          onReorder={(next) => setData((d) => ({ ...d, pageSections: next }))}
          renderRow={(s, idx) => (
            <div className="flex items-center justify-between gap-2">
              <div className="truncate">
                <div className="font-medium">{s.type}</div>
                <div className="text-[11px] text-zinc-500 truncate">id: {s.id}</div>
              </div>
              <button
                onClick={() => onRemoveSection?.(s.id)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label={`Remove ${s.type}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        />
        <p className="mt-2 text-[11px] text-zinc-500">Tip: drag rows to reorder how sections appear on your page.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 p-3 shadow-sm dark:border-zinc-800">
        <div className="text-sm font-semibold">Products shown</div>
        <div className="mt-2 space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={data.productDisplayMode === "all"} onChange={() => setData({ ...data, productDisplayMode: "all" })} /> All active products</label>
          <label className="flex items-center gap-2"><input type="radio" checked={data.productDisplayMode === "curated"} onChange={() => setData({ ...data, productDisplayMode: "curated" })} /> Curated list only</label>
          {data.productDisplayMode === "curated" && (
            <p className="text-[11px] text-zinc-500">Reorder on the right by dragging cards. That order is saved here.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 p-3 shadow-sm dark:border-zinc-800">
        <div className="text-sm font-semibold">Theme</div>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-2"><input type="radio" checked={data.theme.bgType === "gradient"} onChange={() => setData({ ...data, theme: { ...data.theme, bgType: "gradient" } })} /> Gradient</label>
          <label className="inline-flex items-center gap-2"><input type="radio" checked={data.theme.bgType === "color"} onChange={() => setData({ ...data, theme: { ...data.theme, bgType: "color" } })} /> Solid</label>
          <label className="inline-flex items-center gap-2"><input type="radio" checked={data.theme.bgType === "image"} onChange={() => setData({ ...data, theme: { ...data.theme, bgType: "image" } })} /> Image</label>
        </div>
      </div>
    </div>
  );

  const right = (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live preview</h3>
        <span className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-800">Drag cards to reorder <Eye className="h-3 w-3" /></span>
      </div>
      <div className="grid gap-4">
        <SortableProductsGrid
          items={visibleProducts}
          onReorder={handleReorderProducts}
          render={(p) => (
            <a
              key={p.id}
              href={p.href || `#product/${p.id}`}
              className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.title} className="h-48 w-full object-cover" />
              ) : (
                <div className="grid h-48 place-items-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800">No image</div>
              )}
              <div className="p-4">
                <h4 className="line-clamp-2 text-sm font-semibold">{p.title}</h4>
                {typeof p.price === "number" && (
                  <div className="mt-1 text-pink-600">£{p.price.toFixed(2)}</div>
                )}
              </div>
            </a>
          )}
        />
      </div>
    </div>
  );

  return <ResizableSplit left={left} right={right} />;
}
