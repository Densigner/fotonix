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
  Heading as HeadingIcon,
  Rows3,
  Link as LinkIconLucide,
  Quote,
  Star,
  Columns3,
  ChevronDown,
  Truck,
  Shield,
  RotateCcw,
  Award,
  Zap,
  Headphones,
  CreditCard,
  Check,
} from "lucide-react";

import { Button } from "../shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card";
import { Separator } from "../shared/ui/separator";
import { Input, Label, Switch, Textarea, ScrollArea, Badge } from "../shared/ui/inlineFallbacks";
import { createSection, uid } from "../shared/sections";
// Reusing the exact device-preview toggle and CTA/action system from the
// Funnel Builder for visual and behavioral parity — see
// src/Bible/funnel-builder/architecture.md for why these two editors are
// meant to share the same editing paradigm and the same "link / mailing
// list / follow / shop / product" click-action logic rather than each
// maintaining its own.
import { CompactControls, ActionFields, CtaAction, SubscribeInlineForm, ClickableImage } from "../marketing/funnelBuilder/FunnelBuilder";
import { deriveThemeVars, useGoogleFont, toneStyle, Media } from "./theme";
import { EndorsedWidget, ENDORSED_WIDGET_TYPES } from "../shared/endorsedWidget";

// Blocks with no explicit tone stay exactly as they were (no padding added,
// nothing to regress) -- a muted/contrast band needs its own breathing room
// so text isn't flush against the color change, which blocks that already
// carry their own padding (faq, testimonial) handle themselves instead of
// picking this up too.
const toneClass = (tone) => (tone && tone !== "default" ? "rounded-[var(--radius)] p-6 md:p-10" : "");

/* =========================================================================
 * Block renderers — the single source of truth for what a section looks
 * like. AffiliateShopBuilderPage.js's RenderSections (used by both the
 * public /@handle page and elsewhere) calls these same components, so the
 * canvas here and the real storefront can never drift apart.
 * ========================================================================= */

// editable is also (ab)used here as "is this the real public page or the
// editor's own boxed device-preview canvas": the storefront page wraps
// everything in a centered max-width column for readable text, which also
// flattened hero banners into a letterboxed strip instead of a real
// edge-to-edge hero. Breaks out to full viewport width only when it's not
// sitting inside the canvas's own simulated device frame, where "full
// width" would just mean "wider than the frame" and look broken.
export function HeroRenderer({ data, editable }) {
  const { title, subtitle, align, bgImage, overlay = 0.35, cta, variant = "full-bleed", tone } = data;
  const justify = align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center";
  const textAlign = align === "left" ? "left" : align === "right" ? "right" : "center";

  const ctaButton = cta?.label && (
    <a
      href={cta.href || "#"}
      style={{ background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: "var(--radius)" }}
      className="mt-2 inline-block w-max px-5 py-3 text-sm font-semibold shadow-sm transition hover:brightness-110"
    >
      {cta.label}
    </a>
  );

  // Portrait or busy images read better split beside the text than
  // underneath it with an overlay fighting for contrast.
  if (variant === "split") {
    return (
      <section className="grid grid-cols-1 items-center gap-8 rounded-none py-6 md:grid-cols-2" style={toneStyle(tone)}>
        <div className={`flex flex-col gap-4 ${justify}`} style={{ textAlign }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: "var(--heading-weight)", letterSpacing: "var(--heading-tracking)", color: tone === "contrast" ? "inherit" : "var(--text)" }} className="text-3xl md:text-4xl">{title}</h2>
          {subtitle && <p style={{ fontFamily: "var(--font-body)", color: tone === "contrast" ? "inherit" : "var(--muted-text)" }} className="max-w-prose text-lg">{subtitle}</p>}
          {ctaButton}
        </div>
        {bgImage && <img src={bgImage} alt="" style={{ borderRadius: "var(--radius)" }} className="aspect-[4/5] w-full object-cover md:aspect-square" loading="lazy" />}
      </section>
    );
  }

  // editable is also (ab)used here as "is this the real public page or the
  // editor's own boxed device-preview canvas": the storefront page wraps
  // everything in a centered max-width column for readable text, which also
  // flattened hero banners into a letterboxed strip instead of a real
  // edge-to-edge hero. Breaks out to full viewport width only when it's not
  // sitting inside the canvas's own simulated device frame, where "full
  // width" would just mean "wider than the frame" and look broken.
  const bleed = editable ? "" : "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]";
  return (
    <section className={`relative overflow-hidden ${bleed}`} style={{ borderRadius: editable ? "var(--radius)" : 0, ...(bgImage ? {} : toneStyle(tone)) }}>
      {bgImage && <img src={bgImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
      <div className="relative z-10 grid min-h-[320px] place-items-center p-10">
        <div className={`flex w-full max-w-3xl flex-col gap-3 ${justify}`} style={{ textAlign, color: bgImage ? "#fff" : tone === "contrast" ? "inherit" : "var(--text)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: "var(--heading-weight)", letterSpacing: "var(--heading-tracking)" }} className="text-4xl drop-shadow md:text-5xl">{title}</h2>
          {subtitle && <p style={{ fontFamily: "var(--font-body)" }} className="max-w-prose text-lg drop-shadow">{subtitle}</p>}
          {ctaButton}
        </div>
      </div>
      {bgImage && <div className="absolute inset-0" style={{ background: "#000", opacity: overlay }} />}
    </section>
  );
}

// Some designer product types route to a special affiliate page instead of
// the generic product page; everything else goes to the real, owner-scoped
// product URL. Ported from AffiliateStorefrontViewer's old hardcoded grid so
// this behavior isn't lost now that collection-grid is the only product
// grid — a bare `#product/{id}` hash (the old default) doesn't resolve to
// anything real.
//
// These checks used to read `p.typeId`, but AffiliateCreateProduct.js (the
// Create Product modal) actually saves the chosen template under
// `templateId` — `typeId` is never set anywhere in the codebase, so this
// only ever matched via the title-text fallback below, never via the field
// it looks like it's checking. Fixed to read the real field.
function resolveProductClick(p, ownerUid) {
  const title = (p.title || "").toLowerCase();
  if ((title.includes("fotonix") && title.includes("light up")) || p.templateId === "lumina-cut-user" || p.templateId === "light-up-user") {
    return () => { window.location.hash = "affiliate-product-accryl"; };
  }
  if (p.templateId === "lumina-mirror-user") {
    // #product, not #standard-mirror-designer -- ProductPageClean.js (the
    // page that hash actually renders, per App.js) is the real, already-
    // live Lumina Mirror designer every other customer on the site already
    // reaches from the homepage. StandardMirrorDesigner.js is a separate,
    // currently-unlinked-from-anywhere rebuild of the same tool; routing
    // here instead avoids affiliate-storefront traffic landing on a
    // different, less-tested copy of the same experience. Neither page
    // actually takes a product-id prop (ProductPageClean's own component
    // function takes no props at all), so a bare hash jump is correct --
    // there's nothing to pass.
    return () => { window.location.hash = "product"; };
  }
  if (ownerUid) {
    return () => { window.location.href = `${window.location.origin}/product/${ownerUid}/${p.id}`; };
  }
  return undefined;
}

function ProductCardLink({ p, showPrice, showCTA, ownerUid, variant = "grid" }) {
  const idx = p.mainImageIndex ?? 0;
  const fallback = p.images && p.images[idx] ? p.images[idx].url : undefined;
  const src = p.imageUrl || fallback;
  const onNavigate = resolveProductClick(p, ownerUid);
  const clickProps = onNavigate ? { onClick: (e) => { e.preventDefault(); onNavigate(); } } : {};

  if (variant === "editorial-list") {
    return (
      <a href={p.href || "#"} {...clickProps} className="group flex flex-col gap-3">
        <div className="overflow-hidden" style={{ borderRadius: "var(--radius)" }}>
          {src ? <img src={src} alt={p.title} className="aspect-[4/5] w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" /> : null}
        </div>
        <div>
          <h4 style={{ fontFamily: "var(--font-display)", color: "var(--text)" }} className="text-lg font-medium">{p.title}</h4>
          {showPrice && <div style={{ color: "var(--muted-text)" }} className="mt-1 text-sm">£{p.price?.toFixed?.(2) ?? "-"}</div>}
          {showCTA && <div style={{ color: "var(--accent)" }} className="mt-2 text-xs font-medium">View details →</div>}
        </div>
      </a>
    );
  }

  return (
    <a
      href={p.href || "#"}
      {...clickProps}
      style={{ background: "var(--surface)", borderColor: "var(--border)", borderRadius: "var(--radius)" }}
      className="group block overflow-hidden border shadow-sm transition hover:shadow-md"
    >
      {src ? <img src={src} alt={p.title} className="h-48 w-full object-cover" loading="lazy" /> : null}
      <div className="p-4">
        <h4 style={{ fontFamily: "var(--font-body)", color: "var(--text)" }} className="line-clamp-2 text-sm font-semibold">{p.title}</h4>
        {showPrice && <div style={{ color: "var(--accent)" }} className="mt-1 font-medium">£{p.price?.toFixed?.(2) ?? "-"}</div>}
        {showCTA && <div style={{ color: "var(--muted-text)" }} className="mt-2 text-xs">View details →</div>}
      </div>
    </a>
  );
}

export function CollectionGridRenderer({ data, fullProducts, ownerUid }) {
  // Firebase RTDB prunes empty arrays on write, so a saved section with no
  // product IDs reloads with `productIds` missing, not [].
  const { title, productIds = [], showPrice, showCTA, displayMode = "curated", featured, featuredProductId, variant = "grid", tone } = data;
  const all = fullProducts || [];
  const ordered = displayMode === "all" ? all : productIds.map((id) => all.find((p) => p?.id === id)).filter(Boolean);
  const featuredProduct = featured
    ? (featuredProductId && ordered.find((p) => p.id === featuredProductId)) || ordered[0]
    : null;
  const gridProducts = featuredProduct ? ordered.filter((p) => p.id !== featuredProduct.id) : ordered;
  // auto-fit/minmax instead of fixed breakpoint column counts: a fixed
  // `grid-cols-4` grid with a single product only fills one of four column
  // tracks, leaving the rest of the row empty instead of stretching to
  // fill it. auto-fit collapses unused tracks, so one product spans the
  // full row and multiple products wrap the same as before.
  const gridCls = variant === "editorial-list"
    ? "grid gap-x-8 gap-y-10 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]"
    : "grid gap-3 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]";

  return (
    <section className={toneClass(tone)} style={toneStyle(tone)}>
      {title && <h3 style={{ fontFamily: "var(--font-display)", color: "inherit", fontWeight: "var(--heading-weight)" }} className="mb-4 text-2xl">{title}</h3>}
      {featuredProduct && (
        <div className="mb-6">
          <ProductCardLink p={featuredProduct} showPrice={showPrice} showCTA={showCTA} ownerUid={ownerUid} variant={variant} />
        </div>
      )}
      <div className={gridCls}>
        {gridProducts.map((p) => <ProductCardLink key={p.id} p={p} showPrice={showPrice} showCTA={showCTA} ownerUid={ownerUid} variant={variant} />)}
      </div>
    </section>
  );
}

export function RichTextRenderer({ data }) {
  const { html, align, maxWidth = 720, tone } = data;
  const cls = align === "center" ? "mx-auto text-center" : align === "right" ? "ml-auto text-right" : "mr-auto text-left";
  return (
    <section className={`prose max-w-none ${cls} ${toneClass(tone)}`} style={{ maxWidth, fontFamily: "var(--font-body)", color: "inherit", ...toneStyle(tone) }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

export function FaqRenderer({ data }) {
  // Same RTDB-prunes-empty-arrays issue as collection-grid above.
  const faqItems = data.items || [];
  if (!faqItems.length) return null;
  const { tone = "muted" } = data;
  return (
    <section style={{ borderColor: "var(--border)", borderRadius: "var(--radius)", ...toneStyle(tone) }} className="border p-6">
      {/* Native <details> marker killed in favor of a real rotating chevron
          -- the default browser triangle reads as instantly unstyled.
          list-none handles Chrome/Firefox, the webkit rule handles Safari. */}
      <style>{".fx-faq summary{list-style:none}.fx-faq summary::-webkit-details-marker{display:none}.fx-faq details[open] .fx-chevron{transform:rotate(180deg)}"}</style>
      <h3 style={{ fontFamily: "var(--font-display)", color: "inherit", fontWeight: "var(--heading-weight)" }} className="mb-3 text-xl">Frequently asked questions</h3>
      <div style={{ borderColor: "var(--border)" }} className="fx-faq divide-y">
        {faqItems.map((it, idx) => (
          <details key={idx} className="py-3">
            <summary style={{ fontFamily: "var(--font-body)", color: "inherit" }} className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
              {it.q}
              <ChevronDown className="fx-chevron h-4 w-4 shrink-0 transition-transform duration-200" style={{ color: "var(--muted-text)" }} />
            </summary>
            <p style={{ color: tone === "contrast" ? "inherit" : "var(--muted-text)" }} className="mt-2 text-sm leading-relaxed">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function HeadingRenderer({ data }) {
  const { text, size = 32, align = "center", tone } = data;
  return (
    <section className={toneClass(tone)} style={toneStyle(tone)}>
      <h2
        style={{ fontSize: size, textAlign: align, fontFamily: "var(--font-display)", fontWeight: "var(--heading-weight)", letterSpacing: "var(--heading-tracking)", color: "inherit" }}
      >
        {text}
      </h2>
    </section>
  );
}

export function ParagraphRenderer({ data }) {
  const { text, width = 700, align = "center", tone } = data;
  const cls = align === "center" ? "mx-auto text-center" : align === "right" ? "ml-auto text-right" : "text-left";
  return (
    <section className={toneClass(tone)} style={toneStyle(tone)}>
      <p className={`leading-7 ${cls}`} style={{ maxWidth: width, fontFamily: "var(--font-body)", color: tone === "contrast" ? "inherit" : "var(--muted-text)" }}>
        {text}
      </p>
    </section>
  );
}

export function TestimonialRenderer({ data }) {
  const { quote, name, role, photo, tone = "muted" } = data;
  if (!quote) return null;
  const onContrast = tone === "contrast";
  return (
    <section style={{ borderRadius: "var(--radius)", ...toneStyle(tone) }} className="p-8 text-center">
      <p style={{ fontFamily: "var(--font-display)", color: "inherit" }} className="mx-auto max-w-2xl text-xl leading-relaxed md:text-2xl">
        &ldquo;{quote}&rdquo;
      </p>
      {(name || photo) && (
        <div className="mt-5 flex items-center justify-center gap-3">
          {photo && <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover" />}
          <div style={{ fontFamily: "var(--font-body)" }} className="text-left">
            {name && <div style={{ color: "inherit" }} className="text-sm font-semibold">{name}</div>}
            {role && <div style={{ color: onContrast ? "inherit" : "var(--muted-text)" }} className="text-xs">{role}</div>}
          </div>
        </div>
      )}
    </section>
  );
}

// Real, live reviews (Endorsed.Review's own widget.js loader), not a
// hand-typed quote -- see src/components/shared/endorsedWidget.js.
export function EndorsedReviewRenderer({ data }) {
  const { widgetType = "basic-stars", themeMode = "light", branding = true, tone } = data;
  return (
    <div className={`text-center ${toneClass(tone)}`} style={toneStyle(tone)}>
      <EndorsedWidget type={widgetType} theme={themeMode} color="var(--accent)" branding={branding} />
    </div>
  );
}

// funnelOwnerUid here is the storefront owner's own uid — ClickableImage/
// CtaAction/SubscribeInlineForm were written for the Funnel Builder, where
// that prop name refers to whoever owns the funnel being viewed; the same
// resolution (storefronts/{uid}, products/{uid}) applies unchanged here.
export function ImageRenderer({ data, ownerUid }) {
  if (!data.url) return null;
  return (
    <div className="text-center">
      <ClickableImage data={data} funnelOwnerUid={ownerUid}>
        <img
          src={data.url}
          alt=""
          className={data.shadow ? "shadow-md" : ""}
          style={{ width: `${data.widthPct || 100}%`, maxWidth: "100%", borderRadius: data.radius ?? 16, display: "inline-block" }}
        />
      </ClickableImage>
    </div>
  );
}

export function ButtonRenderer({ data, ownerUid, editable = false }) {
  if (data.actionType === "subscribe") {
    return <SubscribeInlineForm label={data.label} full={data.full} style={data.style} funnelOwnerUid={ownerUid} editable={editable} />;
  }
  // Follow/Subscribe buttons keep their platform's own brand color (e.g.
  // YouTube red) — everything else picks up the storefront's theme accent
  // instead of the shared Button component's generic slate default.
  const themedStyle = data.actionType === "follow" ? undefined
    : data.style === "outline" ? { borderColor: "var(--accent)", color: "var(--accent)", background: "transparent" }
    : data.style === "ghost" ? { color: "var(--accent)", background: "transparent" }
    : { background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: "var(--radius)" };
  return (
    <div className={`flex ${data.full ? "" : "justify-center"}`}>
      <CtaAction
        data={data}
        editable={false}
        funnelOwnerUid={ownerUid}
        labelKey="label"
        buttonClassName={data.full ? "w-full" : ""}
        buttonVariant={data.style === "ghost" ? "ghost" : data.style === "outline" ? "outline" : "default"}
        styleOverride={themedStyle}
      />
    </div>
  );
}

// General-purpose media+text block, distinct from Hero (Hero stays the
// page-opening banner; this is the block reused repeatedly further down a
// page -- "media one side, text the other"). Text column capped at 50ch so
// a long body never reads edge-to-edge next to a narrow image.
export function SplitRenderer({ data }) {
  const { eyebrow, heading, body, cta, media, variant = "media-left", tone } = data;
  if (!heading && !media?.url) return null;
  const mediaRight = variant === "media-right";
  const onContrast = tone === "contrast";
  const ctaButton = cta?.label && (
    <a
      href={cta.href || "#"}
      style={{ background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: "var(--radius)" }}
      className="mt-2 inline-block w-max px-5 py-3 text-sm font-semibold shadow-sm transition hover:brightness-110"
    >
      {cta.label}
    </a>
  );
  return (
    <section className={`grid grid-cols-1 items-center gap-8 md:grid-cols-2 ${toneClass(tone)}`} style={toneStyle(tone)}>
      <div className={mediaRight ? "md:order-2" : ""}>
        {media?.url && (
          <Media
            src={media.url}
            alt={heading || ""}
            focal={media.focal}
            className="aspect-[4/3] w-full object-cover"
            style={{ borderRadius: "var(--radius)" }}
          />
        )}
      </div>
      <div className={`flex flex-col gap-3 ${mediaRight ? "md:order-1" : ""}`} style={{ maxWidth: "50ch" }}>
        {eyebrow && <div style={{ fontFamily: "var(--font-body)", color: onContrast ? "inherit" : "var(--accent)" }} className="text-xs font-semibold uppercase tracking-wider">{eyebrow}</div>}
        {heading && <h3 style={{ fontFamily: "var(--font-display)", fontWeight: "var(--heading-weight)", letterSpacing: "var(--heading-tracking)", color: "inherit" }} className="text-2xl md:text-3xl">{heading}</h3>}
        {body && <p style={{ fontFamily: "var(--font-body)", color: onContrast ? "inherit" : "var(--muted-text)" }} className="leading-relaxed">{body}</p>}
        {ctaButton}
      </div>
    </section>
  );
}

// Fixed icon set (one stroke weight, no colored circle backgrounds --
// deliberately plainer than a typical feature grid). Covers shipping/
// guarantee info and simple feature/process lists in one block.
const COLUMN_ICONS = { truck: Truck, shield: Shield, "rotate-ccw": RotateCcw, award: Award, zap: Zap, headphones: Headphones, "credit-card": CreditCard, check: Check };

export function ColumnsRenderer({ data }) {
  const items = data.items || [];
  if (!items.length) return null;
  const { heading, variant = "icon", tone } = data;
  const onContrast = tone === "contrast";
  return (
    <section className={toneClass(tone)} style={toneStyle(tone)}>
      {heading && <h3 style={{ fontFamily: "var(--font-display)", color: "inherit", fontWeight: "var(--heading-weight)" }} className="mb-6 text-center text-2xl">{heading}</h3>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-8">
        {items.map((it, idx) => {
          const Icon = COLUMN_ICONS[it.icon];
          return (
            <div key={idx} className="flex flex-col items-center gap-2 text-center">
              {variant === "numbered"
                ? <div style={{ fontFamily: "var(--font-display)", color: onContrast ? "inherit" : "var(--muted-text)" }} className="text-2xl font-semibold">{String(idx + 1).padStart(2, "0")}</div>
                : Icon && <Icon className="h-6 w-6" style={{ color: onContrast ? "inherit" : "var(--muted-text)" }} />}
              <h4 style={{ fontFamily: "var(--font-body)", color: "inherit" }} className="text-sm font-semibold">{it.title}</h4>
              {it.text && <p style={{ color: onContrast ? "inherit" : "var(--muted-text)" }} className="text-xs leading-relaxed">{it.text}</p>}
            </div>
          );
        })}
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
const VariantField = ({ value, options, onChange, label = "Layout" }) => (
  <Field label={label}>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button key={opt.value} size="sm" variant={value === opt.value ? "default" : "outline"} className="text-black" onClick={() => onChange(opt.value)}>{opt.label}</Button>
      ))}
    </div>
  </Field>
);
// Section background — every block reads this via theme.js's toneStyle()
// instead of picking its own. "Contrast" is a real accent-colored band for
// pacing a long page, not just a slightly darker gray.
const TONE_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "muted", label: "Muted" },
  { value: "contrast", label: "Contrast" },
];
const ToneField = ({ value, onChange }) => (
  <VariantField label="Background" value={value || "default"} options={TONE_OPTIONS} onChange={onChange} />
);

function HeroInspector({ data, onChange, onPickImage }) {
  const { title, subtitle, align, bgImage, overlay = 0.35, cta, variant = "full-bleed", tone } = data;
  return (
    <div className="space-y-4">
      <VariantField
        value={variant}
        options={[{ value: "full-bleed", label: "Full-bleed" }, { value: "split", label: "Split" }]}
        onChange={(v) => onChange({ variant: v })}
      />
      <ToneField value={tone} onChange={(v) => onChange({ tone: v })} />
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

function CollectionGridInspector({ data, onChange, fullProducts }) {
  const { title, productIds = [], columns, showPrice, showCTA, displayMode = "curated", featured, featuredProductId, variant = "grid", tone } = data;
  const setCols = (k, v) => onChange({ columns: { ...columns, [k]: v } });
  const all = fullProducts || [];
  const candidateProducts = displayMode === "all" ? all : all.filter((p) => productIds.includes(p.id));
  return (
    <div className="space-y-4">
      <VariantField
        value={variant}
        options={[{ value: "grid", label: "Grid" }, { value: "editorial-list", label: "Editorial list" }]}
        onChange={(v) => onChange({ variant: v })}
      />
      <ToneField value={tone} onChange={(v) => onChange({ tone: v })} />
      <Field label="Title"><Input value={title || ""} onChange={(e) => onChange({ title: e.target.value })} /></Field>
      <Field label="Which products">
        <div className="flex gap-2">
          <Button size="sm" variant={displayMode === "curated" ? "default" : "outline"} className="text-black" onClick={() => onChange({ displayMode: "curated" })}>Curated list</Button>
          <Button size="sm" variant={displayMode === "all" ? "default" : "outline"} className="text-black" onClick={() => onChange({ displayMode: "all" })}>All active products</Button>
        </div>
      </Field>
      {displayMode === "curated" && (
        <Field label="Product IDs">
          <Input
            placeholder="id1, id2, id3"
            value={productIds.join(", ")}
            onChange={(e) => onChange({ productIds: e.target.value.split(/[,\s]+/).filter(Boolean) })}
          />
        </Field>
      )}
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
      <ToggleField label="Feature one product" checked={featured} onCheckedChange={(v) => onChange({ featured: v })} />
      {featured && (
        <Field label="Featured product">
          <select
            value={featuredProductId || ""}
            onChange={(e) => onChange({ featuredProductId: e.target.value })}
            className="w-full rounded-md border border-gray-200 px-2 py-2 text-sm"
          >
            <option value="">(first in list)</option>
            {candidateProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
      )}
    </div>
  );
}

function RichTextInspector({ data, onChange }) {
  const { html, align, maxWidth = 720, tone } = data;
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
      <ToneField value={tone} onChange={(v) => onChange({ tone: v })} />
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
      <ToneField value={data.tone || "muted"} onChange={(v) => onChange({ tone: v })} />
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

function HeadingInspector({ data, onChange }) {
  const { text, size = 32, align = "center" } = data;
  return (
    <div className="space-y-4">
      <Field label="Text"><Input value={text} onChange={(e) => onChange({ text: e.target.value })} /></Field>
      <Field label={`Size (${size}px)`}>
        <input type="range" min={16} max={72} step={1} value={size} onChange={(e) => onChange({ size: Number(e.target.value) })} className="w-full" />
      </Field>
      <AlignField align={align} onChange={(al) => onChange({ align: al })} />
    </div>
  );
}

function ParagraphInspector({ data, onChange }) {
  const { text, width = 700, align = "center" } = data;
  return (
    <div className="space-y-4">
      <Field label="Text"><Textarea value={text} onChange={(e) => onChange({ text: e.target.value })} className="h-24 w-full rounded-md border border-gray-200 p-2" /></Field>
      <Field label={`Max width (${width}px)`}>
        <input type="range" min={320} max={1200} step={20} value={width} onChange={(e) => onChange({ width: Number(e.target.value) })} className="w-full" />
      </Field>
      <AlignField align={align} onChange={(al) => onChange({ align: al })} />
    </div>
  );
}

function ImageInspector({ data, onChange, onPickImage, ownerUid }) {
  return (
    <div className="space-y-4">
      <Field label="Image">
        <div className="flex items-center gap-2">
          <Input placeholder="Image URL" value={data.url || ""} onChange={(e) => onChange({ url: e.target.value })} />
          {onPickImage && (
            <Button size="sm" variant="outline" className="shrink-0 text-black" onClick={onPickImage}>
              <Upload className="mr-1 inline h-3 w-3" />Upload
            </Button>
          )}
        </div>
      </Field>
      <Field label={`Width (${data.widthPct || 100}%)`}>
        <input type="range" min={20} max={100} step={5} value={data.widthPct || 100} onChange={(e) => onChange({ widthPct: Number(e.target.value) })} className="w-full" />
      </Field>
      <Field label={`Corner radius (${data.radius ?? 16}px)`}>
        <input type="range" min={0} max={32} step={1} value={data.radius ?? 16} onChange={(e) => onChange({ radius: Number(e.target.value) })} className="w-full" />
      </Field>
      <ToggleField label="Shadow" checked={data.shadow} onCheckedChange={(v) => onChange({ shadow: v })} />
      <Separator />
      <p className="text-xs font-medium text-gray-700">Click behavior</p>
      <ActionFields data={data} onChange={onChange} funnelOwnerUid={ownerUid} allowSubscribe={false} allowNone />
      {/* ActionFields itself never renders a field to type the URL into for
          the "link" action — every block that offers it has to add this
          itself (see the button block below). Missing here meant picking
          "Link to a URL" on an image gave no way to actually enter one. */}
      {data.actionType === "link" && (
        <Field label="Link"><Input value={data.href || ""} onChange={(e) => onChange({ href: e.target.value })} /></Field>
      )}
    </div>
  );
}

function ButtonInspector({ data, onChange, ownerUid }) {
  return (
    <div className="space-y-4">
      <Field label="Label"><Input value={data.label} onChange={(e) => onChange({ label: e.target.value })} /></Field>
      <ActionFields data={data} onChange={onChange} funnelOwnerUid={ownerUid} />
      {(!data.actionType || data.actionType === "link") && (
        <Field label="Link"><Input value={data.href} onChange={(e) => onChange({ href: e.target.value })} /></Field>
      )}
      {data.actionType === "subscribe" && (
        <p className="text-xs text-gray-500">Visitors who click this button enter their email right there to join your mailing list — no link needed.</p>
      )}
      <Field label="Style">
        <div className="flex gap-2">
          {["default", "outline", "ghost"].map((s) => (
            <Button key={s} size="sm" variant={data.style === s ? "default" : "outline"} className="text-black" onClick={() => onChange({ style: s })}>{s}</Button>
          ))}
        </div>
      </Field>
      <ToggleField label="Full width" checked={data.full} onCheckedChange={(v) => onChange({ full: v })} />
    </div>
  );
}

function TestimonialInspector({ data, onChange, onPickImage }) {
  return (
    <div className="space-y-4">
      <ToneField value={data.tone || "muted"} onChange={(v) => onChange({ tone: v })} />
      <Field label="Quote"><Textarea value={data.quote || ""} onChange={(e) => onChange({ quote: e.target.value })} className="h-24 w-full rounded-md border border-gray-200 p-2" /></Field>
      <Field label="Name"><Input value={data.name || ""} onChange={(e) => onChange({ name: e.target.value })} /></Field>
      <Field label="Role / context"><Input value={data.role || ""} onChange={(e) => onChange({ role: e.target.value })} placeholder="e.g. Verified buyer" /></Field>
      <Field label="Photo">
        <div className="flex items-center gap-2">
          <Input placeholder="Image URL" value={data.photo || ""} onChange={(e) => onChange({ photo: e.target.value })} />
          {onPickImage && (
            <Button size="sm" variant="outline" className="shrink-0 text-black" onClick={onPickImage}>
              <Upload className="mr-1 inline h-3 w-3" />Upload
            </Button>
          )}
        </div>
      </Field>
    </div>
  );
}

function EndorsedReviewInspector({ data, onChange }) {
  const { widgetType = "basic-stars", themeMode = "light", branding = true, tone } = data;
  return (
    <div className="space-y-4">
      <ToneField value={tone} onChange={(v) => onChange({ tone: v })} />
      <Field label="Widget style">
        <select
          value={widgetType}
          onChange={(e) => onChange({ widgetType: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-2 py-2 text-sm"
        >
          {ENDORSED_WIDGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      <VariantField
        label="Appearance"
        value={themeMode}
        options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
        onChange={(v) => onChange({ themeMode: v })}
      />
      <ToggleField label='Show "Powered by Endorsed.Review"' checked={branding} onCheckedChange={(v) => onChange({ branding: v })} />
      <p className="text-xs text-gray-500">
        Pulls real, live reviews from Fotonix's own Endorsed.Review account — these are reviews of the products, not of your storefront specifically. Automatically matches your brand color above.
      </p>
    </div>
  );
}

function SplitInspector({ data, onChange, onPickImage }) {
  const { eyebrow, heading, body, cta, media, variant = "media-left", tone } = data;
  return (
    <div className="space-y-4">
      <VariantField
        value={variant}
        options={[{ value: "media-left", label: "Media left" }, { value: "media-right", label: "Media right" }]}
        onChange={(v) => onChange({ variant: v })}
      />
      <ToneField value={tone} onChange={(v) => onChange({ tone: v })} />
      <Field label="Eyebrow"><Input value={eyebrow || ""} onChange={(e) => onChange({ eyebrow: e.target.value })} /></Field>
      <Field label="Heading"><Input value={heading || ""} onChange={(e) => onChange({ heading: e.target.value })} /></Field>
      <Field label="Body"><Textarea value={body || ""} onChange={(e) => onChange({ body: e.target.value })} className="h-24 w-full rounded-md border border-gray-200 p-2" /></Field>
      <Field label="Image">
        <div className="flex items-center gap-2">
          <Input placeholder="Image URL" value={media?.url || ""} onChange={(e) => onChange({ media: { ...(media || {}), url: e.target.value } })} />
          {onPickImage && (
            <Button size="sm" variant="outline" className="shrink-0 text-black" onClick={onPickImage}>
              <Upload className="mr-1 inline h-3 w-3" />Upload
            </Button>
          )}
        </div>
      </Field>
      <Field label="Focal point (e.g. 50% 30%)"><Input placeholder="50% 50%" value={media?.focal || ""} onChange={(e) => onChange({ media: { ...(media || {}), focal: e.target.value } })} /></Field>
      <Field label="CTA label"><Input value={cta?.label || ""} onChange={(e) => onChange({ cta: { ...(cta || {}), label: e.target.value } })} /></Field>
      <Field label="CTA link"><Input value={cta?.href || ""} onChange={(e) => onChange({ cta: { ...(cta || {}), href: e.target.value } })} /></Field>
    </div>
  );
}

const COLUMN_ICON_OPTIONS = [
  { value: "truck", label: "Shipping" },
  { value: "shield", label: "Guarantee" },
  { value: "rotate-ccw", label: "Returns" },
  { value: "award", label: "Quality" },
  { value: "zap", label: "Fast" },
  { value: "headphones", label: "Support" },
  { value: "credit-card", label: "Payment" },
  { value: "check", label: "Check" },
];

function ColumnsInspector({ data, onChange }) {
  const { heading, items = [], variant = "icon", tone } = data;
  const setItem = (idx, patch) => onChange({ items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const addItem = () => onChange({ items: [...items, { icon: "check", title: "", text: "" }] });
  const removeItem = (idx) => onChange({ items: items.filter((_, i) => i !== idx) });
  return (
    <div className="space-y-4">
      <VariantField
        value={variant}
        options={[{ value: "icon", label: "Icon" }, { value: "numbered", label: "Numbered" }]}
        onChange={(v) => onChange({ variant: v })}
      />
      <ToneField value={tone} onChange={(v) => onChange({ tone: v })} />
      <Field label="Heading (optional)"><Input value={heading || ""} onChange={(e) => onChange({ heading: e.target.value })} /></Field>
      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={idx} className="space-y-2 rounded-md border border-gray-200 p-2">
            {variant === "icon" && (
              <select
                value={it.icon || "check"}
                onChange={(e) => setItem(idx, { icon: e.target.value })}
                className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
              >
                {COLUMN_ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            <Input placeholder="Title" value={it.title || ""} onChange={(e) => setItem(idx, { title: e.target.value })} />
            <Input placeholder="One line of text" value={it.text || ""} onChange={(e) => setItem(idx, { text: e.target.value })} />
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => removeItem(idx)}>
              <Trash2 className="mr-1 inline h-3 w-3" />Remove
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="text-black" onClick={addItem}>
          <Plus className="mr-1 inline h-3 w-3" />Add item
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================
 * SHOP_BLOCKS registry — mirrors Funnel Builder's BLOCKS registry shape
 * (name/icon/Renderer/Inspector) so both editors work the same way.
 * ========================================================================= */

export const SHOP_BLOCKS = {
  hero: { name: "Hero", icon: ImageIcon, Renderer: HeroRenderer, Inspector: HeroInspector },
  heading: { name: "Heading", icon: HeadingIcon, Renderer: HeadingRenderer, Inspector: HeadingInspector },
  paragraph: { name: "Paragraph", icon: Rows3, Renderer: ParagraphRenderer, Inspector: ParagraphInspector },
  image: { name: "Image", icon: ImageIcon, Renderer: ImageRenderer, Inspector: ImageInspector },
  button: { name: "Button", icon: LinkIconLucide, Renderer: ButtonRenderer, Inspector: ButtonInspector },
  "collection-grid": { name: "Products", icon: LayoutGrid, Renderer: CollectionGridRenderer, Inspector: CollectionGridInspector },
  "rich-text": { name: "Rich Text", icon: Type, Renderer: RichTextRenderer, Inspector: RichTextInspector },
  split: { name: "Split", icon: LayoutTemplate, Renderer: SplitRenderer, Inspector: SplitInspector },
  columns: { name: "Columns", icon: Columns3, Renderer: ColumnsRenderer, Inspector: ColumnsInspector },
  faq: { name: "FAQ", icon: HelpCircle, Renderer: FaqRenderer, Inspector: FaqInspector },
  testimonial: { name: "Testimonial", icon: Quote, Renderer: TestimonialRenderer, Inspector: TestimonialInspector },
  "endorsed-review": { name: "Reviews", icon: Star, Renderer: EndorsedReviewRenderer, Inspector: EndorsedReviewInspector },
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

export default function StoreCanvasBuilder({ value = [], onChange, onPickImage, products = [], currentUserId, theme }) {
  const [selectedId, setSelectedId] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [activeId, setActiveId] = useState(null);

  // Real fonts + derived colors in the canvas too, so what you see while
  // editing is what actually ships — not just on the public page.
  useGoogleFont(theme?.fonts);
  const themeVars = deriveThemeVars(theme);

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
        {/* Left: block palette, or the selected block's Inspector.
            flex-col + flex-1 + min-h-0 on CardContent (rather than a second
            calc()'d height that has to be kept in sync with the Card's own)
            is what actually lets ScrollArea fill the remaining space and
            scroll — a flex child needs min-h-0 to be allowed to shrink
            below its content size at all, otherwise it just overflows the
            card silently instead of scrolling. */}
        <Card className="flex h-[calc(100vh-260px)] flex-col overflow-hidden border border-zinc-200">
          <CardHeader className="flex shrink-0 items-center justify-between pb-2">
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
          <Separator className="shrink-0" />
          <CardContent className="min-h-0 flex-1 p-0">
            <ScrollArea className="h-full p-3">
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
                    fullProducts={products}
                    ownerUid={currentUserId}
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

        {/* Right: canvas — same flex-1/min-h-0 reasoning as the left panel,
            so a tall block's Duplicate/Remove buttons are reachable by
            scrolling instead of silently overflowing the card. */}
        <Card className="relative flex h-[calc(100vh-260px)] flex-col overflow-hidden border border-zinc-200">
          <CardContent className="min-h-0 flex-1 p-0">
            <div className="relative flex h-full items-start overflow-auto bg-white">
              <div className="relative mx-auto h-full w-full overflow-y-auto" style={{ width: containerWidth }}>
                <div className="min-h-full border border-gray-200" style={{ ...themeVars, background: "var(--surface)", color: "var(--text)" }}>
                  <div className="flex flex-col p-6" style={{ gap: "var(--block-gap)" }}>
                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
                      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                        {blocks.map((block) => {
                          const def = SHOP_BLOCKS[block.type];
                          if (!def) return null;
                          const Renderer = def.Renderer;
                          return (
                            <SortableItem key={block.id} id={block.id} selected={selectedId === block.id} onSelect={() => setSelectedId(block.id)}>
                              {/* editable=true here: e.g. a "subscribe" button block must not
                                  actually POST a real signup while someone's just testing it
                                  in the canvas — see ButtonRenderer/SubscribeInlineForm. */}
                              <Renderer data={block.data} fullProducts={products} ownerUid={currentUserId} editable={true} />
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
                            <activeDef.Renderer data={activeBlock.data} fullProducts={products} ownerUid={currentUserId} editable={true} />
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
