import React, { useRef } from 'react';
import UploadDrop from './UploadDrop';
import FeedbackPanel from './FeedbackPanel';
import { useVideoFeedback } from './useVideoFeedback';

export default function VideoAnalyzer() {
  const { previewUrl, loading, error, items, meta, educationalResources, nextSteps, analyze } = useVideoFeedback();
  const videoRef = useRef(null);

  const handleSeek = (sec) => {
    const v = videoRef.current;
    if (v) { v.currentTime = Math.max(0, Number(sec) || 0); v.play(); }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-7 space-y-4">
        <UploadDrop onFile={analyze} />
        {previewUrl && <video ref={videoRef} src={previewUrl} controls className="w-full rounded-xl bg-black" />}
        {/* Compact summary under the player for quick glance */}
        {meta && (items?.length > 0 || educationalResources?.length > 0 || nextSteps?.length > 0) && (
          <div className="mt-3 p-3 rounded-lg bg-[#071421] border border-slate-800">
            <div className="text-xs text-slate-400 mb-2">Model: <b className="text-slate-100">{meta.model}</b> • Duration: <b className="text-slate-100">{meta.duration ?? '—'}s</b> • Frames: <b className="text-slate-100">{meta.frameCount ?? items.length}</b></div>
            {items && items.length > 0 && (
              <div className="mb-2">
                <div className="text-sm font-semibold text-slate-100">{items[0].issue}</div>
                <div className="text-xs text-slate-300">{items[0].startSec}s — {items[0].endSec}s</div>
                <div className="text-sm text-slate-300 mt-1">{items[0].suggestion}</div>
                <div className="mt-2">
                  <button onClick={() => { if (videoRef.current) { videoRef.current.currentTime = items[0].startSec; videoRef.current.play(); } }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-700 text-sm text-slate-100 bg-slate-800 hover:bg-slate-700">Jump to clip</button>
                </div>
              </div>
            )}
            {(educationalResources && educationalResources.length > 0) && (
              <div className="text-xs text-slate-300 mt-2">📘 {educationalResources[0].topic} — <a href={educationalResources[0].url} target="_blank" rel="noreferrer" className="text-pink-300 underline">Open</a></div>
            )}
            {(nextSteps && nextSteps.length > 0) && (
              <div className="text-xs text-slate-300 mt-2">🧭 {nextSteps[0]}</div>
            )}
          </div>
        )}
        {loading && <div className="text-sm text-slate-500">Analyzing…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
      <div className="col-span-12 md:col-span-5 space-y-3">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {meta ? (
            <>
              Model: <b>{meta.model}</b> • Frames: <b>{meta.frameCount}</b> • Interval: <b>{meta.frameAssumptionIntervalSec ?? meta.interval ?? ''}s</b>
            </>
          ) : "Upload a video to get feedback."}
        </div>
        <FeedbackPanel items={items} onSeek={handleSeek} educationalResources={educationalResources} nextSteps={nextSteps} />
      </div>
    </div>
  );
}
