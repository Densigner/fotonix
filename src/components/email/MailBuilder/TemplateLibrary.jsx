import React, { useEffect, useState } from 'react';
import { API_URL } from '../../../config/environment';

function downloadJson(obj, filename) {
  const data = JSON.stringify(obj, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TemplateLibrary({ tid = 'default', onEditTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchList(); }, [tid]);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/tenants/${tid}/templates`);
      const j = await res.json();
      if (j && j.templates) setTemplates(j.templates);
    } catch (err) {
      console.error('fetch templates error', err);
    } finally { setLoading(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete template?')) return;
    const res = await fetch(`${API_URL}/api/tenants/${tid}/templates/${id}`, { method: 'DELETE' });
    if (res.ok) fetchList();
  }

  function handleExport(t) {
    const filename = `template-${t.name.replace(/[^a-z0-9\-_]/gi, '_')}.json`;
    downloadJson({ name: t.name, blocks: t.blocks, assets: t.assets || [] }, filename);
  }

  async function handleImport(file) {
    if (!file) return;
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      if (!obj.blocks) return alert('Invalid template JSON');
      // Optionally validate asset urls here
      const res = await fetch(`${API_URL}/api/tenants/${tid}/templates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: obj.name || 'Imported Template', blocks: obj.blocks, assets: obj.assets || [] }) });
      if (res.ok) { fetchList(); alert('Import successful'); }
    } catch (err) { alert('Invalid JSON: ' + err.message); }
  }

  return (
    <div className="p-3 border rounded bg-white/5">
      <h4 className="text-sm font-semibold mb-2">Templates</h4>
      <div className="mb-2">
        <input type="file" accept="application/json" onChange={(e) => handleImport(e.target.files && e.target.files[0])} />
      </div>
      {loading && <div>Loading...</div>}
      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="p-2 bg-white/3 rounded flex items-center justify-between">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <button className="px-2 py-1 bg-sky-600 text-white rounded" onClick={() => onEditTemplate && onEditTemplate(t)}>Edit</button>
              <button className="px-2 py-1 bg-slate-700 text-white rounded" onClick={() => handleExport(t)}>Export</button>
              <button className="px-2 py-1 bg-yellow-600 text-white rounded" onClick={async () => {
                // duplicate by posting a copy
                const clone = { name: t.name + ' (copy)', blocks: t.blocks, assets: t.assets || [] };
                const res = await fetch(`${API_URL}/api/tenants/${tid}/templates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clone) });
                if (res.ok) fetchList();
              }}>Duplicate</button>
              <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => handleDelete(t.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
