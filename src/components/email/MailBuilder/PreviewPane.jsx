import React, { useMemo, useState, useRef } from 'react';

function toast(msg, type = 'info') {
  // very small toast using alert for now; replace with nicer UI if available
  alert((type === 'error' ? 'Error: ' : '') + msg);
}

let lastTestTs = 0;
const CLIENT_LIMIT_MS = 30 * 1000; // 30s between test sends per client

export default function PreviewPane({ tid = 'default', inlinedHtml = '', defaultDevice = 'desktop' }) {
  const [device, setDevice] = useState(defaultDevice);
  const [sending, setSending] = useState(false);
  const toRef = useRef(null);

  const frameSize = useMemo(() => {
    if (device === 'mobile') return { width: 360, height: 780 };
    if (device === 'tablet') return { width: 768, height: 1024 };
    return { width: 1024, height: 900 };
  }, [device]);

  async function sendTest() {
    const to = toRef.current && toRef.current.value;
    if (!to) return toast('Enter recipient email', 'error');
    const now = Date.now();
    if (now - lastTestTs < CLIENT_LIMIT_MS) return toast('Please wait before sending another test', 'error');
    lastTestTs = now;
    setSending(true);
    try {
      const res = await fetch(`/api/tenants/${tid}/campaigns/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, html: inlinedHtml }) });
      if (res.status === 429) {
        const j = await res.json();
        toast('Rate limited. Retry after ' + Math.ceil((j.retry_after_ms || 0) / 1000) + 's', 'error');
      } else if (!res.ok) {
        const txt = await res.text();
        toast('Send failed: ' + txt, 'error');
      } else {
        const j = await res.json();
        toast('Test sent: ' + (j.message || 'ok'));
      }
    } catch (err) { toast('Send error: ' + String(err), 'error'); }
    setSending(false);
  }

  return (
    <div className="p-3 border rounded bg-white/5">
      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs">Device</label>
        <select value={device} onChange={(e) => setDevice(e.target.value)}>
          <option value="desktop">Desktop</option>
          <option value="mobile">360px Mobile</option>
          <option value="tablet">768px Tablet</option>
        </select>
        <input ref={toRef} placeholder="test@domain.com" className="ml-auto p-1 bg-white/5 rounded" />
        <button className="px-2 py-1 bg-emerald-600 text-white rounded" onClick={sendTest} disabled={sending}>{sending ? 'Sending...' : 'Send Test'}</button>
      </div>
      <div style={{ width: frameSize.width, height: frameSize.height, border: '1px solid rgba(255,255,255,0.08)' }}>
        <iframe title="Preview" srcDoc={inlinedHtml} style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    </div>
  );
}
