import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import MessageBody from './MessageBody';

// Minimal UI primitives fallback if project doesn't have shadcn/ui
const Button = ({ children, variant, className = '', disabled, ...p }) => {
  const base = 'px-3 py-2 rounded font-medium';
  const styles = variant === 'outline'
    ? `border ${disabled ? 'border-neutral-600/40 text-neutral-400' : 'border-neutral-600 text-neutral-100'} bg-transparent`
    : `${disabled ? 'bg-neutral-700 text-neutral-400' : 'bg-slate-800 text-white'}`;
  return <button {...p} className={`${base} ${styles} ${className}`} disabled={disabled}>{children}</button>;
};
const Input = ({ className = '', ...p }) => (
  <input {...p} className={`w-full rounded px-3 py-2 text-sm bg-[#071421] border border-slate-700 text-slate-200 placeholder-neutral-400 dark:bg-neutral-800 dark:border-neutral-700 dark:placeholder-neutral-400 ${className}`} />
);
const Textarea = ({ className = '', ...p }) => (
  <textarea {...p} className={`w-full rounded px-3 py-2 text-sm bg-[#071421] border border-slate-700 text-slate-200 placeholder-neutral-400 dark:bg-neutral-800 dark:border-neutral-700 dark:placeholder-neutral-400 ${className}`} />
);

function StatusPill({ status }) {
  if (!status) return null;
  const map = {
    queued: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800'
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${map[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
}

function useAbortableFetch() {
  const controllerRef = useRef(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  return async (url, init) => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const res = await fetch(url, { ...init, signal: controllerRef.current.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };
}

// Use the shared MessageBody component (sanitizes HTML with DOMPurify)

// Top-level ComposeForm: memoized to avoid remounts
const ComposeForm = React.memo(function ComposeForm({ compose, setCompose, tenantSlug, sending, onSend, replyTo, handleTo, handleSubject, handleText, handleHtml }) {
  const isEmailValid = (s) => typeof s === 'string' && s.trim().length > 3 && s.includes('@');
  const renderRef = useRef(0);
  renderRef.current += 1;
  useEffect(() => {
    console.debug('[ComposeForm] render', renderRef.current);
  });
  const canSend = isEmailValid(compose.to) && ((compose.text && compose.text.trim()) || (compose.html && compose.html.trim()));


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-col">
          <label htmlFor="composer-to" className="mb-1 text-sm text-slate-300">To</label>
          <Input id="composer-to" placeholder="recipient@example.com" value={compose.to ?? replyTo ?? ""} onChange={handleTo} />
        </div>
      </div>

      <div className="flex flex-col">
        <label htmlFor="composer-subject" className="mb-1 text-sm text-slate-300">Subject</label>
        <Input id="composer-subject" placeholder="Subject" value={compose.subject ?? ""} onChange={handleSubject} />
      </div>

      <div className="flex flex-col">
        <label htmlFor="composer-body" className="mb-1 text-sm text-slate-300">Body</label>
        <Textarea id="composer-body" rows={8} placeholder="Write your message…" value={compose.text ?? ""} onChange={handleText} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Button variant="outline" className="mr-2" onClick={() => navigator.clipboard.writeText(JSON.stringify({ tenant_slug: tenantSlug, from: 'noreply@fotonix.co.uk', to: compose.to, subject: compose.subject, text: compose.text, html: compose.html }, null, 2))}>Copy JSON</Button>
        </div>
        <div>
          <Button onClick={onSend} disabled={!canSend || sending} className="ml-2">{sending ? 'Sending…' : 'Send'}</Button>
        </div>
      </div>
    </div>
  );
});

export default function DeluxeEmailClient({ tenantSlug = 'fotonix-prod' }) {
  const fetchJson = useAbortableFetch();
  // Debug render counter for the whole component
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  useEffect(() => {
    console.debug('[DeluxeEmailClient] render', renderCountRef.current);
  });
  const [health, setHealth] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await fetch('/__health').then((r) => r.json());
        setHealth('up');
      } catch (e) {
        setHealth('down');
      }
    })();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenant: tenantSlug });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('q', search);
      params.set('limit', '25');
      const data = await fetchJson(`/api/email/messages?${params.toString()}`);
      setMessages(Array.isArray(data) ? data : []);
      if (!selectedId && Array.isArray(data) && data.length) setSelectedId(data[0].id);
    } catch (e) {
      setError(e?.message ?? 'Failed to load');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMessages(); }, [statusFilter]);
  useEffect(() => { const t = setTimeout(() => loadMessages(), 350); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setDetail(null); setDetailError(null);
      try {
        const params = new URLSearchParams({ tenant: tenantSlug });
        const data = await fetchJson(`/api/email/messages/${selectedId}?${params.toString()}`);
        setDetail(data);
      } catch (e) {
        setDetailError(e?.message ?? 'Failed to load message');
      }
    })();
  }, [selectedId]);

  const [compose, setCompose] = useState({ to: '', from: '', subject: '', text: '', html: '' });

  // Log compose changes for debugging
  useEffect(() => {
    console.debug('[DeluxeEmailClient] compose state changed', { compose });
  }, [compose]);

  // Stable handlers to avoid re-creating functions on every render
  const handleTo = useCallback((e) => {
    const v = e?.target?.value ?? '';
    setCompose(prev => {
      console.debug('[handleTo] prev', prev, 'next', v);
      return { ...prev, to: v };
    });
  }, []);
  // removed editable From field; sender will be hardcoded
  const handleSubject = useCallback((e) => {
    const v = e?.target?.value ?? '';
    setCompose(prev => {
      console.debug('[handleSubject] prev', prev, 'next', v);
      return { ...prev, subject: v };
    });
  }, []);
  const handleText = useCallback((e) => {
    const v = e?.target?.value ?? '';
    setCompose(prev => {
      console.debug('[handleText] prev', prev, 'next', v);
      return { ...prev, text: v };
    });
  }, []);
  const handleHtml = useCallback((e) => {
    const v = e?.target?.value ?? '';
    setCompose(prev => {
      console.debug('[handleHtml] prev', prev, 'next', v);
      return { ...prev, html: v };
    });
  }, []);

  const sendMail = async () => {
    setSending(true);
    try {
  const body = { tenant_slug: tenantSlug, from: 'noreply@fotonix.co.uk', to: compose.to.trim(), subject: (compose.subject && compose.subject.trim()) || '(no subject)', text: compose.text || undefined, html: compose.html || undefined };
      const res = await fetch('/api/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const payload = await res.json();
      const optimistic = { id: payload.id, to_address: compose.to, subject: compose.subject || '(no subject)', status: 'queued', created_at: new Date().toISOString(), sent_at: null };
      setMessages((prev) => [optimistic, ...prev]);
      setComposeOpen(false);
      setCompose({ to: '', from: '', subject: '', text: '', html: '' });
    } catch (e) {
      alert('Send failed. Check worker & SMTP settings.');
    } finally { setSending(false); }
  };


  return (
    <div className="h-full w-full p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Inbox</h2>
          <div className="text-sm text-slate-500">{messages.length} messages</div>
        </div>
        <div className="flex items-center gap-2">
          <Input id="search-input" placeholder="Search mail" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button onClick={() => setComposeOpen(true)}>Compose</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[calc(100%-64px)]">
        <div className="col-span-1 overflow-auto bg-[#071421] border border-slate-800 rounded p-2">
          {loading && <div className="text-sm text-slate-400">Loading…</div>}
          {!loading && messages.length === 0 && <div className="text-sm text-slate-400">No messages yet.</div>}
          {messages.map((m) => (
            <div key={m.id} className={`p-2 rounded hover:bg-slate-800 cursor-pointer ${selectedId===m.id?'bg-slate-800':''}`} onClick={() => setSelectedId(m.id)}>
              <div className="font-medium">{m.to_address || m.to || 'Unknown'}</div>
              <div className="text-sm text-slate-400">{m.subject || '(no subject)'}</div>
              <div className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="col-span-3 overflow-auto bg-[#071421] border border-slate-800 rounded p-4">
          {!detail ? (
            <div className="text-sm text-slate-400">Select a message</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm text-slate-300">From: {detail.from_address}</div>
                  <div className="text-sm text-slate-300">To: {detail.to_address}</div>
                  <div className="mt-1 text-lg font-semibold">{detail.subject}</div>
                </div>
                <div><StatusPill status={detail.status} /></div>
              </div>

              <div className="mt-3">
                <MessageBody html={detail.html} text={detail.text} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose dialog simple */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setComposeOpen(false)} />
          <div className="relative sm:max-w-xl w-full z-10 p-6 rounded shadow-lg bg-[#071421] border border-slate-800 dark:bg-neutral-900 dark:text-neutral-100">
            <ComposeForm compose={compose} setCompose={setCompose} tenantSlug={tenantSlug} sending={sending} onSend={sendMail} replyTo={null}
              handleTo={handleTo} handleSubject={handleSubject} handleText={handleText} handleHtml={handleHtml} />
          </div>
        </div>
      )}
    </div>
  );
}
