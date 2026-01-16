// ColorChooser.jsx — small reusable colour chooser
import React from 'react';

/**
 * Props:
 *  - value: '#RRGGBB' current background color
 *  - onChange: (newHex) => void
 *  - textColor: '#RRGGBB' optional current text color
 *  - onTextColorChange: (newHex) => void optional
 *  - presets: optional array of hex colors
 */
export function ColorChooser({ value = '#FF66B2', onChange, textColor, onTextColorChange, presets }) {
  const defaultPresets = presets || ['#FF66B2', '#FFD57A', '#1A73E8', '#111827', '#00C853', '#FF6D00', '#FFFFFF', '#000000'];

  function handlePick(hex) {
    if (onChange) onChange(hex);
    // If caller wants auto-text contrast, they can call getContrastingText(hex)
  }

  return (
    <div className="space-y-2" style={{display:'block'}}>
      <div className="text-xs text-slate-600" style={{fontSize:12,color:'#4b5563',marginBottom:6}}>Button color</div>

      {/* Preset swatches */}
      <div className="flex gap-2 flex-wrap" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {defaultPresets.map(p => (
          <button
            key={p}
            onClick={() => handlePick(p)}
            aria-label={`Choose ${p}`}
            style={{ width:32, height:32, borderRadius:6, border: p.toLowerCase() === value?.toLowerCase() ? '2px solid #9ca3af' : '1px solid #e5e7eb', background:p, cursor:'pointer' }}
            title={p}
          />
        ))}
      </div>

      {/* Native color input */}
  <div className="flex items-center gap-2" style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
        <input
          type="color"
          value={value}
          onChange={(e) => handlePick(e.target.value)}
          className="w-12 h-8 p-0 border rounded bg-white text-black"
          aria-label="Choose custom color"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) handlePick(normalizeHex(v));
            else onChange && onChange(v); // allow freeform but caller should validate
          }}
          style={{padding:8,borderRadius:6,border:'1px solid #e5e7eb',width:110,background:'#fff',color:'#000'}}
        />
        <div className="text-xs text-slate-500">Hex</div>
      </div>

      {/* Optional text-color override */}
      {typeof onTextColorChange === 'function' && (
        <div className="mt-2">
          <div className="text-xs text-slate-600">Text color (auto or override)</div>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={textColor || getContrastingText(value)} onChange={(e)=>onTextColorChange(e.target.value)} className="w-12 h-8 p-0 border rounded bg-white text-black" />
            <input value={textColor || getContrastingText(value)} onChange={(e)=>onTextColorChange(e.target.value)} className="border p-2 rounded w-28 bg-white text-black" />
            <button onClick={()=>onTextColorChange && onTextColorChange(getContrastingText(value))} className="px-2 py-1 border rounded text-sm">Auto</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function normalizeHex(h) {
  if (!h) return h;
  if (h.length === 4) {
    // #rgb -> #rrggbb
    return '#' + h.slice(1).split('').map(c => c + c).join('');
  }
  return h;
}

export function getContrastingText(bgHex) {
  // returns either '#000000' or '#ffffff' based on luminance
  try {
    const hex = normalizeHex(bgHex || '#ffffff').replace('#','');
    const r = parseInt(hex.substr(0,2),16) / 255;
    const g = parseInt(hex.substr(2,2),16) / 255;
    const b = parseInt(hex.substr(4,2),16) / 255;
    // relative luminance
    const srgb = [r,g,b].map(c => (c <= 0.03928) ? (c/12.92) : Math.pow((c+0.055)/1.055, 2.4));
    const lum = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    return lum > 0.5 ? '#000000' : '#ffffff';
  } catch (e) {
    return '#000000';
  }
}
