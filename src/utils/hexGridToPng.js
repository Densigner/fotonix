/**
 * Make a PNG from an array of hex colors.
 * @param {string[]} hexes - e.g. ["#7c3aed","#ec4899", ...]
 * @param {Object} [opts]
 * @param {number} [opts.cols=5]       - number of columns in the grid
 * @param {number} [opts.cell=64]      - size (px) of each square cell
 * @param {number} [opts.gap=2]        - gap (px) between cells
 * @param {number} [opts.padding=16]   - outer padding (px)
 * @param {string} [opts.bg="#0b0b0b"] - background colour
 * @param {string} [opts.fallback="#000"] - fallback colour if a hex is invalid
 * @returns {Promise<{dataUrl:string, blob:Blob, width:number, height:number}>}
 */
export async function hexGridToPng(hexes, opts = {}) {
  const {
    cols = 5,
    cell = 64,
    gap = 2,
    padding = 16,
    bg = "#0b0b0b",
    fallback = "#000"
  } = opts;

  if (!Array.isArray(hexes) || hexes.length === 0) {
    throw new Error("hexGridToPng: provide a non-empty array of hex colours");
  }

  const rows = Math.ceil(hexes.length / cols);
  const width  = padding * 2 + cols * cell + (cols - 1) * gap;
  const height = padding * 2 + rows * cell + (rows - 1) * gap;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // draw tiles
  for (let i = 0; i < hexes.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * (cell + gap);
    const y = padding + row * (cell + gap);

    const hex = normalizeHex(hexes[i]);
    ctx.fillStyle = isValidHex(hex) ? hex : fallback;
    ctx.fillRect(x, y, cell, cell);
  }

  // outputs
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b), "image/png"));
  return { dataUrl, blob, width, height };
}

// --- helpers ---
export function normalizeHex(h) {
  if (typeof h !== "string") return "";
  let s = h.trim();
  if (!s.startsWith("#")) s = "#" + s;
  // expand #RGB to #RRGGBB
  if (/^#([0-9a-fA-F]{3})$/.test(s)) {
    const [, rgb] = s.match(/^#([0-9a-fA-F]{3})$/);
    s = "#" + rgb.split("").map(ch => ch + ch).join("");
  }
  return s.toLowerCase();
}

export function isValidHex(h) {
  return /^#([0-9a-fA-F]{6})$/.test(h);
}

/**
 * Generate a blended "LED strip" image along a snake path.
 * - Pass 25 hex colours in **snake order** (row1 L→R, row2 R→L, ...).
 * - If you pass fewer than rows*cols, colours will cycle.
 *
 * @param {string[]} hexes  e.g. length 25 in snake order
 * @param {Object}   opts
 * @param {number}   [opts.cols=5]
 * @param {number}   [opts.rows=5]
 * @param {number}   [opts.cell=64]         size of each grid cell (used to place the path)
 * @param {number}   [opts.padding=24]      canvas padding
 * @param {number}   [opts.thickness=36]    line thickness of the "strip"
 * @param {string}   [opts.bg="#0b0b0b"]    background colour
 * @param {"dataUrl"|"blob"} [opts.output="dataUrl"]
 * @returns {Promise<string|Blob>} dataURL or Blob of the PNG
 */
export async function snakeStripToPNG(hexes, opts = {}) {
  const {
    cols = 5,
    rows = 5,
    cell = 64,
    padding = 24,
    thickness = 36,
    bg = "#0b0b0b",
    output = "dataUrl",
  } = opts;

  if (!Array.isArray(hexes) || hexes.length === 0) {
    throw new Error("snakeStripToPNG: provide colours in snake order");
  }

  // Canvas size from grid
  const width = padding * 2 + cols * cell;
  const height = padding * 2 + rows * cell;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Path centers in snake order
  const centers = getSnakeCenters(cols, rows, cell, padding);

  // Stroke settings
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Draw each segment with its own gradient from colour[i] → colour[i+1]
  for (let i = 0; i < centers.length - 1; i++) {
    const p0 = centers[i];
    const p1 = centers[i + 1];

    const c0 = normalizeHex(hexes[i % hexes.length]) || "#ffffff";
    const c1 = normalizeHex(hexes[(i + 1) % hexes.length]) || c0;

    const grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);

    ctx.strokeStyle = grad;
    ctx.lineWidth = thickness;

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  // Optional soft glow pass (subtle)
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = thickness * 1.6;
  for (let i = 0; i < centers.length - 1; i++) {
    const p0 = centers[i];
    const p1 = centers[i + 1];
    const c = normalizeHex(hexes[i % hexes.length]) || "#ffffff";
    const grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
    grad.addColorStop(0, c);
    grad.addColorStop(1, c);
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Return
  if (output === "blob") {
    return await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
  }
  return canvas.toDataURL("image/png");
}

// --- helpers for snake path ---
function getSnakeCenters(cols, rows, cell, pad) {
  const centers = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = r % 2 === 0 ? c : cols - 1 - c; // snake
      const x = pad + col * cell + cell / 2;
      const y = pad + r * cell + cell / 2;
      centers.push({ x, y });
    }
  }
  return centers;
}
