import React, { useRef, useState } from 'react';

export default function UploadDrop({ onFile }) {
  const inputRef = useRef(null);
  const [filename, setFilename] = useState('');

  function handleFile(f) {
    if (!f) return;
    setFilename(f.name);
    if (onFile) onFile(f);
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#0e0a16]/80 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <label
          htmlFor="shortreview-file"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl shadow-md cursor-pointer text-sm"
        >
          Choose file
        </label>
        <input
          id="shortreview-file"
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            handleFile(f);
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-300 truncate">{filename || <span className="text-slate-500">No file chosen</span>}</div>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-3">Upload a short video (mp4/mov/webm). The filename will appear here once selected.</p>
    </div>
  );
}
