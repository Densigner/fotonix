import React from 'react';

export default function FeedbackPanel({ items = [], onSeek, educationalResources = [], nextSteps = [] }) {
  if (!items.length && !educationalResources.length && !nextSteps.length) return <div className="text-sm text-slate-400">No suggestions yet.</div>;
  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-start gap-4 p-4 rounded-2xl bg-[#071421] border border-slate-800 shadow-sm"
            >
              <div className="flex-shrink-0 w-12 h-8 bg-slate-900 rounded-md flex items-center justify-center text-xs text-slate-400">
                {it.startSec}s
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-semibold text-slate-100">{it.issue}</div>
                  <div className="text-xs text-slate-400">{it.startSec}s — {it.endSec}s</div>
                </div>
                <div className="text-sm text-slate-300 leading-relaxed mb-2">{it.suggestion}</div>
                <div>
                  <button
                    onClick={() => onSeek?.(it.startSec)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-700 text-sm text-slate-100 bg-slate-800 hover:bg-slate-700"
                  >
                    Jump to clip
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {educationalResources.length > 0 && (
        <div className="p-3 rounded-lg bg-[#071421] border border-slate-800">
          <div className="text-sm font-semibold text-slate-100 mb-2">📘 Educational Resources</div>
          <ul className="space-y-2 text-sm">
            {educationalResources.map((r, i) => (
              <li key={i}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-pink-300 underline">
                  {r.topic}
                </a>
                <div className="text-xs text-slate-400 truncate">{r.url}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextSteps.length > 0 && (
        <div className="p-3 rounded-lg bg-[#071421] border border-slate-800">
          <div className="text-sm font-semibold text-slate-100 mb-2">🧭 Next Steps</div>
          <ol className="list-decimal list-inside text-sm space-y-1 text-slate-300">
            {nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
