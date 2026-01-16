import React, { useMemo, useRef, useState, useEffect, useId } from "react";
import { useNavigate } from "react-router-dom";
import EditorSidebarBlocks from "./EditorSidebarBlocks";
import ButtonEditor from "./ButtonEditor";
import { GripVertical, Trash2, Edit3, MoveUpRight } from "lucide-react";
import { storage, db } from '../../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { ref as dbRef, set, push, serverTimestamp } from 'firebase/database';
import { API_URL } from '../../../config/environment';

/**
 * TemplateEditor
 * ------------------------------------------------------------
 * - Left: Block palette (click or drag from EditorSidebarBlocks)
 * - Right: Email canvas (drop zones between blocks, inline editing)
 * - Exports a proper email-friendly HTML (tables) from blocks
 * - Preview modal renders exported HTML via <iframe srcDoc>
 *
 * Notes
 *  - Drag payload from palette:  dataTransfer type "application/x-editor-block" with { type }
 *  - Inline editors use controlled inputs or contentEditable (for quick text)
 */

// -----------------------------
// Block model (plain JS)
// -----------------------------
function uid(prefix = "b") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Drag helpers/constants
const DRAG_NEW_BLOCK = "application/x-editor-block";
const DRAG_REORDER = "application/x-editor-reorder";

// backwards/alternate names used in some snippets
const NEWBLOCK_MIME = DRAG_NEW_BLOCK;
const MOVE_MIME = DRAG_REORDER;

function moveItem(arr, from, to) {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function createDefaultBlock(type) {
  switch (type) {
    case "title":
      return { id: uid("title"), type, data: { text: "The announcement template", align: "center", fontSize: 26, color: "#313638" } };
    case "text":
      return {
        id: uid("text"),
        type,
        data: {
          html:
            "This template is great for announcing new products and features. This text box can extend as far as you need, ensuring you can share all the essential details.<br><br>Don't have anything to announce? You could also use this template for welcoming users to your mailing list or thanking them for an event you've run.",
        },
      };
    case "logo":
      return {
        id: uid("logo"),
        type,
        data: {
          src:
            "https://gallery.eousercontent.com/0c035aee-9b79-11f0-a20d-2b34ffa5e2ed%2F1759387962194-Screenshot%202025-09-01%20120152.png",
          href: "https://example.com",
          width: 160,
        },
      };
    case "image":
      return {
        id: uid("image"),
        type,
        data: {
          src: "https://via.placeholder.com/600x300.png?text=Your+Image",
          alt: "",
          full: true,
        },
      };
    case "video":
      return {
        id: uid("video"),
        type,
        data: {
          url: "https://youtu.be/dQw4w9WgXcQ",
          thumbnail: "https://via.placeholder.com/600x338.png?text=Video",
        },
      };
    case "button":
      return {
        id: uid("button"),
        type,
        data: { label: "Call to action", href: "#", fill: false },
      };
    case "social-follow":
      return {
        id: uid("social"),
        type,
        data: {
          links: [
            {
              name: "facebook",
              href: "https://facebook.com",
              icon: "https://gallery.eousercontent.com/tentacles/icons/v1/social-block/square/color/facebook.png",
            },
          ],
        },
      };
    case "divider":
      return { id: uid("divider"), type, data: { thickness: 1, color: "#E5E7EB" } };
    case "code":
      return { id: uid("code"), type, data: { html: "<!-- custom html here -->" } };
    default:
      return { id: uid("block"), type, data: {} };
  }
}

// -----------------------------
// Canvas blocks (inline editing)
// -----------------------------
function Toolbar({ onDelete, onMoveUp, onMoveDown }) {
  return (
    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/80 p-1 shadow-sm">
      <button type="button" className="rounded-md p-1 hover:bg-slate-100" title="Move up" onClick={onMoveUp}>
        ↑
      </button>
      <button type="button" className="rounded-md p-1 hover:bg-slate-100" title="Move down" onClick={onMoveDown}>
        ↓
      </button>
      <button type="button" className="rounded-md p-1 hover:bg-slate-100" title="Drag to move">
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" className="rounded-md p-1 hover:bg-red-50" title="Remove block" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-red-500" />
      </button>
    </div>
  );
}

const TitleBlock = React.memo(function TitleBlock({ block, onChange, onDelete, onMoveUp, onMoveDown }) {
  const { text, align, fontSize = 26, color = "#313638" } = block.data;
  const contentRef = useRef(null);
  const isTypingRef = useRef(false);

  // Only update innerHTML if user is NOT currently typing
  useEffect(() => {
    if (!isTypingRef.current && contentRef.current && contentRef.current.innerHTML !== text) {
      contentRef.current.innerHTML = text;
    }
  }, [text]);

  const handleInput = (e) => {
    isTypingRef.current = true;
    const newText = e.currentTarget.innerHTML;
    console.log('TitleBlock onInput:', { blockId: block.id, newText: newText.substring(0, 30) + '...' });
    onChange({ ...block.data, text: newText });
    // Reset typing flag after a short delay
    setTimeout(() => {
      isTypingRef.current = false;
    }, 100);
  };

  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-4">
      <Toolbar onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      <div className="mb-3 flex items-center gap-2 text-sm">
        <label className="text-slate-600">Align</label>
        <select className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={align} onChange={(e) => onChange({ ...block.data, align: e.target.value })}>
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </div>
      <h1
        ref={contentRef}
        className={`m-0 font-semibold text-slate-800 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}
        style={{ fontSize: fontSize ? `${fontSize}px` : undefined, color: color || undefined }}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
      />
    </div>
  );
});

const TextBlock = React.memo(function TextBlock({ block, onChangeHtml, onUpdateOpts, onDelete, onMoveUp, onMoveDown }) {
  const html = block.data?.html || "";
  const opts = block.data?.opts || {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.25,
    textAlign: "left",
    padding: { top: 5, right: 7, bottom: 25, left: 7 },
    backgroundColor: "",
  };

  const style = {
    background: opts.backgroundColor || undefined,
    fontFamily: opts.fontFamily,
    fontSize: opts.fontSize ? `${opts.fontSize}px` : undefined,
    fontWeight: opts.fontWeight,
    lineHeight: opts.lineHeight,
    textAlign: opts.textAlign,
    paddingTop: opts.padding?.top,
    paddingRight: opts.padding?.right,
    paddingBottom: opts.padding?.bottom,
    paddingLeft: opts.padding?.left,
  };

  const contentRef = useRef(null);
  const isTypingRef = useRef(false);

  // Only update innerHTML if user is NOT currently typing
  useEffect(() => {
    if (!isTypingRef.current && contentRef.current && contentRef.current.innerHTML !== html) {
      contentRef.current.innerHTML = html;
    }
  }, [html]);

  const handleInput = (e) => {
    isTypingRef.current = true;
    const newHtml = e.currentTarget.innerHTML;
    console.log('TextBlock onInput:', { blockId: block.id, newHtml: newHtml.substring(0, 50) + '...' });
    onChangeHtml?.(newHtml);
    // Reset typing flag after a short delay
    setTimeout(() => {
      isTypingRef.current = false;
    }, 100);
  };

  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-4">
      <Toolbar onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      <div
        ref={contentRef}
        className="prose max-w-none text-slate-800"
        contentEditable
        suppressContentEditableWarning
        style={style}
        onInput={handleInput}
      />
    </div>
  );
});

/* Segmented control and LogoEditor (inserted from user request) */
function Segmented({ value, onChange, options }) {
  return (
    <div style={styles.segmentedWrap} role="tablist" aria-label="Logo position">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            style={{
              ...styles.segment,
              ...(active ? styles.segmentActive : {}),
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// small text-align control suggested by user
function TextAlignControl({ value = "left", onChange }) {
  const opts = [
    { v: "left", label: "Left" },
    { v: "center", label: "Center" },
    { v: "right", label: "Right" },
  ];

  return (
    <div style={tac.wrap}>
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(o.v)}
            style={{ ...tac.btn, ...(active ? tac.btnActive : {}) }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const tacPurple = "#6e54d7";
const tac = {
  wrap: {
    display: "inline-flex",
    borderRadius: 999,
    background: "#eef2ff",
    padding: 4,
    gap: 4,
  },
  btn: {
    border: 0,
    background: "transparent",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    color: "#374151",
    cursor: "pointer",
  },
  btnActive: {
    background: tacPurple,
    color: "#fff",
    fontWeight: 600,
  },
};

function LogoEditorInner({
  value,
  onChange,
  gallery = [],
  onUploadClick,
}) {
  const {
    src = "",
    widthPct = 66,
    align = "center",
    alt = "Trial logo",
    href = "https://IdontHaveone.com",
  } = value ?? {};

  const sliderId = useId();
  const widthBoxId = useId();
  const altId = useId();
  const linkId = useId();

  const set = (patch) => onChange?.({ src, widthPct, align, alt, href, ...patch });

  const clampPct = (n) => Math.max(5, Math.min(100, Number.isFinite(n) ? Math.round(n) : 0));

  return (
    <div style={styles.card}>
      <h4 style={styles.title}>Select logo</h4>

      <div style={styles.gallery}>
        {gallery.map((g, i) => {
          const active = g.src === src;
          return (
            <button
              key={g.src || i}
              type="button"
              onClick={() => set({ src: g.src, alt: g.alt ?? alt })}
              title={g.alt || "Logo"}
              style={{
                ...styles.logoTile,
                ...(active ? styles.logoTileActive : {}),
              }}
            >
              <img src={g.src} style={styles.logoImg} alt="" />
            </button>
          );
        })}

        <button
          type="button"
          onClick={onUploadClick}
          style={styles.logoTileDashed}
          aria-label="Upload a logo"
          title="Upload"
        >
          <span style={styles.plus}>＋</span>
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <label htmlFor={sliderId} style={styles.label}>Width</label>
        <div style={styles.sliderRow}>
          <input
            id={sliderId}
            type="range"
            min={5}
            max={100}
            value={widthPct}
            onChange={(e) => set({ widthPct: clampPct(+e.target.value) })}
            style={styles.range}
          />
          <div style={styles.pctBoxWrap}>
            <input
              id={widthBoxId}
              type="number"
              min={5}
              max={100}
              value={widthPct}
              onChange={(e) => set({ widthPct: clampPct(+e.target.value) })}
              style={styles.pctBox}
            />
            <span style={styles.pctSuffix}>%</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={styles.label}>Position</div>
        <Segmented
          value={align}
          onChange={(v) => set({ align: v })}
          options={[
            { value: "left", label: "left" },
            { value: "center", label: "centre" },
            { value: "right", label: "right" },
          ]}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label htmlFor={altId} style={styles.label}>Alt text</label>
        <div style={styles.subLabel}>Text that shows when an image cannot load</div>
        <input
          id={altId}
          type="text"
          value={alt}
          onChange={(e) => set({ alt: e.target.value })}
          placeholder="Alt text"
          style={styles.input}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label htmlFor={linkId} style={styles.label}>Link</label>
        <div style={styles.linkWrap}>
          <input
            id={linkId}
            type="url"
            value={href}
            onChange={(e) => set({ href: e.target.value })}
            placeholder="https://your-site.com"
            style={{ ...styles.input, paddingRight: 34 }}
          />
          {href && (
            <button
              type="button"
              onClick={() => set({ href: "" })}
              aria-label="Clear link"
              style={styles.clearBtn}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LogoBlock({ block, onChange, onDelete }) {
  // Compact preview for the canvas; full controls live in the left sidebar
  const { src = "", href = "", width = 160, align = "center" } = block.data || {};
  const widthStyle = width ? { width, maxWidth: "100%", display: "inline-block" } : { maxWidth: "100%", display: "inline-block" };
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  return (
    <div className={`relative rounded-lg border border-slate-200 bg-white p-4 ${alignClass}`}>
      <Toolbar onDelete={onDelete} onMoveUp={onChange?.onMoveUp} onMoveDown={onChange?.onMoveDown} />
      <div>
        <a href={href} target="_blank" rel="noreferrer" className="inline-block">
          <img src={src} alt="logo" style={widthStyle} />
        </a>
      </div>
      <div className="mt-3 text-xs text-slate-500">Select the block to edit logo options</div>
    </div>
  );
}

function ImageBlock({ block, onChange, onDelete }) {
  const { src, alt, align = "center", widthPct = 100 } = block.data;
  const alignClass = align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center";
  const imgStyle = { width: `${widthPct}%`, maxWidth: "100%", display: "inline-block" };
  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 ${alignClass}`}>
      <Toolbar onDelete={onDelete} onMoveUp={onChange?.onMoveUp} onMoveDown={onChange?.onMoveDown} />
      <div className="px-2 py-1">
        <a href={block.data?.href || "#"} target="_blank" rel="noreferrer" className="inline-block">
          <img src={src} alt={alt} style={imgStyle} />
        </a>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 text-xs">
        <input className="col-span-2 rounded-md border border-slate-300 px-2 py-1" placeholder="Image URL" value={src} onChange={(e) => onChange({ ...block.data, src: e.target.value })} />
        <input className="rounded-md border border-slate-300 px-2 py-1" placeholder="Alt text" value={alt} onChange={(e) => onChange({ ...block.data, alt: e.target.value })} />
      </div>
    </div>
  );
}

function ButtonBlock({ block, onChange, onDelete }) {
  const {
    text: label = "Click Here",
    href = "#",
    widthPct = 70,
    align = "center",
    bgColor = "#6e54d7",
    textColor = "#ffffff",
    paddingY = 18,
    radius = 8,
    border = { style: "none", width: 1, color: "#6e54d7" },
    fontFamily = undefined,
    fontSize = 18,
    fontWeight = 700,
  } = block.data || {};

  const wrapperStyle = {
    display: "flex",
    justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
    padding: "12px 0",
  };

  const btnStyle = {
    display: "inline-block",
    width: `${widthPct}%`,
    textAlign: "center",
    textDecoration: "none",
    cursor: "pointer",
    color: textColor,
    background: border?.style === "outline" ? "transparent" : bgColor,
    border: border?.style === "none" ? "none" : `${border?.width || 1}px ${border?.style === "dashed" ? "dashed" : "solid"} ${border?.color || "#6e54d7"}`,
    borderRadius: radius,
    padding: `${paddingY}px 12px`,
    fontFamily: fontFamily || undefined,
    fontWeight: fontWeight,
    fontSize: fontSize,
    lineHeight: 1.2,
    display: "inline-block",
  };

  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-4">
      <Toolbar onDelete={onDelete} onMoveUp={onChange?.onMoveUp} onMoveDown={onChange?.onMoveDown} />
      <div style={wrapperStyle}>
        <a href={href} style={btnStyle} rel="noreferrer">
          {label}
        </a>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <input className="col-span-1 rounded-md border border-slate-300 px-2 py-1" placeholder="Label" value={label} onChange={(e) => onChange({ ...block.data, text: e.target.value })} />
        <input className="col-span-2 rounded-md border border-slate-300 px-2 py-1" placeholder="Link href" value={href} onChange={(e) => onChange({ ...block.data, href: e.target.value })} />
      </div>
    </div>
  );
}

function DividerBlock({ block, onChange, onDelete }) {
  const { thickness, color } = block.data;
  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-3">
      <Toolbar onDelete={onDelete} onMoveUp={onChange?.onMoveUp} onMoveDown={onChange?.onMoveDown} />
      <div className="py-3">
        <div style={{ height: thickness, background: color }} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <input className="rounded-md border border-slate-300 px-2 py-1" type="number" min={1} max={8} value={thickness} onChange={(e) => onChange({ ...block.data, thickness: Number(e.target.value) })} />
        <input className="col-span-2 rounded-md border border-slate-300 px-2 py-1" value={color} onChange={(e) => onChange({ ...block.data, color: e.target.value })} />
      </div>
    </div>
  );
}

function SocialBlock({ block, onChange, onDelete }) {
  const { links } = block.data;
  const update = (i, patch) => {
    const next = [...links];
    next[i] = { ...next[i], ...patch };
    onChange({ ...block.data, links: next });
  };
  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-4">
      <Toolbar onDelete={onDelete} onMoveUp={onChange?.onMoveUp} onMoveDown={onChange?.onMoveDown} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        {links.map((l, i) => (
          <a key={i} href={l.href} className="inline-block" rel="noreferrer">
            <img src={l.icon} alt={l.name} width={40} height={40} />
          </a>
        ))}
      </div>
      <div className="mt-3 space-y-2 text-xs">
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-6 gap-2">
            <input className="col-span-1 rounded-md border border-slate-300 px-2 py-1" value={l.name} onChange={(e) => update(i, { name: e.target.value })} />
            <input className="col-span-3 rounded-md border border-slate-300 px-2 py-1" value={l.href} onChange={(e) => update(i, { href: e.target.value })} />
            <input className="col-span-2 rounded-md border border-slate-300 px-2 py-1" value={l.icon} onChange={(e) => update(i, { icon: e.target.value })} />
          </div>
        ))}
        <button type="button" className="mt-1 inline-flex items-center gap-2 rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={() => onChange({ ...block.data, links: [...links, { name: "link", href: "#", icon: "" }] })}>
          <Edit3 className="h-3 w-3" /> Add link
        </button>
      </div>
    </div>
  );
}

function CodeBlock({ block, onChange, onDelete }) {
  const { html } = block.data;
  return (
    <div className="relative rounded-lg border border-slate-200 bg-white p-4">
      <Toolbar onDelete={onDelete} onMoveUp={onChange?.onMoveUp} onMoveDown={onChange?.onMoveDown} />
      <textarea className="h-40 w-full rounded-md border border-slate-300 p-2 font-mono text-xs" value={html} onChange={(e) => onChange({ ...block.data, html: e.target.value })} />
    </div>
  );
}

const BlockRenderer = ({ block, onChange, onDelete, onMoveUp, onMoveDown }) => {
  switch (block.type) {
    case "title":
      return <TitleBlock block={block} onChange={onChange} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />;
    case "text":
      return (
        <TextBlock
          block={block}
          onChangeHtml={(html) => onChange({ ...block.data, html })}
          onUpdateOpts={(optsPatch) => onChange({ ...block.data, opts: { ...(block.data?.opts || {}), ...optsPatch } })}
          onDelete={onDelete}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      );
    case "logo":
      return <LogoBlock block={block} onChange={onChange} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />;
    case "image":
      return <ImageBlock block={block} onChange={onChange} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />;
    case "button":
      return <ButtonBlock block={block} onChange={onChange} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />;
    case "divider":
      return <DividerBlock block={block} onChange={onChange} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />;
    case "social-follow":
      return <SocialBlock block={block} onChange={onChange} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />;
    case "code":
      return <CodeBlock block={block} onChange={onChange} onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />;
    case "section": {
      const children = block.children || block.data?.children || [];
      const backgroundColor = block.data?.background || block.data?.backgroundColor || "";
      const backgroundImage = block.data?.backgroundImage || "";
      const paddingObj = block.data?.padding || {};
      const paddingTop = paddingObj.top ?? block.data?.paddingTop ?? 0;
      const paddingRight = paddingObj.right ?? block.data?.paddingRight ?? 0;
      const paddingBottom = paddingObj.bottom ?? block.data?.paddingBottom ?? 0;
      const paddingLeft = paddingObj.left ?? block.data?.paddingLeft ?? 0;

      const wrapperStyle = {
        marginTop: (block.data?.marginTop ?? 0) ? `${block.data.marginTop}px` : undefined,
        marginBottom: (block.data?.marginBottom ?? 0) ? `${block.data.marginBottom}px` : undefined,
      };

      const innerStyle = {
        padding: `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,
        backgroundColor: backgroundImage ? undefined : backgroundColor || undefined,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: backgroundImage ? "cover" : undefined,
        backgroundPosition: backgroundImage ? "center" : undefined,
        backgroundRepeat: backgroundImage ? "no-repeat" : undefined,
      };

      return (
        <div className="relative rounded-lg border border-slate-200 p-0" style={{ overflow: "hidden", ...wrapperStyle }}>
          <Toolbar onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
          <div style={innerStyle}>
            {children.map((c) => (
              <div key={c.id} className="my-3">
                <BlockRenderer
                  block={c}
                  onChange={(data) => {
                    const nextChildren = (block.data?.children || []).map((ci) => (ci.id === c.id ? { ...ci, data } : ci));
                    onChange({ ...block.data, children: nextChildren });
                  }}
                  onDelete={() => {
                    const nextChildren = (block.data?.children || []).filter((ci) => ci.id !== c.id);
                    onChange({ ...block.data, children: nextChildren });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "video":
      return (
        <div className="relative rounded-lg border border-slate-200 bg-white p-4">
          <Toolbar onDelete={onDelete} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
          <a href={block.data.url} target="_blank" rel="noreferrer" className="group relative block">
            <img src={block.data.thumbnail} alt="video" className="w-full" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="rounded-full bg-white/90 p-3 shadow">
                <MoveUpRight className="h-5 w-5" />
              </span>
            </span>
          </a>
          <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
            <input className="col-span-3 rounded-md border border-slate-300 px-2 py-1" placeholder="Video URL" value={block.data.url} onChange={(e) => onChange({ ...block.data, url: e.target.value })} />
            <input className="col-span-2 rounded-md border border-slate-300 px-2 py-1" placeholder="Thumbnail URL" value={block.data.thumbnail} onChange={(e) => onChange({ ...block.data, thumbnail: e.target.value })} />
          </div>
        </div>
      );
    default:
      return null;
  }
};

// -----------------------------
// Email HTML Export (table-based)
// -----------------------------
const EMAIL_HEAD = `\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width" initial-scale="1">\n<meta http-equiv="X-UA-Compatible" content="IE=edge">\n<meta name="x-apple-disable-message-reformatting">\n<title></title>\n<style>\n*,*:after,*:before{box-sizing:border-box}*{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}html,body,.document{width:100%!important;height:100%!important;margin:0;padding:0}body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;padding:0}table{border-spacing:0;border-collapse:collapse;table-layout:fixed;margin:0 auto}img{-ms-interpolation-mode:bicubic;max-width:100%;border:0}*[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}body,html,td{font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;color:#000}a,.container a{color:#000;text-decoration:none}\n</style>`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blockToEmailHTML(block) {
  // Helper to convert relative URLs to absolute URLs for email
  const makeAbsoluteUrl = (url) => {
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    // Convert relative URLs to absolute using production domain for email compatibility
    // Use environment variable or fallback to current origin for local testing
    const baseUrl = process.env.REACT_APP_PUBLIC_URL || process.env.REACT_APP_DOMAIN || 'https://fotonix.co.uk';
    if (url.startsWith('/')) {
      return `${baseUrl}${url}`;
    }
    return url;
  };
  
  switch (block.type) {
    case "logo": {
        const { src, href, width, align } = block.data;
        const alignAttr = align || "center";
        const absoluteSrc = makeAbsoluteUrl(src);
        const absoluteHref = makeAbsoluteUrl(href);
        return `\n<table role="presentation" width="100%"><tr><td align="${alignAttr}" style="padding:10px 15px;">\n  <a href="${escapeHtml(absoluteHref)}"><img src="${escapeHtml(absoluteSrc)}" alt="logo" width="${width}" style="width:${width}px;max-width:100%;display:block;border:none;outline:none;"/></a>\n</td></tr></table>`;
    }
    case "title": {
      const { text, align, fontSize = 26, color = "#313638" } = block.data;
      return `\n<table role="presentation" width="100%"><tr><td style="padding:5px 15px 15px 15px;">\n  <h1 style="margin:0;color:${escapeHtml(color)};font-size:${fontSize}px;text-align:${align};">${text}</h1>\n</td></tr></table>`;
    }
    case "text": {
      return `\n<table role="presentation" width="100%"><tr><td style="padding:5px 15px 20px 15px;">\n  <div style="line-height:1.45;color:#313638;">${block.data.html}</div>\n</td></tr></table>`;
    }
    case "image": {
      const { src, alt, align = "center", widthPct = 100 } = block.data;
      const alignAttr = align || "center";
      const absoluteSrc = makeAbsoluteUrl(src);
      // widthPct maps into max-width percentage of the content column (approx)
      const imgStyle = `display:block;border:none;outline:none;max-width:${widthPct}%`; 
      return `\n<table role="presentation" width="100%"><tr><td align="${alignAttr}" style="padding:0;">\n  <img src="${escapeHtml(absoluteSrc)}" alt="${escapeHtml(alt || "")}" style="${imgStyle}"/>\n</td></tr></table>`;
    }
    case "button": {
      const {
        text: label = "Click Here",
        href = "#",
        widthPct = 70,
        align = "center",
        bgColor = "#6e54d7",
        textColor = "#ffffff",
        paddingY = 18,
        radius = 8,
        border = { style: "none", width: 1, color: "#6e54d7" },
        fontFamily = null,
        fontSize = 18,
        fontWeight = 700,
      } = block.data || {};

      const alignAttr = align || "center";
      const innerWidth = `${widthPct}%`;
      const borderStyle = border?.style === "none" ? "none" : `${border?.width || 1}px ${border?.style === "dashed" ? "dashed" : "solid"} ${escapeHtml(border?.color || "#6e54d7")}`;
      const bg = border?.style === "outline" ? "transparent" : bgColor;
      const fontFam = fontFamily ? escapeHtml(fontFamily) : "Arial, Helvetica, sans-serif";

      // Enhanced button styling for better email client compatibility
      // Use table-based button with solid background and proper spacing
      const aStyle = `display:inline-block;color:${escapeHtml(textColor)};background:${escapeHtml(bg)};border:${borderStyle};border-radius:${radius}px;padding:${paddingY}px 32px;font-family:${fontFam};font-size:${fontSize}px;font-weight:${fontWeight};text-decoration:none;text-align:center;line-height:1.2;mso-padding-alt:0;`;
      
      // Wrapper td styling for Outlook
      const tdStyle = `background:${escapeHtml(bg)};border:${borderStyle};border-radius:${radius}px;mso-padding-alt:${paddingY}px 32px;`;

      return `\n<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="${alignAttr}" style="padding:10px 0;">\n  <table role="presentation" align="${alignAttr}" cellpadding="0" cellspacing="0" border="0" style="width:${innerWidth};border-collapse:separate !important;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr><td align="center" valign="middle" style="${tdStyle}">\n    <a href="${escapeHtml(href)}" target="_blank" style="${aStyle}"><span style="color:${escapeHtml(textColor)};font-family:${fontFam};font-size:${fontSize}px;font-weight:${fontWeight};line-height:1.2;mso-line-height-rule:exactly;">${escapeHtml(label)}</span></a>\n  </td></tr></table>\n</td></tr></table>`;
    }
    case "divider": {
      const { thickness, color } = block.data;
      return `\n<table role="presentation" width="100%"><tr><td style="padding:10px 15px"><div style="height:${thickness}px;background:${color};line-height:${thickness}px;font-size:${thickness}px">&nbsp;</div></td></tr></table>`;
    }
    case "social-follow": {
      const { links } = block.data;
      const icons = links
        .map(
          (l) => `\n<td align="center" valign="middle" width="48" style="padding:0 5px"><a href="${escapeHtml(
            l.href
          )}" target="_blank"><img src="${escapeHtml(
            l.icon
          )}" height="48" width="48" style="display:block;border:0;height:auto;outline:none;-ms-interpolation-mode:bicubic"/></a></td>`
        )
        .join("");
      return `\n<table role="presentation" width="100%"><tr><td align="center" style="padding:5px 0"><table align="center" role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>${icons}</tr></table></td></tr></table>`;
    }
    case "code":
      return `\n${block.data.html}`;
    case "video": {
      const { url, thumbnail } = block.data;
      return `\n<table role="presentation" width="100%"><tr><td align="center" style="padding:0"><a href="${escapeHtml(
        url
      )}" target="_blank"><img src="${escapeHtml(
        thumbnail
      )}" width="570" style="display:block;width:100%;max-width:100%;border:none;outline:none" alt="video"/></a></td></tr></table>`;
    }
    case "section": {
      const children = block.children || block.data?.children || [];
      const backgroundColor = block.data?.background || block.data?.backgroundColor || "";
      const backgroundImage = block.data?.backgroundImage || "";
      const paddingObj = block.data?.padding || {};
      const paddingTop = paddingObj.top ?? block.data?.paddingTop ?? 0;
      const paddingRight = paddingObj.right ?? block.data?.paddingRight ?? 0;
      const paddingBottom = paddingObj.bottom ?? block.data?.paddingBottom ?? 0;
      const paddingLeft = paddingObj.left ?? block.data?.paddingLeft ?? 0;

      const styleParts = [];
      if (backgroundImage) {
        styleParts.push(`background-image:url(${escapeHtml(backgroundImage)})`, `background-size:cover`, `background-repeat:no-repeat`);
      } else if (backgroundColor) {
        styleParts.push(`background-color:${escapeHtml(backgroundColor)}`);
      }
      styleParts.push(`padding:${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`);
      const styleAttr = styleParts.join(";");

      const inner = children.map(blockToEmailHTML).join("\n");
      return `\n<table role="presentation" width="100%"><tr><td style="${styleAttr}">\n${inner}\n</td></tr></table>`;
    }
    default:
      return "";
  }
}

 
function renderEmail(blocks) {
  const body = blocks.map(blockToEmailHTML).join("\n");
  return `<!DOCTYPE html>\n<html><head>${EMAIL_HEAD}</head>\n<body bgcolor="#e8e9eb" style="background-color:#e8e9eb;font-size:16px;">\n<table role="presentation" class="document" align="center"><tr><td valign="top">\n<table role="presentation" align="center" width="600" class="container" style="margin:0 auto;background:#ffffff">\n<tr><td>${body}</td></tr>\n</table>\n</td></tr></table>\n</body></html>`;
}

/* Inline styles used by the embedded LogoEditor */
const styles = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    background: "#fff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    color: "#1f2937",
  },
  title: { margin: 0, marginBottom: 10, fontSize: 14, fontWeight: 600 },
  label: { fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" },
  subLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  gallery: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  logoTile: {
    border: "2px solid transparent",
    borderRadius: 8,
    padding: 8,
    background: "#f9fafb",
    cursor: "pointer",
  },
  logoTileActive: {
    borderColor: "#6e54d7",
    boxShadow: "0 0 0 3px rgba(110,84,215,0.15)",
    background: "#ffffff",
  },
  logoTileDashed: {
    border: "2px dashed #d1d5db",
    borderRadius: 8,
    padding: 8,
    background: "#fff",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  },
  logoImg: { display: "block", width: "100%", height: "auto", objectFit: "contain" },
  plus: { fontSize: 28, lineHeight: 1, color: "#9ca3af" },
  sliderRow: { display: "flex", alignItems: "center", gap: 12 },
  range: { flex: 1, accentColor: "#6e54d7" },
  pctBoxWrap: { position: "relative", width: 70 },
  pctBox: {
    width: "100%",
    height: 34,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "0 22px 0 10px",
    fontSize: 14,
  },
  pctSuffix: {
    position: "absolute",
    right: 8,
    top: 8,
    fontSize: 12,
    color: "#6b7280",
    pointerEvents: "none",
  },
  segmentedWrap: {
    display: "inline-flex",
    background: "#eef2ff",
    padding: 4,
    borderRadius: 999,
    gap: 4,
  },
  segment: {
    border: 0,
    background: "transparent",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    color: "#6b7280",
    cursor: "pointer",
  },
  segmentActive: {
    background: "#6e54d7",
    color: "#fff",
  },
  input: {
    width: "100%",
    height: 38,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 14,
  },
  linkWrap: { position: "relative" },
  clearBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 26,
    height: 26,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "#eef2f7",
    color: "#6b7280",
    border: "none",
    cursor: "pointer",
  },
};

/* ---------- Image editor (inline) ---------- */
function SegmentedImage({ value, onChange }) {
  const opts = [
    { v: "left", label: "left" },
    { v: "center", label: "centre" },
    { v: "right", label: "right" },
  ];
  return (
    <div style={s.segmentWrap} role="tablist" aria-label="Image position">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.v)}
            style={{ ...s.segment, ...(active ? s.segmentActive : {}) }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ImageEditorInner({ value, onChange, onPickImage }) {
  const { src = "", widthPct = 100, align = "center", alt = "", href = "" } = value ?? {};
  const widthId = useId();
  const pctId = useId();
  const altId = useId();
  const linkId = useId();

  const set = (patch) => onChange?.({ src, widthPct, align, alt, href, ...patch });
  const clampPct = (n) => Math.max(5, Math.min(100, Number.isFinite(n) ? Math.round(n) : 0));

  return (
    <div style={s.card}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={s.thumbBox}>
          {src ? <img src={src} style={s.thumbImg} alt="" /> : <div style={s.thumbPlaceholder} />}
        </div>
        <button type="button" onClick={onPickImage} style={s.primaryBtn}>
          Change image
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <label htmlFor={widthId} style={s.label}>Width</label>
        <div style={s.sliderRow}>
          <input id={widthId} type="range" min={5} max={100} value={widthPct} onChange={(e) => set({ widthPct: clampPct(+e.target.value) })} style={s.range} />
          <div style={s.pctBoxWrap}>
            <input id={pctId} type="number" min={5} max={100} value={widthPct} onChange={(e) => set({ widthPct: clampPct(+e.target.value) })} style={s.pctBox} />
            <span style={s.pctSuffix}>%</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={s.label}>Position</div>
        <SegmentedImage value={align} onChange={(v) => set({ align: v })} />
      </div>

      <div style={{ marginTop: 16 }}>
        <label htmlFor={altId} style={s.label}>Alt text</label>
        <div style={s.subLabel}>Text that shows when an image cannot load</div>
        <input id={altId} type="text" placeholder="Describe your image here" value={alt} onChange={(e) => set({ alt: e.target.value })} style={s.input} />
      </div>

      <div style={{ marginTop: 16 }}>
        <label htmlFor={linkId} style={s.label}>Link</label>
        <input id={linkId} type="url" placeholder="https://" value={href} onChange={(e) => set({ href: e.target.value })} style={s.input} />
      </div>
    </div>
  );
}

/* styles for image editor */
const purple = "#6e54d7";
const s = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    background: "#fff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    color: "#111827",
  },
  label: { fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" },
  subLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  thumbBox: {
    width: 84,
    height: 64,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#f3f4f6",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover" },
  thumbPlaceholder: { width: 40, height: 28, background: "#dbe3f3", borderRadius: 4 },
  primaryBtn: { padding: "10px 14px", background: purple, color: "#fff", borderRadius: 8, border: 0, fontWeight: 600, cursor: "pointer" },
  sliderRow: { display: "flex", alignItems: "center", gap: 12 },
  range: { flex: 1, accentColor: purple },
  pctBoxWrap: { position: "relative", width: 72 },
  pctBox: { width: "100%", height: 36, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 24px 0 10px", fontSize: 14 },
  pctSuffix: { position: "absolute", right: 8, top: 8, fontSize: 12, color: "#6b7280", pointerEvents: "none" },
  segmentWrap: { display: "inline-flex", background: "#eef2ff", padding: 6, borderRadius: 999, gap: 8, alignItems: "center" },
  segment: { border: 0, background: "transparent", padding: "6px 14px", margin: "0 4px", borderRadius: 999, fontSize: 12, color: "#6b7280", cursor: "pointer", lineHeight: 1 },
  segmentActive: { background: purple, color: "#fff" },
  input: { width: "100%", height: 38, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 12px", fontSize: 14 },
};

/* ------- Header appearance editor (inline) ------- */
function PxStepper({ value, onChange, min = 0, max = 500, step = 1 }) {
  const clamp = (n) => Math.max(min, Math.min(max, Math.round(n)));
  return (
    <div style={st.stepperWrap}>
      <button type="button" style={st.stepBtn} onClick={() => onChange(clamp(value - step))}>–</button>
      <input
        type="number"
        style={st.stepInput}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(+e.target.value))}
      />
      <div style={st.suffix}>px</div>
      <button type="button" style={st.stepBtn} onClick={() => onChange(clamp(value + step))}>+</button>
    </div>
  );
}

export function HeaderAppearancePanel({
  value,
  onChange,
  onPickBackground,
}) {
  const {
    backgroundColor = "",
    backgroundImage = "",
    marginTop = 0,
    marginBottom = 0,
    paddingTop = 15,
    paddingRight = 0,
    paddingBottom = 15,
    paddingLeft = 0,
  } = value ?? {};

  const set = (patch) =>
    onChange?.({
      backgroundColor,
      backgroundImage,
      marginTop,
      marginBottom,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      ...patch,
    });

  const nudgeAllPadding = (delta) =>
    set({
      paddingTop: Math.max(0, paddingTop + delta),
      paddingRight: Math.max(0, paddingRight + delta),
      paddingBottom: Math.max(0, paddingBottom + delta),
      paddingLeft: Math.max(0, paddingLeft + delta),
    });

  return (
    <div style={st.card}>
      <h5 style={st.sectionTitle}>BACKGROUND</h5>
      <div style={st.row}>
        <div style={{ flex: 1 }}>
          <div style={st.label}>Background colour</div>
          <div style={st.colorWrap}>
            <input
              type="text"
              placeholder="#FFFFFF or empty"
              value={backgroundColor}
              onChange={(e) => set({ backgroundColor: e.target.value })}
              style={st.input}
            />
            {backgroundColor && (
              <button
                type="button"
                aria-label="Clear background colour"
                onClick={() => set({ backgroundColor: "" })}
                style={st.clearMini}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div style={{ width: 140 }}>
          <div style={st.label}>Background image</div>
          <button type="button" style={st.primaryBtn} onClick={onPickBackground}>
            Add image
          </button>
          {backgroundImage ? <div style={st.previewNote}>set</div> : null}
        </div>
      </div>

      <h5 style={{ ...st.sectionTitle, marginTop: 18 }}>MARGIN</h5>
      <div style={st.subtleBox}>
        <div style={st.subtleText}>Gap between this and surrounding blocks</div>
        <div style={{ marginTop: 10 }}>
          <div style={st.label}>Margin above</div>
          <PxStepper value={marginTop} onChange={(n) => set({ marginTop: n })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={st.label}>Margin below</div>
          <PxStepper value={marginBottom} onChange={(n) => set({ marginBottom: n })} />
        </div>
      </div>

      <h5 style={{ ...st.sectionTitle, marginTop: 18 }}>PADDING</h5>
      <div style={st.subtleBox}>
        <div style={st.subtleText}>Spacing on the inside of the block</div>

        <div style={{ marginTop: 12, display: "grid", placeItems: "center" }}>
          <div style={{ width: 120 }}>
            <PxStepper value={paddingTop} onChange={(n) => set({ paddingTop: n })} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, marginTop: 8 }}>
          <PxStepper value={paddingLeft} onChange={(n) => set({ paddingLeft: n })} />
          <div style={st.nudgeAll}>
            <button type="button" style={st.bigNudgeBtn} onClick={() => nudgeAllPadding(-5)}>–</button>
            <div style={st.nudgeDivider} />
            <button type="button" style={st.bigNudgeBtn} onClick={() => nudgeAllPadding(+5)}>+</button>
          </div>
          <PxStepper value={paddingRight} onChange={(n) => set({ paddingRight: n })} />
        </div>

        <div style={{ display: "grid", placeItems: "center", marginTop: 8 }}>
          <div style={{ width: 120 }}>
            <PxStepper value={paddingBottom} onChange={(n) => set({ paddingBottom: n })} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- styles for header panel ---------- */
const st = {
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    background: "#fff",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    color: "#111827",
  },
  sectionTitle: { fontSize: 12, letterSpacing: 0.4, color: "#6b7280", margin: 0, marginBottom: 8 },
  row: { display: "flex", gap: 12, alignItems: "flex-end" },

  label: { fontSize: 12, fontWeight: 600, marginBottom: 6 },
  input: { width: "100%", height: 36, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 12px", fontSize: 14 },

  primaryBtn: { width: "100%", height: 36, borderRadius: 8, border: 0, background: "#6e54d7", color: "#fff", fontWeight: 600, cursor: "pointer" },
  secondaryBtn: { width: "100%", height: 28, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 12, fontWeight: 500, cursor: "pointer" },

  colorWrap: { position: "relative" },
  clearMini: { position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 6, background: "#eef2f7", border: 0, color: "#6b7280", cursor: "pointer" },
  previewNote: { marginTop: 6, fontSize: 11, color: "#6b7280" },

  subtleBox: { background: "#f6f9fb", border: "1px solid #e5edf5", borderRadius: 10, padding: 12 },
  subtleText: { fontSize: 12, color: "#6b7280" },

  stepperWrap: { display: "grid", gridTemplateColumns: "36px 1fr 28px 36px", alignItems: "center", width: 180, border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#fff" },
  stepBtn: { height: 34, border: "none", background: "#eef2f7", cursor: "pointer", fontSize: 18, color: "#4b5563" },
  stepInput: { height: 34, border: "none", outline: "none", textAlign: "right", paddingRight: 6, fontSize: 14 },
  suffix: { fontSize: 12, color: "#6b7280", textAlign: "center" },

  nudgeAll: { width: 90, height: 36, display: "grid", gridTemplateColumns: "1fr 1px 1fr", borderRadius: 8, overflow: "hidden", border: "1px solid #d1d5db", background: "#fff" },
  bigNudgeBtn: { border: "none", background: "#eef2ff", color: "#6e54d7", fontSize: 18, cursor: "pointer" },
  nudgeDivider: { width: 1, background: "#e5e7eb" },
};

/* ---------- Title editor (inline) ---------- */
function TitleEditorInner({ value, onChange }) {
  const { text = "", align = "center", fontSize = 26, color = "#313638" } = value ?? {};
  return (
    <div style={styles.card}>
      <h4 style={styles.title}>Title</h4>
      <div style={{ marginBottom: 10 }}>
        <div style={styles.label}>Alignment</div>
        <select style={styles.input} value={align} onChange={(e) => onChange({ text, align: e.target.value })}>
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={styles.label}>Font size (px)</div>
          <input type="number" min={10} max={72} value={fontSize} onChange={(e) => onChange({ text, align, fontSize: Number(e.target.value) || 26, color })} style={styles.input} />
        </div>
        <div>
          <div style={styles.label}>Color</div>
          <input type="color" value={color} onChange={(e) => onChange({ text, align, fontSize, color: e.target.value })} style={{ ...styles.input, height: 40, padding: 4 }} />
        </div>
      </div>
      <div>
        <div style={styles.label}>Text</div>
        <textarea style={{ ...styles.input, height: 120 }} value={text} onChange={(e) => onChange({ text: e.target.value, align, fontSize, color })} />
      </div>
    </div>
  );
}

// -----------------------------
// Drop zones
// -----------------------------
function DropZone({ index, onDropType, onMoveBlock }) {
  const [active, setActive] = React.useState(false);

  const acceptsDrag = (dt) => {
    const types = dt?.types ? Array.from(dt.types) : [];
    return types.includes(NEWBLOCK_MIME) || types.includes(MOVE_MIME);
  };

  const allowDrop = (e) => {
    if (!acceptsDrag(e.dataTransfer)) return;
    e.preventDefault();
    const types = Array.from(e.dataTransfer.types || []);
    e.dataTransfer.dropEffect = types.includes(MOVE_MIME) ? "move" : "copy";
    setActive(true);
  };

  const leave = () => setActive(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setActive(false);

    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes(MOVE_MIME)) {
      try {
        const { fromIndex } = JSON.parse(e.dataTransfer.getData(MOVE_MIME));
        if (typeof onMoveBlock === "function" && typeof fromIndex === "number") {
          onMoveBlock(fromIndex, index > fromIndex ? index - 1 : index);
        }
      } catch {}
      return;
    }

    if (types.includes(NEWBLOCK_MIME)) {
      try {
        const { type } = JSON.parse(e.dataTransfer.getData(NEWBLOCK_MIME));
        if (type) onDropType(type, index);
      } catch {}
    }
  };

  return (
    <div
      onDragOver={allowDrop}
      onDragEnter={allowDrop}
      onDragLeave={leave}
      onDrop={handleDrop}
      className={[
        "my-2 grid h-8 place-items-center rounded-md border-2 border-dashed text-[11px] transition",
        active ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-500" : "border-slate-300 text-slate-400 opacity-50",
      ].join(" ")}
    >
      Drop here
    </div>
  );
}

/* ---------- Text appearance panel (left column for text blocks) ---------- */
function PxStepperLocal({ value, onChange, min = 0, max = 500, step = 1, width = 170 }) {
  const clamp = (n) => Math.max(min, Math.min(max, Math.round(n)));
  return (
    <div style={{ ...st.stepperWrap, width }}>
      <button type="button" style={st.stepBtn} onClick={() => onChange(clamp(value - step))}>–</button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(clamp(+e.target.value))}
        min={min}
        max={max}
        style={st.stepInput}
      />
      <div style={st.suffix}>px</div>
      <button type="button" style={st.stepBtn} onClick={() => onChange(clamp(value + step))}>+</button>
    </div>
  );
}

function SegmentedLocal({ value, options, onChange }) {
  return (
    <div style={st.segmentWrap} role="tablist" aria-label="Line height">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            style={{ ...st.segment, ...(active ? st.segmentActive : {}) }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Padding editor (box-model UI) ---------- */
function PaddingEditor({ value = {}, onChange }) {
  const { top = 0, right = 0, bottom = 0, left = 0 } = value ?? {};
  const [locked, setLocked] = useState(false);

  const set = (patch) => {
    const next = { top, right, bottom, left, ...patch };
    onChange?.(next);
  };

  const setSide = (side, n) => {
    n = Math.max(0, Math.round(n || 0));
    if (locked) {
      onChange?.({ top: n, right: n, bottom: n, left: n });
    } else {
      onChange?.({ top, right, bottom, left, [side]: n });
    }
  };

  return (
    <div style={sPad.card}>
      <div style={sPad.titleRow}>
        <div style={sPad.title}>Padding</div>
        <button type="button" title={locked ? "Unlock paddings" : "Lock paddings"} onClick={() => setLocked((v) => !v)} style={{ ...sPad.lockBtn, background: locked ? "#eef2ff" : "transparent" }}>
          {locked ? "🔒" : "🔓"}
        </button>
      </div>

      <div style={sPad.boxWrap}>
        <div style={sPad.top}>
          <PxStepperLocal value={top} onChange={(n) => setSide("top", n)} width={140} />
        </div>

        <div style={sPad.middle}>
          <div style={sPad.left}>
            <PxStepperLocal value={left} onChange={(n) => setSide("left", n)} width={120} />
          </div>

          <div style={sPad.center}>Content</div>

          <div style={sPad.right}>
            <PxStepperLocal value={right} onChange={(n) => setSide("right", n)} width={120} />
          </div>
        </div>

        <div style={sPad.bottom}>
          <PxStepperLocal value={bottom} onChange={(n) => setSide("bottom", n)} width={140} />
        </div>
      </div>
    </div>
  );
}

const sPad = {
  card: { border: "1px solid #e5e7eb", padding: 10, borderRadius: 8, background: "#fff" },
  titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 12, fontWeight: 600 },
  lockBtn: { border: "none", padding: 6, borderRadius: 6, cursor: "pointer" },
  boxWrap: { display: "grid", gridTemplateRows: "auto auto auto", gap: 8 },
  top: { justifySelf: "center" },
  bottom: { justifySelf: "center" },
  middle: { display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center" },
  left: { justifySelf: "end" },
  right: { justifySelf: "start" },
  center: { background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 4, padding: 8, textAlign: "center", fontSize: 12, color: "#6b7280" },
};

function TextAppearancePanel({ value, onChange, onPickBackground }) {
  const {
    backgroundColor = "",
    backgroundImage = "",
    imageLayout = "overlay", // 'overlay' | 'hero-top' | 'hero-bottom'
    lineHeight = 1.25,
    marginTop = 0,
    marginBottom = 0,
    paddingTop = 5,
    paddingRight = 0,
    paddingBottom = 25,
    paddingLeft = 0,
  } = value ?? {};

  const set = (patch) =>
    onChange?.({
      backgroundColor,
      backgroundImage,
      imageLayout,
      lineHeight,
      marginTop,
      marginBottom,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      ...patch,
    });

  const nudgeHoriz = (delta) =>
    set({
      paddingLeft: Math.max(0, paddingLeft + delta),
      paddingRight: Math.max(0, paddingRight + delta),
    });

  return (
    <div style={st.card}>
      {/* BACKGROUND */}
      <h5 style={st.sectionTitle}>BACKGROUND</h5>
      <div style={st.row}>
        <div style={{ flex: 1 }}>
          <div style={st.label}>Background colour</div>
          <div style={st.colorWrap}>
            <input type="text" placeholder="#FFFFFF or empty" value={backgroundColor} onChange={(e) => set({ backgroundColor: e.target.value })} style={st.input} />
            {backgroundColor && (
              <button type="button" aria-label="Clear colour" onClick={() => set({ backgroundColor: "" })} style={st.clearMini}>
                ×
              </button>
            )}
          </div>
        </div>
        <div style={{ width: 140 }}>
          <div style={st.label}>Background image</div>
          <button type="button" style={st.primaryBtn} onClick={onPickBackground}>
            {backgroundImage && backgroundImage !== "uploading..." ? "Change image" : "Add image"}
          </button>
          {backgroundImage === "uploading..." && <div style={{ ...st.previewNote, color: "#6e54d7" }}>Uploading...</div>}
          {backgroundImage && backgroundImage !== "uploading..." && (
            <button type="button" onClick={() => set({ backgroundImage: "" })} style={{ ...st.secondaryBtn, marginTop: 4, fontSize: 11 }}>
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Image Layout Options */}
      {backgroundImage && backgroundImage !== "uploading..." && (
        <div style={{ marginTop: 12 }}>
          <div style={st.label}>Image layout</div>
          <div style={st.subtleText}>How the image and text are positioned</div>
          <div style={{ marginTop: 8 }}>
            <SegmentedLocal 
              value={imageLayout} 
              onChange={(v) => set({ imageLayout: v })} 
              options={[
                { value: "overlay", label: "Overlay" }, 
                { value: "hero-top", label: "Hero (Top)" }, 
                { value: "hero-bottom", label: "Hero (Bottom)" }
              ]} 
            />
          </div>
          <div style={{ ...st.subtleText, marginTop: 6, fontSize: 11 }}>
            {imageLayout === "overlay" && "Text appears on top of the image"}
            {imageLayout === "hero-top" && "Image appears above the text"}
            {imageLayout === "hero-bottom" && "Image appears below the text"}
          </div>
        </div>
      )}

      {/* TYPOGRAPHY */}
      <h5 style={{ ...st.sectionTitle, marginTop: 16 }}>TYPOGRAPHY</h5>
      <div style={st.subtleBox}>
        <div style={st.label}>Line height</div>
        <div style={st.subtleText}>Spacing between lines of text</div>
        <SegmentedLocal value={lineHeight} onChange={(v) => set({ lineHeight: v })} options={[{ value: 1, label: "Tight" }, { value: 1.25, label: "Normal" }, { value: 1.5, label: "Relaxed" }, { value: 2, label: "Double" }]} />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={st.label}>Text align</div>
        <TextAlignControl value={value?.textAlign || value?.opts?.textAlign || "left"} onChange={(v) => set({ textAlign: v })} />
      </div>

      {/* MARGIN */}
      <h5 style={{ ...st.sectionTitle, marginTop: 16 }}>MARGIN</h5>
      <div style={st.subtleBox}>
        <div style={st.subtleText}>Gap between this and surrounding blocks</div>
        <div style={{ marginTop: 10 }}>
          <div style={st.label}>Margin above</div>
          <PxStepperLocal value={marginTop} onChange={(n) => set({ marginTop: n })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={st.label}>Margin below</div>
          <PxStepperLocal value={marginBottom} onChange={(n) => set({ marginBottom: n })} />
        </div>
      </div>

      {/* PADDING (box-model editor) */}
      <h5 style={{ ...st.sectionTitle, marginTop: 16 }}>PADDING</h5>
      <div style={{ marginTop: 8 }}>
        <PaddingEditor
          value={{ top: paddingTop, right: paddingRight, bottom: paddingBottom, left: paddingLeft }}
          onChange={(v) => set({ paddingTop: v.top, paddingRight: v.right, paddingBottom: v.bottom, paddingLeft: v.left })}
        />
      </div>
    </div>
  );
}

// -----------------------------
// Main component
// -----------------------------
export default function TemplateEditor(props = {}) {
  console.log('=== TEMPLATE EDITOR INIT ===');
  console.log('TemplateEditor props:', props);
  console.log('Composer state received:', props.composerState);
  console.log('Subject from composer:', props.composerState?.subject);
  console.log('PreviewText from composer:', props.composerState?.previewText);
  const navigate = useNavigate();
  const [title, setTitle] = useState("Untitled");
  const [isEditingTitle, setEditingTitle] = useState(false);
  const inputRef = useRef(null);
  const [isPreviewOpen, setPreviewOpen] = useState(false);

  // Canvas state
  const [blocks, setBlocks] = useState([
    createDefaultBlock("logo"),
    createDefaultBlock("image"),
    createDefaultBlock("title"),
    createDefaultBlock("text"),
    createDefaultBlock("button"),
    createDefaultBlock("social-follow"),
  ]);
  const [selectedBlockId, setSelectedBlockId] = useState(null);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) inputRef.current.focus();
  }, [isEditingTitle]);

  // Hidden file input used for picking images for image blocks
  const fileInputRef = useRef(null);
  const handlePickImage = (blockId) => {
    if (!fileInputRef.current) return;
    fileInputRef.current._blockId = blockId;
    fileInputRef.current._mode = "image";
    fileInputRef.current.value = null;
    fileInputRef.current.click();
  };

  const handlePickBackground = (blockId) => {
    if (!fileInputRef.current) return;
    fileInputRef.current._blockId = blockId;
    fileInputRef.current._mode = "background";
    fileInputRef.current.value = null;
    fileInputRef.current.click();
  };

  const handleFileInputChange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const blockId = fileInputRef.current && fileInputRef.current._blockId;
    const mode = fileInputRef.current && fileInputRef.current._mode;
    
    // Show uploading state
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        if (mode === "background") return { ...b, data: { ...b.data, backgroundImage: "uploading..." } };
        return { ...b, data: { ...b.data, src: "uploading...", alt: f.name } };
      })
    );

    try {
      // Upload to Firebase Storage
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const timestamp = Date.now();
      const fileName = `email-images/${user.uid}/${timestamp}_${f.name}`;
      const imageRef = storageRef(storage, fileName);
      
      await uploadBytes(imageRef, f);
      const downloadURL = await getDownloadURL(imageRef);

      // Update block with Firebase URL
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          if (mode === "background") return { ...b, data: { ...b.data, backgroundImage: downloadURL } };
          return { ...b, data: { ...b.data, src: downloadURL, alt: f.name } };
        })
      );
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image: ' + error.message);
      
      // Revert to previous state on error
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          if (mode === "background") return { ...b, data: { ...b.data, backgroundImage: "" } };
          return { ...b, data: { ...b.data, src: "", alt: "" } };
        })
      );
    }
  };

  const emailHtml = useMemo(() => renderEmail(blocks), [blocks]);

  const insertBlock = (type, index) => {
    const b = createDefaultBlock(type);
    setBlocks((prev) => {
      const copy = [...prev];
      const i = typeof index === "number" ? index : copy.length;
      copy.splice(i, 0, b);
      // select the newly inserted block so the sidebar can show its options
      setSelectedBlockId(b.id);
      return copy;
    });
  };

  const handleChange = (id, data) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, data } : b)));
  const handleDelete = (id) => setBlocks((prev) => prev.filter((b) => b.id !== id));

  const moveBlockByIndex = React.useCallback((from, to) => {
    setBlocks((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to > prev.length) return prev;
      return moveItem(prev, from, to);
    });
  }, []);

  return (
    <div className="container-fluid px-0">
      <div className="flex min-h-screen">
        {/* Left: block palette or block options when a block is selected */}
        <aside className="w-80 shrink-0 border-r border-slate-200 bg-slate-50/60 p-3">
          {(() => {
            const selected = blocks.find((b) => b.id === selectedBlockId);
            if (selected && selected.type === "logo") {
              // show the logo editor for the selected logo block
              return (
                <LogoEditorInner
                  value={{
                    src: selected.data?.src || "",
                    href: selected.data?.href || "",
                    widthPct: selected.data?.widthPct || Math.round((selected.data?.width || 160) * 100 / 160),
                    align: selected.data?.align || "center",
                    alt: selected.data?.alt || "",
                  }}
                  onChange={(v) => {
                    const pct = Number(v.widthPct) || 66;
                    const px = Math.max(20, Math.round((pct / 100) * 160));
                    handleChange(selected.id, { src: v.src, href: v.href, width: px, widthPct: pct, align: v.align, alt: v.alt });
                  }}
                />
              );
            }
            if (selected && selected.type === "title") {
              return (
                <TitleEditorInner
                  value={selected.data}
                  onChange={(v) => handleChange(selected.id, v)}
                />
              );
            }
            if (selected && selected.type === "button") {
              return (
                <ButtonEditor
                  value={selected.data}
                  onChange={(v) => handleChange(selected.id, v)}
                  onPreviewClick={() => {/* optional preview callback */}}
                />
              );
            }
            if (selected && selected.type === "image") {
              return (
                <ImageEditorInner
                  value={{
                    src: selected.data?.src || "",
                    widthPct: selected.data?.widthPct ?? 100,
                    align: selected.data?.align || "center",
                    alt: selected.data?.alt || "",
                    href: selected.data?.href || "",
                  }}
                  onChange={(v) => {
                    // map editor shape back to block.data
                    handleChange(selected.id, {
                      src: v.src,
                      alt: v.alt,
                      widthPct: Number(v.widthPct) || 100,
                      align: v.align,
                      href: v.href,
                    });
                  }}
                  onPickImage={() => handlePickImage(selected.id)}
                />
              );
            }
            if (selected && selected.type === "text") {
              return (
                <TextAppearancePanel
                  value={{
                    backgroundColor: selected.data?.opts?.backgroundColor || selected.data?.backgroundColor || "",
                    backgroundImage: selected.data?.opts?.backgroundImage || "",
                    imageLayout: selected.data?.opts?.imageLayout || "overlay",
                    lineHeight: selected.data?.opts?.lineHeight ?? selected.data?.lineHeight ?? 1.25,
                    marginTop: selected.data?.marginTop ?? 0,
                    marginBottom: selected.data?.marginBottom ?? 0,
                    paddingTop: selected.data?.opts?.padding?.top ?? selected.data?.paddingTop ?? 5,
                    paddingRight: selected.data?.opts?.padding?.right ?? selected.data?.paddingRight ?? 0,
                    paddingBottom: selected.data?.opts?.padding?.bottom ?? selected.data?.paddingBottom ?? 25,
                    paddingLeft: selected.data?.opts?.padding?.left ?? selected.data?.paddingLeft ?? 0,
                    fontFamily: selected.data?.opts?.fontFamily ?? "",
                    fontSize: selected.data?.opts?.fontSize ?? 16,
                    fontWeight: selected.data?.opts?.fontWeight ?? 400,
                    textAlign: selected.data?.opts?.textAlign ?? "left",
                  }}
                  onChange={(v) => {
                    // Map panel values into opts and preserve html
                    const nextOpts = {
                      ...(selected.data?.opts || {}),
                      backgroundColor: v.backgroundColor,
                      backgroundImage: v.backgroundImage,
                      imageLayout: v.imageLayout,
                      lineHeight: v.lineHeight,
                      fontFamily: v.fontFamily,
                      fontSize: v.fontSize,
                      fontWeight: v.fontWeight,
                      textAlign: v.textAlign,
                      padding: { top: v.paddingTop, right: v.paddingRight, bottom: v.paddingBottom, left: v.paddingLeft },
                    };
                    const nextData = {
                      ...selected.data,
                      opts: nextOpts,
                      // margins live on the top-level data for layout around the block
                      marginTop: typeof v.marginTop === "number" ? v.marginTop : selected.data?.marginTop,
                      marginBottom: typeof v.marginBottom === "number" ? v.marginBottom : selected.data?.marginBottom,
                    };
                    handleChange(selected.id, nextData);
                  }}
                  onPickBackground={() => handlePickBackground(selected.id)}
                />
              );
            }
            if (selected && (selected.type === "section" || selected.type === "header")) {
              return (
                <HeaderAppearancePanel
                  value={selected.data}
                  onChange={(v) => handleChange(selected.id, v)}
                  onPickBackground={() => handlePickBackground(selected.id)}
                />
              );
            }
            // default: show block palette
            return <EditorSidebarBlocks onInsert={(type) => insertBlock(type)} />;
          })()}
        </aside>

        {/* Right: editor */}
        <main className="flex-1">
          {/* Campaign Progress Steps */}
          <div className="mb-4 flex items-center justify-center bg-white py-4 border-b border-slate-200">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-6 py-3 shadow-sm">
              <div className="flex items-center gap-2 opacity-40">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">1</div>
                <span className="text-slate-600">Setup</span>
              </div>
              <div className="w-12 h-px bg-slate-300 mx-1"></div>
              <div className="flex items-center gap-2 opacity-40">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">2</div>
                <span className="text-slate-600">Design</span>
              </div>
              <div className="w-12 h-px bg-slate-300 mx-1"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">3</div>
                <span className="font-medium text-slate-900">Content</span>
              </div>
              <div className="w-12 h-px bg-slate-300 mx-1"></div>
              <div className="flex items-center gap-2 opacity-40">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">4</div>
                <span className="text-slate-600">Send</span>
              </div>
            </div>
          </div>

          {/* Title bar (kept from your design) */}
          <div className="page-top page-top--bg">
            <div className="container">
              <div className="page-top__title pb-0">
                <div className="dashboard-top-left editable-title">
                  <div className="title-wrapper">
                    {isEditingTitle ? (
                      <input
                        ref={inputRef}
                        type="text"
                        className="form-control"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => setEditingTitle(false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
                        }}
                        aria-label="Campaign title"
                        style={{ maxWidth: 420 }}
                      />
                    ) : (
                      <h1
                        className="long toggle-tooltip"
                        data-untitled="Untitled"
                        style={{ display: "inline-block", marginRight: 12 }}
                      >
                        {title || "Untitled"}
                      </h1>
                    )}
                    <button
                      type="button"
                      className="edit base-button icon icon-only tertiary medium toggle-tooltip"
                      onClick={() => setEditingTitle((v) => !v)}
                      aria-label="Edit title"
                    >
                      <i className="fa-solid fa-pen-to-square" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="page-top__controls">
                <div className="page-top__actions">
                  <div className="page-top__actions-right">
                    <button className="btn btn-secondary mr-3" onClick={() => setPreviewOpen(true)} type="button">
                      Preview &amp; test
                    </button>
                    <button
                      className="btn btn-secondary mr-3"
                      type="button"
                      onClick={() => {
                        const blob = new Blob([emailHtml], { type: "text/html;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${title || "email"}.html`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export HTML
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={async () => {
                        try {
                          const auth = getAuth();
                          const user = auth.currentUser;
                          
                          if (!user) {
                            alert('You must be logged in to save templates');
                            return;
                          }

                          // Generate template ID if new
                          const templateId = uid('template');
                          
                          // Generate final HTML for email sending
                          const finalHtml = renderEmail(blocks);
                          
                          // Fetch business emails for this user
                          let businessEmails = [];
                          try {
                            const emailsResponse = await fetch(`${API_URL}/api/member/business-emails/${user.uid}`, {
                              credentials: 'include',
                            });
                            if (emailsResponse.ok) {
                              const emailsData = await emailsResponse.json();
                              console.log('Business emails response:', emailsData);
                              console.log('First item structure:', emailsData[0]);
                              
                              // API returns flat array of individual email objects
                              if (Array.isArray(emailsData)) {
                                businessEmails = emailsData.map(emailObj => ({
                                  id: emailObj.id,
                                  email: emailObj.email,
                                  type: emailObj.type,
                                  displayName: emailObj.displayName,
                                  description: emailObj.description
                                }));
                              }
                              console.log('Parsed business emails for navigation:', businessEmails);
                            }
                          } catch (err) {
                            console.error('Failed to fetch business emails:', err);
                          }
                          
                          // Prepare template data
                          const templateData = {
                            id: templateId,
                            title: title || 'Untitled Template',
                            blocks: blocks, // Store block structure for editing
                            html: finalHtml, // Rendered HTML for sending
                            subject: title || 'Untitled Template',
                            
                            // Metadata
                            userId: user.uid,
                            userEmail: user.email,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            
                            // Store business emails with template
                            businessEmails: businessEmails,
                            
                            // Email options (can be configured in a settings panel)
                            tracking: {
                              opens: true, // Track email opens
                              clicks: true, // Track link clicks
                              trackingDomain: 'fotonix.co.uk' // Your tracking domain
                            },
                            
                            // Template status
                            status: 'content-complete', // Now moving to send stage
                            stage: 'send', // Next stage
                            
                          // Campaign settings (to be configured in send stage)
                          campaign: {
                            name: title || 'Untitled Campaign',
                            fromEmail: '', // To be set in send stage
                            fromName: '', // To be set in send stage
                            replyTo: '', // To be set in send stage
                            recipients: [], // To be set in send stage
                            scheduledFor: null, // Send now or schedule
                            
                            // Email content from composer
                            subject: (props.composerState?.subject || '').trim(),
                            preheader: (props.composerState?.previewText || '').trim(),
                            
                            // Fallback to localStorage if composer state is empty
                            ...((!props.composerState?.subject) && (() => {
                              try {
                                const savedData = localStorage.getItem('fotonix.composer.state');
                                if (savedData) {
                                  const parsed = JSON.parse(savedData);
                                  console.log('Using localStorage fallback for campaign data:', parsed);
                                  return {
                                    subject: (parsed.subject || '').trim(),
                                    preheader: (parsed.previewText || '').trim()
                                  };
                                }
                              } catch (e) {
                                console.warn('Failed to parse localStorage data:', e);
                              }
                              return {};
                            })()),
                            
                            // Audience data from composer
                            selectedAudience: 'all', // Default to all subscribers
                            audienceCount: 1, // Default count
                            audienceInfo: 'All subscribers'
                          }
                          };
                          
                          console.log('=== TEMPLATE SAVE TO FIREBASE ===');
                          console.log('Template title:', title);
                          console.log('Composer state:', props.composerState);
                          console.log('Campaign subject from composer:', props.composerState?.subject);
                          console.log('Campaign preheader from composer:', props.composerState?.previewText);
                          console.log('Final template data:', templateData);                          // Save to Firebase Realtime Database
                          const templateRef = dbRef(db, `templates/${user.uid}/${templateId}`);
                          await set(templateRef, templateData);
                          
                          console.log('Template saved successfully:', {
                            templateId,
                            userId: user.uid,
                            blocks: blocks.length,
                            htmlLength: finalHtml.length,
                            businessEmailsCount: businessEmails.length
                          });
                          
                          // Navigate to send stage with business emails in state
                          navigate(`/mailbuilder/send/${templateId}`, { 
                            state: { 
                              businessEmails: businessEmails 
                            } 
                          });
                          
                        } catch (error) {
                          console.error('Error saving template:', error);
                          alert(`Failed to save template: ${error.message}`);
                        }
                      }}
                    >
                      Save &amp; Continue →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex justify-center bg-[#e8e9eb] p-6">
            <div className="w-full max-w-[600px] rounded-md bg-white p-4 shadow">
              {/* top drop zone */}
              <DropZone index={0} onDropType={(t, i) => insertBlock(t, i)} onMoveBlock={moveBlockByIndex} />

              {blocks.map((block, i) => {
                const mt = typeof block.data?.marginTop === "number" ? `${block.data.marginTop}px` : undefined;
                const mb = typeof block.data?.marginBottom === "number" ? `${block.data.marginBottom}px` : undefined;
                return (
                  <div key={block.id} className="my-3" style={{ marginTop: mt, marginBottom: mb }}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_REORDER, JSON.stringify({ id: block.id, fromIndex: i }));
                        e.dataTransfer.effectAllowed = "move";
                        // optional: set drag image
                        // e.dataTransfer.setDragImage(e.currentTarget, 10, 10);
                      }}
                      onMouseDown={() => setSelectedBlockId(block.id)}
                    >
                      <BlockRenderer
                        block={block}
                        onChange={(data) => handleChange(block.id, data)}
                        onDelete={() => handleDelete(block.id)}
                        onMoveUp={() => moveBlockByIndex(i, Math.max(0, i - 1))}
                        onMoveDown={() => moveBlockByIndex(i, Math.min(blocks.length - 1, i + 1))}
                      />
                    </div>
                    <DropZone index={i + 1} onDropType={(t, idx) => insertBlock(t, idx)} onMoveBlock={moveBlockByIndex} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hidden textarea holding HTML for legacy posting */}
          <textarea id="campaign_design_bodyHtml" name="campaign_design[bodyHtml]" defaultValue={emailHtml} style={{ display: "none" }} />
          {/* hidden file input for image picking */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileInputChange} />
        </main>
      </div>

      {/* Preview modal */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-[1050] grid place-items-center bg-black/50"
          onClick={(e) => e.currentTarget === e.target && setPreviewOpen(false)}
        >
          <div className="modal-dialog modal-fullscreen w-[95%] max-w-[1200px]">
            <div className="modal-content max-h-[90vh] overflow-hidden">
              <div className="modal-header flex items-center justify-between">
                <h5 className="modal-title">{title || "Untitled"} - preview</h5>
                <button type="button" className="close" onClick={() => setPreviewOpen(false)}>
                  <i className="fa-regular fa-xmark" />
                </button>
              </div>
              <div className="modal-body p-0">
                <iframe title="preview" srcDoc={emailHtml} style={{ width: "100%", height: "80vh", border: 0 }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
