import React from "react";
import registry from "./registry";

// Hero render + editor
export function HeroRender({ section }) {
  const { title, subtitle, align, bgImage, overlay = 0.35, cta } = section.data;
  const justify = align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center";
  return (
    <section className="relative overflow-hidden rounded-2xl">
      {bgImage && <img src={bgImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
      <div className="relative z-10 grid min-h-[220px] place-items-center p-8">
        <div className={`flex w-full max-w-3xl flex-col gap-2 ${justify} text-white`}>
          <h2 className="text-3xl font-bold drop-shadow">{title}</h2>
          {subtitle && <p className="max-w-prose drop-shadow">{subtitle}</p>}
          {cta?.label && <a href={cta.href || "#"} className="mt-2 w-max rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow">{cta.label}</a>}
        </div>
      </div>
      <div className="absolute inset-0" style={{ background: "#000", opacity: overlay }} />
    </section>
  );
}

export function HeroEditor({ section, onPatch, onPickImage }) {
  const d = section.data;
  const patch = (p) => onPatch({ ...d, ...p });
  return (
    <div className="space-y-2">
      <div className="mb-2">Title<input value={d.title} onChange={(e) => patch({ title: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></div>
      <div className="mb-2">Subtitle<input value={d.subtitle || ""} onChange={(e) => patch({ subtitle: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></div>
      <div className="mb-2">Align<select value={d.align} onChange={(e) => patch({ align: e.target.value })} className="rounded-xl border px-2 py-1"><option>left</option><option>center</option><option>right</option></select></div>
      <div className="mb-2">Background<input value={d.bgImage || ""} onChange={(e) => patch({ bgImage: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></div>
      <div className="mb-2"><button className="rounded-xl border px-3 py-2" onClick={() => onPickImage?.()}>Upload</button></div>
      <div className="mb-2">Overlay<input type="range" min={0} max={0.8} step={0.05} value={d.overlay || 0.35} onChange={(e) => patch({ overlay: Number(e.target.value) })} className="w-48" /></div>
      <div className="mb-2">CTA label<input value={d.cta?.label || ""} onChange={(e) => patch({ cta: { ...(d.cta || {}), label: e.target.value } })} className="w-full rounded-xl border px-3 py-2" /></div>
      <div className="mb-2">CTA link<input value={d.cta?.href || ""} onChange={(e) => patch({ cta: { ...(d.cta || {}), href: e.target.value } })} className="w-full rounded-xl border px-3 py-2" /></div>
    </div>
  );
}

// Collection grid render + editor
export function CollectionRender({ section, products = [] }) {
  const { title, productIds = [], columns = { base: 1, sm: 2, md: 3, lg: 4 }, showPrice = true, showCTA = true } = section.data;
  const list = productIds && productIds.length ? products.filter((p) => productIds.includes(p.id)) : products;
  return (
    <section>
      {title && <h3 className="mb-2 text-lg font-semibold">{title}</h3>}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <a key={p.id} href={p.href || `#product/${p.id}`} className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
            {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="h-48 w-full object-cover" loading="lazy" />}
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

export function CollectionEditor({ section, onPatch }) {
  const d = section.data;
  const patch = (p) => onPatch({ ...d, ...p });
  return (
    <div className="space-y-2">
      <div className="mb-2">Title<input value={d.title || ""} onChange={(e) => patch({ title: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></div>
      <div className="mb-2">Products (IDs)<input value={(d.productIds || []).join(", ")} onChange={(e) => patch({ productIds: e.target.value.split(/[,\s]+/).filter(Boolean) })} className="w-full rounded-xl border px-3 py-2" /></div>
    </div>
  );
}

// Rich text render + editor
export function RichTextRender({ section }) {
  const { html, align, maxWidth = 720 } = section.data;
  const cls = align === "center" ? "mx-auto text-center" : align === "right" ? "ml-auto text-right" : "mr-auto text-left";
  return (
    <section className={`prose max-w-none ${cls}`} style={{ maxWidth }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

export function RichTextEditor({ section, onPatch }) {
  const d = section.data; const patch = (p) => onPatch({ ...d, ...p });
  return (
    <div className="space-y-2">
      <div className="mb-2">Align<select value={d.align} onChange={(e) => patch({ align: e.target.value })} className="rounded-xl border px-2 py-1"><option>left</option><option>center</option><option>right</option></select></div>
      <div className="mb-2">Max width (px)<input type="number" value={d.maxWidth || 720} onChange={(e) => patch({ maxWidth: Number(e.target.value) || 720 })} className="w-32 rounded-xl border px-3 py-2" /></div>
      <div className="rounded-xl border">
        <div contentEditable suppressContentEditableWarning className="min-h-[120px] w-full rounded-xl p-3 text-sm" onInput={(e) => patch({ html: e.currentTarget.innerHTML })} dangerouslySetInnerHTML={{ __html: d.html }} />
      </div>
    </div>
  );
}

// FAQ render + editor
export function FaqRender({ section }) {
  return (
    <section className="rounded-2xl border p-4">
      <h3 className="mb-2 text-lg font-semibold">FAQ</h3>
      <div className="divide-y">
        {section.data.items.map((it, idx) => (
          <details key={idx} className="py-2">
            <summary className="cursor-pointer text-sm font-medium">{it.q}</summary>
            <p className="mt-1 text-sm text-zinc-600">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FaqEditor({ section, onPatch }) {
  const d = section.data; const set = (i, p) => onPatch({ ...d, items: d.items.map((it, idx) => idx === i ? { ...it, ...p } : it) });
  return (
    <div className="space-y-2">
      {d.items.map((it, i) => (
        <div key={i} className="rounded-xl border p-2">
          <div className="mb-2">Q{`${i+1}`}<input value={it.q} onChange={(e) => set(i, { q: e.target.value })} className="w-full rounded-xl border px-3 py-2" /></div>
          <div className="mb-2">A{`${i+1}`}<textarea value={it.a} onChange={(e) => set(i, { a: e.target.value })} className="h-20 w-full rounded-xl border px-3 py-2" /></div>
          <div className="text-right"><button className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => onPatch({ ...d, items: d.items.filter((_, idx) => idx !== i) })}>Remove</button></div>
        </div>
      ))}
      <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => onPatch({ ...d, items: [...d.items, { q: "New question", a: "Answer…" }] })}>Add FAQ</button>
    </div>
  );
}

// Register built-ins
registry.register("hero", { label: "Hero banner", Render: HeroRender, Editor: HeroEditor });
registry.register("collection-grid", { label: "Collection grid", Render: CollectionRender, Editor: CollectionEditor });
registry.register("rich-text", { label: "Rich text", Render: RichTextRender, Editor: RichTextEditor });
registry.register("faq", { label: "FAQ", Render: FaqRender, Editor: FaqEditor });

export default registry;