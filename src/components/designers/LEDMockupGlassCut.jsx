import React, { useEffect, useMemo, useRef, useState } from "react";

export default function LEDMockupGlassCut({
  src,
  colors = ["#22D3EE", "#34D399", "#A78BFA", "#F472B6", "#F59E0B", "#EF4444", "#FFFFFF"],
  initialIndex = 0,
  title = "LED Preview",
  expandPx = 200,         // acrylic expansion around design before cutting
  ringThicknessPx = 10,  // visible LED ring thickness
  maxArtWidth = 260      // scales PNG inside the mockup
}) {
  const [idx, setIdx] = useState(initialIndex);
  const color = colors[idx % colors.length];
  const canvasRef = useRef(null);
  const work = useRef(document.createElement("canvas"));

  const rgb = useMemo(() => hexToRgb(color), [color]);

  useEffect(() => {
    let cancelled = false;
    const cnv = canvasRef.current;
    const W = 360, H = 440;
    cnv.width = W; cnv.height = H;
    const ctx = cnv.getContext("2d");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      drawScene(ctx, W, H, img);
    };
    img.onerror = () => drawScene(ctx, W, H, null);
    img.src = src || "";

    return () => { cancelled = true; };
  }, [src, rgb, expandPx, ringThicknessPx, maxArtWidth]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <div className="flex gap-1">
          {colors.map((c, i) => (
            <button
              key={c+i}
              onClick={() => setIdx(i)}
              className="h-5 w-5 rounded-full ring-1 ring-black/20"
              style={{ background: c }}
              aria-label={`Set color ${c}`}
            />
          ))}
        </div>
      </div>

      <div
        className="relative w-full rounded-xl overflow-hidden"
        style={{
          aspectRatio: "4/5",
          isolation: "isolate",
          background: "radial-gradient(ellipse at bottom, rgba(0,0,0,.35) 0%, rgba(0,0,0,.85) 70%)"
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
          onClick={() => setIdx(i => (i+1)%colors.length)}
        >
          Next color
        </button>
        <div className="text-xs text-slate-400">Tip: transparent PNG gives the cleanest edge.</div>
      </div>
    </div>
  );

  // ============ draw pipeline ===============================================

  function drawScene(ctx, W, H, img) {
    ctx.clearRect(0,0,W,H);

    // table/ground
    const tableH = Math.round(H * 0.28);
    const tableY = H - tableH;
    const g = ctx.createLinearGradient(0, tableY, 0, H);
    g.addColorStop(0, "rgba(20,20,20,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(0, tableY, W, tableH);

    // base
    drawBase(ctx, W, H, tableY, rgb);

    if (!img) return;

    // scale & place artwork
    const scale = Math.min(1, maxArtWidth / img.width);
    const artW = Math.max(1, Math.round(img.width * scale));
    const artH = Math.max(1, Math.round(img.height * scale));
    const plateBottom = tableY + 2;
    const artX = Math.round(W/2 - artW/2);
    const artY = Math.round(plateBottom - artH - 24);

    // build alpha mask of the artwork
    const { mask, w, h } = getAlphaMask(img, artW, artH);

    // OUTER acrylic silhouette (dilated alpha)
    const outer = dilate(mask, w, h, Math.max(1, Math.round(expandPx)));

    // RING = dilate(expand) – dilate(expand - thickness)
    const innerForRing = dilate(mask, w, h, Math.max(0, Math.round(Math.max(0, expandPx - ringThicknessPx))));
    const ringMask = subtract(outer, innerForRing);

    // Ambient wall glow
    drawAmbient(ctx, W, H, tableY, rgb);

    // Trace the OUTER silhouette to polygons and render **glass plate cut to shape**
    const contours = traceContours(outer, w, h, 1); // array of paths [{x,y}...]
    drawGlassSilhouette(ctx, contours, artX, artY, rgb);

    // LED ring on the edge
    drawRing(ctx, ringMask, w, h, artX, artY, rgb);

    // Illuminated artwork (white core + slight color tint + bloom)
    drawLitArtwork(ctx, img, artX, artY, artW, artH, rgb);
  }

  // ============ visuals =======================================================

  function drawAmbient(ctx, W, H, tableY, rgb) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.filter = "blur(40px)";
    ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    const gw = Math.round(W*0.78), gh = Math.round(H*0.36);
    ctx.beginPath();
    ctx.ellipse(W/2, tableY - gh*0.1, gw/2, gh/2, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawBase(ctx, W, H, tableY, rgb) {
    ctx.save();
    const bw = Math.round(W * 0.78);
    const bh = Math.round(H * 0.12);
    const bx = Math.round((W - bw)/2);
    const by = H - bh;

    roundRect(ctx, bx, by-2, bw, bh, 26);
    ctx.fillStyle = "#0B0F14"; ctx.fill();

    ctx.beginPath();
    ellipse(ctx, W/2, by-6, bw*0.43, bh*0.22);
    ctx.fillStyle = "#0B0F14"; ctx.fill();

    const rg = ctx.createRadialGradient(W/2, by-10, 12, W/2, by-10, bw*0.5);
    rg.addColorStop(0, "rgba(255,255,255,0.06)");
    rg.addColorStop(1, "rgba(255,255,255,0.0)");
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = rg;
    ctx.beginPath(); ellipse(ctx, W/2, by-6, bw*0.43, bh*0.22); ctx.fill();
    ctx.globalAlpha = 1;

    // slot
    const sw = Math.round(bw * 0.42);
    roundRect(ctx, Math.round(W/2 - sw/2), by-12, sw, 6, 3);
    ctx.fillStyle = "#05070A"; ctx.fill();

    // LED indicator
    ctx.beginPath();
    ctx.arc(bx + bw - 35, by + Math.round(bh*0.55), 4, 0, Math.PI*2);
    ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.globalAlpha = .9; ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGlassSilhouette(ctx, contours, offsetX, offsetY, rgb) {
    if (!contours.length) return;
    ctx.save();

    // Base translucent fill
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    contours.forEach(path => {
      if (!path.length) return;
      ctx.moveTo(offsetX + path[0].x, offsetY + path[0].y);
      for (let i=1;i<path.length;i++) ctx.lineTo(offsetX + path[i].x, offsetY + path[i].y);
      ctx.closePath();
    });
    ctx.fill();

    // Outer rim (LED tint)
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    contours.forEach(path => {
      if (!path.length) return;
      ctx.moveTo(offsetX + path[0].x, offsetY + path[0].y);
      for (let i=1;i<path.length;i++) ctx.lineTo(offsetX + path[i].x, offsetY + path[i].y);
      ctx.closePath();
    });
    ctx.stroke();

    // Inner highlight (gives “edge thickness”)
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    contours.forEach(path => {
      if (!path.length) return;
      // inset by 1px visually by offsetting along normal is heavy; cheap trick:
      // just stroke again with lighter alpha.
      ctx.moveTo(offsetX + path[0].x, offsetY + path[0].y);
      for (let i=1;i<path.length;i++) ctx.lineTo(offsetX + path[i].x, offsetY + path[i].y);
      ctx.closePath();
    });
    ctx.stroke();

    ctx.restore();
  }

  function drawRing(ctx, ringMask, w, h, x, y, rgb) {
    const img = new ImageData(w, h);
    for (let i=0, j=0; i<ringMask.length; i++, j+=4) {
      if (ringMask[i]) {
        img.data[j+0] = rgb.r; img.data[j+1] = rgb.g; img.data[j+2] = rgb.b; img.data[j+3] = 255;
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(6px)";
    ctx.putImageData(img, x, y);
    ctx.filter = "none";
    ctx.globalAlpha = 0.9;
    ctx.putImageData(img, x, y);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function drawLitArtwork(ctx, img, x, y, w, h, rgb) {
    ctx.save();
    // bloom
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`;
    ctx.shadowBlur = 18;
    ctx.globalAlpha = 0.65;
    ctx.drawImage(img, x, y, w, h);

    // white core + subtle tint
    const t = work.current; t.width = w; t.height = h;
    const tctx = t.getContext("2d");
    tctx.clearRect(0,0,w,h);
    tctx.drawImage(img, 0, 0, w, h);
    tctx.globalCompositeOperation = "source-in";
    tctx.fillStyle = "#FFFFFF"; tctx.fillRect(0,0,w,h);
    tctx.globalCompositeOperation = "source-atop";
    tctx.globalAlpha = 0.15;
    tctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    tctx.fillRect(0,0,w,h);

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(t, x, y);
    ctx.restore();
  }

  // ============ mask + contour utils =========================================

  function getAlphaMask(img, w, h) {
    const cv = work.current;
    cv.width = w; cv.height = h;
    const c = cv.getContext("2d", { willReadFrequently: true });
    c.clearRect(0,0,w,h);
    c.drawImage(img, 0, 0, w, h);
    const d = c.getImageData(0,0,w,h).data;
    const mask = new Uint8Array(w*h);
    for (let i=0, p=0; i<d.length; i+=4, p++) mask[p] = d[i+3] > 8 ? 1 : 0;
    return { mask, w, h };
  }

  function dilate(src, w, h, R) {
    if (R <= 0) return src.slice();
    const dst = new Uint8Array(src.length);
    for (let y=0; y<h; y++) {
      for (let x=0; x<w; x++) {
        let on = 0;
        for (let j=-R; j<=R && !on; j++) {
          const yy = y+j; if (yy<0||yy>=h) continue;
          const yoff = yy*w;
          for (let i=-R; i<=R; i++) {
            const xx = x+i; if (xx<0||xx>=w) continue;
            if (src[yoff+xx]) { on = 1; break; }
          }
        }
        dst[y*w + x] = on;
      }
    }
    return dst;
  }
  function subtract(a, b) {
    const out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] && !b[i] ? 1 : 0;
    return out;
  }

  // Marching-squares style border trace (clockwise) → list of polylines
  function traceContours(mask, w, h, step=1) {
    const res = [];
    const seen = new Uint8Array(mask.length);
    const inside = (x,y) => x>=0&&y>=0&&x<w&&y<h && mask[y*w+x];
    for (let y=0; y<h; y+=step) {
      for (let x=0; x<w; x+=step) {
        const idx = y*w+x;
        if (!inside(x,y) || seen[idx]) continue;

        // walk boundary
        let cx=x, cy=y, dir=0, guard=0;
        const poly = [];
        do {
          if (++guard > w*h*2) break;
          seen[cy*w+cx]=1;
          poly.push({x:cx, y:cy});

          const leftDir = (dir+3)&3;
          const fw = dir===0?[step,0]:dir===1?[0,step]:dir===2?[-step,0]:[0,-step];
          const lf = leftDir===0?[step,0]:leftDir===1?[0,step]:leftDir===2?[-step,0]:[0,-step];

          const lx = clamp(cx+lf[0],0,w-1);
          const ly = clamp(cy+lf[1],0,h-1);
          const fx = clamp(cx+fw[0],0,w-1);
          const fy = clamp(cy+fw[1],0,h-1);

          if (inside(lx,ly)) dir = leftDir;
          else if (!inside(fx,fy)) dir = (dir+1)&3;
          else { cx = fx; cy = fy; }
        } while (!(Math.abs(cx-x)<=step && Math.abs(cy-y)<=step && dir===0));

        if (poly.length>8) res.push(simplify(poly, 0.75));
      }
    }
    return res;
  }

  // RDP-ish simplifier for nicer edges
  function simplify(pts, tol=0.75) {
    if (pts.length<3) return pts;
    const out=[pts[0]];
    for (let i=1;i<pts.length-1;i++) {
      const a=out[out.length-1], b=pts[i], c=pts[i+1];
      const area = Math.abs((a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y))/2);
      if (area > tol) out.push(b);
    }
    out.push(pts[pts.length-1]);
    return out;
  }

  // ============ tiny drawing utils ===========================================

  function roundRect(ctx, x,y,w,h,r=8) {
    const rr = Math.max(0, Math.min(r, Math.min(w,h)/2));
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.lineTo(x+w-rr,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+rr);
    ctx.lineTo(x+w,y+h-rr);
    ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
    ctx.lineTo(x+rr,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-rr);
    ctx.lineTo(x,y+rr);
    ctx.quadraticCurveTo(x,y,x+rr,y);
    ctx.closePath();
  }
  function ellipse(ctx,cx,cy,rx,ry){ctx.save();ctx.translate(cx,cy);ctx.scale(rx,ry);ctx.arc(0,0,1,0,Math.PI*2);ctx.restore();}
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function hexToRgb(hex){const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||"");return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}:{r:255,g:255,b:255};}
}