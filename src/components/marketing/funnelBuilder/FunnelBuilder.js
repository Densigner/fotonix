import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Settings2,
  Trash2,
  Laptop,
  Smartphone,
  Tablet,
  Download,
  Upload,
  Eye,
  LayoutTemplate,
  Copy,
  Save,
  Undo2,
  Redo2,
  Play,
  Edit3,
  Sparkles,
  Image as ImageIcon,
  Type,
  Link,
  Mail,
  SquareStack,
  Rows3,
  ArrowUpRight,
  GripVertical,
} from "lucide-react";
import { useSearchParams } from 'react-router-dom';
import { getStarterBlocks } from './templateRegistry';
// Firebase storage helper (upload images to the project storage bucket)
import { storage } from '../../../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { API_URL } from '../../../config/environment';

// shadcn/ui (use relative paths to avoid alias resolution issues in CRA)
import { Button } from "../../shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../shared/ui/card";
import { Separator } from "../../shared/ui/separator";

// Minimal inline fallbacks for shadcn/ui components not present in this repo.
// These are intentionally simple — replace with full components when available.
const Input = ({ value, onChange, placeholder, className, ...rest }) => (
  <input value={value} onChange={onChange} placeholder={placeholder} className={className || 'w-full rounded-md border border-gray-200 px-2 py-1'} {...rest} />
);
const Label = ({ children, className }) => <label className={className || 'block text-xs font-semibold text-gray-600'}>{children}</label>;
const Switch = ({ checked, onCheckedChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!checked}
    onClick={() => onCheckedChange && onCheckedChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
  </button>
);
const Tabs = ({ children }) => <div>{children}</div>;
const TabsList = ({ children }) => <div className="flex gap-2">{children}</div>;
const TabsTrigger = ({ children, onClick, className }) => <button onClick={onClick} className={className}>{children}</button>;
const TabsContent = ({ children }) => <div>{children}</div>;
const Textarea = ({ value, onChange, className, ...rest }) => <textarea value={value} onChange={onChange} className={className || 'w-full rounded-md border p-2'} {...rest} />;
const Slider = ({ value, onValueChange, min = 0, max = 100 }) => (
  <input type="range" min={min} max={max} value={Array.isArray(value) ? value[0] : value} onChange={(e) => onValueChange && onValueChange([Number(e.target.value)])} />
);
const Tooltip = ({ children }) => <span>{children}</span>;
const TooltipProvider = ({ children }) => <>{children}</>;
const TooltipTrigger = ({ children }) => <span>{children}</span>;
const TooltipContent = ({ children }) => <div>{children}</div>;
const Dialog = ({ open, children, onOpenChange }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange && onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md mx-auto px-4">{children}</div>
    </div>
  );
};

const DialogContent = ({ children, className }) => (
  <div className={`bg-white shadow-xl rounded-2xl ${className || ''}`}>{children}</div>
);
const DialogFooter = ({ children }) => <div className="mt-4">{children}</div>;
const DialogHeader = ({ children }) => <div className="mb-2">{children}</div>;
const DialogTitle = ({ children }) => <h3 className="text-lg font-medium">{children}</h3>;
const DialogTrigger = ({ children }) => <>{children}</>;
const DropdownMenu = ({ children }) => <div>{children}</div>;
const DropdownMenuTrigger = ({ children }) => <>{children}</>;
const DropdownMenuContent = ({ children }) => <div>{children}</div>;
const DropdownMenuItem = ({ children }) => <div>{children}</div>;
const ScrollArea = ({ children, className }) => <div className={className} style={{ maxHeight: '60vh', overflow: 'auto' }}>{children}</div>;
const Badge = ({ children }) => <span className="inline-block bg-gray-200 px-2 py-1 rounded">{children}</span>;

/*****************************************
 * FunnelBuilder – Single‑file React app
 * - Drag‑and‑drop block editor (dnd-kit)
 * - Live responsive preview (mobile/tablet/desktop)
 * - Right‑pane property inspector
 * - Export/Import JSON schema
 * - LocalStorage autosave, undo/redo, duplicating
 * - A/B Variants (A, B) toggle
 * - Minimal runtime dependencies; Tailwind styles
 *****************************************/

// Resolved as inline styles rather than interpolated Tailwind classes
// (`bg-${color}`) — Tailwind's build-time scanner only picks up class names
// that appear literally in source, so a runtime-constructed class name here
// would silently render with no background at all outside of whichever
// exact strings happen to already appear elsewhere in the codebase.
const CTA_BG_COLORS = {
  'indigo-600': '#4f46e5',
  'emerald-800': '#065f46',
  'rose-600': '#e11d48',
  'slate-900': '#0f172a',
  'amber-600': '#d97706',
  'light': '#f8fafc',
};

// Same reasoning as CTA_BG_COLORS above — resolves a "color-shade/opacity"
// string (e.g. "emerald-900/70", the shape the Wildlife/Women's
// Empowerment templates already store) into a real rgba() value instead of
// an interpolated Tailwind class that Tailwind's scanner would never
// generate CSS for.
const HERO_OVERLAY_HEX = {
  'emerald-900': '#064e3b',
  'rose-900': '#881337',
  'indigo-900': '#312e81',
  'slate-900': '#0f172a',
  'amber-900': '#78350f',
};
function resolveOverlayColor(gradientColor) {
  const [name, opacityStr] = (gradientColor || '').split('/');
  const hex = HERO_OVERLAY_HEX[name] || HERO_OVERLAY_HEX['slate-900'];
  const opacity = opacityStr ? Number(opacityStr) / 100 : 0.6;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// "Follow / Subscribe" platform presets for CTA buttons — built for the
// creators (YouTubers, podcasters) this builder is actually for, who want
// a button that grows their following on a specific platform, not just a
// generic link. YouTube reuses the exact same `sub_confirmation=1` +
// UTM deep-link mechanism already built for email campaigns
// (src/components/email/MailBuilder/SubscribeButtonBuilder.jsx) — clicking
// it opens YouTube's native one-click subscribe prompt instead of just
// landing on the channel page. Other platforms don't have an equivalent
// deep link, so they just take a profile URL.
const FOLLOW_PLATFORMS = {
  youtube: { label: 'YouTube', color: '#FF0000', defaultLabel: '▶ Subscribe on YouTube', placeholder: '@yourhandle or full channel URL', isHandle: true },
  spotify: { label: 'Spotify', color: '#1DB954', defaultLabel: 'Listen on Spotify', placeholder: 'https://open.spotify.com/show/...' },
  applepodcasts: { label: 'Apple Podcasts', color: '#A855F7', defaultLabel: 'Listen on Apple Podcasts', placeholder: 'https://podcasts.apple.com/...' },
  instagram: { label: 'Instagram', color: '#E1306C', defaultLabel: 'Follow on Instagram', placeholder: 'https://instagram.com/yourhandle' },
  tiktok: { label: 'TikTok', color: '#000000', defaultLabel: 'Follow on TikTok', placeholder: 'https://tiktok.com/@yourhandle' },
  twitter: { label: 'Twitter / X', color: '#1DA1F2', defaultLabel: 'Follow on X', placeholder: 'https://x.com/yourhandle' },
  facebook: { label: 'Facebook', color: '#1877F2', defaultLabel: 'Follow on Facebook', placeholder: 'https://facebook.com/yourpage' },
};

function normalizeYouTubeLink(input) {
  let s = (input || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('@')) s = s.slice(1);
  if (/^UC[\w-]{20,}$/.test(s)) return `https://www.youtube.com/channel/${s}`;
  return `https://www.youtube.com/@${s}`;
}

function buildFollowLink(platform, handle) {
  if (!handle) return '#';
  if (platform === 'youtube') {
    const base = normalizeYouTubeLink(handle);
    try {
      const u = new URL(base);
      u.searchParams.set('sub_confirmation', '1');
      return u.toString();
    } catch (e) {
      return base + (base.includes('?') ? '&' : '?') + 'sub_confirmation=1';
    }
  }
  return /^https?:\/\//i.test(handle) ? handle : `https://${handle}`;
}

// Shared inspector fragment for any block with a CTA — the Action choice
// (link / join mailing list / follow-a-platform) plus whichever fields
// that choice needs. Reused by the standalone `button` block, `hero`'s
// CTA, and the `cta` block, so all three offer the same options instead
// of three independently-maintained copies.
function ActionFields({ data, onChange }) {
  return (
    <>
      <Field label="Action">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={(!data.actionType || data.actionType === 'link') ? 'default':'outline'} className="text-black" onClick={()=>onChange({ actionType: 'link' })}>Link to a URL</Button>
          <Button size="sm" variant={data.actionType === 'subscribe' ? 'default':'outline'} className="text-black" onClick={()=>onChange({ actionType: 'subscribe' })}>Join mailing list</Button>
          <Button
            size="sm"
            variant={data.actionType === 'follow' ? 'default':'outline'}
            className="text-black"
            onClick={() => {
              const platform = data.platform || 'youtube';
              const patch = { actionType: 'follow', platform };
              if (!data.platform) {
                // first time picking "follow" — seed a sensible default label
                patch.label = FOLLOW_PLATFORMS[platform].defaultLabel;
                patch.ctaLabel = FOLLOW_PLATFORMS[platform].defaultLabel;
              }
              onChange(patch);
            }}
          >
            Follow / Subscribe
          </Button>
        </div>
      </Field>
      {data.actionType === 'follow' && (
        <>
          <Field label="Platform">
            <div className="flex flex-wrap gap-2">
              {Object.entries(FOLLOW_PLATFORMS).map(([id, p]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange({ platform: id, label: p.defaultLabel, ctaLabel: p.defaultLabel })}
                  className="text-xs px-3 py-1.5 rounded-full border transition"
                  style={{
                    backgroundColor: data.platform === id ? p.color : '#fff',
                    color: data.platform === id ? '#fff' : '#111827',
                    borderColor: data.platform === id ? p.color : '#e5e7eb',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={FOLLOW_PLATFORMS[data.platform]?.isHandle ? 'Channel handle or URL' : `${FOLLOW_PLATFORMS[data.platform]?.label || 'Profile'} URL`}>
            <Input
              value={data.handle || ''}
              onChange={(e) => onChange({ handle: e.target.value })}
              placeholder={FOLLOW_PLATFORMS[data.platform]?.placeholder || 'https://...'}
            />
          </Field>
          {data.platform === 'youtube' && (
            <p className="text-xs text-gray-500">
              Opens YouTube's one-click subscribe prompt directly, instead of just linking to your channel page.
            </p>
          )}
        </>
      )}
    </>
  );
}

// Shared CTA renderer — the actual button/form markup for whichever action
// ActionFields above chose. Reused by hero (both layouts) and the cta
// block so "link vs mailing-list vs follow-a-platform" behaves and looks
// identical everywhere a CTA button appears, not just on the standalone
// button block.
function CtaAction({ data, onChange, editable, funnelOwnerUid, buttonClassName, showIcon }) {
  if (data.actionType === 'subscribe') {
    return (
      <SubscribeInlineForm
        label={data.ctaLabel}
        funnelOwnerUid={funnelOwnerUid}
        editable={editable}
      />
    );
  }
  const isFollow = data.actionType === 'follow';
  const platform = isFollow ? FOLLOW_PLATFORMS[data.platform] : null;
  const href = isFollow ? buildFollowLink(data.platform, data.handle) : (data.ctaHref || '#');
  return (
    <Button
      asChild
      className={buttonClassName}
      style={platform ? { backgroundColor: platform.color, color: '#fff' } : undefined}
    >
      <a href={href} target={isFollow ? '_blank' : undefined} rel={isFollow ? 'noopener noreferrer' : undefined} className="inline-flex items-center gap-2">
        <span
          contentEditable={editable}
          suppressContentEditableWarning={true}
          onBlur={(e) => onChange && onChange({ ctaLabel: e.target.textContent })}
          className="focus:outline-none"
        >
          {data.ctaLabel}
        </span>
        {showIcon && <ArrowUpRight className="h-4 w-4" />}
      </a>
    </Button>
  );
}

// ----- Block registry ----- //
const BLOCKS = {
  hero: {
    name: "Hero",
    icon: Sparkles,
    defaults: () => ({
      headline: "Launch your product in minutes",
      subhead: "A blazing‑fast funnel built with our drag‑and‑drop editor.",
      ctaLabel: "Get Started",
      ctaHref: "#",
      actionType: "link",
      image: "/images/AmeliaBedroom.png",
      align: "center",
      gradient: true,
    }),
    render: ({ data, onChange, editable, funnelOwnerUid }) => {
      // Full-bleed background image with the headline/CTA overlaid on top —
      // what the Wildlife/Women's Empowerment templates actually intend
      // (they set gradientOverlay/gradientColor/textColor), as opposed to
      // the default side-by-side/stacked layout below.
      if (data.gradientOverlay) {
        const overlayColor = resolveOverlayColor(data.gradientColor);
        const textColor = data.textColor === 'dark' ? '#0f172a' : '#ffffff';
        return (
          <section
            className={`relative overflow-hidden rounded-2xl min-h-[420px] flex flex-col justify-center ${
              data.align === 'center' ? 'items-center text-center' : 'items-start text-left'
            } p-8 md:p-16`}
          >
            {data.image && (
              <img src={data.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0" style={{ backgroundColor: overlayColor }} />

            <div className="relative z-10 max-w-2xl" style={{ color: textColor }}>
              <h1
                contentEditable={editable}
                suppressContentEditableWarning={true}
                onBlur={(e) => onChange && onChange({ headline: e.target.textContent })}
                className="text-3xl md:text-5xl font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
              >
                {data.headline}
              </h1>
              <p
                contentEditable={editable}
                suppressContentEditableWarning={true}
                onBlur={(e) => onChange && onChange({ subhead: e.target.textContent })}
                className="mt-3 text-base md:text-lg opacity-90 focus:outline-none focus:ring-1 focus:ring-white/30 rounded"
              >
                {data.subhead}
              </p>
              <div className={`mt-6 flex gap-3 ${data.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                <CtaAction data={data} onChange={onChange} editable={editable} funnelOwnerUid={funnelOwnerUid} buttonClassName="bg-white text-gray-900 hover:bg-gray-100" showIcon />
              </div>
            </div>

            {editable && (
              <div className="absolute top-2 right-2 z-10">
                <UploadImage onUploaded={(url) => onChange && onChange({ image: url })} />
              </div>
            )}
          </section>
        );
      }

      return (
        <section className={`relative overflow-hidden rounded-2xl border border-gray-200 ${
          data.gradient ? "bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10" : "bg-white"
        } p-8 md:p-12`}>
          <div className={`mx-auto ${data.align === "center" ? "text-center max-w-2xl" : "text-left grid md:grid-cols-2 gap-8 items-center"}`}>
            <div>
              <h1
                contentEditable={editable}
                suppressContentEditableWarning={true}
                onBlur={(e) => onChange && onChange({ headline: e.target.textContent })}
                className="text-3xl md:text-5xl font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
              >
                {data.headline}
              </h1>

              <p
                contentEditable={editable}
                suppressContentEditableWarning={true}
                onBlur={(e) => onChange && onChange({ subhead: e.target.textContent })}
                className="mt-3 text-gray-600 text-base md:text-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded"
              >
                {data.subhead}
              </p>
              <div className={`mt-5 ${data.align === "center" ? "justify-center" : "justify-start"} flex gap-3`}>
                <CtaAction data={data} onChange={onChange} editable={editable} funnelOwnerUid={funnelOwnerUid} showIcon />
              </div>
            </div>

            {/* Editable image pattern */}
            <div className="relative group">
              {data.align !== "center" && (
                <img src={data.image} alt="Hero" className="w-full rounded-xl shadow-md" />
              )}

              {data.align === "center" && (
                <img src={data.image} alt="Hero" className="w-full mt-8 rounded-xl shadow-md" />
              )}

              {editable && (
                <UploadImage onUploaded={(url) => onChange && onChange({ image: url })} />
              )}
            </div>
          </div>
        </section>
      );
    },
    inspector: ({ data, onChange }) => (
  <div className="space-y-4">
        <Field label="Hero Style">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onChange({ gradientOverlay: false })}
              className={`text-left rounded-lg border p-2.5 text-sm transition ${
                !data.gradientOverlay ? 'border-indigo-500 ring-1 ring-indigo-200 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">Side-by-side</div>
              <div className="text-xs text-gray-500 mt-0.5">Text on one side, image next to (or below) it</div>
            </button>
            <button
              type="button"
              onClick={() => onChange({ gradientOverlay: true, textColor: data.textColor || 'white' })}
              className={`text-left rounded-lg border p-2.5 text-sm transition ${
                data.gradientOverlay ? 'border-indigo-500 ring-1 ring-indigo-200 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">Full-bleed image, text overlaid</div>
              <div className="text-xs text-gray-500 mt-0.5">Background image fills the section, text sits on top of it</div>
            </button>
          </div>
        </Field>
        <Field label="Headline">
          <Input value={data.headline} onChange={e=>onChange({ headline: e.target.value })} />
        </Field>
        <Field label="Sub‑headline">
          <Textarea value={data.subhead} onChange={e=>onChange({ subhead: e.target.value })} />
        </Field>
        <Field label="CTA Label">
          <Input value={data.ctaLabel} onChange={e=>onChange({ ctaLabel: e.target.value })} />
        </Field>
        <ActionFields data={data} onChange={onChange} />
        {(!data.actionType || data.actionType === 'link') && (
          <Field label="CTA Link">
            <Input value={data.ctaHref} onChange={e=>onChange({ ctaHref: e.target.value })} />
          </Field>
        )}
        <ImageUrlField label="Image URL" value={data.image} onChange={(image) => onChange({ image })} />
        <Field label="Alignment">
          <div className="flex items-center gap-2">
            <Button variant={data.align === "center" ? "default" : "outline"} size="sm" className="text-black" onClick={()=>onChange({ align: "center" })}>Center</Button>
            <Button variant={data.align === "left" ? "default" : "outline"} size="sm" className="text-black" onClick={()=>onChange({ align: "left" })}>Left</Button>
          </div>
        </Field>
        {data.gradientOverlay ? (
          <>
            <Field label="Overlay color">
              <div className="flex flex-wrap gap-2">
                {Object.keys(HERO_OVERLAY_HEX).map((name) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => onChange({ gradientColor: `${name}/70` })}
                    className={`h-8 w-8 rounded-full border-2 ${(data.gradientColor||'').startsWith(name) ? 'border-indigo-500' : 'border-gray-200'}`}
                    style={{ backgroundColor: HERO_OVERLAY_HEX[name] }}
                  />
                ))}
              </div>
            </Field>
            <Field label="Text color">
              <div className="flex gap-2">
                <Button size="sm" variant={data.textColor !== 'dark' ? 'default':'outline'} className="text-black" onClick={()=>onChange({ textColor: 'white' })}>White</Button>
                <Button size="sm" variant={data.textColor === 'dark' ? 'default':'outline'} className="text-black" onClick={()=>onChange({ textColor: 'dark' })}>Dark</Button>
              </div>
            </Field>
          </>
        ) : (
          <ToggleField label="Subtle gradient tint behind text" checked={data.gradient} onCheckedChange={(v)=>onChange({ gradient: v })} />
        )}
      </div>
    )
  },
  volunteerHero: {
    name: "Volunteer Hero",
    icon: Sparkles,
    defaults: () => ({
      showHeader: true,
      logoText: "VOLUNTEER",
      links: ["Home", "About", "Opportunities", "How to Volunteer", "Contact"],
      ctaLabel: "Start Now",
      ctaHref: "#",
      headline: "Volunteer in your Community",
      subhead:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Autem dolore, alias, numquam enim ab voluptate id quam.",
      buttonLabel: "Contact Us",
      buttonHref: "#",
      placeholder: "Email",
      background:
        "https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=1200&auto=format&fit=crop",
      overlay: true,
      darkText: false,
      align: "left",
    }),
    render: ({ data, onChange, editable }) => (
      <section className="relative flex h-[85vh] min-h-[520px] w-full flex-col overflow-hidden rounded-2xl">
        {/* Background */}
        <img src={data.background} alt="Volunteer background" className="absolute inset-0 h-full w-full object-cover" />
        {data.overlay && <div className="absolute inset-0 bg-black/50" />}
        {editable && (
          <div className="absolute top-2 right-2 z-20">
            <UploadImage onUploaded={(url) => onChange && onChange({ background: url })} />
          </div>
        )}

        {/* Header/Nav */}
        {data.showHeader && (
          <nav className="relative z-20 flex w-full items-center justify-between px-8 py-5 text-white">
            {/* Logo */}
            <div className="text-lg font-bold tracking-tight uppercase">{data.logoText}</div>

            {/* Links */}
            <div className="hidden md:flex gap-6 text-sm font-medium opacity-90">
              {data.links.map((link, idx) => (
                <a key={idx} href="#" className="transition hover:opacity-100 hover:underline">{link}</a>
              ))}
            </div>

            {/* CTA */}
            <Button asChild className="bg-red-600 hover:bg-red-700 text-white text-sm px-5 py-2 rounded-md">
              <a href={data.ctaHref}>{data.ctaLabel}</a>
            </Button>
          </nav>
        )}

        {/* Hero Text */}
        <div className={`relative z-10 mx-auto flex flex-col items-${data.align} justify-center h-full max-w-3xl px-6 text-${data.align} ${data.darkText ? "text-gray-900" : "text-white"}`}>
          <h1
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ headline: e.target.textContent })}
            className="text-4xl md:text-6xl font-bold leading-tight focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
          >
            {data.headline}
          </h1>
          <p
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ subhead: e.target.textContent })}
            className="mt-3 text-base md:text-lg opacity-90 focus:outline-none focus:ring-1 focus:ring-white/30 rounded"
          >
            {data.subhead}
          </p>

          {/* Email + Button */}
          <form onSubmit={(e) => e.preventDefault()} className={`mt-6 flex max-w-md flex-col gap-3 ${data.align === "center" ? "mx-auto" : ""} sm:flex-row`}>
            <Input placeholder={data.placeholder} className="flex-1 bg-white/90 text-black placeholder-gray-500" />
            <Button className="bg-indigo-600 hover:bg-indigo-700">{data.buttonLabel}</Button>
          </form>
        </div>
      </section>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <ToggleField label="Show header" checked={data.showHeader} onCheckedChange={(v) => onChange({ showHeader: v })} />
        {data.showHeader && (
          <>
            <Field label="Logo text">
              <Input value={data.logoText} onChange={(e) => onChange({ logoText: e.target.value })} />
            </Field>
            <Field label="Navigation links (comma separated)">
              <Input value={data.links.join(', ')} onChange={(e) => onChange({ links: e.target.value.split(',').map((l) => l.trim()) })} />
            </Field>
            <Field label="CTA label">
              <Input value={data.ctaLabel} onChange={(e) => onChange({ ctaLabel: e.target.value })} />
            </Field>
            <Field label="CTA link">
              <Input value={data.ctaHref} onChange={(e) => onChange({ ctaHref: e.target.value })} />
            </Field>
          </>
        )}
        <Separator />
        <Field label="Headline">
          <Input value={data.headline} onChange={(e) => onChange({ headline: e.target.value })} />
        </Field>
        <Field label="Subheadline">
          <Textarea value={data.subhead} onChange={(e) => onChange({ subhead: e.target.value })} />
        </Field>
        <Field label="Email placeholder">
          <Input value={data.placeholder} onChange={(e) => onChange({ placeholder: e.target.value })} />
        </Field>
        <Field label="Button label">
          <Input value={data.buttonLabel} onChange={(e) => onChange({ buttonLabel: e.target.value })} />
        </Field>
        <Field label="Button link">
          <Input value={data.buttonHref} onChange={(e) => onChange({ buttonHref: e.target.value })} />
        </Field>
        <ImageUrlField label="Background image" value={data.background} onChange={(background) => onChange({ background })} />
        <ToggleField label="Overlay" checked={data.overlay} onCheckedChange={(v) => onChange({ overlay: v })} />
        <ToggleField label="Dark text" checked={data.darkText} onCheckedChange={(v) => onChange({ darkText: v })} />
        <Field label="Alignment">
          <div className="flex gap-2">
            {["left", "center"].map((align) => (
              <Button key={align} size="sm" variant={data.align === align ? "default" : "outline"} className="text-black" onClick={() => onChange({ align })}>{align}</Button>
            ))}
          </div>
        </Field>
      </div>
    ),
  },
  heading: {
    name: "Heading",
    icon: Type,
    defaults: () => ({ text: "Powerful headline", size: 36, align: "center" }),
    render: ({ data, onChange, editable }) => (
      <h2
        contentEditable={editable}
        suppressContentEditableWarning={true}
        onBlur={(e) => onChange && onChange({ text: e.target.textContent })}
        className={`w-full font-semibold tracking-tight focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded ${
          data.align === "center" ? "text-center" : data.align === "right" ? "text-right" : "text-left"
        }`} style={{ fontSize: `${data.size}px` }}>{data.text}</h2>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Text"><Input value={data.text} onChange={e=>onChange({ text: e.target.value })} /></Field>
        <Field label="Size"><Slider value={[data.size]} min={16} max={72} step={1} onValueChange={(v)=>onChange({ size: v[0] })} /></Field>
        <Field label="Align">
          <div className="flex gap-2">
            {['left','center','right'].map(al=> (
              <Button key={al} size="sm" variant={data.align===al? 'default':'outline'} className="text-black" onClick={()=>onChange({ align: al })}>{al}</Button>
            ))}
          </div>
        </Field>
      </div>
    )
  },
  paragraph: {
    name: "Paragraph",
    icon: Rows3,
    defaults: () => ({ text: "Explain your offer in a concise, benefit‑driven way.", width: 700, align: "center" }),
    render: ({ data, onChange, editable }) => (
      <p
        contentEditable={editable}
        suppressContentEditableWarning={true}
        onBlur={(e) => onChange && onChange({ text: e.target.textContent })}
        className={`text-gray-600 leading-7 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded ${
        data.align === "center" ? "mx-auto text-center" : data.align === "right" ? "ml-auto text-right" : "text-left"
      }`} style={{ maxWidth: data.width }}>{data.text}</p>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Text"><Textarea value={data.text} onChange={e=>onChange({ text: e.target.value })} /></Field>
        <Field label="Max width">
          <Slider value={[data.width]} min={320} max={1000} step={10} onValueChange={(v)=>onChange({ width: v[0] })} />
        </Field>
        <Field label="Align">
          <div className="flex gap-2">
            {['left','center','right'].map(al=> (
              <Button key={al} size="sm" variant={data.align===al? 'default':'outline'} className="text-black" onClick={()=>onChange({ align: al })}>{al}</Button>
            ))}
          </div>
        </Field>
      </div>
    )
  },
  image: {
    name: "Image",
    icon: ImageIcon,
    defaults: () => ({ url: "/images/products/lucasroom.jpg", radius: 16, shadow: true }),
    render: ({ data, onChange, editable }) => (
      <div className="relative group">
        <img src={data.url} alt="" className={`w-full ${data.shadow? 'shadow-md':''}`} style={{ borderRadius: data.radius }} />
        {editable && (
              <UploadImage onUploaded={(url) => onChange && onChange({ url })} />
        )}
      </div>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <ImageUrlField label="Image URL" value={data.url} onChange={(url) => onChange({ url })} />
        <Field label="Corner radius"><Slider value={[data.radius]} min={0} max={32} step={1} onValueChange={(v)=>onChange({ radius: v[0] })} /></Field>
        <ToggleField label="Shadow" checked={data.shadow} onCheckedChange={(v)=>onChange({ shadow: v })} />
      </div>
    )
  },
  button: {
    name: "Button",
    icon: Link,
    defaults: () => ({ label: "Get started", href: "#", style: "default", full: false, actionType: "link" }),
    render: ({ data, onChange, editable, funnelOwnerUid }) => {
      if (data.actionType === 'subscribe') {
        return (
          <SubscribeInlineForm
            label={data.label}
            full={data.full}
            style={data.style}
            funnelOwnerUid={funnelOwnerUid}
            editable={editable}
          />
        );
      }
      const isFollow = data.actionType === 'follow';
      const platform = isFollow ? FOLLOW_PLATFORMS[data.platform] : null;
      const href = isFollow ? buildFollowLink(data.platform, data.handle) : data.href;
      return (
        <div className={`flex ${data.full? '':'justify-center'}`}>
          <Button
            asChild
            className={data.full? 'w-full':''}
            variant={data.style === 'ghost'? 'ghost': data.style === 'outline'? 'outline':'default'}
            style={platform ? { backgroundColor: platform.color, color: '#fff' } : undefined}
          >
            <a href={href} target={isFollow ? '_blank' : undefined} rel={isFollow ? 'noopener noreferrer' : undefined}>
              <span
                contentEditable={editable}
                suppressContentEditableWarning={true}
                onBlur={(e) => onChange && onChange({ label: e.target.textContent })}
                className="focus:outline-none"
              >
                {data.label}
              </span>
            </a>
          </Button>
        </div>
      );
    },
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Label"><Input value={data.label} onChange={e=>onChange({ label: e.target.value })} /></Field>
        <ActionFields data={data} onChange={onChange} />
        {(!data.actionType || data.actionType === 'link') && (
          <Field label="Link"><Input value={data.href} onChange={e=>onChange({ href: e.target.value })} /></Field>
        )}
        {data.actionType === 'subscribe' && (
          <p className="text-xs text-gray-500">Visitors who click this button enter their email right there to join your mailing list — no link needed.</p>
        )}
        <Field label="Style">
          <div className="flex gap-2">
            {['default','outline','ghost'].map(s=> (
              <Button key={s} size="sm" variant={data.style===s? 'default':'outline'} onClick={()=>onChange({ style: s })}>{s}</Button>
            ))}
          </div>
        </Field>
        <ToggleField label="Full width" checked={data.full} onCheckedChange={(v)=>onChange({ full: v })} />
      </div>
    )
  },
  emailCapture: {
    name: "Email Capture",
    icon: Mail,
    defaults: () => ({ headline: "Get early access", placeholder: "you@example.com", button: "Notify me", success: "Thanks! Check your inbox." }),
    render: ({ data, onChange, editable, funnelOwnerUid }) => (
      <div className="mx-auto max-w-md w-full">
        <h3
          contentEditable={editable}
          suppressContentEditableWarning={true}
          onBlur={(e) => onChange && onChange({ headline: e.target.textContent })}
          className="text-xl font-semibold tracking-tight text-center focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded"
        >
          {data.headline}
        </h3>
        <div className="mt-3">
          <SubscribeInlineForm
            label={data.button}
            placeholder={data.placeholder}
            successMessage={data.success}
            full
            funnelOwnerUid={funnelOwnerUid}
            editable={editable}
          />
        </div>
  <p className="text-xs text-gray-600 mt-2 text-center">We respect your privacy.</p>
      </div>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Headline"><Input value={data.headline} onChange={e=>onChange({ headline: e.target.value })} /></Field>
        <Field label="Placeholder"><Input value={data.placeholder} onChange={e=>onChange({ placeholder: e.target.value })} /></Field>
        <Field label="Button text"><Input value={data.button} onChange={e=>onChange({ button: e.target.value })} /></Field>
        <Field label="Success message"><Input value={data.success} onChange={e=>onChange({ success: e.target.value })} /></Field>
      </div>
    )
  },
  features: {
    name: "Features",
    icon: SquareStack,
    defaults: () => ({
      title: "Why people love this",
      items: [
        { id: uuidv4(), title: "Fast to build", desc: "Create a page in minutes." },
        { id: uuidv4(), title: "Responsive", desc: "Looks great on any device." },
        { id: uuidv4(), title: "Integrated", desc: "Connect payments, email, analytics." },
      ],
    }),
    render: ({ data, onChange, editable }) => (
      <div className="w-full">
        <h3
          contentEditable={editable}
          suppressContentEditableWarning={true}
          onBlur={(e) => onChange && onChange({ title: e.target.textContent })}
          className="text-xl font-semibold tracking-tight text-center focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded"
        >
          {data.title}
        </h3>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {data.items.map((it, i)=> (
            <Card key={it.id} className="h-full">
              <CardHeader className="pb-2">
                <CardTitle
                  contentEditable={editable}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    if (!onChange) return;
                    const items = [...data.items];
                    items[i] = { ...it, title: e.target.textContent };
                    onChange({ items });
                  }}
                  className="text-base focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded"
                >
                  {it.title}
                </CardTitle>
              </CardHeader>
              <CardContent
                contentEditable={editable}
                suppressContentEditableWarning={true}
                onBlur={(e) => {
                  if (!onChange) return;
                  const items = [...data.items];
                  items[i] = { ...it, desc: e.target.textContent };
                  onChange({ items });
                }}
                className="text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded"
              >
                {it.desc}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    ),
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Title"><Input value={data.title} onChange={e=>onChange({ title: e.target.value })} /></Field>
        <Separator />
        <div className="space-y-3">
          {data.items.map((it, idx)=> (
            <div className="p-3 rounded-lg border" key={it.id}>
              <Field label={`Item ${idx+1} Title`}>
                <Input value={it.title} onChange={e=>{
                  const items=[...data.items]; items[idx]={...it,title:e.target.value}; onChange({ items })
                }} />
              </Field>
              <Field label="Description">
                <Textarea value={it.desc} onChange={e=>{ const items=[...data.items]; items[idx]={...it,desc:e.target.value}; onChange({ items }) }} />
              </Field>
              <div className="flex justify-between mt-2">
                <Button size="sm" variant="outline" onClick={()=>{
                  const items=[...data.items]; items.splice(idx+1,0,{id:uuidv4(), title:"New feature", desc:"Describe it..."}); onChange({ items });
                }}>Add below</Button>
                <Button size="sm" variant="destructive" onClick={()=>{ const items=data.items.filter((_,i)=>i!==idx); onChange({ items }); }}><Trash2 className="h-4 w-4"/></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  cta: {
    name: "Call to Action",
    icon: ArrowUpRight,
    defaults: () => ({
      headline: "Ready to get started?",
      subhead: "Join hundreds of happy customers today.",
      ctaLabel: "Get Started",
      ctaHref: "#",
      theme: "dark",
      background: { color: "indigo-600" },
      align: "center",
    }),
    render: ({ data, onChange, editable, funnelOwnerUid }) => {
      const isLight = data.theme === 'light' && !data.background?.color;
      const bgColor = isLight ? CTA_BG_COLORS.light : (CTA_BG_COLORS[data.background?.color] || CTA_BG_COLORS['indigo-600']);
      const textColor = data.textColor === 'dark' || isLight ? '#0f172a' : '#ffffff';
      const alignCls = data.align === 'left' ? 'items-start text-left' : data.align === 'right' ? 'items-end text-right' : 'items-center text-center';
      return (
        <section
          className={`rounded-2xl flex flex-col ${alignCls} ${data.padding || 'py-16'} px-8`}
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          <h2
            contentEditable={editable}
            suppressContentEditableWarning={true}
            onBlur={(e) => onChange && onChange({ headline: e.target.textContent })}
            className="text-3xl md:text-4xl font-bold focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
          >
            {data.headline}
          </h2>
          {(data.subhead || editable) && (
            <p
              contentEditable={editable}
              suppressContentEditableWarning={true}
              onBlur={(e) => onChange && onChange({ subhead: e.target.textContent })}
              className="mt-3 max-w-xl opacity-90 focus:outline-none focus:ring-1 focus:ring-white/30 rounded"
            >
              {data.subhead}
            </p>
          )}
          <div className="mt-6">
            <CtaAction data={data} onChange={onChange} editable={editable} funnelOwnerUid={funnelOwnerUid} buttonClassName="bg-white text-gray-900 hover:bg-gray-100" />
          </div>
        </section>
      );
    },
    inspector: ({ data, onChange }) => (
      <div className="space-y-4">
        <Field label="Headline"><Input value={data.headline} onChange={e=>onChange({ headline: e.target.value })} /></Field>
        <Field label="Subheadline"><Textarea value={data.subhead} onChange={e=>onChange({ subhead: e.target.value })} /></Field>
        <Field label="Button label"><Input value={data.ctaLabel} onChange={e=>onChange({ ctaLabel: e.target.value })} /></Field>
        <ActionFields data={data} onChange={onChange} />
        {(!data.actionType || data.actionType === 'link') && (
          <Field label="Button link"><Input value={data.ctaHref} onChange={e=>onChange({ ctaHref: e.target.value })} /></Field>
        )}
        <Field label="Background color">
          <div className="flex flex-wrap gap-2">
            {Object.keys(CTA_BG_COLORS).map((key) => (
              <button
                key={key}
                type="button"
                title={key}
                onClick={() => onChange({ background: { color: key }, theme: key === 'light' ? 'light' : 'dark' })}
                className={`h-8 w-8 rounded-full border-2 ${data.background?.color === key ? 'border-indigo-500' : 'border-gray-200'}`}
                style={{ backgroundColor: CTA_BG_COLORS[key] }}
              />
            ))}
          </div>
        </Field>
        <Field label="Alignment">
          <div className="flex gap-2">
            {['left','center','right'].map(al=> (
              <Button key={al} size="sm" variant={data.align===al? 'default':'outline'} className="text-black" onClick={()=>onChange({ align: al })}>{al}</Button>
            ))}
          </div>
        </Field>
      </div>
    )
  },
};

// Exported so the public viewer (FunnelViewer.js) can render a saved
// funnel's real blocks with the exact same markup as the editor, instead
// of maintaining a second copy of every block's display logic.
export { BLOCKS };

// (Templates gallery removed — templates are now managed in the separate TemplatesPage)

// ----- Utilities ----- //
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

// ----- Sortable item wrapper ----- //
function SortableItem({ id, children, selected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border ${selected ? 'ring-2 ring-indigo-500' : ''} bg-white hover:bg-gray-50`}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      {...attributes}
    >
      <div
        {...listeners}
        className="absolute left-2 top-2 cursor-grab opacity-60 group-hover:opacity-100"
        title="Drag"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ----- Main App ----- //
export default function FunnelBuilder({ initialTemplateId = null, funnelId = null, currentUserId = null, companySlug = null }) {
  // Map simple template ids (from the TemplatesPage) to block type arrays.
  const TEMPLATE_MAP = {
    volunteer: ['volunteerHero', 'paragraph'],
    wildlife: ['hero', 'heading', 'paragraph', 'features', 'cta'],
    women: ['hero', 'heading', 'paragraph', 'features', 'cta'],
    productLaunch: ['hero', 'features', 'emailCapture'],
    webinar: ['hero', 'emailCapture'],
    storefront: ['hero', 'features', 'image'],
    custom: [],
    // fallback for older keys
    simpleLaunch: ['hero', 'features', 'emailCapture'],
  };
  const [variant, setVariant] = useState('A');
  const [device, setDevice] = useState('desktop');
  const [blocks, setBlocks] = useState(()=>loadInitial(initialTemplateId));
  const [selectedId, setSelectedId] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [importText, setImportText] = useState("");
  // edit mode enables inline editable regions in the canvas
  const [editMode, setEditMode] = useState(true);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // Real persistence — funnelId is set when this editor was opened from the
  // dashboard for an existing (or just-created) funnel row. Before this,
  // the editor only ever wrote to a single shared localStorage key; that
  // stays as a crash-recovery draft cache, but the funnels API is now the
  // source of truth whenever we have a real id to save against.
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [publishStatus, setPublishStatus] = useState('idle'); // idle | publishing | published | error
  const [publicUrl, setPublicUrl] = useState(null);
  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'x-member-uid': currentUserId || 'test_user_1',
  }), [currentUserId]);

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor));

  useEffect(()=>{ localStorage.setItem('funnel.blocks', JSON.stringify(blocks)); },[blocks]);

  // If we're editing a real, already-saved funnel, load its actual blocks
  // from the backend — this overrides whatever loadInitial() guessed from
  // a template or the shared localStorage draft.
  useEffect(() => {
    if (!funnelId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/funnels/${funnelId}`, { headers: authHeaders });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.funnel?.blocks)) {
          setBlocks(data.funnel.blocks);
        }
        if (data.funnel?.published) {
          setPublishStatus('published');
        }
      } catch (e) {
        // non-fatal — editor still usable against whatever loadInitial() gave it
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funnelId]);

  // Debounced autosave to the real backend whenever blocks change, if we
  // have a funnel to save against.
  useEffect(() => {
    if (!funnelId) return;
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/funnels/${funnelId}`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ blocks }),
        });
        setSaveStatus(res.ok ? 'saved' : 'error');
      } catch (e) {
        setSaveStatus('error');
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, funnelId]);

  async function publishFunnel() {
    if (!funnelId) {
      alert('Create this funnel from the Funnels dashboard first, then publishing will be available here.');
      return;
    }
    setPublishStatus('publishing');
    try {
      const res = await fetch(`${API_URL}/api/funnels/${funnelId}/publish`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (!res.ok) {
        setPublishStatus('error');
        return;
      }
      const data = await res.json();
      setPublishStatus('published');
      if (companySlug && data.funnel?.slug) {
        setPublicUrl(`${window.location.origin}/funnel/${companySlug}/${data.funnel.slug}`);
      }
    } catch (e) {
      setPublishStatus('error');
    }
  }

  // If the URL contains a ?template=... param (navigated from TemplatesPage),
  // hydrate the editor with the starter blocks from the central registry.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    try {
      const tmpl = searchParams.get('template');
      if (tmpl) {
        const starter = getStarterBlocks(tmpl);
        if (Array.isArray(starter) && starter.length > 0) {
          const hydrated = starter.map((b) => ({ id: uuidv4(), type: b.type, data: b.data }));
          setBlocks(hydrated);
        }
      }
    } catch (e) {
      // ignore and leave existing blocks
    }
  }, [searchParams]);

  const pushHistory = useCallback((next)=>{ setHistory((h)=>[...h, blocks]); setFuture([]); setBlocks(next); },[blocks]);

  function loadInitial(templateId){
      if (templateId) {
        // Prefer the centralized template registry first — it contains the
        // canonical, full starter schemas (hero + features + etc.). This
        // ensures the App's onSelectTemplate flow and ?template=... navigation
        // both hydrate the editor with the full starter when available.
        try {
          const starter = getStarterBlocks(templateId);
          if (Array.isArray(starter) && starter.length > 0) {
            return starter.map((b) => ({ id: uuidv4(), type: b.type, data: b.data }));
          }
        } catch (e) {
          // ignore and fall back to TEMPLATE_MAP below
        }

        // Fallback: if registry didn't provide a starter, use the faster
        // TEMPLATE_MAP (legacy inline mapping) when present.
        if (TEMPLATE_MAP[templateId] !== undefined) {
          const types = TEMPLATE_MAP[templateId] || [];
          if (types.length === 0) return [];
          return types.map((t) => makeBlock(t)).filter(Boolean);
        }
      }

    const stored = typeof window !== 'undefined' ? localStorage.getItem('funnel.blocks') : null;
    if (stored) { try { return JSON.parse(stored); } catch(e) {} }
    return [
      makeBlock('hero'),
      makeBlock('features'),
      makeBlock('emailCapture'),
    ];
  }

  function makeBlock(type){
    const def = BLOCKS[type];
    return { id: uuidv4(), type, data: def.defaults() };
  }

  // drag handlers
  const [activeId, setActiveId] = useState(null);
  const activeBlock = blocks.find(b=>b.id===activeId);

  function handleDragStart(event){ setActiveId(event.active.id); }
  function handleDragEnd(event){
    const { active, over } = event; setActiveId(null);
    if (!over || active.id===over.id) return;
    const oldIndex = blocks.findIndex(b=>b.id===active.id);
    const newIndex = blocks.findIndex(b=>b.id===over.id);
    pushHistory(arrayMove(blocks, oldIndex, newIndex));
  }

  function updateBlock(id, patch){
    pushHistory(blocks.map(b=> b.id===id ? { ...b, data: { ...b.data, ...patch } } : b));
  }

  function duplicate(id){
    const idx = blocks.findIndex(b=>b.id===id); if (idx<0) return;
    const copy = { ...blocks[idx], id: uuidv4(), data: JSON.parse(JSON.stringify(blocks[idx].data)) };
    pushHistory([ ...blocks.slice(0, idx+1), copy, ...blocks.slice(idx+1) ]);
  }

  function remove(id){ pushHistory(blocks.filter(b=>b.id!==id)); if (selectedId===id) setSelectedId(null); }

  function addBlock(type){ pushHistory([ ...blocks, makeBlock(type) ]); }

  function doUndo(){ if (!history.length) return; const prev = history[history.length-1]; setHistory(history.slice(0,-1)); setFuture([blocks, ...future]); setBlocks(prev); }
  function doRedo(){ if (!future.length) return; const next = future[0]; setFuture(future.slice(1)); setHistory([...history, blocks]); setBlocks(next); }

  // Use a responsive width for the preview canvas. For desktop use 100% so
  // full-bleed sections (hero with background images) can span the full
  // preview area without an empty side gutter. Tablet/mobile keep fixed
  // preview widths to simulate device sizes.
  const containerWidth = device === 'desktop' ? '100%' : device === 'tablet' ? '768px' : '380px';

  // Export schema
  const schema = useMemo(()=> JSON.stringify({ variant, blocks }, null, 2), [variant, blocks]);

  function importSchema(){ try { const obj = JSON.parse(importText); if (obj?.blocks) { setBlocks(obj.blocks); setVariant(obj.variant||'A'); setShowExport(false);} } catch(e){ alert('Invalid JSON'); } }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
  <div className="w-full px-0 py-5">
          <EditorHeader
            variant={variant}
            setVariant={setVariant}
            device={device}
            setDevice={setDevice}
            doUndo={doUndo}
            doRedo={doRedo}
            showExport={showExport}
            setShowExport={setShowExport}
            schema={schema}
            importText={importText}
            setImportText={setImportText}
            importSchema={importSchema}
            editMode={editMode}
            setEditMode={setEditMode}
            saveStatus={saveStatus}
            publishStatus={publishStatus}
            publishFunnel={publishFunnel}
            publicUrl={publicUrl}
          />

          <div className="pt-[72px] md:pt-[86px]">

          {/* Editor grid: two columns — left toggles between Blocks and Inspector, right is the canvas */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
            {/* Left: Blocks or Inspector (toggle) */}
            <Card className="h-[calc(100vh-180px)] overflow-hidden">
              <CardHeader className="pb-2 flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {selectedId ? <Settings2 className="h-4 w-4"/> : <LayoutTemplate className="h-4 w-4"/>}
                    {selectedId ? 'Inspector' : 'Blocks'}
                  </CardTitle>
                  {/* Quick toggle back to Blocks when inspector is open */}
                  <div>
                    {selectedId && (
                      <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)} className="text-sm">
                        Show Blocks
                      </Button>
                    )}
                  </div>
                </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-240px)] p-3">
                  {selectedId ? (
                    <div className="p-4">
                      <Inspector block={blocks.find(b=>b.id===selectedId)} onChange={(patch)=>updateBlock(selectedId, patch)} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(BLOCKS).map(([key, def])=> (
                        <button key={key} className="group rounded-xl border border-gray-200 p-3 hover:bg-gray-50 text-left transition"
                        onClick={()=>addBlock(key)}>
                          <div className="flex items-center gap-2">
                            <def.icon className="h-4 w-4 text-gray-600"/>
                            <span className="text-sm font-medium">{def.name}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-600">Add {def.name} block</p>
                          <span className="opacity-0 group-hover:opacity-100 inline-flex items-center text-xs text-indigo-600 mt-2">Add <Plus className="h-3 w-3 ml-1"/></span>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Right: Canvas (fuller, better fill) */}
            <Card className="relative h-[calc(100vh-180px)] overflow-hidden">
  <CardContent className="p-0 h-full">
    <div className="relative flex items-start h-full overflow-auto bg-white rounded-none">
      <div className="relative w-full h-full overflow-y-auto" style={{ width: containerWidth }}>
        {/* Full-bleed content frame */}
        <div className="min-h-full bg-white rounded-none border border-gray-200">
          <div className="p-6 space-y-6">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              collisionDetection={closestCenter}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {blocks.map((block) => (
                  <SortableItem
                    key={block.id}
                    id={block.id}
                    selected={selectedId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                  >
                    <BLOCKRenderer
                      block={block}
                      editable={editMode}
                      onChange={(patch) => updateBlock(block.id, patch)}
                      funnelOwnerUid={currentUserId}
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-black"
                        onClick={() => duplicate(block.id)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(block.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </SortableItem>
                ))}

                {blocks.length === 0 && (
                  <div className="text-center text-gray-500 py-20">
                    Add blocks from the left to start building.
                  </div>
                )}
              </SortableContext>

              <DragOverlay>
                {activeBlock ? (
                  <div className="rounded-xl border bg-white p-4 shadow-xl opacity-90">
                    <BLOCKRenderer
                      block={activeBlock}
                      editable={editMode}
                      onChange={(patch) =>
                        updateBlock(activeBlock.id, patch)
                      }
                      funnelOwnerUid={currentUserId}
                    />
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
      </div>
    </div>
    </TooltipProvider>
  );
}

function BLOCKRenderer({ block, editable = false, onChange, funnelOwnerUid }){
  const def = BLOCKS[block.type];
  if (!def) return <div className="text-red-500">Unknown block: {block.type}</div>;
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        // Blocks render real <a href> CTAs/links so the public funnel page
        // works normally — but that means clicking one here in the editor
        // to select/edit it would also really navigate the browser away.
        // Swallowing the click at capture time (before the anchor's native
        // navigation runs) stops that. Scoped to actual <a> elements only
        // (not the whole block) — a blanket preventDefault here would also
        // suppress a submit <button>'s default action (triggering its
        // form's submit event), which is exactly what the "Join mailing
        // list" button/Email Capture block need in order to show their
        // editor-preview success state at all.
        onClickCapture={(e) => { if (editable && e.target.closest('a')) e.preventDefault(); }}
      >
        {def.render({ data: block.data, onChange, editable, funnelOwnerUid })}
      </motion.div>
    </AnimatePresence>
  );
}

function Inspector({ block, onChange }){
  if (!block) return null;
  const def = BLOCKS[block.type];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{def.name}</h4>
        <Badge variant="secondary" className="uppercase">{block.type}</Badge>
      </div>
      {def.inspector({ data: block.data, onChange })}
    </div>
  );
}

// Lightweight Sortable implementation using dnd-kit primitives
function DraggableItem({ id, children }){
  // Implement a minimal wrapper that provides an id and CSS transform via dataset
  return (
    <div id={id} data-id={id} style={{ transform: CSS.Translate.toString({ x: 0, y: 0, scaleX: 1, scaleY: 1 }) }}>
      {children}
    </div>
  );
}

function TooltipWrap({ label, children }){
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// SubscribeInlineForm — real email-capture submission, shared by the
// "Join mailing list" button action and the Email Capture block. Posts to
// the funnel owner's contacts (via server/routes/email/contacts.js, using
// their uid as the x-member-uid header) rather than a separate per-affiliate
// list system, which doesn't exist — see src/Bible/emails/gotchas.md.
function SubscribeInlineForm({
  label = "Subscribe",
  placeholder = "you@example.com",
  successMessage = "Thanks — you're on the list!",
  full = false,
  style = 'default',
  funnelOwnerUid,
  editable,
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || status === 'submitting') return;

    // In the editor canvas this is just a live preview of the block — don't
    // write a real signup every time someone testing the funnel clicks it.
    if (editable) {
      setStatus('success');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-member-uid': funnelOwnerUid || '' },
        body: JSON.stringify({ email, source: 'funnel_signup' }),
      });
      // 409 = this email is already subscribed — that's a success from the visitor's point of view.
      setStatus(res.ok || res.status === 409 ? 'success' : 'error');
    } catch (err) {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return <p className="text-sm text-center text-emerald-700 font-medium py-2">{successMessage}</p>;
  }

  return (
    <div className={full ? 'w-full' : ''}>
      <form onSubmit={handleSubmit} className={`flex gap-2 ${full ? 'w-full' : 'justify-center'}`}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <Button
          type="submit"
          disabled={status === 'submitting'}
          variant={style === 'ghost' ? 'ghost' : style === 'outline' ? 'outline' : 'default'}
        >
          {status === 'submitting' ? '…' : label}
        </Button>
      </form>
      {status === 'error' && (
        <p className="text-xs text-red-600 text-center mt-1">Something went wrong — please try again.</p>
      )}
    </div>
  );
}

// Resize + re-encode an image client-side before it ever reaches Firebase
// Storage. Storage cost (and every later page load's bandwidth) scales with
// stored bytes — an un-resized phone photo can be 4000px+ and several MB;
// funnel images are never displayed larger than the page width, so there's
// no reason to store more than ~1600px on the long edge. WebP at 0.82
// quality typically lands a photo like that in the low hundreds of KB
// (vs multiple MB for the original) with no visible quality loss at
// display size. Falls back to JPEG if the browser can't encode WebP.
async function compressImageFile(file, { maxDimension = 1600, quality = 0.82 } = {}) {
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

    const webpBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (webpBlob) return { blob: webpBlob, extension: 'webp' };

    const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (jpegBlob) return { blob: jpegBlob, extension: 'jpg' };
  } catch (e) {
    // createImageBitmap/canvas unsupported for this file — fall through to the original
  }
  return { blob: file, extension: (file.name.split('.').pop() || 'jpg').toLowerCase() };
}

async function uploadFunnelImage(file) {
  const { blob, extension } = await compressImageFile(file);
  const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const sRef = storageRef(storage, path);
  const task = uploadBytesResumable(sRef, blob);
  await new Promise((res, rej) => {
    task.on('state_changed', null, (err) => rej(err), () => res());
  });
  return getDownloadURL(task.snapshot.ref);
}

// ImageUrlField — an inspector field that accepts either a pasted URL or a
// direct file upload (compressed via uploadFunnelImage before it's stored).
function ImageUrlField({ label = "Image URL", value, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadFunnelImage(file);
      onChange(url);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Image upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = null;
    }
  }

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Paste an image URL…" />
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 text-black"
          disabled={uploading}
          onClick={() => inputRef.current && inputRef.current.click()}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </Field>
  );
}

// UploadImage — small helper that opens a file picker and uploads the image
function UploadImage({ onUploaded, accept = 'image/*', className }){
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e){
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadFunnelImage(file);
      if (onUploaded) onUploaded(url);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Image upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = null;
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      <button
        type="button"
        className={`absolute top-2 right-2 p-1.5 bg-white/80 rounded-md opacity-0 group-hover:opacity-100 transition ${className||''}`}
        onClick={() => inputRef.current && inputRef.current.click()}
        title={uploading ? 'Uploading...' : 'Upload image'}
      >
        <ImageIcon className="h-4 w-4 text-gray-700" />
      </button>
    </>
  );
}

/* CompactControls — small, glassy control pill with Undo/Redo + device toggle */

const TT = ({ label, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent className="px-2 py-1 text-xs rounded-md bg-gray-900 text-white shadow">{label}</TooltipContent>
  </Tooltip>
);

export function CompactControls({ device, setDevice, doUndo, doRedo }) {
  const deviceOpts = [
    { key: "desktop", Icon: Laptop, label: "Desktop" },
    { key: "tablet", Icon: Tablet, label: "Tablet" },
    { key: "mobile", Icon: Smartphone, label: "Mobile" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="
        flex items-center gap-3
        bg-white/70 backdrop-blur-md border border-gray-200
        rounded-xl px-2 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]
      "
    >
      {/* Undo / Redo */}
      <div className="flex items-center gap-1">
        <TT label="Undo (⌘/Ctrl+Z)">
          <button
            type="button"
            onClick={doUndo}
            className="h-8 w-8 grid place-items-center rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:scale-[.97] transition-all"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        </TT>

        <TT label="Redo (⌘/Ctrl+Shift+Z)">
          <button
            type="button"
            onClick={doRedo}
            className="h-8 w-8 grid place-items-center rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:scale-[.97] transition-all"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </TT>
      </div>

      <span className="h-5 w-px bg-gray-200 mx-1" aria-hidden />

      {/* Device preview buttons */}
      <div className="flex items-center gap-1">
        {deviceOpts.map(({ key, Icon, label }) => {
          const active = device === key;
          return (
            <TT key={key} label={label}>
              <button
                type="button"
                onClick={() => setDevice(key)}
                className={`
                  h-8 w-9 grid place-items-center rounded-md transition-all
                  ${active
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }
                `}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            </TT>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ========= EDITOR HEADER ========= */
function IconBtn({ label, onClick, children }) {
  return (
    <TooltipWrap label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onClick}
      >
        {children}
      </Button>
    </TooltipWrap>
  );
}

/* Segmented control (variants + device) */
function Segmented({ options, value, onChange, compact = false }) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${active 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-600 hover:text-gray-800"
              }
            `}
          >
            {opt.icon && <span className="mr-1">{opt.icon}</span>}
            {opt.label || opt.key}
          </button>
        );
      })}
    </div>
  );
}

function EditorHeader({
  variant,
  setVariant,
  device,
  setDevice,
  doUndo,
  doRedo,
  showExport,
  setShowExport,
  schema,
  importText,
  setImportText,
  importSchema,
  editMode,
  setEditMode,
  saveStatus,
  publishStatus,
  publishFunnel,
  publicUrl,
}) {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/80 border-b border-gray-200 shadow-sm">
      <div className="max-w-[1400px] mx-auto h-14 px-4 md:px-6 flex items-center justify-between gap-4">
        {/* Left Section — Brand */}
        <div className="flex items-center gap-3">
          <span className="text-sm md:text-base font-semibold tracking-tight text-gray-800 flex items-center gap-1">
            ⚡ <span>Funnel Builder</span>
          </span>

          <div className="hidden sm:flex items-center gap-2 ml-4">
            <Segmented
              options={[
                { key: "A", label: "Variant A" },
                { key: "B", label: "Variant B" },
              ]}
              value={variant}
              onChange={setVariant}
            />

            <Button
              variant={editMode ? "default" : "outline"}
              size="icon"
              onClick={() => setEditMode(!editMode)}
              className="transition-all hover:scale-105"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Secondary row (compact + pretty) */}
        <div className="h-12 px-4 md:px-6 flex items-center justify-start">
          <CompactControls device={device} setDevice={setDevice} doUndo={doUndo} doRedo={doRedo} />
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-2">
          <Dialog open={showExport} onOpenChange={setShowExport}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex text-gray-700 hover:text-gray-900"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Export / Import Schema</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="export">
                <TabsList className="mb-3">
                  <TabsTrigger value="export">Export</TabsTrigger>
                  <TabsTrigger value="import">Import</TabsTrigger>
                </TabsList>
                <TabsContent value="export">
                  <Textarea
                    className="h-80 font-mono text-xs"
                    value={schema}
                    readOnly
                  />
                </TabsContent>
                <TabsContent value="import">
                  <Textarea
                    className="h-80 font-mono text-xs"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste your JSON schema here"
                  />
                  <div className="mt-3 flex justify-end">
                    <Button onClick={importSchema}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <span className="hidden md:inline text-xs text-gray-400">
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'error' && 'Save failed'}
          </span>

          <Button
            onClick={publishFunnel}
            disabled={publishStatus === 'publishing'}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-60"
          >
            <Play className="h-4 w-4 mr-2" />
            {publishStatus === 'publishing' ? 'Publishing…' : publishStatus === 'published' ? 'Published' : 'Publish'}
          </Button>
        </div>
      </div>

      {publicUrl && (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 pb-2 text-xs text-emerald-700 flex items-center gap-2">
          Live at
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">{publicUrl}</a>
          <button
            className="text-emerald-600 hover:text-emerald-800"
            onClick={() => navigator.clipboard?.writeText(publicUrl)}
          >
            Copy
          </button>
        </div>
      )}
    </header>
  );
}
