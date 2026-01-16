import React, { useState } from "react";
import { GripVertical, Trash2, Plus, Image as ImageIcon } from "lucide-react";

// ---- shared helpers (same DnD/DropZone pattern as your email editor) ----
const DRAG_NEW_BLOCK = "application/x-store-section";
const DRAG_REORDER = "application/x-store-reorder";

const uid = (p = "sec") => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const move = (arr, from, to) => {
  const a = arr.slice();
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
};

// ---- section factory (re-uses your schema) ----
export function createSection(type = "rich-text") {
  switch (type) {
    case "hero":
      return {
        id: uid("hero"),
        type,
        data: {
          title: "Welcome to my shop",
          subtitle: "Curated picks, updated weekly.",
          align: "center",
          overlay: 0.35,
          bgImage: "",
          cta: { label: "Shop now", href: "#products" },
        },
      };
    case "collection-grid":
      return {
        id: uid("grid"),
        type,
        data: {
          title: "Featured",
          productIds: [], // references only
          columns: 3,
          showPrice: true,
          showCTA: false,
        },
      };
    case "faq":
      return {
        id: uid("faq"),
        type,
        data: {
          items: [{ q: "Shipping times?", a: "Usually 2–5 business days." }],
        },
      };
    default:
      return {
        id: uid("text"),
        type: "rich-text",
        data: {
          html: "<p>Add your story here.</p>",
          align: "left",
          maxWidth: 720,
        },
      };
  }
}

// ---- left palette ----
function Palette({ onInsert }) {
  const items = [
    { t: "hero", label: "Hero", desc: "Big banner with title/subtitle/CTA" },
    { t: "collection-grid", label: "Collection grid", desc: "Products grid (by IDs)" },
    { t: "rich-text", label: "Rich text", desc: "Custom HTML/text block" },
    { t: "faq", label: "FAQ", desc: "Collapsible Q&A" },
  ];
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-zinc-500">Add a section</div>
      {items.map((i) => (
        <button
          key={i.t}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_NEW_BLOCK, JSON.stringify({ type: i.t }));
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onInsert(i.t)}
          className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="font-medium">{i.label}</div>
          <div className="text-xs text-zinc-500">{i.desc}</div>
        </button>
      ))}
    </div>
  );
}

// ---- generic drop zone (like your email DropZone) ----
function DropZone({ index, onInsert, onMove }) {
  const [active, setActive] = useState(false);
  const accept = (dt) => {
    const types = Array.from((dt && dt.types) || []);
    return types.includes(DRAG_NEW_BLOCK) || types.includes(DRAG_REORDER);
  };
  const onOver = (e) => {
    if (!accept(e.dataTransfer)) return;
    e.preventDefault();
    const types = Array.from(e.dataTransfer.types || []);
    e.dataTransfer.dropEffect = types.includes(DRAG_REORDER) ? "move" : "copy";
    setActive(true);
  };
  const onLeave = () => setActive(false);
  const onDrop = (e) => {
    e.preventDefault();
    setActive(false);
    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes(DRAG_REORDER)) {
      try {
        const { from } = JSON.parse(e.dataTransfer.getData(DRAG_REORDER));
        onMove && onMove(from, index > from ? index - 1 : index);
      } catch {}
      return;
    }
    if (types.includes(DRAG_NEW_BLOCK)) {
      try {
        const { type } = JSON.parse(e.dataTransfer.getData(DRAG_NEW_BLOCK));
        onInsert && onInsert(type, index);
      } catch {}
    }
  };
  return (
    <div
      onDragOver={onOver}
      onDragEnter={onOver}
      onDragLeave={onLeave}
      onDrop={onDrop}
      className={[
        "my-2 grid h-8 place-items-center rounded-md border-2 border-dashed text-[11px] transition",
        active ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-500" : "border-slate-300 text-slate-400 opacity-60",
      ].join(" ")}
    >
      Drop here
    </div>
  );
}

// ---- inline toolbars per section ----
function RowShell({ children, onRemove, onMoveUp, onMoveDown, dragProps }) {
  return (
    <div className="relative rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/80 p-1 shadow-sm">
        <button type="button" title="Move up" className="rounded-md px-2 py-1 hover:bg-zinc-100" onClick={onMoveUp}>
          ↑
        </button>
        <button type="button" title="Move down" className="rounded-md px-2 py-1 hover:bg-zinc-100" onClick={onMoveDown}>
          ↓
        </button>
        <button type="button" title="Drag to move" {...dragProps} className="rounded-md p-1 hover:bg-zinc-100">
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" title="Remove section" onClick={onRemove} className="rounded-md p-1 hover:bg-red-50">
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
      {children}
    </div>
  );
}

// ---- small editors shown on the right when a section is selected ----
function HeroEditor({ value, onChange, onPick }) {
  const { title, subtitle, align = "center", overlay = 0.35, bgImage = "", cta = {} } = value || {};
  const set = (p) => onChange && onChange({ title, subtitle, align, overlay, bgImage, cta, ...p });
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Hero settings</div>
      <label className="text-xs">Title</label>
      <input className="w-full rounded-md border px-2 py-1 text-sm" value={title} onChange={(e) => set({ title: e.target.value })} />
      <label className="text-xs">Subtitle</label>
      <textarea className="w-full rounded-md border px-2 py-1 text-sm" value={subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
      <label className="text-xs">Align</label>
      <select className="w-full rounded-md border px-2 py-1 text-sm" value={align} onChange={(e) => set({ align: e.target.value })}>
        <option value="left">left</option>
        <option value="center">center</option>
        <option value="right">right</option>
      </select>
      <label className="text-xs">Overlay (0–1)</label>
      <input
        type="number"
        step="0.05"
        min="0"
        max="1"
        className="w-full rounded-md border px-2 py-1 text-sm"
        value={overlay}
        onChange={(e) => set({ overlay: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })}
      />
      <div className="flex items-center gap-2">
        <button type="button" className="rounded-md border px-2 py-1 text-sm" onClick={onPick}>
          Pick background
        </button>
        {bgImage ? <span className="text-xs text-zinc-500">image set</span> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs">CTA label</label>
          <input
            className="w-full rounded-md border px-2 py-1 text-sm"
            value={cta && cta.label ? cta.label : ""}
            onChange={(e) => set({ cta: { ...(cta || {}), label: e.target.value } })}
          />
        </div>
        <div>
          <label className="text-xs">CTA href</label>
          <input
            className="w-full rounded-md border px-2 py-1 text-sm"
            value={cta && cta.href ? cta.href : ""}
            onChange={(e) => set({ cta: { ...(cta || {}), href: e.target.value } })}
          />
        </div>
      </div>
    </div>
  );
}

function GridEditor({ value, onChange, products }) {
  const { title = "Featured", productIds = [], columns = 3, showPrice = true, showCTA = false } = value || {};
  const set = (p) => onChange && onChange({ title, productIds, columns, showPrice, showCTA, ...p });
  const selectable = products.map((p) => ({ id: p.id, title: p.title }));
  const toggle = (id) => set({ productIds: productIds.includes(id) ? productIds.filter((x) => x !== id) : [...productIds, id] });
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Collection grid</div>
      <label className="text-xs">Title</label>
      <input className="w-full rounded-md border px-2 py-1 text-sm" value={title} onChange={(e) => set({ title: e.target.value })} />
      <label className="text-xs">Columns</label>
      <input
        type="number"
        min={1}
        max={5}
        className="w-full rounded-md border px-2 py-1 text-sm"
        value={columns}
        onChange={(e) => set({ columns: Math.max(1, Math.min(5, Number(e.target.value) || 3)) })}
      />
      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showPrice} onChange={(e) => set({ showPrice: e.target.checked })} /> Show price
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showCTA} onChange={(e) => set({ showCTA: e.target.checked })} /> Show CTA hint
        </label>
      </div>
      <div className="text-xs font-medium mt-2">Products (toggle to include)</div>
      <div className="max-h-40 overflow-auto rounded-md border p-2">
        {selectable.length === 0 ? (
          <div className="text-xs text-zinc-500">No products yet.</div>
        ) : (
          selectable.map((p) => (
            <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggle(p.id)} />
              <span className="truncate">{p.title}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function RichTextEditor({ value, onChange }) {
  const { html = "<p>Text</p>", align = "left", maxWidth = 720 } = value || {};
  const set = (p) => onChange && onChange({ html, align, maxWidth, ...p });
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Rich text</div>
      <label className="text-xs">Align</label>
      <select className="w-full rounded-md border px-2 py-1 text-sm" value={align} onChange={(e) => set({ align: e.target.value })}>
        <option value="left">left</option>
        <option value="center">center</option>
        <option value="right">right</option>
      </select>
      <label className="text-xs">Max width (px)</label>
      <input
        type="number"
        min={360}
        max={1200}
        className="w-full rounded-md border px-2 py-1 text-sm"
        value={maxWidth}
        onChange={(e) => set({ maxWidth: Number(e.target.value) || 720 })}
      />
      <label className="text-xs">HTML</label>
      <textarea className="h-36 w-full rounded-md border px-2 py-1 text-sm" value={html} onChange={(e) => set({ html: e.target.value })} />
    </div>
  );
}

function FaqEditor({ value, onChange }) {
  const items = (value && value.items) || [];
  const add = () => onChange && onChange({ items: [...items, { q: "Question", a: "Answer" }] });
  const setItem = (i, patch) => onChange && onChange({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const del = (i) => onChange && onChange({ items: items.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">FAQ</div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-md border p-2">
            <input
              className="mb-1 w-full rounded-md border px-2 py-1 text-sm"
              value={it.q}
              onChange={(e) => setItem(i, { q: e.target.value })}
              placeholder="Question"
            />
            <textarea
              className="w-full rounded-md border px-2 py-1 text-sm"
              value={it.a}
              onChange={(e) => setItem(i, { a: e.target.value })}
              placeholder="Answer"
            />
            <div className="mt-1 text-right">
              <button className="text-xs text-red-500" onClick={() => del(i)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-1 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs" onClick={add}>
        <Plus className="h-3 w-3" /> Add Q&A
      </button>
    </div>
  );
}

// ---- section preview render (compact, same style as your public view) ----
function SectionPreview({ section, products }) {
  if (section.type === "hero") {
    const { title, subtitle, align = "center", bgImage, overlay = 0.35, cta } = section.data || {};
    const justify = align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center";
    return (
      <div className="relative overflow-hidden rounded-xl">
        {bgImage ? (
          <img src={bgImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-zinc-400">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <div className="relative z-10 grid min-h-[180px] place-items-center p-6">
          <div className={`flex w-full max-w-3xl flex-col gap-2 ${justify} text-white drop-shadow`}>
            <div className="text-2xl font-bold">{title}</div>
            {subtitle && <div className="text-sm opacity-90">{subtitle}</div>}
            {cta && cta.label ? (
              <span className="mt-1 inline-flex w-max rounded-md bg-white px-3 py-1 text-sm font-semibold text-zinc-900">{cta.label}</span>
            ) : null}
          </div>
        </div>
        <div className="absolute inset-0" style={{ background: "#000", opacity: overlay }} />
      </div>
    );
  }
  if (section.type === "collection-grid") {
    const { title, productIds = [], columns = 3, showPrice = true, showCTA = false } = section.data || {};
    const list = productIds.length ? products.filter((p) => productIds.includes(p.id)) : products;
    const col = Math.max(1, Math.min(4, columns));
    // NOTE: dynamic Tailwind class names like md:grid-cols-${n} need safelisting in your config.
    return (
      <div>
        {title ? <div className="mb-2 text-sm font-semibold">{title}</div> : null}
        <div className={`grid gap-3 sm:grid-cols-2 ${`md:grid-cols-${Math.min(3, col)}`} ${`lg:grid-cols-${col}`}`}>
          {list.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
              {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="h-36 w-full object-cover" /> : null}
              <div className="p-3">
                <div className="line-clamp-2 text-sm font-semibold">{p.title}</div>
                {showPrice && typeof p.price === "number" ? <div className="mt-1 text-pink-600">£{p.price.toFixed(2)}</div> : null}
                {showCTA ? <div className="mt-1 text-xs text-zinc-500">View details →</div> : null}
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="rounded-md border p-6 text-center text-sm text-zinc-500">No products yet</div>}
        </div>
      </div>
    );
  }
  if (section.type === "rich-text") {
    const { html, align = "left", maxWidth = 720 } = section.data || {};
    const cls = align === "center" ? "mx-auto text-center" : align === "right" ? "ml-auto text-right" : "mr-auto text-left";
    return <div className={`prose max-w-none ${cls}`} style={{ maxWidth }} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (section.type === "faq") {
    const items = (section.data && section.data.items) || [];
    return (
      <div className="rounded-xl border p-3">
        <div className="mb-2 text-sm font-semibold">FAQ</div>
        <div className="divide-y">
          {items.map((it, i) => (
            <details key={i} className="py-1">
              <summary className="cursor-pointer text-sm font-medium">{it.q}</summary>
              <p className="mt-1 text-sm text-zinc-600">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// ---- main builder ----
export default function StorePageBuilderPro({
  value = [],
  onChange,
  products = [],
  onPickImageForSection, // (sectionId) => void
}) {
  const [selectedId, setSelectedId] = useState(null);

  const insert = (type, index) => {
    const sec = createSection(type);
    if (onChange) {
      onChange((prev) => {
        const arr = Array.isArray(prev) ? prev.slice() : [];
        const i = typeof index === "number" ? index : arr.length;
        arr.splice(i, 0, sec);
        return arr;
      });
    }
    setSelectedId(sec.id);
  };

  const remove = (id) =>
    onChange &&
    onChange((prev) => prev.filter((s) => s.id !== id));

  const moveByIndex = (from, to) =>
    onChange &&
    onChange((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to > prev.length) return prev;
      return move(prev, from, to);
    });

  const patch = (id, patchData) =>
    onChange &&
    onChange((prev) => prev.map((s) => (s.id === id ? { ...s, data: patchData } : s)));

  const selected = value.find((s) => s.id === selectedId) || null;

  return (
    <div className="grid grid-cols-[280px_1fr] gap-3">
      {/* left: palette */}
      <aside className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <Palette onInsert={(t) => insert(t)} />
      </aside>

      {/* center: canvas */}
      <main className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <DropZone index={0} onInsert={insert} onMove={moveByIndex} />
        {value.map((s, i) => (
          <div key={s.id} className="my-2">
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_REORDER, JSON.stringify({ from: i, id: s.id }));
                e.dataTransfer.effectAllowed = "move";
              }}
              onMouseDown={() => setSelectedId(s.id)}
            >
              <RowShell
                onRemove={() => remove(s.id)}
                onMoveUp={() => moveByIndex(i, Math.max(0, i - 1))}
                onMoveDown={() => moveByIndex(i, Math.min(value.length - 1, i + 1))}
                dragProps={{ draggable: false }}
              >
                <SectionPreview section={s} products={products} />
              </RowShell>
            </div>
            <DropZone index={i + 1} onInsert={insert} onMove={moveByIndex} />
          </div>
        ))}
        {value.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">
            Start by dragging a section from the left, or click a tile to insert.
          </div>
        )}
      </main>

      {/* contextual editor intentionally removed to avoid UI issues */}
    </div>
  );
}
