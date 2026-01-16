import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * LEDMockupGlass
 * - src: PNG dataURL from Fabric (transparent bg recommended)
 * - colors: LED color presets
 * - ringExpandPx: how far the acrylic “halo” expands from artwork
 * - ringThicknessPx: halo thickness (tight ring look)
 * - platePaddingPx: clear plate padding beyond artwork bbox
 * - maxArtWidth: scales the artwork in the mockup
 */
export default function LEDMockupGlass({
  src,
  colors = ["#22D3EE", "#34D399", "#A78BFA", "#F59E0B", "#EF4444", "#FFFFFF"],
  initialIndex = 0,
  title = "LED Preview",
  ringExpandPx = 2,
  ringThicknessPx = 2,
  platePaddingPx = 2,
  maxArtWidth = 260,
}) {
  const [idx, setIdx] = useState(initialIndex);
  const color = colors[idx % colors.length];
  const canvasRef = useRef(null);
  const offA = useRef(typeof document !== 'undefined' ? document.createElement("canvas") : null); // mask / ring workspace

  // Precompute numeric RGB once
  const rgb = useMemo(() => hexToRgb(color), [color]);

  useEffect(() => {
    let cancelled = false;
    const cnv = canvasRef.current;
    if (!cnv) return;

    const W = 360;  // overall mockup canvas size (tweak)
    const H = 440;
    cnv.width = W;
    cnv.height = H;
    const ctx = cnv.getContext("2d");

    if (!src) {
      ctx.clearRect(0, 0, W, H);
      drawScene(ctx, W, H, null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      drawScene(ctx, W, H, img);
    };
    img.src = src;

    return () => { cancelled = true; };
  }, [src, rgb, ringExpandPx, ringThicknessPx, platePaddingPx, maxArtWidth]);

  // UI
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <div className="flex gap-1">
          {colors.map((c, i) => (
            <button
              key={c + i}
              onClick={() => setIdx(i)}
              aria-label={`Set color ${c}`}
              className="h-5 w-5 rounded-full ring-1 ring-black/20"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      <div
        className="relative w-full rounded-xl overflow-hidden"
        style={{
          aspectRatio: "4/5",
          isolation: "isolate",                // contain blend/composition
          background:
            "radial-gradient(ellipse at bottom, rgba(0,0,0,.35) 0%, rgba(0,0,0,.85) 70%)",
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm"
          onClick={() => setIdx((i) => (i + 1) % colors.length)}
        >
          Next color
        </button>
        <div className="text-xs text-slate-400">
          Tip: export with transparent background for best glow.
        </div>
      </div>
    </div>
  );

  // ==== helpers ===============================================================

  function drawScene(ctx, W, H, img) {
    ctx.clearRect(0, 0, W, H);

    // Ground/table
    const tableH = Math.round(H * 0.28);
    const tableY = H - tableH;
    const grad = ctx.createLinearGradient(0, tableY, 0, H);
    grad.addColorStop(0, "rgba(20,20,20,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, tableY, W, tableH);

    // Ambient wall glow (large soft ellipse)
    if (img) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.filter = "blur(40px)";
      ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
      const gw = Math.round(W * 0.78);
      const gh = Math.round(H * 0.36);
      ctx.beginPath();
      ctx.ellipse(W / 2, tableY - gh * 0.1, gw / 2, gh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Base (simple)
    drawBase(ctx, W, H, tableY, rgb);

    // If we have an image, compute mask + ring + plate + lit art
    if (!img) return;

    // Scale artwork to mockup space
    const scale = Math.min(1, maxArtWidth / img.width);
    const artW = Math.max(1, Math.round(img.width * scale));
    const artH = Math.max(1, Math.round(img.height * scale));

    // Position: centered horizontally, sits in slot just above base
    const plateBottom = tableY + 2; // just into the slot
    const artX = Math.round(W / 2 - artW / 2);
    const artY = Math.round(plateBottom - artH - 24);

    // Build binary alpha mask at artwork scale
    const { mask, w, h, bbox } = getAlphaMask(img, artW, artH);

    // Build tight ring (outer - inner) in pixel space
    const outer = dilate(mask, w, h, Math.max(1, Math.round(ringExpandPx)));
    const inner = dilate(mask, w, h, Math.max(0, Math.round(Math.max(0, ringExpandPx - ringThicknessPx))));
    const ring = logicSubtract(outer, inner); // Uint8Array

    // Optionally tighten bbox to mask content (for glass plate sizing)
    const rb = maskBounds(ring, w, h) || bbox; // fallback to original bbox

    // Draw translucent glass plate around the art bbox (+ padding)
    const pad = Math.max(8, Math.round(platePaddingPx));
    const plate = inflateRect(
      { x: artX + rb.x, y: artY + rb.y, w: rb.w, h: rb.h },
      pad
    );
    drawGlassPlate(ctx, plate, rgb);

    // Draw LED ring (soft glow + crisp inner edge)
    drawRing(ctx, ring, w, h, artX, artY, rgb);

    // Draw illuminated artwork (white core + colored bloom)
    drawLitArtwork(ctx, img, artX, artY, artW, artH, rgb);
  }

  function drawBase(ctx, W, H, tableY, rgb) {
    ctx.save();
    // base body
    const bw = Math.round(W * 0.78);
    const bh = Math.round(H * 0.12);
    const bx = Math.round((W - bw) / 2);
    const by = H - bh;

    roundRect(ctx, bx, by - 2, bw, bh, 26);
    ctx.fillStyle = "#0B0F14";
    ctx.fill();

    // top ellipse
    ctx.beginPath();
    ellipse(ctx, W / 2, by - 6, bw * 0.43, bh * 0.22);
    ctx.fillStyle = "#0B0F14";
    ctx.fill();

    // rim highlight
    const rg = ctx.createRadialGradient(W / 2, by - 10, 12, W / 2, by - 10, bw * 0.5);
    rg.addColorStop(0, "rgba(255,255,255,0.06)");
    rg.addColorStop(1, "rgba(255,255,255,0.0)");
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = rg;
    ctx.beginPath();
    ellipse(ctx, W / 2, by - 6, bw * 0.43, bh * 0.22);
    ctx.fill();
    ctx.globalAlpha = 1;

    // slot
    const sw = Math.round(bw * 0.42);
    roundRect(ctx, Math.round(W / 2 - sw / 2), by - 12, sw, 6, 3);
    ctx.fillStyle = "#05070A";
    ctx.fill();

    // LED dot
    ctx.beginPath();
    ctx.arc(bx + bw - 35, by + Math.round(bh * 0.55), 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGlassPlate(ctx, rect, rgb) {
    ctx.save();
    // subtle glass fill
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fill();

    // edge highlight (top)
    ctx.globalAlpha = 0.7;
    const gTop = ctx.createLinearGradient(0, rect.y, 0, rect.y + 14);
    gTop.addColorStop(0, "rgba(255,255,255,0.55)");
    gTop.addColorStop(1, "rgba(255,255,255,0.0)");
    ctx.fillStyle = gTop;
    roundRect(ctx, rect.x, rect.y, rect.w, Math.min(rect.h, 14), 10);
    ctx.fill();

    // side rim (slight refraction tint)
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.lineWidth = 2;
    roundRect(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 10);
    ctx.stroke();

    // inner faint border
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    roundRect(ctx, rect.x + 2.5, rect.y + 2.5, rect.w - 5, rect.h - 5, 8);
    ctx.stroke();

    ctx.restore();
  }

  function drawRing(ctx, ringMask, w, h, x, y, rgb) {
    // Build an ImageData for the ring once (tinted)
    const ringImg = new ImageData(w, h);
    for (let i = 0, j = 0; i < ringMask.length; i++, j += 4) {
      const on = ringMask[i] ? 1 : 0;
      ringImg.data[j + 0] = rgb.r;
      ringImg.data[j + 1] = rgb.g;
      ringImg.data[j + 2] = rgb.b;
      ringImg.data[j + 3] = on ? 255 : 0;
    }

    ctx.save();
    // Soft bloom
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(6px)";
    ctx.putImageData(ringImg, x, y);
    // Crisp core
    ctx.filter = "none";
    ctx.globalAlpha = 0.9;
    ctx.putImageData(ringImg, x, y);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function drawLitArtwork(ctx, img, x, y, w, h, rgb) {
    ctx.save();
  // Glow pass (offscreen tinted blur) - avoids rectangular shadow artifacts
  const glow = offA.current;
  glow.width = w; glow.height = h;
  const gctx = glow.getContext("2d");
  // 1) draw the art into the offscreen
  gctx.clearRect(0, 0, w, h);
  gctx.drawImage(img, 0, 0, w, h);
  // 2) turn it into a solid color using the alpha of the art
  gctx.globalCompositeOperation = "source-in";
  gctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
  gctx.fillRect(0, 0, w, h);
  // 3) paint that back with a blur + additive blend
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "blur(18px)";
  ctx.globalAlpha = 0.6;
  ctx.drawImage(glow, x, y);
  ctx.restore();

  // Core (white) + color tint atop
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
    // draw the artwork to a temp offscreen, then tint using source-atop
    const tmp = offA.current;
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext("2d");
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(img, 0, 0, w, h);
    // make it white
    tctx.globalCompositeOperation = "source-in";
    tctx.fillStyle = "#FFFFFF";
    tctx.fillRect(0, 0, w, h);
    // tint with LED color (slight)
    tctx.globalCompositeOperation = "source-atop";
    tctx.globalAlpha = 0.15;
    tctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    tctx.fillRect(0, 0, w, h);

    ctx.drawImage(tmp, x, y);
    ctx.restore();
  }

  // --- image mask / ring utils ------------------------------------------------

  function getAlphaMask(img, w, h) {
    const cv = offA.current;
    cv.width = w; cv.height = h;
    const c = cv.getContext("2d", { willReadFrequently: true });
    c.clearRect(0, 0, w, h);
    c.drawImage(img, 0, 0, w, h);
    const d = c.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    let x1 = w, y1 = h, x2 = -1, y2 = -1;

    for (let y = 0, p = 0; y < h; y++) {
      for (let x = 0; x < w; x++, p++) {
        const a = d[p * 4 + 3];
        const on = a > 8 ? 1 : 0;
        mask[p] = on;
        if (on) {
          if (x < x1) x1 = x;
          if (y < y1) y1 = y;
          if (x > x2) x2 = x;
          if (y > y2) y2 = y;
        }
      }
    }
    const bbox = (x2 >= x1 && y2 >= y1) ? { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 } : { x: 0, y: 0, w: w, h: h };
    return { mask, w, h, bbox };
  }

  function dilate(src, w, h, R) {
    if (R <= 0) return src.slice();
    const dst = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
      const yoff = y * w;
      for (let x = 0; x < w; x++) {
        let on = 0;
        for (let j = -R; j <= R && !on; j++) {
          const yy = y + j; if (yy < 0 || yy >= h) continue;
          const y2 = yy * w;
          for (let i = -R; i <= R; i++) {
            const xx = x + i; if (xx < 0 || xx >= w) continue;
            if (src[y2 + xx]) { on = 1; break; }
          }
        }
        dst[yoff + x] = on;
      }
    }
    return dst;
  }
  function logicSubtract(a, b) {
    const out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] && !b[i] ? 1 : 0;
    return out;
  }
  function maskBounds(m, w, h) {
    let x1 = w, y1 = h, x2 = -1, y2 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (m[y * w + x]) {
          if (x < x1) x1 = x;
          if (y < y1) y1 = y;
          if (x > x2) x2 = x;
          if (y > y2) y2 = y;
        }
      }
    }
    if (x2 < x1 || y2 < y1) return null;
    return { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
  }

  // --- small drawing utils ----------------------------------------------------

  function roundRect(ctx, x, y, w, h, r = 8) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }
  function ellipse(ctx, cx, cy, rx, ry) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
  }
  function inflateRect(r, pad) {
    return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
  }
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return { r: 255, g: 255, b: 255 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
}
