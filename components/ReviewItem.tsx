// @ts-nocheck
import React, { useCallback, useState } from 'react';

export type Review = {
  id: string;
  name: string;
  title: string;
  body: string;
  rating: number;
  date: string;
  location?: string;
  verified?: boolean;
  helpfulUp?: number;
  helpfulDown?: number;
};

// clamp util
const clamp = (v: number, lo = 0) => Math.max(lo, Math.floor(v));

// API stub: POST /api/reviews/:id/helpful { vote: 'up'|'down'|'clear' } => { helpfulUp, helpfulDown }
export async function saveHelpfulVote(reviewId: string, vote: 'up' | 'down' | 'clear') {
  try {
    const resp = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/helpful`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    });
    if (!resp.ok) return null;
    const j = await resp.json();
    return { helpfulUp: Number(j.helpfulUp || 0), helpfulDown: Number(j.helpfulDown || 0) };
  } catch (e) {
    // demo/no-op on network error
    return null;
  }
}

type MyVote = 'up' | 'down' | null;

// Hook that manages optimistic helpful voting and localStorage persistence
export function useHelpfulVote(
  reviewId: string,
  initialUp = 0,
  initialDown = 0
) {
  const key = `rv-helpful-${reviewId}`;
  const [up, setUp] = useState(clamp(initialUp));
  const [down, setDown] = useState(clamp(initialDown));
  const [myVote, setMyVote] = useState<MyVote>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return raw === 'up' ? 'up' : raw === 'down' ? 'down' : null;
    } catch (e) {
      return null;
    }
  });
  const [pending, setPending] = useState(false);

  // helper to persist
  const persist = useCallback((v: MyVote) => {
    try {
      if (v === null) localStorage.removeItem(key);
      else localStorage.setItem(key, v);
    } catch (e) {}
  }, [key]);

  // vote action: optimistic update then reconcile
  const vote = useCallback(async (v: 'up' | 'down') => {
    if (pending) return;
    const prevVote = myVote;
    let nextVote: MyVote = v === myVote ? null : v;

    // compute optimistic counts
    const oldUp = up; const oldDown = down;
    let nextUp = oldUp; let nextDown = oldDown;

    if (prevVote === nextVote) {
      // no-op
    } else if (prevVote === 'up' && nextVote === null) {
      nextUp = clamp(oldUp - 1);
    } else if (prevVote === 'down' && nextVote === null) {
      nextDown = clamp(oldDown - 1);
    } else if (prevVote === 'up' && nextVote === 'down') {
      nextUp = clamp(oldUp - 1); nextDown = oldDown + 1;
    } else if (prevVote === 'down' && nextVote === 'up') {
      nextDown = clamp(oldDown - 1); nextUp = oldUp + 1;
    } else if (prevVote === null && nextVote === 'up') {
      nextUp = oldUp + 1;
    } else if (prevVote === null && nextVote === 'down') {
      nextDown = oldDown + 1;
    }

    // apply optimistic
    setUp(nextUp); setDown(nextDown); setMyVote(nextVote); persist(nextVote);

    setPending(true);
    try {
      const apiVote = nextVote === null ? 'clear' : nextVote;
      const res = await saveHelpfulVote(reviewId, apiVote);
      if (res && typeof res.helpfulUp === 'number' && typeof res.helpfulDown === 'number') {
        // reconcile authoritative counts
        setUp(clamp(res.helpfulUp));
        setDown(clamp(res.helpfulDown));
        // persist server-side state nothing to do for myVote
        persist(nextVote);
        // analytics
        try { window.dispatchEvent(new CustomEvent('review:voted', { detail: { id: reviewId, nextVote, prevVote } })); } catch (e) {}
      } else {
        // server returned null => demo no-op: keep optimistic but do not change
      }
    } catch (e) {
      // rollback
      setUp(oldUp); setDown(oldDown); setMyVote(prevVote); persist(prevVote);
    } finally {
      setPending(false);
    }
  }, [down, myVote, pending, persist, reviewId, up]);

  return {
    up, down, total: up + down, helpfulPct: up + down ? Math.round((up / (up + down)) * 100) : 0,
    myVote, pending, vote
  } as const;
}

type Props = { review: Review };

export default function ReviewItem({ review }: Props) {
  const { id, name, title, body, rating, date, location, verified, helpfulUp = 0, helpfulDown = 0 } = review;
  const { up, down, total, helpfulPct, myVote, pending, vote } = useHelpfulVote(id, helpfulUp, helpfulDown);

  return (
    <li className="py-3">
      <article className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h4 className="font-semibold text-slate-100">{title}</h4>
              <div className="text-sm text-slate-400">{rating.toFixed(1)}★</div>
              {verified && <div className="ml-1 rounded-full px-2 py-0.5 text-xs text-slate-300 bg-white/5">Verified</div>}
            </div>
            <p className="mt-2 text-slate-200 text-sm">{body}</p>
            <div className="mt-3 text-xs text-slate-400">— {name} · {new Date(date).toLocaleDateString()} {location ? `· ${location}` : ''}</div>
          </div>

          <div className="flex-shrink-0 ml-4 flex flex-col items-end gap-2">
            <div className="text-xs text-slate-300">{total} found this helpful ({helpfulPct}%)</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={myVote === 'up'}
                disabled={pending}
                onClick={() => vote('up')}
                className={`rounded-full px-3 py-1.5 text-xs transition ${myVote === 'up' ? 'bg-white/10 text-white ring-2 ring-indigo-400/60' : 'bg-white/5 text-slate-300 border border-white/10'} focus:outline-none focus:ring-2 focus:ring-indigo-400/60`}
                aria-label={`Helpful up. ${up} people found this helpful`}
              >
                👍 {up}
              </button>

              <button
                type="button"
                aria-pressed={myVote === 'down'}
                disabled={pending}
                onClick={() => vote('down')}
                className={`rounded-full px-3 py-1.5 text-xs transition ${myVote === 'down' ? 'bg-white/10 text-white ring-2 ring-indigo-400/60' : 'bg-white/5 text-slate-300 border border-white/10'} focus:outline-none focus:ring-2 focus:ring-indigo-400/60`}
                aria-label={`Helpful down. ${down} people found this unhelpful`}
              >
                👎 {down}
              </button>
            </div>
          </div>
        </div>
      </article>
      {/* HTML fallback for non-JS browsers: simple form posts back to API */}
      <noscript>
        <div className="mt-2">
          <form method="post" action={`/api/reviews/${id}/helpful`}>
            <input type="hidden" name="vote" value="up" />
            <button type="submit" className="rounded-full px-3 py-1.5 text-xs bg-white/5 border border-white/10 mr-2">👍 {up}</button>
            <input type="hidden" name="vote" value="down" />
            <button type="submit" className="rounded-full px-3 py-1.5 text-xs bg-white/5 border border-white/10">👎 {down}</button>
          </form>
        </div>
      </noscript>
    </li>
  );
}
