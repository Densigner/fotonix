import React, { useEffect, useRef, useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Settings2,
  Trash2,
  Copy,
  GripVertical,
  LayoutTemplate,
  Upload,
  Image as ImageIcon,
  Type,
  LayoutGrid,
  HelpCircle,
} from "lucide-react";

import { Button } from "../shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card";
import { Separator } from "../shared/ui/separator";
import { Input, Label, Switch, Textarea, ScrollArea, Badge } from "../shared/ui/inlineFallbacks";
import { createSection, uid } from "../shared/sections";
// Reusing the exact device-preview toggle from the Funnel Builder for visual
// and behavioral parity — see src/Bible/store-builder (this rebuild) and
// src/Bible/funnel-builder/architecture.md for why these two editors are
// meant to share the same editing paradigm.
import { CompactControls } from "../marketing/funnelBuilder/FunnelBuilder";

/* =========================================================================
 * Block renderers — the single source of truth for what a section looks
 * like. AffiliateShopBuilderPage.js's RenderSections (used by both the
 * public /@handle page and elsewhere) calls these same components, so the
 * canvas here and the real storefront can never drift apart.
 * ========================================================================= */

export function HeroRenderer({ data }) {
  const { title, subtitle, align, bgImage, overlay = 0.35, cta } = data;
  const justify = align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center";
  return (
    <section className="relative overflow-hidden rounded-2xl">
      {bgImage && <img src={bgImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
      <div className="relative z-10 grid min-h-[220px] place-items-center p-8">
        <div className={`flex w-full max-w-3xl flex-col gap-2 ${justify} text-white`}>
          <h2 className="text-3xl font-bold drop-shadow">{title}</h2>
          {subtitle && <p className="max-w-prose drop-shadow">{subtitle}</p>}
          {cta?.label && <a href={cta.href || "#"} className="mt-2 w-max rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow"> {cta.label} </a>}
        </div>
      </div>
      <div className="absolute inset-0" style={{ background: "#000", opacity: overlay }} />
    </section>
  );
}

export function CollectionGridRenderer({ data, fullProducts }) {
  // Firebase RTDB prunes empty arrays on write, so a saved section with no
  // product IDs reloads with `productIds` missing, not [].
  const { title, productIds = [], showPrice, showCTA } = data;
  const list = productIds.length ? (fullProducts || []).filter((p) => productIds.includes(p.id)) : [];
  return (
    <section>
      {title && <h3 className="mb-2 text-lg font-semibold">{title}</h3>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <a key={p.id} href={p.href || `#product/${p.id}`} className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
            {(() => {
              const idx = p.mainImageIndex ?? 0;
              const fallback = p.images && p.images[idx] ? p.images[idx].url : undefined;
              const src = p.imageUrl || fallback;
              return src ? <img src={src} alt={p.title} className="h-48 w-full object-cover" loading="lazy" /> : null;
            })()}
            <div className="p-4">
              <h4 className="line-clamp-2 text-sm font-semibold">{p.title}</h4>
              {showPrice && <div className="mt-1 text-pink-600">£{p.price?.toFixed?.(2) ?? "-"}</div>}
              {showCTA && <div className="mt-2 text-xs text-zinc-500">View details →</div>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function RichTextRenderer({ data }) {
  const { html, align, maxWidth = 720 } = data;
  const cls = align === "center" ? "mx-auto text-center" : align === "right" ? "ml-auto text-right" : "mr-auto text-left";
  return (
    <section className={`prose max-w-none ${cls}`} style={{ maxWidth }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

export function FaqRenderer({ data }) {
  // Same RTDB-prunes-empty-arrays issue as collection-grid above.
  const faqItems = data.items || [];
  if (!faqItems.length) return null;
  return (
    <section className="rounded-2xl border p-4">
      <h3 className="mb-2 text-lg font-semibold">FAQ</h3>
      <div className="divide-y">
        {faqItems.map((it, idx) => (
          <details key={idx} className="py-2">
            <summary className="cursor-pointer text-sm font-medium">{it.q}</summary>
            <p className="mt-1 text-sm text-zinc-600">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* =========================================================================
 * Inspectors — the property forms shown in the left panel when a block is
 * selected. Editing lives here, not inline in the canvas.
 * ========================================================================= */

const Field = ({ label, children }) => (
  <div className="space-y-1">
    <Label className="text-xs uppercase tracking-wider text-gray-600">{label}</Label>
    {children}
  </div>
);
const ToggleField = ({ label, checked, onCheckedChange }) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <Label className="text-sm text-gray-700">{label}</Label>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);
const AlignField = ({ align, onChange }) => (
  <Field label="Align">
    <div className="flex gap-2">
      {["left", "center", "right"].map((al) => (
        <Button key={al} size="sm" variant={align === al ? "default" : "outline"} className="text-black" onClick={() => onChange(al)}>{al}</Button>
      ))}
    </div>
  </Field>
);

function HeroInspector({ data, onChange, onPickImage }) {
  const { title, subtitle, align, bgImage, overlay = 0.35, cta } = data;
  return (
    <div className="space-y-4">
      <Field label="Title"><Input value={title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtitle"><Input value={subtitle || ""} onChange={(e) => onChange({ subtitle: e.target.value })} /></Field>
      <AlignField align={align} onChange={(al) => onChange({ align: al })} />
      <Field label="Background image">
        <div className="flex items-center gap-2">
          <Input placeholder="Image URL" value={bgImage || ""} onChange={(e) => onChange({ bgImage: e.target.value })} />
          {onPickImage && (
            <Button size="sm" variant="outline" className="shrink-0 text-black" onClick={onPickImage}>
              <Upload className="mr-1 inline h-3 w-3" />Upload
            </Button>
          )}
        </div>
      </Field>
      <Field label="Overlay darkness">
        <input type="range" min={0} max={0.8} step={0.05} value={overlay} onChange={(e) => onChange({ overlay: Number(e.target.value) })} className="w-full" />
      </Field>
      <Field label="CTA label"><Input value={cta?.label || ""} onChange={(e) => onChange({ cta: { ...(cta || {}), label: e.target.value } })} /></Field>
      <Field label="CTA link"><Input value={cta?.href || ""} onChange={(e) => onChange({ cta: { ...(cta || {}), href: e.target.value } })} /></Field>
    </div>
  );
}

function CollectionGridInspector({ data, onChange }) {
  const { title, productIds = [], columns, showPrice, showCTA } = data;
  const setCols = (k, v) => onChange({ columns: { ...columns, [k]: v } });
  return (
    <div className="space-y-4">
      <Field label="Title"><Input value={title || ""} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Product IDs">
        <Input
          placeholder="id1, id2, id3"
          value={productIds.join(", ")}
          onChange={(e) => onChange({ productIds: e.target.value.split(/[,\s]+/).filter(Boolean) })}
        />
      </Field>
      <Field label="Columns">
        <div className="grid grid-cols-4 gap-2">
          {["base", "sm", "md", "lg"].map((k) => (
            <label key={k} className="flex flex-col items-center gap-1 text-xs text-gray-600">
              {k}
              <input
                type="number"
                min={1}
                max={6}
                value={columns?.[k] ?? 1}
                onChange={(e) => setCols(k, Number(e.target.value) || 1)}
                className="w-full rounded-md border border-gray-200 px-1 py-1 text-center"
              />
            </label>
          ))}
        </div>
      </Field>
      <ToggleField label="Show price" checked={showPrice} onCheckedChange={(v) => onChange({ showPrice: v })} />
      <ToggleField label="Show button" checked={showCTA} onCheckedChange={(v) => onChange({ showCTA: v })} />
    </div>
  );
}

function RichTextInspector({ data, onChange }) {
  const { html, align, maxWidth = 720 } = data;
  const editorRef = useRef(null);
  // Sentinel (not a valid html value) so the first effect run always paints
  // the initial content; afterwards only external changes (not this
  // editor's own typing) get pushed into the DOM. Setting innerHTML
  // unconditionally on every render would wipe the caret back to position 0
  // on every keystroke — see StoreCanvasBuilder's git history for the bug
  // this pattern fixes.
  const lastEmitted = useRef(undefined);

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
    <div className="space-y-4">
      <AlignField align={align} onChange={(al) => onChange({ align: al })} />
      <Field label="Max width (px)">
        <Input type="number" value={maxWidth} onChange={(e) => onChange({ maxWidth: Number(e.target.value) || 720 })} />
      </Field>
      <Field label="Text">
        <div className="rounded-md border border-gray-200">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[120px] w-full rounded-md p-3 text-sm"
            onInput={handleInput}
          />
        </div>
      </Field>
    </div>
  );
}

function FaqInspector({ data, onChange }) {
  const items = data.items || [];
  const setItem = (i, patch) => onChange({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-md border border-gray-200 p-2">
          <Field label={`Question ${i + 1}`}><Input value={it.q} onChange={(e) => setItem(i, { q: e.target.value })} /></Field>
          <Field label={`Answer ${i + 1}`}><Textarea value={it.a} onChange={(e) => setItem(i, { a: e.target.value })} className="h-20 w-full rounded-md border border-gray-200 p-2" /></Field>
          <div className="text-right">
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => onChange({ items: items.filter((_, idx) => idx !== i) })}>Remove</Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" className="text-black" onClick={() => onChange({ items: [...items, { q: "New question", a: "Answer…" }] })}>Add FAQ</Button>
    </div>
  );
}

/* =========================================================================
 * SHOP_BLOCKS registry — mirrors Funnel Builder's BLOCKS registry shape
 * (name/icon/Renderer/Inspector) so both editors work the same way.
 * ========================================================================= */

export const SHOP_BLOCKS = {
  hero: { name: "Hero", icon: ImageIcon, Renderer: HeroRenderer, Inspector: HeroInspector },
  "collection-grid": { name: "Collection Grid", icon: LayoutGrid, Renderer: CollectionGridRenderer, Inspector: CollectionGridInspector },
  "rich-text": { name: "Rich Text", icon: Type, Renderer: RichTextRenderer, Inspector: RichTextInspector },
  faq: { name: "FAQ", icon: HelpCircle, Renderer: FaqRenderer, Inspector: FaqInspector },
};

/* =========================================================================
 * Canvas plumbing — drag/select wrapper, adapted from FunnelBuilder.js's
 * own SortableItem (dnd-kit). Small enough that duplicating it here is
 * simpler than cross-importing a non-exported function from that file.
 * ========================================================================= */

function SortableItem({ id, children, selected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border bg-white hover:bg-gray-50 ${selected ? "border-fuchsia-500 ring-2 ring-fuchsia-500" : "border-zinc-200"}`}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      {...attributes}
    >
      <div {...listeners} className="absolute left-2 top-2 z-10 cursor-grab opacity-60 group-hover:opacity-100" title="Drag">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* =========================================================================
 * Main editor
 * ========================================================================= */

export default function StoreCanvasBuilder({ value = [], onChange, onPickImage, products = [] }) {
  const [selectedId, setSelectedId] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor)
  );

  const blocks = Array.isArray(value) ? value : [];
  const selectedBlock = blocks.find((b) => b.id === selectedId);
  const selectedDef = selectedBlock ? SHOP_BLOCKS[selectedBlock.type] : null;
  const activeBlock = blocks.find((b) => b.id === activeId);
  const activeDef = activeBlock ? SHOP_BLOCKS[activeBlock.type] : null;

  const addBlock = (type) => {
    if (typeof onChange !== "function") return;
    onChange([...blocks, createSection(type)]);
  };
  const updateBlock = (id, patch) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, data: { ...b.data, ...patch } } : b)));
  };
  const remove = (id) => {
    onChange(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const duplicate = (id) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const original = blocks[idx];
    const copy = { ...original, id: uid(original.type), data: { ...original.data } };
    const next = [...blocks];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  const handleDragStart = (e) => setActiveId(e.active.id);
  const handleDragEnd = (e) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  };

  const containerWidth = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "380px";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Page sections</h3>
        <CompactControls device={device} setDevice={setDevice} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left: block palette, or the selected block's Inspector */}
        <Card className="h-[calc(100vh-260px)] overflow-hidden border border-zinc-200">
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {selectedId ? <Settings2 className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
              {selectedId ? "Inspector" : "Blocks"}
            </CardTitle>
            {selectedId && (
              <Button size="sm" variant="outline" className="text-black" onClick={() => setSelectedId(null)}>
                Show Blocks
              </Button>
            )}
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-320px)] p-3">
              {selectedId && selectedDef ? (
                <div className="space-y-3 p-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{selectedDef.name}</h4>
                    <Badge>{selectedBlock.type}</Badge>
                  </div>
                  <selectedDef.Inspector
                    data={selectedBlock.data}
                    onChange={(patch) => updateBlock(selectedBlock.id, patch)}
                    onPickImage={onPickImage ? () => onPickImage(selectedBlock.id) : undefined}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(SHOP_BLOCKS).map(([key, def]) => (
                    <button
                      key={key}
                      type="button"
                      className="group rounded-xl border border-gray-200 p-3 text-left transition hover:bg-gray-50"
                      onClick={() => addBlock(key)}
                    >
                      <div className="flex items-center gap-2">
                        <def.icon className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium">{def.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">Add {def.name} block</p>
                      <span className="mt-2 inline-flex items-center text-xs text-fuchsia-600 opacity-0 group-hover:opacity-100">
                        Add <Plus className="ml-1 h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: canvas */}
        <Card className="relative h-[calc(100vh-260px)] overflow-hidden border border-zinc-200">
          <CardContent className="h-full p-0">
            <div className="relative flex h-full items-start overflow-auto bg-white">
              <div className="relative mx-auto h-full w-full overflow-y-auto" style={{ width: containerWidth }}>
                <div className="min-h-full border border-gray-200">
                  <div className="space-y-6 p-6">
                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
                      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                        {blocks.map((block) => {
                          const def = SHOP_BLOCKS[block.type];
                          if (!def) return null;
                          const Renderer = def.Renderer;
                          return (
                            <SortableItem key={block.id} id={block.id} selected={selectedId === block.id} onSelect={() => setSelectedId(block.id)}>
                              <Renderer data={block.data} fullProducts={products} />
                              <div className="mt-3 flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" className="text-black" onClick={() => duplicate(block.id)}>
                                  <Copy className="mr-1 h-3 w-3" /> Duplicate
                                </Button>
                                <Button variant="outline" size="sm" className="text-red-600" onClick={() => remove(block.id)}>
                                  <Trash2 className="mr-1 h-3 w-3" /> Remove
                                </Button>
                              </div>
                            </SortableItem>
                          );
                        })}

                        {blocks.length === 0 && (
                          <div className="py-20 text-center text-gray-500">Add blocks from the left to start building.</div>
                        )}
                      </SortableContext>

                      <DragOverlay>
                        {activeBlock && activeDef ? (
                          <div className="rounded-xl border bg-white p-4 opacity-90 shadow-xl">
                            <activeDef.Renderer data={activeBlock.data} fullProducts={products} />
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
