import React, { useEffect, useMemo, useState, useRef } from "react";

export default function CreatePattern({ initial, onChange, className = "" }) {
  const [vars, setVars] = useState(() => {
    if (initial?.vars && Array.isArray(initial.vars) && initial.vars.length === 25) {
      return initial.vars.map(v => (v ? 1 : 0));
    }
    return Array.from({ length: 25 }, () => 0);
  });
  const [brightness, setBrightness] = useState(initial?.brightness ?? 80);
  const [speed, setSpeed] = useState(initial?.speed ?? 1.0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [colors, setColors] = useState(() => {
    if (initial?.colors && Array.isArray(initial.colors) && initial.colors.length === 25) {
      return initial.colors.map(c => c || '#ffffff');
    }
    return Array.from({ length: 25 }, () => '#ffffff');
  });
  const [pickerIndex, setPickerIndex] = useState(null);
  const colorInputRef = useRef(null);
  const [styleName] = useState(initial?.style ?? "default"); // reserved
  // fileRef removed (no JSON upload UI)

  useEffect(() => {
    onChange?.({ vars, colors, title, brightness, speed, style: styleName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(vars), JSON.stringify(colors), brightness, speed, title]);

  const snake = useMemo(() => buildSnakeIndices(5, 5), []);

  function activateAndPick(idx) {
    setVars(prev => {
      const next = prev.slice();
      next[idx] = 1; // always set active when picking color
      return next;
    });
    setTimeout(() => openColorPicker(idx), 50);
  }

  function openColorPicker(idx) {
    setPickerIndex(idx);
  }

  function setColorForIndex(idx, hex) {
    setColors(prev => {
      const next = prev.slice();
      next[idx] = hex;
      return next;
    });
  }

  function clearAll() {
    setVars(Array.from({ length: 25 }, () => 0));
  }

  function invertAll() {
    setVars(prev => prev.map(v => (v ? 0 : 1)));
  }

  function randomise() {
    setVars(prev => prev.map(() => (Math.random() < 0.45 ? 1 : 0)));
  }

  // Removed JSON copy/load helpers per UX change

  return (
    <div className={`mx-auto max-w-3xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Create Pattern</h2>
        <div className="ml-4 w-1/2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Pattern name (e.g. BigJs colours)"
            className="w-full rounded-md border bg-white text-black placeholder:text-neutral-400 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {/* 5×5 Snake Grid */}
      <div className="grid gap-2">
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((__, col) => {
              const linearIndex = row * 5 + col;
              const idx = snake[linearIndex];
              const active = vars[idx] === 1;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => activateAndPick(idx)}
                  className={`h-12 rounded-md border text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-violet-500
                    ${active
                      ? `border-transparent text-white shadow` // background by inline color
                      : "border-gray-300 bg-white text-gray-700 hover:border-violet-300"}`}
                  aria-pressed={active}
                >
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? colors[idx] : undefined, borderRadius: 6 }}>
                    {/* active cells show color, inactive cells show empty */}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Persistent color picker area (always visible above sliders) */}
      <div className="mt-6 mb-4 rounded-md border bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium">Selected colour</label>
            {pickerIndex === null ? (
              <div className="text-sm text-gray-500">Click a cell above to select it, then pick a colour.</div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full" style={{ background: colors[pickerIndex] || '#ffffff', border: '1px solid #e5e7eb' }} />
                    <div className="text-sm font-medium">Colour {pickerIndex + 1}</div>
                  </div>
                  {/* Preset swatches */}
                  <div className="flex items-center gap-2">
                    {['#ffffff','#ff4d4f','#ffa940','#ffd666','#73d13d','#40a9ff','#9254de','#ff7a45','#fadb14','#ff85c0','#14b8a6','#40e0d0'].map((hex) => (
                      <button
                        key={hex}
                        aria-label={`Apply ${hex}`}
                        onClick={() => setColorForIndex(pickerIndex, hex)}
                        type="button"
                        className="w-6 h-6 rounded-sm border"
                        style={{ background: hex, borderColor: '#e5e7eb' }}
                      />
                    ))}
                  </div>
                  {/* Hidden native color input used for advanced colour selection */}
                  <input
                    ref={colorInputRef}
                    type="color"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const idx = Number(e.target.dataset.idx ?? pickerIndex);
                      setColorForIndex(idx, e.target.value);
                      // cleanup dataset
                      delete e.target.dataset.idx;
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!colorInputRef.current) return;
                      colorInputRef.current.value = colors[pickerIndex] || '#ffffff';
                      colorInputRef.current.dataset.idx = String(pickerIndex);
                      colorInputRef.current.click();
                    }}
                    className="px-2 py-1 rounded-md border text-sm"
                    type="button"
                  >
                    More…
                  </button>
                  <button onClick={() => setPickerIndex(null)} className="px-2 py-1 rounded-md border text-sm">Deselect</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Brightness: {brightness}</label>
          <input
            type="range"
            min="0"
            max="100"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Speed: {speed.toFixed(2)}x</label>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-full accent-pink-600"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={clearAll} variant="secondary">Clear</Button>
        <Button onClick={invertAll} variant="secondary">Invert</Button>
        <Button onClick={randomise} variant="secondary">Randomise</Button>
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary" }) {
  if (variant === "secondary") {
    return (
      <button onClick={onClick} type="button" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:border-violet-300">
        {children}
      </button>
    );
  }
  return (
    <button onClick={onClick} type="button" className="rounded-md bg-gradient-to-r from-violet-600 to-pink-600 px-3 py-2 text-sm font-semibold text-white shadow">
      {children}
    </button>
  );
}

function buildSnakeIndices(rows, cols) {
  const indices = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const linear = r * cols + (r % 2 === 0 ? c : cols - 1 - c);
      indices.push(linear);
    }
  }
  return indices;
}
