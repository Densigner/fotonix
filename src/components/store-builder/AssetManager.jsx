import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { API_URL } from '../../config/environment';

// Simple Asset Manager modal
export default function AssetManager({ tid, onClose, onSelect }) {
  const [assets, setAssets] = useState([]);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    try {
      const res = await fetch(`${API_URL}/api/tenants/${tid}/assets`);
      const json = await res.json();
      // expect array of { id, url, filename, width, height }
      setAssets(json || []);
    } catch (e) {
      console.warn('fetch assets failed', e);
      setAssets([]);
    }
  }

  // client-side image optimize: resize to max 2500px, optionally convert to webp
  async function optimizeFile(file) {
    const img = await createImageBitmap(file);
    const max = 2500;
    let { width, height } = img;
    if (width > max || height > max) {
      const ratio = Math.min(max / width, max / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9);
    });
  }

  async function handleFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setUploading(true);
    try {
      const optimized = await optimizeFile(f);
      const form = new FormData();
      form.append('file', optimized, f.name.replace(/\.[^/.]+$/, '') + '.webp');
      const res = await fetch(`${API_URL}/api/tenants/${tid}/assets`, { method: 'POST', body: form });
      const json = await res.json();
      // assume response returns the new asset
      setAssets(a => [json, ...a]);
    } catch (err) {
      console.error('upload failed', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(asset) {
    if (!window.confirm(`Delete asset ${asset.filename || asset.id}?`)) return;
    try {
      // soft-delete API
      await fetch(`${API_URL}/api/tenants/${tid}/assets/${asset.id}`, { method: 'DELETE' });
      setAssets(a => a.filter(x => x.id !== asset.id));
    } catch (e) {
      console.warn('delete failed', e);
    }
  }

  const filtered = assets.filter(a => (a.filename || a.url || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/60">
      <div className="w-full max-w-4xl bg-slate-900 rounded shadow-lg overflow-hidden">
        <div className="p-3 flex items-center justify-between border-b border-white/6">
          <div className="text-lg font-semibold">Assets</div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            <button className="px-3 py-1 bg-emerald-600 rounded text-white" onClick={() => fileRef.current && fileRef.current.click()}>{uploading ? 'Uploading...' : 'Upload'}</button>
            <button className="px-3 py-1 bg-white/5 rounded" onClick={() => onClose()}>Close</button>
          </div>
        </div>
        <div className="p-3">
          <input placeholder="Search filename..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full p-2 bg-white/5 rounded" />
        </div>
        <div className="p-3 grid grid-cols-4 gap-3 max-h-[60vh] overflow-auto">
          {filtered.length === 0 && <div className="col-span-4 text-slate-400">No assets</div>}
          {filtered.map(asset => (
            <div key={asset.id || asset.url} className="bg-white/3 rounded overflow-hidden p-1 flex flex-col">
              <img src={asset.url} alt={asset.filename || ''} className="w-full h-32 object-contain bg-black" />
              <div className="mt-2 text-xs text-slate-300 truncate">{asset.filename || asset.url}</div>
              <div className="mt-2 flex gap-2">
                <button className="flex-1 px-2 py-1 bg-sky-600 rounded text-white" onClick={() => onSelect(asset.url, { width: asset.width, height: asset.height, id: asset.id })}>Select</button>
                <button className="px-2 py-1 bg-red-600 rounded text-white" onClick={() => handleDelete(asset)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

AssetManager.propTypes = {
  tid: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};
