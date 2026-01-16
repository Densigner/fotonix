import React, { useState } from 'react';
import { useBrand } from './BrandContext';

export default function BrandSettingsPanel() {
  const { brand, loading, error, updateLocal, saveBrand } = useBrand();
  const [syncAll, setSyncAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contrastWarning, setContrastWarning] = useState(null);

  if (loading) return <div>Loading brand settings...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  async function onSave() {
    setSaving(true);
    const res = await saveBrand({}, { syncToTemplates: syncAll });
    setSaving(false);
    return res;
  }

  // simple contrast check (WCAG 2.1 AA approximated): returns true if contrast is sufficient
  function luminance(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0,2),16)/255;
    const g = parseInt(c.substring(2,4),16)/255;
    const b = parseInt(c.substring(4,6),16)/255;
    const a = [r,g,b].map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4));
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
  }

  function contrastRatio(hex1, hex2) {
    const l1 = luminance(hex1) + 0.05;
    const l2 = luminance(hex2) + 0.05;
    return Math.max(l1,l2)/Math.min(l1,l2);
  }

  function checkContrast() {
    const ratio = contrastRatio(brand.primaryColor || '#000000', brand.bodyBackground || '#ffffff');
    if (ratio < 4.5) setContrastWarning(`Primary color may fail WCAG AA contrast (ratio ${ratio.toFixed(2)})`); else setContrastWarning(null);
  }

  return (
    <div className="p-3 border rounded bg-white/5">
      <h4 className="text-sm font-semibold mb-2">Brand Settings</h4>
  <label className="text-xs block mt-2">Primary Color</label>
  <input aria-label="Primary Color" type="color" value={brand.primaryColor} onChange={(e) => { updateLocal({ primaryColor: e.target.value }); checkContrast(); }} />

  <label className="text-xs block mt-2">Accent Color</label>
  <input aria-label="Accent Color" type="color" value={brand.accentColor} onChange={(e) => updateLocal({ accentColor: e.target.value })} />

  <label className="text-xs block mt-2">Secondary Color</label>
  <input aria-label="Secondary Color" type="color" value={brand.secondaryColor} onChange={(e) => updateLocal({ secondaryColor: e.target.value })} />

  <label className="text-xs block mt-2">Default Font Family</label>
  <input aria-label="Default Font Family" className="w-full p-1 bg-white/5 rounded mt-1" value={brand.defaultFontFamily} onChange={(e) => updateLocal({ defaultFontFamily: e.target.value })} />

      <label className="text-xs block mt-2">Base Font Size (px)</label>
      <input type="number" className="w-full p-1 bg-white/5 rounded mt-1" value={brand.baseFontSize} onChange={(e) => updateLocal({ baseFontSize: Number(e.target.value) })} />

  <label className="text-xs block mt-2">Body Background</label>
  <input aria-label="Body Background" type="color" value={brand.bodyBackground} onChange={(e) => { updateLocal({ bodyBackground: e.target.value }); checkContrast(); }} />

      <label className="inline-flex items-center gap-2 mt-3">
        <input aria-label="Sync to all templates" type="checkbox" checked={syncAll} onChange={(e) => setSyncAll(e.target.checked)} />
        <span className="text-xs">Sync to all templates</span>
      </label>

      {contrastWarning && <div className="text-yellow-400 text-xs mt-2">{contrastWarning}</div>}
      <div className="mt-3">
        <button aria-label="Save Brand" className="px-3 py-2 bg-emerald-600 rounded text-white focus:outline-2 focus:outline-sky-500" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save Brand'}</button>
      </div>
    </div>
  );
}
