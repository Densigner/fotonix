import React, { useEffect, useRef, useState } from "react";

export default function AcrylicComposerWithMask() {
  const baseCanvasRef = useRef(null);   // shows merged preview
  const maskCanvasRef = useRef(null);   // user paints mask on top (same size)
  const containerRef = useRef(null);

  const [guideline, setGuideline] = useState(null);
  const [rendering, setRendering] = useState(null);
  const [baseImg, setBaseImg] = useState(null);
  const [overlayImg, setOverlayImg] = useState(null);

  // overlay transform
  const [overlayScale, setOverlayScale] = useState(0.8);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [draggingOverlay, setDraggingOverlay] = useState(false);
  const dragStateRef = useRef(null);

  // mask drawing
  const [isPainting, setIsPainting] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [mode, setMode] = useState("paint"); // "paint" (transparent => edit) | "erase" (opaque => preserve)

  const [prompt, setPrompt] = useState(
    "Enhance realistically: correct edges, reflections, lighting; keep proportions."
  );
  const [resultUrl, setResultUrl] = useState(null);

  // Load images from file inputs (Object URLs)
  useEffect(() => {
    if (guideline) {
      const img = new Image();
      img.onload = () => setBaseImg(img);
      img.src = URL.createObjectURL(guideline);
    }
  }, [guideline]);

  useEffect(() => {
    if (rendering) {
      const img = new Image();
      img.onload = () => setOverlayImg(img);
      img.src = URL.createObjectURL(rendering);
    }
  }, [rendering]);

  // Redraw whenever inputs change
  useEffect(() => {
    drawBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseImg, overlayImg, overlayScale, overlayOpacity, pos]);

  function syncCanvasSizes() {
    const baseCanvas = baseCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!baseImg || !baseCanvas || !maskCanvas) return;

    // set logical pixel size to image natural size
    const newW = baseImg.naturalWidth;
    const newH = baseImg.naturalHeight;

    // preserve existing mask content by scaling it to new size
    const prevW = maskCanvas.width || 0;
    const prevH = maskCanvas.height || 0;
    const hadPrev = prevW > 0 && prevH > 0;

    // copy previous content to temp canvas to allow scaling
    let prev = null;
    if (hadPrev) {
      prev = document.createElement('canvas');
      prev.width = prevW; prev.height = prevH;
      const pctx = prev.getContext('2d');
      pctx.drawImage(maskCanvas, 0, 0);
    }

    baseCanvas.width = newW;
    baseCanvas.height = newH;
    baseCanvas.style.width = '100%';
    baseCanvas.style.height = 'auto';

    // Keep mask canvas identical size (logical pixels)
    maskCanvas.width = newW;
    maskCanvas.height = newH;
    maskCanvas.style.width = '100%';
    maskCanvas.style.height = '100%';

    const mctx = maskCanvas.getContext('2d');
    if (hadPrev && prev) {
      // scale previous mask to new size so painted regions align
      mctx.clearRect(0, 0, newW, newH);
      mctx.drawImage(prev, 0, 0, prevW, prevH, 0, 0, newW, newH);
    } else {
      // Initialize mask as fully opaque (preserve everywhere).
      // Use a white visual fill so the UI shows a white background instead of a black block,
      // while still keeping opaque pixels for the mask.
      mctx.globalCompositeOperation = 'source-over';
      mctx.fillStyle = 'rgba(255,255,255,1)';
      mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
  }

  function drawBase() {
    const canvas = baseCanvasRef.current;
    if (!canvas || !baseImg) return;

    syncCanvasSizes();
    const ctx = canvas.getContext('2d');

    // Draw guideline (base)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

    // Draw overlay (rendering)
    if (overlayImg) {
      const targetW = canvas.width * overlayScale;
      const aspect = overlayImg.naturalHeight / overlayImg.naturalWidth;
      const targetH = targetW * aspect;

      ctx.save();
      ctx.globalAlpha = overlayOpacity;
      ctx.drawImage(overlayImg, pos.x, pos.y, targetW, targetH);
      ctx.restore();
    }
  }

  // Helpers to map mouse events to canvas pixel coordinates (handles CSS scaling)
  function getCanvasPixelPos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.nativeEvent.clientX;
    const clientY = e.nativeEvent.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  // Overlay drag (use pixel-accurate coords)
  function handleOverlayMouseDown(e) {
    if (!overlayImg) return;
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    setDraggingOverlay(true);
    const posPx = getCanvasPixelPos(canvas, e);
    dragStateRef.current = { startClient: posPx, startOverlay: { ...pos } };
  }
  function handleOverlayMouseMove(e) {
    if (!draggingOverlay) return;
    const canvas = baseCanvasRef.current;
    if (!canvas || !dragStateRef.current) return;
    const current = getCanvasPixelPos(canvas, e);
    const dx = current.x - dragStateRef.current.startClient.x;
    const dy = current.y - dragStateRef.current.startClient.y;
    setPos({ x: dragStateRef.current.startOverlay.x + dx, y: dragStateRef.current.startOverlay.y + dy });
  }
  function handleOverlayMouseUp() {
    setDraggingOverlay(false);
    dragStateRef.current = null;
  }

  // Mask drawing helpers
  function getMaskCtx() {
    const maskCanvas = maskCanvasRef.current;
    return maskCanvas?.getContext('2d');
  }

  function canvasCoordFromEvent(e) {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return { x: 0, y: 0 };
    return getCanvasPixelPos(maskCanvas, e);
  }

  function beginPaint(e) {
    setIsPainting(true);
    paint(e, true);
  }
  function endPaint() {
    setIsPainting(false);
  }

  function paint(e, isStart = false) {
    if (!isPainting && !isStart) return;
    const ctx = getMaskCtx();
    const maskCanvas = maskCanvasRef.current;
    if (!ctx || !maskCanvas) return;

    const { x, y } = canvasCoordFromEvent(e);

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = brushSize;

    if (mode === 'paint') {
      // paint = make area transparent => editable by OpenAI
      ctx.globalCompositeOperation = 'destination-out'; // removes from alpha
      ctx.strokeStyle = 'rgba(0,0,0,1)'; // irrelevant with destination-out
    } else {
      // erase = restore opacity => preserved area
      ctx.globalCompositeOperation = 'source-over';
      // Draw opaque white on the mask when restoring so the visual overlay stays white
      ctx.strokeStyle = 'rgba(255,255,255,1)';
    }

    // Draw a short line segment (supports both drag and click)
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.001, y + 0.001);
    ctx.stroke();
    ctx.restore();
  }

  function clearMask() {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const mctx = maskCanvas.getContext('2d');
    // Reset to fully opaque (preserve everything)
    mctx.globalCompositeOperation = 'source-over';
    mctx.fillStyle = 'rgba(0,0,0,1)';
    mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  }

  async function getMergedBlob() {
    const canvas = baseCanvasRef.current;
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
    });
  }

  async function getMaskBlob() {
    const maskCanvas = maskCanvasRef.current;
    return new Promise((resolve) => {
      // Important: mask must be PNG with alpha; transparent pixels = editable
      maskCanvas.toBlob((b) => resolve(b), 'image/png');
    });
  }

  async function downloadMerged() {
    const blob = await getMergedBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'composite.png';
    a.click();
  }

  async function downloadMask() {
    const blob = await getMaskBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mask.png';
    a.click();
  }

  async function sendToOpenAI() {
    const imgBlob = await getMergedBlob();
    const maskBlob = await getMaskBlob();

    const form = new FormData();
    form.append('image', imgBlob, 'composite.png');
    form.append('mask', maskBlob, 'mask.png');
    form.append('prompt', prompt);

    const res = await fetch('/api/ai-blend', { method: 'POST', body: form });
    const data = await res.json();
    if (data?.result_b64) {
      setResultUrl(`data:image/png;base64,${data.result_b64}`);
    } else if (data?.url) {
      setResultUrl(data.url);
    } else {
      alert(data?.error || 'OpenAI call failed');
    }
  }

  return (
    <div ref={containerRef} style={{ padding: 16, maxWidth: 980, background: '#ffffff', color: '#000000' }}>
      <h2>Acrylic Composer + Mask (Browser)</h2>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label>Guideline Image</label>
          <input type="file" accept="image/*" onChange={(e) => setGuideline(e.target.files[0] || null)} />
        </div>
        <div>
          <label>Rendering Image</label>
          <input type="file" accept="image/*" onChange={(e) => setRendering(e.target.files[0] || null)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Overlay Scale ({(overlayScale * 100).toFixed(0)}%)</label>
        <input type="range" min="0.1" max="1.5" step="0.01" value={overlayScale}
               onChange={(e) => setOverlayScale(parseFloat(e.target.value))} />
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Overlay Opacity ({overlayOpacity.toFixed(2)})</label>
        <input type="range" min="0" max="1" step="0.01" value={overlayOpacity}
               onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))} />
      </div>

      <p style={{ marginTop: 8, fontSize: 13, color: '#333' }}>
        Tip: drag the image area to position the overlay. Switch to “Paint” and brush the region you want OpenAI to edit
        (it will turn transparent in the mask). “Erase” restores areas to be preserved.
      </p>

      {/* Canvas stack */}
      <div style={{ position: 'relative', border: '1px solid #ddd', marginTop: 8 }}>
        <canvas
          ref={baseCanvasRef}
          style={{ width: '100%', display: 'block', cursor: draggingOverlay ? 'grabbing' : 'grab' }}
          onMouseDown={handleOverlayMouseDown}
          onMouseMove={handleOverlayMouseMove}
          onMouseUp={handleOverlayMouseUp}
          onMouseLeave={handleOverlayMouseUp}
        />
        <canvas
          ref={maskCanvasRef}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'auto', cursor: mode === 'paint' ? 'crosshair' : 'cell',
          }}
          onMouseDown={(e) => { beginPaint(e); }}
          onMouseMove={(e) => { paint(e); }}
          onMouseUp={endPaint}
          onMouseLeave={endPaint}
        />
      </div>

      {/* Mask controls */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label>Brush Size: {brushSize}px</label>
          <input type="range" min="4" max="200" step="1" value={brushSize}
                 onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} />
        </div>

        <div>
          <label>Mode:&nbsp;</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="paint">Paint (editable)</option>
            <option value="erase">Erase (preserve)</option>
          </select>
        </div>

        <button onClick={clearMask}>Clear Mask (preserve all)</button>
        <button onClick={downloadMask}>Download Mask</button>
      </div>

      {/* Actions */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={downloadMerged}>Download merged PNG</button>
        <button onClick={sendToOpenAI}>Send merged + mask to OpenAI</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>OpenAI Prompt</label>
        <textarea rows={3} style={{ width: '100%' }} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </div>

      {resultUrl && (
        <div style={{ marginTop: 12 }}>
          <h3>OpenAI Result</h3>
          <img src={resultUrl} alt="openai result" style={{ maxWidth: '100%' }} />
        </div>
      )}
    </div>
  );
}
