import React from "react";

/** --------- Public component (drop-in) ---------- */
export default function ButtonEditor({
  value = {},
  onChange,
  onPreviewClick,
}) {
  const v = {
    text: "Button",
    href: "https://",
    fontFamily: "",
    fontWeight: 700,
    fontSize: 18,
    textColor: "#000000",
    paddingY: 18,              // vertical padding (top & bottom)
    widthPct: 70,
    align: "center",           // left | center | right
    bgColor: "#FFFFFF",
    radius: 3,
    border: { style: "none", width: 1, color: "#6e54d7" },
    ...value,
  };

  const set = (patch) => onChange?.({ ...v, ...patch });
  const setBorder = (patch) => set({ border: { ...v.border, ...patch } });

  const previewWrapStyle = {
    display: "flex",
    justifyContent:
      v.align === "left" ? "flex-start" : v.align === "right" ? "flex-end" : "center",
    padding: "12px 0",
  };

  const previewBtnStyle = {
    display: "inline-block",
    width: `${v.widthPct}%`,
    textAlign: "center",
    textDecoration: "none",
    cursor: "pointer",
    color: v.textColor,
    background: v.border.style === "outline" ? "transparent" : v.bgColor,
    border:
      v.border.style === "none"
        ? "none"
        : `${v.border.width}px ${v.border.style === "dashed" ? "dashed" : "solid"} ${v.border.color}`,
    borderRadius: v.radius,
    padding: `${v.paddingY}px 12px`,
    fontFamily: v.fontFamily || undefined,
    fontWeight: v.fontWeight,
    fontSize: v.fontSize,
    lineHeight: 1.2,
  };

  return (
    <div style={ui.card}>
      <Section title="Button">
        <Label>Text</Label>
        <input
          style={ui.input}
          value={v.text}
          onChange={(e) => set({ text: e.target.value })}
        />
        <Label className="mt">Link</Label>
        <input
          style={ui.input}
          value={v.href}
          onChange={(e) => set({ href: e.target.value })}
        />
      </Section>

      <Section title="Typography">
        <Label>Font</Label>
        <select
          style={ui.input}
          value={v.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value })}
        >
          <option value="">Select</option>
          <option value='Arial, "Helvetica Neue", Helvetica, sans-serif'>Arial</option>
          <option value='"Inter", system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"'>
            Inter / System
          </option>
          <option value='"Georgia", serif'>Georgia</option>
          <option value='"Courier New", monospace'>Courier New</option>
        </select>

        <Label className="mt">Weight</Label>
        <TogglePill
          active={v.fontWeight >= 600}
          onClick={() =>
            set({ fontWeight: v.fontWeight >= 600 ? 400 : 700 })
          }
          label="bold"
        >
          B
        </TogglePill>

        <div style={ui.row}>
          <div style={{ flex: 1, marginRight: 8 }}>
            <Label className="mt">Colour</Label>
            <ColorInput
              value={v.textColor}
              onChange={(c) => set({ textColor: c })}
            />
          </div>
          <div style={{ width: 150 }}>
            <Label className="mt">Size</Label>
            <Stepper
              value={v.fontSize}
              onChange={(n) => set({ fontSize: clamp(n, 10, 64) })}
              min={10}
              max={64}
            />
          </div>
        </div>
      </Section>

      <Section title="Styling">
        <Label>Padding</Label>
        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 6 }}>
          Spacing on the top and bottom of the button
        </div>
        <Stepper
          value={v.paddingY}
          onChange={(n) => set({ paddingY: clamp(n, 0, 64) })}
          min={0}
          max={64}
        />

        <Label className="mt">Width</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="range"
            min={20}
            max={100}
            value={v.widthPct}
            onChange={(e) => set({ widthPct: parseInt(e.target.value, 10) })}
            style={{ width: "100%" }}
          />
          <div style={{ alignSelf: "flex-start" }}>
            <PercentBox
              value={v.widthPct}
              onChange={(n) => set({ widthPct: clamp(n, 20, 100) })}
            />
          </div>
        </div>

        <Label className="mt">Position</Label>
        <Segmented
          value={v.align}
          options={[
            { value: "left", label: "left" },
            { value: "center", label: "centre" },
            { value: "right", label: "right" },
          ]}
          onChange={(val) => set({ align: val })}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          <div>
            <Label>Colour</Label>
            <ColorInput
              value={v.bgColor}
              onChange={(c) => set({ bgColor: c })}
            />
          </div>
          <div>
            <Label>Radius</Label>
            <Stepper
              value={v.radius}
              onChange={(n) => set({ radius: clamp(n, 0, 64) })}
              min={0}
              max={64}
            />
          </div>
        </div>
      </Section>

      <Section title="Border">
        <Label>Style</Label>
        <BorderTiles
          value={v.border.style}
          onChange={(style) => setBorder({ style })}
        />

        {v.border.style !== "none" && (
          <div style={{ marginTop: 8 }}>
            <div style={ui.row}>
              <div style={{ width: 120, marginRight: 8 }}>
                <Label>Width</Label>
                <Stepper
                  value={v.border.width}
                  onChange={(n) => setBorder({ width: clamp(n, 0, 12) })}
                  min={0}
                  max={12}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Colour</Label>
                <ColorInput
                  value={v.border.color}
                  onChange={(c) => setBorder({ color: c })}
                />
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Live preview */}
      <Section title="Preview">
        <div style={previewWrapStyle}>
          <a
            href={v.href || "#"}
            style={previewBtnStyle}
            onClick={(e) => {
              e.preventDefault();
              onPreviewClick?.();
            }}
          >
            {v.text || "Button"}
          </a>
        </div>
      </Section>
    </div>
  );
}

/** --------- Small UI helpers ---------- */
function Section({ title, children }) {
  return (
    <div style={ui.section}>
      <div style={ui.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Label({ children, className }) {
  return (
    <label
      className={className}
      style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 6 }}
    >
      {children}
    </label>
  );
}

function Stepper({ value, onChange, min = -999, max = 999 }) {
  return (
    <div style={ui.stepper}>
      <button type="button" onClick={() => onChange(clamp(value - 1, min, max))}>–</button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value || 0, 10), min, max))}
      />
      <span>px</span>
      <button type="button" onClick={() => onChange(clamp(value + 1, min, max))}>+</button>
    </div>
  );
}

function PercentBox({ value, onChange }) {
  return (
    <div style={ui.percent}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value || 0, 10), 0, 100))}
      />
      <span>%</span>
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div style={ui.segmented}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            style={{ ...ui.segBtn, ...(active ? ui.segBtnActive : {}) }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TogglePill({ active, onClick, children, label }) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        style={{ ...ui.pill, ...(active ? ui.pillActive : {}) }}
        aria-pressed={active}
        title={label}
      >
        {children}
      </button>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ColorInput({ value, onChange }) {
  return (
    <div style={ui.colorRow}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={ui.colorSwatch}
      />
      <input
        style={{ ...ui.input, marginLeft: 8 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function BorderTiles({ value, onChange }) {
  const tiles = [
    { v: "none", title: "None" },
    { v: "solid", title: "Solid" },
    { v: "dashed", title: "Dashed" },
    { v: "outline", title: "Outline" }, // transparent bg, visible border
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {tiles.map((t) => {
        const active = value === t.v;
        return (
          <button
            key={t.v}
            type="button"
            onClick={() => onChange(t.v)}
            style={{
              height: 36,
              borderRadius: 8,
              border: active ? "2px solid #6e54d7" : "1px solid #d1d5db",
              background: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
            title={t.title}
          >
            {t.title}
          </button>
        );
      })}
    </div>
  );
}

/** --------- Styling primitives ---------- */
const ui = {
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 },
  section: { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10, textTransform: "uppercase" },
  input: {
    width: "100%",
    height: 34,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "0 10px",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  },
  row: { display: "flex", alignItems: "center" },
  stepper: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    height: 34,
    padding: "0 6px",
    gap: 6,
    background: "#fff",
  },
  percent: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    height: 34,
    padding: "0 6px",
    gap: 6,
    background: "#fff",
  },
  segmented: {
    display: "inline-flex",
    background: "#eef2ff",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    border: 0,
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    color: "#374151",
    background: "transparent",
    cursor: "pointer",
  },
  segBtnActive: { background: "#6e54d7", color: "#fff", fontWeight: 600 },
  pill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#6b7280",
    fontWeight: 800,
    fontSize: 18,
    cursor: "pointer",
  },
  pillActive: { background: "#6e54d7", color: "#fff", borderColor: "#6e54d7" },
  colorRow: { display: "flex", alignItems: "center" },
  colorSwatch: {
    width: 38,
    height: 34,
    padding: 0,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "transparent",
  },
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
