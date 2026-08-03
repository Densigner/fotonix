import React, { useState } from 'react';
import { X, Mail, ArrowRight } from 'lucide-react';

/**
 * Exit-intent popup for the affiliate signup page. Shown once per session
 * when useExitIntent detects the visitor is about to leave without signing
 * up. Captures an email via POST /api/affiliates/leads (flat-file
 * leads.json on the VPS, same pattern as the rest of affiliates.js) so
 * there's a way to follow up with people who didn't convert.
 */
export default function AffiliateExitIntentPopup({ isOpen, onClose, apiBase }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | done | error

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || status === 'submitting') return;
    setStatus('submitting');
    try {
      const res = await fetch(`${apiBase}/api/affiliates/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'affiliate-signup-exit-intent' }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('done');
    } catch (err) {
      console.warn('Exit-intent lead capture failed:', err);
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[#2a2740] bg-[#14131f] p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#6e6a8c] transition hover:text-[#f5f3ff]"
        >
          <X className="h-5 w-5" />
        </button>

        {status === 'done' ? (
          <div className="text-center">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00f5d4]/10">
              <Mail className="h-6 w-6 text-[#00f5d4]" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-[#f5f3ff]">You're on the list</h2>
            <p className="text-sm text-[#a8a3c0]">We'll drop you a note — no spam, just a follow-up whenever you're ready.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-[#f5f3ff]">Thinking about it?</h2>
            <p className="mb-5 text-sm text-[#a8a3c0]">
              Drop your email below and you can come back to it whenever you're ready.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-[#2a2740] bg-white/[0.03] px-4 py-3 text-sm text-[#f5f3ff] placeholder:text-[#6e6a8c] focus:border-[#00f5d4] focus:outline-none"
              />
              {status === 'error' && (
                <p className="text-xs text-pink-400">Something went wrong — please try again.</p>
              )}
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {status === 'submitting' ? 'Sending…' : (
                  <>
                    Keep Me Posted
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
