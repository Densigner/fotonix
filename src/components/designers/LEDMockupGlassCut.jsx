import React, { useEffect, useRef, useState } from "react";

/**
 * LEDMockupGlassCut
 *
 * Cut-to-shape edge-lit acrylic mockup — the design is cut tight to its own
 * outline (uniform dilation, not a rectangle plate) and rendered on a tilted,
 * reflective table with a real glass/acrylic look (transmitted "body" layer
 * separate from an emissive "glow" layer, a visible sheet-thickness edge, a
 * table reflection, contact shadow, and a surface sheen).
 *
 * Ported from a standalone canvas prototype (table-topper-mockup.html) that
 * was built specifically to fix two problems with the previous version of
 * this component: a hand-rolled marching-squares contour tracer that (a)
 * produced a visibly jagged pixel edge and (b) could hang the tab for
 * 20-30s on more complex artwork. This version's "cut" is built entirely
 * from `drawImage` blits stamped around a circle (a true Minkowski-sum
 * dilation) — no pixel reads, no contour tracing, no risk of a runaway loop.
 *
 * Same prop shape as LEDMockupGlass so the two are drop-in replacements for
 * each other at existing call sites.
 */
export default function LEDMockupGlassCut({
  src,
  colors = ["#22D3EE", "#34D399", "#A78BFA", "#F472B6", "#F59E0B", "#EF4444", "#FFFFFF"],
  initialIndex = 0,
  title = "LED Preview",
  tiltDeg = 4,
  material = "acrylic",
}) {
  const [idx, setIdx] = useState(initialIndex);
  const canvasRef = useRef(null);
  const bgSnapRef = useRef(null);
  const shapeRef = useRef(null);
  const imgRef = useRef(null);

  const color = colors[idx % colors.length];

  // ---- one-time constants (scene geometry) ---------------------------------
  const W = 840, H = 1050;
  const FOCAL = 2000;
  const PIVOT_X = W / 2;
  const EYE_Y = H * 0.30;
  const MARGIN = 26;
  // A mirror's cut margin reads as roughly 2cm at the acrylic's MARGIN — the
  // brief is 0.5cm max, so this stays proportionally tight to that (~1/4).
  const MIRROR_MARGIN = 7;
  const EDGE_W = 9;
  const PADD = MARGIN + 8;
  const BLOOM = 96;
  const THICK = 26;
  const TABLE_Y = 700;
  const PANEL_BOTTOM = 900;

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W; canvas.height = H;
    if (!bgSnapRef.current) bgSnapRef.current = cv(W, H);

    if (!src) {
      shapeRef.current = null;
      imgRef.current = null;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      shapeRef.current = buildShape(img, material);
      renderScene(canvas, bgSnapRef.current, shapeRef.current, hexToRgb(color), tiltDeg, material);
    };
    img.onerror = () => { shapeRef.current = null; imgRef.current = null; };
    img.src = src;

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // The cut margin itself differs by material (mirror's is much tighter),
  // so a material change has to rebuild the shape, not just re-render it —
  // re-uses the already-loaded image rather than re-fetching `src`.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    shapeRef.current = buildShape(imgRef.current, material);
    renderScene(canvas, bgSnapRef.current, shapeRef.current, hexToRgb(color), tiltDeg, material);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shapeRef.current) return;
    renderScene(canvas, bgSnapRef.current, shapeRef.current, hexToRgb(color), tiltDeg, material);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, tiltDeg]);

  // ==== geometry / drawing pipeline ==========================================
  // (module-scope-independent — reads only the constants above and its args,
  // so it can't accidentally depend on stale React state)

  function cv(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || "").trim());
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
             : { r: 255, g: 255, b: 255 };
  }
  function rgba(c, a) { return `rgba(${c.r},${c.g},${c.b},${a})`; }
  function mixWhite(c, t) {
    return { r: Math.round(c.r + (255 - c.r) * t),
             g: Math.round(c.g + (255 - c.g) * t),
             b: Math.round(c.b + (255 - c.b) * t) };
  }

  function tint(source, colorStr, alpha) {
    const o = cv(source.width, source.height), c = o.getContext("2d");
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = colorStr;
    c.fillRect(0, 0, o.width, o.height);
    return o;
  }
  function blurCopy(source, amt) {
    const o = cv(source.width, source.height), c = o.getContext("2d");
    c.filter = "blur(" + amt + "px)";
    c.drawImage(source, 0, 0);
    return o;
  }

  // Real design uploads/drawings arrive as a full-canvas PNG with a lot of
  // transparent margin — crop to the actual drawn content's tight alpha
  // bounding box first (one getImageData pass, on image load only, not
  // per-frame) so the dilation below scales sensibly regardless of how much
  // empty space the source canvas had.
  function cropToTightAlpha(img, pad) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const probe = cv(iw, ih);
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    pctx.drawImage(img, 0, 0, iw, ih);
    const data = pctx.getImageData(0, 0, iw, ih).data;
    let minX = iw, minY = ih, maxX = -1, maxY = -1;
    for (let y = 0; y < ih; y++) {
      const row = y * iw;
      for (let x = 0; x < iw; x++) {
        if (data[(row + x) * 4 + 3] > 10) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return probe; // fully transparent — nothing drawn yet
    const p = pad == null ? 6 : pad;
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const out = cv(cw + p * 2, ch + p * 2);
    out.getContext("2d").drawImage(probe, minX, minY, cw, ch, p, p, cw, ch);
    return out;
  }

  // UNIFORM DILATION — the cut line. Stamps the artwork around a circle of
  // radius r (a Minkowski sum with a disc): an exactly uniform outward
  // offset on every part of the outline regardless of shape complexity.
  // Pure drawImage blits, no pixel reads, no contour tracing.
  function dilate(source, r, pad) {
    const o = cv(source.width + pad * 2, source.height + pad * 2);
    const c = o.getContext("2d");
    if (r > 0.5) {
      const n1 = Math.max(40, Math.ceil(r * 5));
      for (let i = 0; i < n1; i++) {
        const a = (i / n1) * Math.PI * 2;
        c.drawImage(source, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
      }
      const n2 = Math.max(20, Math.ceil(r * 2.5));
      for (let i = 0; i < n2; i++) {
        const a = (i / n2) * Math.PI * 2 + 0.37;
        c.drawImage(source, pad + Math.cos(a) * r * 0.5, pad + Math.sin(a) * r * 0.5);
      }
    }
    c.drawImage(source, pad, pad);
    return o;
  }

  function buildShape(img, materialNow) {
    const art = cropToTightAlpha(img, 6);
    const sc = Math.min(600 / art.width, 470 / art.height, 1.7);
    const artS = cv(art.width * sc, art.height * sc);
    artS.getContext("2d").drawImage(art, 0, 0, artS.width, artS.height);

    const margin = materialNow === "mirror" ? MIRROR_MARGIN : MARGIN;
    const outer = blurCopy(dilate(artS, margin, PADD), 1.1);
    const inner = blurCopy(dilate(artS, margin - EDGE_W, PADD), 1.1);

    const ring = cv(outer.width, outer.height);
    const rc = ring.getContext("2d");
    rc.drawImage(outer, 0, 0);
    rc.globalCompositeOperation = "destination-out";
    rc.drawImage(inner, 0, 0);

    return { artS, outer, ring, mw: outer.width, mh: outer.height };
  }

  // A mirror is opaque, so the same LED strip that runs light through clear
  // acrylic instead has to shine from behind it — there's no engraving-glow,
  // no lit cut edge, just a reflective face and a soft halo spilling out
  // around the perimeter from behind the shape ("back-lit" vs the acrylic
  // panel's "edge-lit"). Kept as its own function rather than more branches
  // threaded through the acrylic path below, since almost nothing is shared.
  function buildMirrorPanel(shape, rgb, cw, ch, ox, oy) {
    const body = cv(cw, ch), b = body.getContext("2d");
    const base = b.createLinearGradient(0, oy, 0, oy + shape.mh);
    base.addColorStop(0, "#e9eef1");
    base.addColorStop(0.45, "#bcc5ca");
    base.addColorStop(0.55, "#9aa4a9");
    base.addColorStop(1, "#7c868b");
    b.fillStyle = base;
    b.fillRect(0, 0, cw, ch);

    // Diagonal catch-light, like a real mirror surface reflecting a bright
    // source at an angle — this is what reads as "reflective" rather than
    // "flat grey", since there's no scene to actually reflect.
    const sheen = b.createLinearGradient(ox, oy + shape.mh, ox + shape.mw, oy);
    sheen.addColorStop(0.00, "rgba(255,255,255,0)");
    sheen.addColorStop(0.36, "rgba(255,255,255,0)");
    sheen.addColorStop(0.48, "rgba(255,255,255,0.30)");
    sheen.addColorStop(0.55, "rgba(255,255,255,0.55)");
    sheen.addColorStop(0.62, "rgba(255,255,255,0.30)");
    sheen.addColorStop(0.74, "rgba(255,255,255,0)");
    sheen.addColorStop(1.00, "rgba(255,255,255,0)");
    b.fillStyle = sheen;
    b.fillRect(0, 0, cw, ch);

    b.globalCompositeOperation = "destination-in";
    b.drawImage(shape.outer, ox, oy);
    b.globalCompositeOperation = "source-over";

    // The design itself still needs to read on the face — on acrylic it's
    // the lit white engraving; a mirror doesn't glow, so the same detail
    // shows as a dark etched mark against the reflective silver instead.
    // "source-atop" keeps it from ever drawing past the silhouette above.
    const ax = BLOOM + PADD, ay = BLOOM + PADD;
    const etched = tint(shape.artS, "#454b4f", 1);
    b.globalCompositeOperation = "source-atop";
    b.filter = "blur(1.5px)"; b.globalAlpha = 0.35; b.drawImage(etched, ax, ay);
    b.filter = "none";        b.globalAlpha = 0.85; b.drawImage(etched, ax, ay);
    b.globalAlpha = 1;
    b.globalCompositeOperation = "source-over";

    const glow = cv(cw, ch), g = glow.getContext("2d");
    g.globalCompositeOperation = "lighter";
    const ringGlow = tint(shape.ring, rgba(rgb, 1), 1);
    g.filter = "blur(70px)"; g.globalAlpha = 0.55; g.drawImage(ringGlow, ox, oy);
    g.filter = "blur(30px)"; g.globalAlpha = 0.50; g.drawImage(ringGlow, ox, oy);
    g.filter = "blur(10px)"; g.globalAlpha = 0.35; g.drawImage(ringGlow, ox, oy);
    g.filter = "none"; g.globalAlpha = 1;

    // The blur radii above are tuned for the halo spilling into the air
    // around the mirror — on a small shape that same blur reaches back in
    // and re-floods the whole face, burying the reflective body layer under
    // solid glow. Cut the interior back out so the light only shows where a
    // backlit mirror would actually show it: past the edge, not on the glass.
    g.globalCompositeOperation = "destination-out";
    g.drawImage(shape.outer, ox, oy);
    g.globalCompositeOperation = "source-over";

    g.globalCompositeOperation = "destination-in";
    const fall = g.createLinearGradient(0, oy + shape.mh, 0, oy - 20);
    fall.addColorStop(0, "rgba(0,0,0,1)");
    fall.addColorStop(0.6, "rgba(0,0,0,0.92)");
    fall.addColorStop(1, "rgba(0,0,0,0.82)");
    g.fillStyle = fall; g.fillRect(0, 0, cw, ch);

    return { body, glow, cw, ch };
  }

  function buildPanel(shape, rgb, bgSnap, sx, sy, material) {
    const cw = shape.mw + BLOOM * 2, ch = shape.mh + BLOOM * 2;
    const ox = BLOOM, oy = BLOOM;
    const ax = BLOOM + PADD, ay = BLOOM + PADD;

    if (material === "mirror") {
      return buildMirrorPanel(shape, rgb, cw, ch, ox, oy);
    }

    const hot = mixWhite(rgb, 0.45);
    const sinTilt = Math.sin(tiltDeg * Math.PI / 180);

    // ---- body: clear glass (transmitted light replaces the background) ----
    const body = cv(cw, ch), b = body.getContext("2d");
    const zoom = 1.05, dx = 7, dy = 5;
    const swid = cw / zoom, shgt = ch / zoom;
    b.filter = "blur(2.5px)";
    b.drawImage(bgSnap,
      sx + (cw - swid) / 2 + dx, sy + (ch - shgt) / 2 + dy, swid, shgt,
      0, 0, cw, ch);
    b.filter = "none";
    b.globalCompositeOperation = "destination-in";
    b.drawImage(shape.outer, ox, oy);
    b.globalCompositeOperation = "source-atop";
    b.globalAlpha = 0.10; b.fillStyle = "#b9dcee"; b.fillRect(0, 0, cw, ch);
    b.globalAlpha = 0.08; b.fillStyle = "#000000"; b.fillRect(0, 0, cw, ch);
    b.globalAlpha = 1;

    // ---- glow: edges and engraving only (emitted light adds) ----
    const glow = cv(cw, ch), g = glow.getContext("2d");

    const off = THICK * sinTilt;
    if (off > 0.6) {
      const edgeT = tint(shape.outer, rgba(hot, 0.55), 1);
      const steps = 10;
      for (let i = 1; i <= steps; i++) g.drawImage(edgeT, ox - (off * i) / steps, oy);
      g.globalCompositeOperation = "destination-out";
      g.drawImage(shape.outer, ox, oy);
      g.globalCompositeOperation = "source-over";
    }

    g.globalCompositeOperation = "lighter";

    const ringGlow = tint(shape.ring, rgba(rgb, 1), 1);
    g.filter = "blur(58px)"; g.globalAlpha = 0.30; g.drawImage(ringGlow, ox, oy);
    g.filter = "blur(22px)"; g.globalAlpha = 0.34; g.drawImage(ringGlow, ox, oy);

    const ringT = tint(shape.ring, rgba(hot, 1), 1);
    g.filter = "blur(6px)";   g.globalAlpha = 0.50; g.drawImage(ringT, ox, oy);
    g.filter = "blur(1.2px)"; g.globalAlpha = 0.98; g.drawImage(ringT, ox, oy);

    const coreT = tint(shape.artS, "#ffffff", 1);
    g.filter = "blur(9px)";   g.globalAlpha = 0.16; g.drawImage(tint(shape.artS, rgba(rgb, 1), 1), ax, ay);
    g.filter = "blur(2.4px)"; g.globalAlpha = 0.40; g.drawImage(coreT, ax, ay);
    g.filter = "none";        g.globalAlpha = 0.92; g.drawImage(coreT, ax, ay);
    g.globalAlpha = 1;

    const feed = cv(cw, ch), fc = feed.getContext("2d");
    const fg = fc.createLinearGradient(0, oy + shape.mh, 0, oy + shape.mh - 64);
    fg.addColorStop(0, rgba(hot, 0.55));
    fg.addColorStop(1, rgba(hot, 0));
    fc.fillStyle = fg; fc.fillRect(0, 0, cw, ch);
    fc.globalCompositeOperation = "destination-in";
    fc.drawImage(shape.outer, ox, oy);
    g.globalAlpha = 0.55; g.drawImage(blurCopy(feed, 5), 0, 0); g.globalAlpha = 1;

    const sheen = cv(cw, ch), s = sheen.getContext("2d");
    const gr = s.createLinearGradient(ox, oy + shape.mh, ox + shape.mw, oy);
    gr.addColorStop(0.00, "rgba(255,255,255,0)");
    gr.addColorStop(0.30, "rgba(255,255,255,0)");
    gr.addColorStop(0.41, "rgba(255,255,255,0.10)");
    gr.addColorStop(0.49, "rgba(255,255,255,0.19)");
    gr.addColorStop(0.57, "rgba(255,255,255,0.09)");
    gr.addColorStop(0.66, "rgba(255,255,255,0)");
    gr.addColorStop(0.72, "rgba(255,255,255,0.17)");
    gr.addColorStop(0.76, "rgba(255,255,255,0)");
    gr.addColorStop(1.00, "rgba(255,255,255,0)");
    s.fillStyle = gr; s.fillRect(0, 0, cw, ch);
    s.globalCompositeOperation = "destination-in";
    s.drawImage(shape.outer, ox, oy);
    g.drawImage(sheen, 0, 0);

    g.globalCompositeOperation = "destination-in";
    const fall = g.createLinearGradient(0, oy + shape.mh, 0, oy - 20);
    fall.addColorStop(0, "rgba(0,0,0,1)");
    fall.addColorStop(0.5, "rgba(0,0,0,0.80)");
    fall.addColorStop(1, "rgba(0,0,0,0.54)");
    g.fillStyle = fall; g.fillRect(0, 0, cw, ch);

    return { body, glow, cw, ch };
  }

  function drawRoom(ctx, rgb, panelTop, panelW) {
    const wall = ctx.createLinearGradient(0, 0, 0, TABLE_Y);
    wall.addColorStop(0, "#05050a");
    wall.addColorStop(0.72, "#0b0c13");
    wall.addColorStop(1, "#12131c");
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, TABLE_Y);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cy = (panelTop + PANEL_BOTTOM) / 2;
    const halo = ctx.createRadialGradient(W / 2, cy, 20, W / 2, cy, Math.max(panelW, 460) * 1.15);
    halo.addColorStop(0, rgba(rgb, 0.15));
    halo.addColorStop(0.5, rgba(rgb, 0.05));
    halo.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, TABLE_Y + 160);
    ctx.restore();

    const tbl = ctx.createLinearGradient(0, TABLE_Y, 0, H);
    tbl.addColorStop(0, "#171821");
    tbl.addColorStop(0.35, "#0e0f16");
    tbl.addColorStop(1, "#050509");
    ctx.fillStyle = tbl; ctx.fillRect(0, TABLE_Y, W, H - TABLE_Y);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const graze = ctx.createLinearGradient(W * 0.1, TABLE_Y, W * 0.95, H);
    graze.addColorStop(0, "rgba(255,255,255,0.035)");
    graze.addColorStop(0.5, "rgba(255,255,255,0.008)");
    graze.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = graze; ctx.fillRect(0, TABLE_Y, W, H - TABLE_Y);
    ctx.restore();
  }

  function drawContactShadow(ctx, panelW) {
    ctx.save();
    ctx.filter = "blur(20px)";
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(W / 2, PANEL_BOTTOM + 2, panelW * 0.52, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "blur(6px)";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(W / 2, PANEL_BOTTOM + 1, panelW * 0.46, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();
  }

  function roundRectPath(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawStand(ctx, rgb, panelW) {
    const bw = Math.max(170, Math.min(300, panelW * 0.62));
    const bh = 48;
    const bx = W / 2 - bw / 2;
    const by = PANEL_BOTTOM - 8;
    ctx.save();
    roundRectPath(ctx, bx, by, bw, bh, 22);
    ctx.fillStyle = "#0B0F14";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W / 2, by, bw * 0.46, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#12161d";
    ctx.fill();
    const rg = ctx.createRadialGradient(W / 2, by - 4, 8, W / 2, by, bw * 0.5);
    rg.addColorStop(0, rgba(mixWhite(rgb, 0.7), 0.14));
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 0.8; ctx.fillStyle = rg;
    ctx.beginPath(); ctx.ellipse(W / 2, by, bw * 0.46, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const sw = Math.min(bw * 0.5, 150);
    roundRectPath(ctx, W / 2 - sw / 2, by - 5, sw, 9, 3);
    ctx.fillStyle = "#05070A";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + bw - 22, by + bh * 0.6, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = rgba(rgb, 0.95);
    ctx.fill();
    ctx.restore();
  }

  function drawTableLight(ctx, rgb, panelW) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(46px)";
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = rgba(rgb, 1);
    ctx.beginPath();
    ctx.ellipse(W / 2, PANEL_BOTTOM + 16, W * 0.42, 96, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "blur(16px)";
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = rgba(mixWhite(rgb, 0.4), 1);
    ctx.beginPath();
    ctx.ellipse(W / 2, PANEL_BOTTOM + 10, panelW * 0.44, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();
  }

  function renderScene(canvas, bgSnap, shape, rgb, tiltDegNow, materialNow) {
    if (!shape) return;
    const ctx = canvas.getContext("2d");
    const tilt = tiltDegNow * Math.PI / 180, cosT = Math.cos(tilt), sinT = Math.sin(tilt);

    function proj(u, d, y) {
      const x = u * cosT - d * sinT;
      const z = u * sinT + d * cosT;
      const s = FOCAL / (FOCAL + z);
      return [PIVOT_X + x * s, EYE_Y + (y - EYE_Y) * s, s];
    }
    function warpBlit(dctx, source, topY, depth, op, alpha) {
      // Slices the layer into thin vertical strips and re-projects each one
      // through `proj` to fake real keystone perspective. A small, constant
      // per-strip padding used to be enough to hide the seams between
      // strips, but that overlap isn't constant in screen space (perspective
      // compresses it unevenly across the width), which left a fine but
      // very visible vertical banding — most obvious as bright streaks
      // straight through high-contrast art. A larger, fixed overlap plus a
      // small final blur removes it without visibly softening the design.
      const w = source.width, h = source.height, cx = w / 2, step = 1;
      const off = cv(dctx.canvas.width, dctx.canvas.height);
      const octx = off.getContext("2d");
      for (let i = 0; i < w; i += step) {
        const a = proj(i - cx, depth, topY);
        const bpt = proj(i + step - cx, depth, topY);
        const dw = Math.max(1, bpt[0] - a[0]) + 4;
        octx.drawImage(source, i, 0, step, h, a[0] - 2, a[1], dw, h * a[2]);
      }
      dctx.save();
      dctx.globalCompositeOperation = op || "source-over";
      if (alpha != null) dctx.globalAlpha = alpha;
      dctx.filter = "blur(0.6px)";
      dctx.drawImage(off, 0, 0);
      dctx.filter = "none";
      dctx.restore();
    }

    const cw = shape.mw + BLOOM * 2, ch = shape.mh + BLOOM * 2;
    const layerTop = PANEL_BOTTOM - shape.mh - BLOOM;
    const layerLeft = W / 2 - cw / 2;
    const panelTop = PANEL_BOTTOM - shape.mh;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawRoom(ctx, rgb, panelTop, shape.mw);
    drawContactShadow(ctx, shape.mw);
    drawTableLight(ctx, rgb, shape.mw);
    drawStand(ctx, rgb, shape.mw);

    const bgCtx = bgSnap.getContext("2d");
    bgCtx.clearRect(0, 0, W, H);
    bgCtx.drawImage(canvas, 0, 0);

    const p = buildPanel(shape, rgb, bgSnap, layerLeft, layerTop, materialNow);
    const k = 0.42;
    const refl = cv(cw, ch), rc = refl.getContext("2d");
    rc.translate(0, ch); rc.scale(1, -1);
    rc.drawImage(p.glow, 0, 0);
    rc.setTransform(1, 0, 0, 1, 0, 0);
    rc.globalCompositeOperation = "destination-in";
    const rg = rc.createLinearGradient(0, BLOOM, 0, ch);
    rg.addColorStop(0, "rgba(0,0,0,0.30)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    rc.fillStyle = rg; rc.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(4px)";
    ctx.drawImage(refl, layerLeft, PANEL_BOTTOM - BLOOM * k, cw, ch * k);
    ctx.filter = "none";
    ctx.restore();

    warpBlit(ctx, p.body, layerTop, 0, "source-over");
    warpBlit(ctx, p.glow, layerTop, 0, "lighter");

    const vig = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.22, W / 2, H * 0.52, H * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  }

  // ==== markup (matches LEDMockupGlass's wrapper so it's a drop-in swap) ====
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <div className="flex gap-1">
          {colors.map((c, i) => (
            <button
              key={c + i}
              onClick={() => setIdx(i)}
              aria-label={`Set colour ${c}`}
              className="h-5 w-5 rounded-full ring-1 ring-black/20"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      <div
        className="relative w-full rounded-xl overflow-hidden"
        style={{ aspectRatio: "4/5", isolation: "isolate", background: "#05050a" }}
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
        <div className="text-xs text-slate-400">Cut tight to your design's own shape.</div>
      </div>
    </div>
  );
}
