import React, { useMemo, useRef, useState, useCallback } from "react";
import { Eye, Image as ImageIcon, GripVertical, Edit3, Check, X } from "lucide-react";

// Small utility: immutable array move
const move = (arr, from, to) => {
  const a = arr.slice();
  const [it] = a.splice(from, 1);
  a.splice(to, 0, it);
  return a;
};

// Generic list DnD (indexes)
function useDragList(onReorder) {
  const dragIndexRef = useRef(null);
  const overIndexRef = useRef(null);

  const dragStart = (index) => (e) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };
  const dragEnter = (index) => (e) => {
    overIndexRef.current = index;
  };
  const dragOver = (index) => (e) => {
    e.preventDefault(); // allow drop
    overIndexRef.current = index;
  };
  const drop = (list) => (e) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    const to = overIndexRef.current;
    dragIndexRef.current = null;
    overIndexRef.current = null;
    if (from == null || to == null || from === to) return;
    onReorder(list, from, to);
  };
  const dragEnd = () => {
    dragIndexRef.current = null;
    overIndexRef.current = null;
  };
  return { dragStart, dragEnter, dragOver, drop, dragEnd };
}

// Inline text editor (contenteditable with blur/enter save)
function InlineText({
  value,
  onChange,
  className,
  placeholder = "",
  singleLine = false,
  as = "div",
}) {
  const ref = useRef(null);
  const Tag = as;

  const handleInput = () => {
    const txt = ref.current?.innerText ?? "";
    onChange(txt);
  };
  const handleKeyDown = (e) => {
    if (singleLine && e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      className={className}
      data-placeholder={placeholder}
      aria-label={placeholder}
      onFocus={(e) => {
        if (!value) {
          // place caret at start but keep placeholder visible
        }
      }}
      style={{ outline: "none" }}
    >
      {value || ""}
    </Tag>
  );
}

// Section chrome (select, drag handle, quick actions)
function SectionToolbar({ selected, onSelect, dragHandleProps, children }) {
  return (
    <div
      className={[
        "relative rounded-2xl border",
        selected ? "border-pink-400 ring-2 ring-pink-300/40" : "border-zinc-200",
        "bg-white/95 dark:bg-zinc-900/90 shadow-sm overflow-hidden",
      ].join(" ")}
      onClick={onSelect}
    >
      <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
        <button
          {...dragHandleProps}
          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function StorefrontPreviewInteractive({
  data,
  setData,
  products = [],
  onPickSectionImage, // (sectionId) => void  (hook into your uploadSectionImage)
}) {
  const [selectedId, setSelectedId] = useState(null);

  // Section DnD
  const { dragStart, dragEnter, dragOver, drop, dragEnd } = useDragList(
    (list, from, to) => {
      setData((d) => ({
        ...d,
        pageSections: move(d.pageSections || [], from, to),
      }));
    }
  );

  const themeBg = (() => {
    if (data.theme.bgType === "color") return { background: data.theme.color || "#fff" };
    if (data.theme.bgType === "image")
      return {
        backgroundImage: `url(${data.theme.imageUrl || ""})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    const from = data.theme.gradientFrom || "#ec4899";
    const to = data.theme.gradientTo || "#8b5cf6";
    return { backgroundImage: `linear-gradient(90deg, ${from}, ${to})` };
  })();

  const visibleProducts =
    data.productDisplayMode === "all"
      ? products
      : products.filter((p) => (data.productIds || []).includes(p.id));

  // Product DnD (curated only). Use ids so order persists.
  const productIds = useMemo(
    () => (data.productDisplayMode === "curated" ? data.productIds || [] : visibleProducts.map((p) => p.id)),
    [data.productDisplayMode, data.productIds, visibleProducts]
  );

  const prodDnD = useDragList((list, from, to) => {
    // list is productIds
    if (data.productDisplayMode !== "curated") return;
    setData((d) => ({ ...d, productIds: move(list, from, to) }));
  });

  const updateSection = useCallback(
    (id, updater) => {
      setData((d) => ({
        ...d,
        pageSections: (d.pageSections || []).map((s) => (s.id === id ? { ...s, data: updater(s.data || {}) } : s)),
      }));
    },
    [setData]
  );

  const SectionHero = ({ s, index }) => {
    const d = s.data || {};
    const justify =
      d.align === "left" ? "items-start text-left" : d.align === "right" ? "items-end text-right" : "items-center text-center";

    return (
      <div
        role="listitem"
        draggable
        onDragStart={dragStart(index)}
        onDragEnter={dragEnter(index)}
        onDragOver={dragOver(index)}
        onDrop={drop(data.pageSections || [])}
        onDragEnd={dragEnd}
        className="relative"
      >
        <SectionToolbar
          selected={selectedId === s.id}
          onSelect={() => setSelectedId(s.id)}
          dragHandleProps={{ draggable: true, onDragStart: dragStart(index), onDragEnd: dragEnd }}
        >
          <div className="absolute right-2 top-2 z-10 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateSection(s.id, (prev) => ({ ...prev, align: prev.align === "left" ? "center" : prev.align === "center" ? "right" : "left" }));
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm"
              title="Toggle alignment"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPickSectionImage && onPickSectionImage(s.id);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm"
              title="Change background"
            >
              <ImageIcon className="h-4 w-4" /> Image
            </button>
          </div>
          <section className="relative overflow-hidden rounded-2xl">
            {d.bgImage ? (
              <img src={d.bgImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-zinc-100 text-zinc-400">
                <span className="text-xs">Click Image to set background</span>
              </div>
            )}
            <div className="relative z-10 grid min-h-[240px] place-items-center p-8">
              <div className={`flex w-full max-w-3xl flex-col gap-2 ${justify} text-white`}>
                <InlineText
                  value={d.title || "Hero heading…"}
                  onChange={(v) => updateSection(s.id, (prev) => ({ ...prev, title: v.slice(0, 90) }))}
                  className="text-3xl font-bold drop-shadow"
                  placeholder="Hero heading…"
                  singleLine
                />
                <InlineText
                  value={d.subtitle || ""}
                  onChange={(v) => updateSection(s.id, (prev) => ({ ...prev, subtitle: v.slice(0, 160) }))}
                  className="max-w-prose drop-shadow text-sm opacity-95"
                  placeholder="Optional subtitle…"
                />
                <div className="mt-2">
                  <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow">
                    {d?.cta?.label || "CTA button"}
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute inset-0" style={{ background: "#000", opacity: d.overlay ?? 0.35 }} />
          </section>
        </SectionToolbar>
      </div>
    );
  };

  const SectionGrid = ({ s, index }) => {
    const d = s.data || {};
    const colCls = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
    const list =
      d.productIds && d.productIds.length
        ? products.filter((p) => d.productIds.includes(p.id))
        : visibleProducts;

    // local ids for dnd
    const ids = d.productIds && d.productIds.length ? d.productIds : productIds;

    const onReorder = useDragList((listLocal, from, to) => {
      const nextIds = move(listLocal, from, to);
      if (d.productIds && d.productIds.length) {
        updateSection(s.id, (prev) => ({ ...prev, productIds: nextIds }));
      } else if (data.productDisplayMode === "curated") {
        setData((d0) => ({ ...d0, productIds: nextIds }));
      }
    });

    return (
      <div
        role="listitem"
        draggable
        onDragStart={dragStart(index)}
        onDragEnter={dragEnter(index)}
        onDragOver={dragOver(index)}
        onDrop={drop(data.pageSections || [])}
        onDragEnd={dragEnd}
      >
        <SectionToolbar
          selected={selectedId === s.id}
          onSelect={() => setSelectedId(s.id)}
          dragHandleProps={{ draggable: true, onDragStart: dragStart(index), onDragEnd: dragEnd }}
        >
          <section className="rounded-2xl p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <InlineText
                value={d.title || "Collection"}
                onChange={(v) => updateSection(s.id, (prev) => ({ ...prev, title: v.slice(0, 80) }))}
                className="text-lg font-semibold"
                placeholder="Collection title…"
                singleLine
              />
              <div className="flex items-center gap-2 text-xs">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={!!d.showPrice}
                    onChange={(e) =>
                      updateSection(s.id, (prev) => ({ ...prev, showPrice: e.target.checked }))
                    }
                  />
                  Price
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={!!d.showCTA}
                    onChange={(e) => updateSection(s.id, (prev) => ({ ...prev, showCTA: e.target.checked }))}
                  />
                  CTA
                </label>
              </div>
            </div>

            <div className={`gap-3 ${colCls}`}>
              {ids.map((pid, i) => {
                const p = products.find((x) => x.id === pid) || list.find((x) => x.id === pid) || list[i];
                if (!p) return null;
                return (
                  <div
                    key={pid}
                    draggable
                    onDragStart={onReorder.dragStart(i)}
                    onDragEnter={onReorder.dragEnter(i)}
                    onDragOver={onReorder.dragOver(i)}
                    onDrop={onReorder.drop(ids)}
                    onDragEnd={onReorder.dragEnd}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                    title="Drag to reorder product"
                  >
                    <div className="absolute left-2 top-2 z-10 hidden rounded-md border bg-white px-1.5 py-1 text-[10px] text-zinc-600 shadow-sm group-hover:block">
                      <GripVertical className="h-3.5 w-3.5" />
                    </div>
                    {p?.imageUrl ? (
                      <img src={p.imageUrl} alt={p.title} className="h-40 w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center bg-zinc-100">
                        <ImageIcon className="h-6 w-6 text-zinc-400" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="line-clamp-2 text-sm font-semibold">{p?.title || "Untitled"}</div>
                      {!!d.showPrice && (
                        <div className="mt-1 text-pink-600">£{p?.price?.toFixed?.(2) ?? "-"}</div>
                      )}
                      {!!d.showCTA && <div className="mt-1 text-[11px] text-zinc-500">View details →</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </SectionToolbar>
      </div>
    );
  };

  const SectionRich = ({ s, index }) => {
    const d = s.data || {};
    const cls =
      d.align === "center"
        ? "mx-auto text-center"
        : d.align === "right"
        ? "ml-auto text-right"
        : "mr-auto text-left";

    return (
      <div
        role="listitem"
        draggable
        onDragStart={dragStart(index)}
        onDragEnter={dragEnter(index)}
        onDragOver={dragOver(index)}
        onDrop={drop(data.pageSections || [])}
        onDragEnd={dragEnd}
      >
        <SectionToolbar
          selected={selectedId === s.id}
          onSelect={() => setSelectedId(s.id)}
          dragHandleProps={{ draggable: true, onDragStart: dragStart(index), onDragEnd: dragEnd }}
        >
          <section className={`rounded-2xl p-4 ${cls}`} style={{ maxWidth: d.maxWidth || 720 }}>
            <InlineText
              value={d.html?.replace?.(/<[^>]+>/g, "") || "Start writing…"}
              onChange={(v) => updateSection(s.id, (prev) => ({ ...prev, html: `<p>${v}</p>` }))}
              className="prose max-w-none text-sm"
              placeholder="Rich text…"
            />
            <div className="mt-2 flex justify-center gap-2 text-xs">
              <button
                className="rounded-lg border px-2 py-1"
                onClick={(e) => {
                  e.stopPropagation();
                  updateSection(s.id, (prev) => ({ ...prev, align: "left" }));
                }}
              >
                Left
              </button>
              <button
                className="rounded-lg border px-2 py-1"
                onClick={(e) => {
                  e.stopPropagation();
                  updateSection(s.id, (prev) => ({ ...prev, align: "center" }));
                }}
              >
                Center
              </button>
              <button
                className="rounded-lg border px-2 py-1"
                onClick={(e) => {
                  e.stopPropagation();
                  updateSection(s.id, (prev) => ({ ...prev, align: "right" }));
                }}
              >
                Right
              </button>
            </div>
          </section>
        </SectionToolbar>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Top chrome */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
        <div className="flex items-center gap-2 font-semibold">
          <Eye className="h-4 w-4" /> Live Preview (interactive)
        </div>
        <div className="text-[11px] text-zinc-500">
          Tip: drag section handles to reorder. Click text to edit.
        </div>
      </div>

      {/* Masthead */}
      <div className="h-40 w-full" style={themeBg} />
      {data.bannerUrl && (
        <img
          src={data.bannerUrl}
          alt="Banner"
          className="-mt-24 mx-auto h-40 w-40 rounded-2xl border-4 border-white object-cover shadow-md"
        />
      )}

      {/* Header info */}
      <div className="mx-auto max-w-4xl p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <InlineText
              value={data.displayName || "Your Display Name"}
              onChange={(v) => setData((d) => ({ ...d, displayName: v.slice(0, 60) }))}
              className="text-2xl font-bold"
              placeholder="Display name…"
              singleLine
            />
            <InlineText
              value={data.bio || ""}
              onChange={(v) => setData((d) => ({ ...d, bio: v.slice(0, 240) }))}
              className="text-sm opacity-80"
              placeholder="Short bio…"
            />
          </div>
          <a
            href="#products"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
          >
            <Eye className="h-4 w-4" /> View products
          </a>
        </div>

        {/* Editable sections */}
        <div className="mt-6 space-y-6">
          {(data.pageSections || []).map((s, i) => {
            if (s.type === "hero") return <SectionHero key={s.id} s={s} index={i} />;
            if (s.type === "collection-grid") return <SectionGrid key={s.id} s={s} index={i} />;
            if (s.type === "rich-text") return <SectionRich key={s.id} s={s} index={i} />;
            return null;
          })}
        </div>

        {/* Products (also draggable when curated) */}
        <h2 id="products" className="mt-8 text-lg font-semibold">
          Products
        </h2>
        <div
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
          onDrop={prodDnD.drop(productIds)}
          onDragOver={prodDnD.dragOver(0)}
        >
          {productIds.map((pid, i) => {
            const p = products.find((x) => x.id === pid);
            if (!p) return null;
            return (
              <div
                key={pid}
                draggable={data.productDisplayMode === "curated"}
                onDragStart={prodDnD.dragStart(i)}
                onDragEnter={prodDnD.dragEnter(i)}
                onDragOver={prodDnD.dragOver(i)}
                onDrop={prodDnD.drop(productIds)}
                onDragEnd={prodDnD.dragEnd}
                className="group relative block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                title={data.productDisplayMode === "curated" ? "Drag to reorder" : undefined}
              >
                {data.productDisplayMode === "curated" && (
                  <div className="absolute left-2 top-2 z-10 hidden rounded-md border bg-white px-1.5 py-1 text-[10px] text-zinc-600 shadow-sm group-hover:block">
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                )}
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="h-48 w-full object-cover" />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center bg-zinc-100">
                    <ImageIcon className="h-8 w-8 text-zinc-400" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="text-lg font-bold text-pink-600 dark:text-pink-400">
                    £{p.price?.toFixed?.(2) ?? "-"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
