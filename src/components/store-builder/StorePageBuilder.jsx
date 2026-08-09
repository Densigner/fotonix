import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, GripVertical, Upload } from "lucide-react";
import { createSection } from "../shared/sections";

export default function StorePageBuilder({ value = [], onChange, onPickImage }) {
  const [openPalette, setOpenPalette] = React.useState(false);

  const insert = (type, index) => {
    try {
      if (typeof onChange !== "function") {
        console.warn("StorePageBuilder: onChange is not a function");
        return;
      }
      const arr = Array.isArray(value) ? value : [];
      const idx = typeof index === "number" ? index : arr.length;
      const s = createSection(type);
      const next = [...arr];
      next.splice(idx, 0, s);
      // debug: ensure parent receives new array
      // console.debug("StorePageBuilder.insert", { type, idx, s, next });
      onChange(next);
      setOpenPalette(false);
    } catch (err) {
      console.error("StorePageBuilder.insert error", err);
    }
  };

  const update = (id, patch) => onChange(value.map((s) => (s.id === id ? { ...s, data: { ...s.data, ...patch } } : s)));
  const remove = (id) => onChange(value.filter((s) => s.id !== id));

  const onDragStart = (e, id, fromIndex) => {
    e.dataTransfer.setData("application/x-section-move", JSON.stringify({ id, fromIndex }));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDropAt = (e, index) => {
    const m = e.dataTransfer.getData("application/x-section-move");
    if (!m) return;
    e.preventDefault();
    const { fromIndex } = JSON.parse(m);
    if (fromIndex === index || fromIndex + 1 === index) return;
    const next = [...value];
    const [moved] = next.splice(fromIndex, 1);
    const dest = fromIndex < index ? index - 1 : index;
    next.splice(dest, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Page sections</h3>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" onClick={() => setOpenPalette(true)}>
          <Plus className="h-4 w-4" /> Add section
        </button>
      </div>

      <AnimatePresence initial={false}>
        {value.map((s, i) => (
          <motion.div key={s.id} layout initial={{ opacity: 0.7, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            draggable onDragStart={(e) => onDragStart(e, s.id, i)}
            className="mb-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <GripVertical className="h-4 w-4" /> <span>{s.type}</span>
              </div>
              <button className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></button>
            </div>

            {/* Editors */}
            {s.type === "hero" && <HeroEditor data={s.data} onChange={(p) => update(s.id, p)} onPickImage={() => onPickImage?.(s.id)} />}
            {s.type === "collection-grid" && <CollectionEditor data={s.data} onChange={(p) => update(s.id, p)} />}
            {s.type === "rich-text" && <RichTextEditor data={s.data} onChange={(p) => update(s.id, p)} />}
            {s.type === "faq" && <FaqEditor data={s.data} onChange={(p) => update(s.id, p)} />}

            {/* Drop zone below each card */}
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropAt(e, i + 1)}
                 className="mt-3 grid h-8 place-items-center rounded-md border-2 border-dashed border-zinc-300 text-[11px] text-zinc-400">
              Drop here
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* top drop zone for index 0 */}
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropAt(e, 0)}
           className="mb-3 grid h-8 place-items-center rounded-md border-2 border-dashed border-zinc-300 text-[11px] text-zinc-400">
        Drop at top
      </div>

      {/* palette */}
      {openPalette && (
        <div className="flex flex-wrap gap-2">
          {["hero", "collection-grid", "rich-text", "faq"].map((t) => (
            <button key={t} type="button" onClick={() => insert(t)} className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">{t}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }) {
  return <div className="mb-2 grid grid-cols-[160px_1fr] items-center gap-3 text-sm"><div className="text-zinc-500">{label}</div><div>{children}</div></div>;
}

function HeroEditor({ data, onChange, onPickImage }) {
  const { title, subtitle, align, bgImage, overlay = 0.35, cta } = data;
  return (
    <div className="space-y-2">
      <Row label="Title"><input value={title} onChange={(e) => onChange({ title: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></Row>
      <Row label="Subtitle"><input value={subtitle || ""} onChange={(e) => onChange({ subtitle: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></Row>
      <Row label="Align">
        <select value={align} onChange={(e) => onChange({ align: e.target.value })} className="rounded-xl border px-2 py-1">
          <option>left</option><option>center</option><option>right</option>
        </select>
      </Row>
      <Row label="Background">
        <div className="flex items-center gap-2">
          <input placeholder="Image URL" value={bgImage || ""} onChange={(e) => onChange({ bgImage: e.target.value })} className="w-full rounded-xl border px-3 py-2" />
          <button onClick={onPickImage} className="rounded-xl border px-3 py-2 text-sm"><Upload className="mr-2 inline h-4 w-4" />Upload</button>
        </div>
      </Row>
      <Row label="Overlay">
        <input type="range" min={0} max={0.8} step={0.05} value={overlay}
          onChange={(e) => onChange({ overlay: Number(e.target.value) })} className="w-48" />
      </Row>
      <Row label="CTA Label"><input value={cta?.label || ""} onChange={(e) => onChange({ cta: { ...(cta || {}), label: e.target.value } })} className="w-full rounded-xl border px-3 py-2" /></Row>
      <Row label="CTA Link"><input value={cta?.href || ""} onChange={(e) => onChange({ cta: { ...(cta || {}), href: e.target.value } })} className="w-full rounded-xl border px-3 py-2" /></Row>
    </div>
  );
}

function CollectionEditor({ data, onChange }) {
  const { title, productIds, columns, showPrice, showCTA } = data;
  const setCols = (k, v) => onChange({ columns: { ...columns, [k]: v } });
  return (
    <div className="space-y-2">
      <Row label="Title"><input value={title || ""} onChange={(e) => onChange({ title: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></Row>
      <Row label="Products (IDs)"><input placeholder="id1,id2, id3" value={productIds.join(", ")} onChange={(e) => onChange({ productIds: e.target.value.split(/[,\s]+/).filter(Boolean) })} className="w-full rounded-xl border px-3 py-2" /></Row>
      <Row label="Columns">
        <div className="flex items-center gap-2">
          <Num label="base" value={columns.base} onChange={(v) => setCols("base", v)} />
          <Num label="sm" value={columns.sm} onChange={(v) => setCols("sm", v)} />
          <Num label="md" value={columns.md} onChange={(v) => setCols("md", v)} />
          <Num label="lg" value={columns.lg} onChange={(v) => setCols("lg", v)} />
        </div>
      </Row>
      <Row label="Show price"><input type="checkbox" checked={showPrice} onChange={(e) => onChange({ showPrice: e.target.checked })} /></Row>
      <Row label="Show button"><input type="checkbox" checked={showCTA} onChange={(e) => onChange({ showCTA: e.target.checked })} /></Row>
    </div>
  );
}
function Num({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="text-zinc-500">{label}</span>
      <input type="number" min={1} max={6} value={value} onChange={(e) => onChange(Number(e.target.value) || 1)} className="w-16 rounded-lg border px-2 py-1" />
    </label>
  );
}

function RichTextEditor({ data, onChange }) {
  const { html, align, maxWidth = 720 } = data;
  const editorRef = useRef(null);
  // Sentinel (not a valid html value) so the first effect run always paints
  // the initial content into the DOM instead of thinking nothing changed.
  const lastEmitted = useRef(undefined);

  // Only push `html` into the DOM when it changed for a reason other than
  // this editor's own onInput (e.g. switching sections, loading saved data).
  // Setting innerHTML unconditionally on every render wipes the DOM subtree
  // and resets the caret to the start on each keystroke.
  useEffect(() => {
    if (editorRef.current && html !== lastEmitted.current) {
      editorRef.current.innerHTML = html;
      lastEmitted.current = html;
    }
  }, [html]);

  const handleInput = (e) => {
    const next = e.currentTarget.innerHTML;
    lastEmitted.current = next;
    onChange({ html: next });
  };

  return (
    <div className="space-y-2">
      <Row label="Align">
        <select value={align} onChange={(e) => onChange({ align: e.target.value })} className="rounded-xl border px-2 py-1">
          <option>left</option><option>center</option><option>right</option>
        </select>
      </Row>
      <Row label="Max width (px)">
        <input type="number" value={maxWidth} onChange={(e) => onChange({ maxWidth: Number(e.target.value) || 720 })} className="w-32 rounded-xl border px-3 py-2" />
      </Row>
      <div className="rounded-xl border">
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          className="min-h-[120px] w-full rounded-xl p-3 text-sm"
          onInput={handleInput} />
      </div>
    </div>
  );
}

function FaqEditor({ data, onChange }) {
  const { items } = data;
  const set = (i, patch) => onChange({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border p-2">
          <Row label={`Q${i + 1}`}><input value={it.q} onChange={(e) => set(i, { q: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></Row>
          <Row label={`A${i + 1}`}><textarea value={it.a} onChange={(e) => set(i, { a: e.target.value })} className="h-20 w-full rounded-xl border px-3 py-2" /></Row>
          <div className="text-right">
            <button className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => onChange({ items: items.filter((_, idx) => idx !== i) })}>Remove</button>
          </div>
        </div>
      ))}
      <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => onChange({ items: [...items, { q: "New question", a: "Answer…" }] })}>Add FAQ</button>
    </div>
  );
}
