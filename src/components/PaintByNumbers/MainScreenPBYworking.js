import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Download,
  Layers,
  Settings,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Trash2,
  Check,
  AlertCircle,
  Loader,
  Eye,
  EyeOff,
  Sliders,
  RefreshCw,
  ShoppingCart,
  Info,
  Palette,
  Hash,
  Maximize2,
  Lock,
  X,
  Sparkles,
  ArrowRight,
  Paintbrush,
  Scissors,
  FileImage,
  Smartphone,
  Truck
} from 'lucide-react';
import * as faceapi from 'face-api.js';
import { useAuth } from '../../contexts/AuthContext';
import { storage, db } from '../../firebase';
import { API_URL } from '../../config/environment';
import Header from '../shared/Header';
import pbyLogo from './Branding/thelogo.png';
import dogShowcase from './pictures/dogPhoto.png';
import endorsedReviewLogo from '../stencilUpload/er.svg';
import { solvePaletteForRegions, buildPaintList } from './MainScreenPBYHelper';

// ============================================================================
// PAINT-BY-NUMBERS GENERATOR
// Converts uploaded images into numbered SVG region maps with palette legends
// ============================================================================

// ─── Configurable Constants ─────────────────────────────────────────────────

/**
 * MIN_REGION_SIZE — any connected region with fewer pixels than this
 * threshold will be merged into its closest-colour neighbour.
 * Increase to simplify output (fewer, larger regions).
 * Decrease to preserve more fine detail.
 */
const MIN_REGION_SIZE = 200;

/**
 * EDGE_STRENGTH_THRESHOLD — when an edge map is provided, merging is
 * blocked across boundaries where the maximum Sobel gradient magnitude
 * exceeds this value (0–255 scale).  Set higher to allow more merges;
 * set lower to be stricter about preserving edges.
 */
const EDGE_STRENGTH_THRESHOLD = 80;

// ─── Face-Aware Preprocessing Parameters ────────────────────────────────────

/** Bilateral radius for skin areas inside detected faces. */
const FACE_SMOOTH_RADIUS = 3;
/** Bilateral radius for eye / eyebrow regions — kept light to preserve
 *  pupil boundaries, eyelid shapes, and eyebrow edges. */
const EYE_SMOOTH_RADIUS  = 1;
/** Bilateral radius for everything outside the face (hair, clothes, bg). */
const GLOBAL_SMOOTH_RADIUS = 1;
/** Fractional expansion of face bounding box (0.15 = 15%). */
const FACE_PADDING = 0.15;

// ─── Color Science Helpers ───────────────────────────────────────────────────

/** sRGB → CIE-Lab for perceptual colour comparison */
function rgbToLab(r, g, b) {
  // sRGB → linear
  let lr = r / 255, lg = g / 255, lb = b / 255;
  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;
  // linear → XYZ (D65)
  let x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  let y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750);
  let z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIEDE2000-simplified (CIE76 ΔE) */
function deltaE(lab1, lab2) {
  return Math.sqrt(
    (lab1[0] - lab2[0]) ** 2 +
    (lab1[1] - lab2[1]) ** 2 +
    (lab1[2] - lab2[2]) ** 2
  );
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/** CIE-Lab → sRGB (inverse of rgbToLab) */
function labToRgb(L, a, b) {
  let fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const finv = t => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
  const x = finv(fx) * 0.95047, y = finv(fy), z = finv(fz) * 1.08883;
  let rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let gl = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  let bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  const gamma = c => (c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c);
  return [
    Math.round(Math.max(0, Math.min(255, gamma(rl) * 255))),
    Math.round(Math.max(0, Math.min(255, gamma(gl) * 255))),
    Math.round(Math.max(0, Math.min(255, gamma(bl) * 255)))
  ];
}

/** Seeded PRNG for deterministic k-means results */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Edge-Preserving Smoothing ──────────────────────────────────────────────

/**
 * Simplified bilateral filter: averages neighbours weighted by spatial
 * proximity and colour similarity. Preserves edges while reducing noise
 * so k-means quantisation follows real image structure instead of noise.
 */
function edgePreservingSmooth(imageData, radius = 2, sigmaColor = 30) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data.length);
  const sigmaColor2 = 2 * sigmaColor * sigmaColor;
  const sigmaSpace = Math.max(1, radius / 2);
  const sigmaSpace2 = 2 * sigmaSpace * sigmaSpace;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cr = data[idx], cg = data[idx + 1], cb = data[idx + 2];
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const nIdx = (ny * width + nx) * 4;
          const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
          const colorDist2 = (cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2;
          const spatDist2 = dx * dx + dy * dy;
          const w = Math.exp(-spatDist2 / sigmaSpace2 - colorDist2 / sigmaColor2);
          sumR += nr * w; sumG += ng * w; sumB += nb * w; sumW += w;
        }
      }
      out[idx]     = Math.round(sumR / sumW);
      out[idx + 1] = Math.round(sumG / sumW);
      out[idx + 2] = Math.round(sumB / sumW);
      out[idx + 3] = 255;
    }
  }
  return new ImageData(out, width, height);
}

// ─── Zone-Aware Bilateral Smoothing ─────────────────────────────────────────

/**
 * Per-pixel bilateral filter whose radius and colour sigma vary by zone:
 *
 *   FACE SKIN  (skinMask=1, eyeMask=0) → radius FACE_SMOOTH_RADIUS,  σ_c 45
 *   EYE REGION (eyeMask=1)             → radius EYE_SMOOTH_RADIUS,   σ_c 20
 *   EVERYTHING ELSE                    → radius GLOBAL_SMOOTH_RADIUS, σ_c 30
 *
 * A single full-image pass is made at the maximum of the three radii.
 * At each pixel the interpolated σ² values ensure smooth blending at
 * mask boundaries — no hard seams.
 *
 * Inside the face-skin zone, neighbours outside the skin mask are
 * excluded so hair/lip colours never bleed into skin.
 *
 * @param {ImageData}    imageData – input image
 * @param {Float32Array} faceMask  – soft face mask 0.0–1.0 (or null)
 * @param {Uint8Array}   skinMask  – binary skin mask (or null)
 * @param {Uint8Array}   eyeMask   – binary eye mask (or null)
 * @returns {ImageData}
 */
function zoneAwareSmooth(imageData, faceMask, skinMask, eyeMask) {
  const { data, width, height } = imageData;
  const total = width * height;
  const out = new Uint8ClampedArray(data.length);

  // ── Per-zone sigma² constants ────────────────────────────────────────
  const faceR  = FACE_SMOOTH_RADIUS;
  const eyeR   = EYE_SMOOTH_RADIUS;
  const globR  = GLOBAL_SMOOTH_RADIUS;
  const maxR   = Math.ceil(Math.max(faceR, eyeR, globR));

  const faceSS2  = 2 * Math.max(1, faceR / 2) ** 2;
  const eyeSS2   = 2 * Math.max(1, eyeR / 2) ** 2;
  const globSS2  = 2 * Math.max(1, globR / 2) ** 2;

  const faceSC2  = 2 * 45 * 45;   // wide — flatten skin micro-tones
  const eyeSC2   = 2 * 20 * 20;   // tight — preserve iris / lid / brow edges
  const globSC2  = 2 * 30 * 30;   // moderate — normal detail preservation

  // ── Pre-classify every pixel into one of three zones ─────────────────
  //    0 = global,  1 = face-skin,  2 = eye/brow
  const zone = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (eyeMask && eyeMask[i])            zone[i] = 2;
    else if (skinMask && skinMask[i])     zone[i] = 1;
    else                                  zone[i] = 0;
  }

  // ── Main bilateral pass ──────────────────────────────────────────────
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i   = y * width + x;
      const idx = i * 4;
      const cr = data[idx], cg = data[idx + 1], cb = data[idx + 2];
      const z  = zone[i];

      // Select sigma² pair for this pixel's zone
      const ss2 = z === 1 ? faceSS2 : z === 2 ? eyeSS2 : globSS2;
      const sc2 = z === 1 ? faceSC2 : z === 2 ? eyeSC2 : globSC2;

      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;

      for (let dy = -maxR; dy <= maxR; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -maxR; dx <= maxR; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const ni = ny * width + nx;

          // Prevent colour bleeding: skin pixels only average with skin,
          // eye pixels only average with eye pixels.
          if (z === 1 && zone[ni] !== 1) continue;
          if (z === 2 && zone[ni] !== 2) continue;

          const nIdx = ni * 4;
          const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];

          const spatDist2  = dx * dx + dy * dy;
          const colorDist2 = (cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2;

          const w = Math.exp(-spatDist2 / ss2 - colorDist2 / sc2);
          sumR += nr * w;
          sumG += ng * w;
          sumB += nb * w;
          sumW += w;
        }
      }

      if (sumW > 0) {
        out[idx]     = Math.round(sumR / sumW);
        out[idx + 1] = Math.round(sumG / sumW);
        out[idx + 2] = Math.round(sumB / sumW);
      } else {
        out[idx] = cr; out[idx + 1] = cg; out[idx + 2] = cb;
      }
      out[idx + 3] = 255;
    }
  }

  return new ImageData(out, width, height);
}

// ─── Preprocessing Pipeline Helpers ─────────────────────────────────────────

/**
 * 1. CLAHE-inspired histogram stretch.
 * Converts to luminance, stretches the 1st–99th percentile range to [0,255],
 * then scales each pixel's RGB channels proportionally.
 * Improves tonal separation before colour clustering.
 */
function histogramStretch(imageData) {
  const { data, width, height } = imageData;
  const total = width * height;
  const lum = new Float32Array(total);

  // Compute luminance for every pixel
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    lum[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Build histogram (256 bins)
  const hist = new Uint32Array(256);
  for (let i = 0; i < total; i++) hist[Math.round(lum[i])]++;

  // Find 1st and 99th percentile
  const p1Count = Math.floor(total * 0.01);
  const p99Count = Math.floor(total * 0.99);
  let cumul = 0, lo = 0, hi = 255;
  for (let b = 0; b <= 255; b++) {
    cumul += hist[b];
    if (cumul >= p1Count && lo === 0) lo = b;
    if (cumul >= p99Count) { hi = b; break; }
  }

  if (hi <= lo) return imageData; // already full range

  const scale = 255 / (hi - lo);
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const l = lum[i];
    const ratio = l > 0 ? Math.max(0, Math.min(255, (l - lo) * scale)) / l : 1;
    out[idx]     = Math.min(255, Math.round(data[idx] * ratio));
    out[idx + 1] = Math.min(255, Math.round(data[idx + 1] * ratio));
    out[idx + 2] = Math.min(255, Math.round(data[idx + 2] * ratio));
    out[idx + 3] = 255;
  }
  return new ImageData(out, width, height);
}

/**
 * 2. Face enhancement: midtone-targeted contrast boost inside face regions.
 * Uses the soft face mask (0.0–1.0) to alpha-blend the enhanced result with
 * the original, so the adjustment feathers smoothly into surrounding pixels
 * instead of creating hard rectangular boundaries.
 */
function enhanceFaceRegions(imageData, faceMask) {
  if (!faceMask) return imageData;
  const { data, width, height } = imageData;
  const total = width * height;
  const out = new Uint8ClampedArray(data);

  // Build a lookup table for the midtone S-curve
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    const strength = 0.15;
    const curved = t + strength * Math.sin(Math.PI * t);
    const lifted = curved + 0.03;
    lut[v] = Math.max(0, Math.min(255, Math.round(lifted * 255)));
  }

  for (let i = 0; i < total; i++) {
    const alpha = faceMask[i];
    if (alpha < 0.001) continue;           // skip fully-outside pixels
    const idx = i * 4;
    // Alpha-blend: result = original * (1 - α) + enhanced * α
    for (let c = 0; c < 3; c++) {
      const orig = data[idx + c];
      const enhanced = lut[orig];
      out[idx + c] = Math.round(orig + alpha * (enhanced - orig));
    }
  }
  return new ImageData(out, width, height);
}

/**
 * 3. Unsharp mask: sharpens edges to produce cleaner region boundaries.
 * Applies: output = original + amount * (original - blurred)
 */
function unsharpMask(imageData, radius = 1, amount = 0.6) {
  const { data, width, height } = imageData;
  const total = width * height;
  // Build box-blur kernel (fast approximation of Gaussian)
  const blurred = new Float32Array(total * 3);
  const size = 2 * radius + 1;
  const area = size * size;

  // Horizontal pass
  const hPass = new Float32Array(total * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sr = 0, sg = 0, sb = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = Math.max(0, Math.min(width - 1, x + dx));
        const nIdx = (y * width + nx) * 4;
        sr += data[nIdx]; sg += data[nIdx + 1]; sb += data[nIdx + 2];
      }
      const off = (y * width + x) * 3;
      hPass[off] = sr / size; hPass[off + 1] = sg / size; hPass[off + 2] = sb / size;
    }
  }
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sr = 0, sg = 0, sb = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        const off = (ny * width + x) * 3;
        sr += hPass[off]; sg += hPass[off + 1]; sb += hPass[off + 2];
      }
      const off = (y * width + x) * 3;
      blurred[off] = sr / size; blurred[off + 1] = sg / size; blurred[off + 2] = sb / size;
    }
  }

  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const bOff = i * 3;
    out[idx]     = Math.max(0, Math.min(255, Math.round(data[idx]     + amount * (data[idx]     - blurred[bOff]))));
    out[idx + 1] = Math.max(0, Math.min(255, Math.round(data[idx + 1] + amount * (data[idx + 1] - blurred[bOff + 1]))));
    out[idx + 2] = Math.max(0, Math.min(255, Math.round(data[idx + 2] + amount * (data[idx + 2] - blurred[bOff + 2]))));
    out[idx + 3] = 255;
  }
  return new ImageData(out, width, height);
}

/**
 * 4. Mild saturation boost (~12%).
 * Converts each pixel to HSL, increases S, converts back.
 * Compensates for colour dulling from clustering.
 */
function boostSaturation(imageData, factor = 1.12) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0, len = width * height; i < len; i++) {
    const idx = i * 4;
    const r = data[idx] / 255, g = data[idx + 1] / 255, b = data[idx + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) {
      // Achromatic — copy as-is
      out[idx] = data[idx]; out[idx + 1] = data[idx + 1]; out[idx + 2] = data[idx + 2]; out[idx + 3] = 255;
      continue;
    }
    const d = max - min;
    let h, s;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    // Boost saturation
    s = Math.min(1, s * factor);
    // HSL → RGB
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    out[idx]     = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    out[idx + 1] = Math.round(hue2rgb(p, q, h) * 255);
    out[idx + 2] = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    out[idx + 3] = 255;
  }
  return new ImageData(out, width, height);
}

/**
 * Build a binary skin mask inside face regions using Lab colour-space heuristics.
 * Skin pixels typically fall within specific Lab ranges — moderate L (40–85),
 * positive a* (warm/red), moderate b*. This separates skin from hair, eyes,
 * lips, and clothing that also falls inside the expanded face bounding box.
 */
function buildSkinMask(imageData, faceMask) {
  if (!faceMask) return null;
  const { data, width, height } = imageData;
  const total = width * height;
  const mask = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    if (faceMask[i] <= 0.5) continue; // only check inside face region
    const idx = i * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    const [L, a, bVal] = rgbToLab(r, g, b);
    // Skin detection in Lab: L between 40-85, a* between 5-28, b* between 5-45
    // Covers pale → medium skin tones in Lab space
    if (L >= 35 && L <= 88 && a >= 3 && a <= 32 && bVal >= 2 && bVal <= 48) {
      mask[i] = 1;
    }
  }
  return mask;
}

/**
 * Bilateral smooth specifically on skin-masked pixels.
 * Reduces tiny tonal variations that cause fragmented skin regions in PBN.
 * Only averages with other skin pixels to avoid bleeding hair/lip colours.
 *
 * Uses FACE_SMOOTH_RADIUS and a wide σ_colour (35) so micro-tone
 * variations from pores, freckles and lighting noise are flattened while
 * real feature edges (nose bridge, cheekbone highlight) are preserved.
 */
function smoothSkinRegions(imageData, skinMask) {
  if (!skinMask) return imageData;
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data);
  const radius = FACE_SMOOTH_RADIUS;       // configurable — default 3
  const sigmaColor = 35;                   // wide enough to merge freckles/pores
  const sigmaColor2 = 2 * sigmaColor * sigmaColor;
  const sigmaSpace = Math.max(1, radius / 2);
  const sigmaSpace2 = 2 * sigmaSpace * sigmaSpace;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!skinMask[i]) continue;
      const idx = i * 4;
      const cr = data[idx], cg = data[idx + 1], cb = data[idx + 2];
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          // Only average with other skin pixels
          if (!skinMask[ny * width + nx]) continue;
          const nIdx = (ny * width + nx) * 4;
          const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
          const colorDist2 = (cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2;
          const spatDist2 = dx * dx + dy * dy;
          const w = Math.exp(-spatDist2 / sigmaSpace2 - colorDist2 / sigmaColor2);
          sumR += nr * w; sumG += ng * w; sumB += nb * w; sumW += w;
        }
      }
      if (sumW > 0) {
        out[idx]     = Math.round(sumR / sumW);
        out[idx + 1] = Math.round(sumG / sumW);
        out[idx + 2] = Math.round(sumB / sumW);
      }
    }
  }
  return new ImageData(out, width, height);
}

// ─── Majority-Vote Filter ───────────────────────────────────────────────────

/**
 * For each pixel, replace its colour label with the most common label in its
 * (2r+1)×(2r+1) neighbourhood. Removes salt-and-pepper assignment noise.
 */
function majorityFilter(colorAssign, width, height, radius = 1) {
  const total = width * height;
  const out = new Int32Array(total);
  const counts = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      counts.clear();
      let bestLabel = colorAssign[y * width + x], bestCount = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const label = colorAssign[ny * width + nx];
          const c = (counts.get(label) || 0) + 1;
          counts.set(label, c);
          if (c > bestCount) { bestCount = c; bestLabel = label; }
        }
      }
      out[y * width + x] = bestLabel;
    }
  }
  return out;
}

/**
 * Face-aware majority filter.  Uses a smaller radius inside eye/brow zones
 * so fine features (pupil, iris, lid, brow) are preserved, while skin and
 * background get a larger radius for flatter, more paintable regions.
 *
 * @param {Int32Array}  colorAssign – per-pixel palette index
 * @param {number}      width
 * @param {number}      height
 * @param {number}      bgRadius   – radius for background & skin (3-4)
 * @param {number}      eyeRadius  – radius for eye/brow zones (1)
 * @param {Uint8Array}  [eyeMask]  – binary eye mask (0/1)
 */
function faceAwareMajorityFilter(colorAssign, width, height, bgRadius, eyeRadius, eyeMask) {
  const total = width * height;
  const out = new Int32Array(total);
  const counts = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const r = (eyeMask && eyeMask[i]) ? eyeRadius : bgRadius;
      counts.clear();
      let bestLabel = colorAssign[i], bestCount = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const label = colorAssign[ny * width + nx];
          const c = (counts.get(label) || 0) + 1;
          counts.set(label, c);
          if (c > bestCount) { bestCount = c; bestLabel = label; }
        }
      }
      out[i] = bestLabel;
    }
  }
  return out;
}

/** Assign every pixel to its nearest palette colour index. */
function assignPixels(imageData, palette) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const paletteLab = palette.map(c => c.lab);
  const colorAssign = new Int32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const lab = rgbToLab(data[idx], data[idx + 1], data[idx + 2]);
    let bestK = 0, bestD = Infinity;
    for (let c = 0; c < paletteLab.length; c++) {
      const d = deltaE(lab, paletteLab[c]);
      if (d < bestD) { bestD = d; bestK = c; }
    }
    colorAssign[i] = bestK;
  }
  return colorAssign;
}

// ─── Pipeline Instrumentation ───────────────────────────────────────────────

function logPipelineStats(label, data) {
  console.group(`[PBN] ${label}`);
  if (data.dimensions) console.log(`  Dimensions: ${data.dimensions.w}×${data.dimensions.h} (${data.dimensions.w * data.dimensions.h} px)`);
  if (data.uniqueColors !== undefined) console.log(`  Unique palette colours: ${data.uniqueColors}`);
  if (data.regionCount !== undefined) console.log(`  Regions: ${data.regionCount}`);
  if (data.regionSizes) {
    const sizes = [...data.regionSizes].sort((a, b) => a - b);
    console.log(`  Region sizes — min: ${sizes[0]}, median: ${sizes[Math.floor(sizes.length / 2)]}, max: ${sizes[sizes.length - 1]}`);
  }
  if (data.elapsed !== undefined) console.log(`  Elapsed: ${data.elapsed.toFixed(0)} ms`);
  if (data.note) console.log(`  Note: ${data.note}`);
  console.groupEnd();
}

// ─── K-Means Colour Quantisation ────────────────────────────────────────────

/**
 * Run k-means in Lab space. Guarantees exactly K centroids.
 * Uses seeded PRNG for deterministic results; handles empty/duplicate clusters.
 */
function kMeansQuantise(imageData, k, maxIter = 30) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const rng = mulberry32(42); // deterministic seed

  // Sample pixels (max 50 000)
  const sampleRate = Math.max(1, Math.floor(totalPixels / 50000));
  const samples = [];
  for (let i = 0; i < totalPixels; i += sampleRate) {
    const idx = i * 4;
    samples.push([data[idx], data[idx + 1], data[idx + 2]]);
  }

  const samplesLab = samples.map(([r, g, b]) => rgbToLab(r, g, b));
  const N = samplesLab.length;

  // k-means++ initialisation (seeded, deterministic)
  const centroids = [];
  centroids.push([...samplesLab[Math.floor(rng() * N)]]);

  for (let c = 1; c < k; c++) {
    const dists = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let minD = Infinity;
      for (const cent of centroids) {
        const d = deltaE(samplesLab[i], cent);
        if (d < minD) minD = d;
      }
      dists[i] = minD * minD;
    }
    const total = dists.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let chosen = N - 1;
    for (let i = 0; i < N; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroids.push([...samplesLab[chosen]]);
  }

  // Iterate
  const assignments = new Int32Array(N);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = 0;
    for (let i = 0; i < N; i++) {
      let bestK = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = deltaE(samplesLab[i], centroids[c]);
        if (d < bestD) { bestD = d; bestK = c; }
      }
      if (assignments[i] !== bestK) { assignments[i] = bestK; changed++; }
    }
    if (changed === 0 && iter > 0) break;

    // Update centroids (with empty cluster recovery)
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Float64Array(k);
    for (let i = 0; i < N; i++) {
      const c = assignments[i];
      sums[c][0] += samplesLab[i][0];
      sums[c][1] += samplesLab[i][1];
      sums[c][2] += samplesLab[i][2];
      counts[c]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c][0] = sums[c][0] / counts[c];
        centroids[c][1] = sums[c][1] / counts[c];
        centroids[c][2] = sums[c][2] / counts[c];
      } else {
        // Empty cluster → reinitialise to farthest sample from all centroids
        let maxDist = -1, maxIdx = 0;
        for (let i = 0; i < N; i++) {
          let minD = Infinity;
          for (let cc = 0; cc < k; cc++) {
            if (cc === c || counts[cc] === 0) continue;
            const d = deltaE(samplesLab[i], centroids[cc]);
            if (d < minD) minD = d;
          }
          if (minD > maxDist) { maxDist = minD; maxIdx = i; }
        }
        centroids[c] = [...samplesLab[maxIdx]];
      }
    }
  }

  // Deduplicate centroids that converged to same point (ΔE < 3)
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      if (deltaE(centroids[i], centroids[j]) < 3) {
        let maxDist = -1, maxIdx = 0;
        for (let s = 0; s < N; s++) {
          let minD = Infinity;
          for (let cc = 0; cc < k; cc++) {
            if (cc === j) continue;
            const d = deltaE(samplesLab[s], centroids[cc]);
            if (d < minD) minD = d;
          }
          if (minD > maxDist) { maxDist = minD; maxIdx = s; }
        }
        centroids[j] = [...samplesLab[maxIdx]];
      }
    }
  }

  // Convert centroids to RGB via proper Lab→RGB inverse (not nearest sample)
  const palette = centroids.map(centLab => {
    const [r, g, b] = labToRgb(centLab[0], centLab[1], centLab[2]);
    return { r, g, b, lab: centLab, hex: rgbToHex(r, g, b) };
  });

  return palette;
}

// ─── Region Segmentation ────────────────────────────────────────────────────

/**
 * Assign every pixel to its nearest palette colour, then run connected-component
 * labelling to identify individual regions.  Returns { regionMap, regions }.
 */
function segmentRegions(imageData, palette) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const paletteLab = palette.map(c => c.lab);

  // Assign each pixel to nearest palette colour
  const colorAssign = new Int32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const lab = rgbToLab(data[idx], data[idx + 1], data[idx + 2]);
    let bestK = 0, bestD = Infinity;
    for (let c = 0; c < paletteLab.length; c++) {
      const d = deltaE(lab, paletteLab[c]);
      if (d < bestD) { bestD = d; bestK = c; }
    }
    colorAssign[i] = bestK;
  }

  return segmentFromColorAssign(colorAssign, width, height);
}

/**
 * Connected-component labelling directly from a per-pixel colorAssign array.
 * Avoids re-quantising from synthetic ImageData.  O(width × height).
 */
function segmentFromColorAssign(colorAssign, width, height) {
  const totalPixels = width * height;
  const regionMap = new Int32Array(totalPixels).fill(-1);
  let nextLabel = 0;
  const regions = []; // { id, colorIndex, pixels: [indices], area }

  for (let i = 0; i < totalPixels; i++) {
    if (regionMap[i] !== -1) continue;
    const colorIdx = colorAssign[i];
    const label = nextLabel++;
    const pixels = [];
    const stack = [i];
    regionMap[i] = label;
    while (stack.length > 0) {
      const p = stack.pop();
      pixels.push(p);
      const x = p % width;
      const y = Math.floor(p / width);
      // 4-connected neighbours
      const neighbours = [];
      if (x > 0) neighbours.push(p - 1);
      if (x < width - 1) neighbours.push(p + 1);
      if (y > 0) neighbours.push(p - width);
      if (y < height - 1) neighbours.push(p + width);
      for (const n of neighbours) {
        if (regionMap[n] === -1 && colorAssign[n] === colorIdx) {
          regionMap[n] = label;
          stack.push(n);
        }
      }
    }
    regions.push({ id: label, colorIndex: colorIdx, pixels, area: pixels.length });
  }

  return { regionMap, regions, colorAssign: new Int32Array(colorAssign) };
}

// ─── Edge Map Computation (Sobel gradient magnitude) ────────────────────────

/**
 * Compute a per-pixel edge-strength map using the Sobel operator on the
 * luminance channel.  Returns a Float32Array[width*height] with values
 * in 0–255.  This is optional — pass the result as `edgeMap` to
 * mergeSmallRegions to prevent merging across strong edges.
 *
 * Efficient: single pass over image, O(width × height).
 */
function computeEdgeMap(imageData) {
  const { data, width, height } = imageData;
  const edge = new Float32Array(width * height);

  // Pre-compute greyscale luminance (rec. 709)
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    lum[i] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
  }

  // Sobel 3×3 convolution (skip 1-pixel border)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = lum[(y - 1) * width + (x - 1)];
      const tc = lum[(y - 1) * width + x];
      const tr = lum[(y - 1) * width + (x + 1)];
      const ml = lum[y * width + (x - 1)];
      const mr = lum[y * width + (x + 1)];
      const bl = lum[(y + 1) * width + (x - 1)];
      const bc = lum[(y + 1) * width + x];
      const br = lum[(y + 1) * width + (x + 1)];

      // Horizontal and vertical gradient
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

      // Gradient magnitude, clamped to 0–255
      edge[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }

  return edge;
}

// ─── Region Merging (iterative, RGB-distance, edge-aware) ───────────────────

/**
 * Iteratively merge regions smaller than `minArea` into their closest-colour
 * neighbour.  Repeats until no undersized regions remain.
 *
 * Colour distance uses Euclidean RGB:
 *   distance = sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)
 *
 * Neighbour selection priority:
 *   1) smallest colour distance
 *   2) largest neighbour region area  (tie-breaker)
 *
 * Optional `edgeMap` (Float32Array, same dimensions as image): if the
 * maximum edge strength along the shared boundary exceeds
 * EDGE_STRENGTH_THRESHOLD the neighbour is skipped, preventing merges
 * across strong visual edges.
 *
 * Uses an id→region Map for O(1) lookups — efficient up to 2000×2000.
 *
 * @param {Int32Array}   regionMap   – per-pixel region id
 * @param {Array}        regions     – region objects {id, colorIndex, pixels, area}
 * @param {Int32Array}   colorAssign – per-pixel palette index
 * @param {Array}        palette     – palette entries with .r .g .b
 * @param {number}       width
 * @param {number}       height
 * @param {number}       minArea     – regions smaller than this are merged (default MIN_REGION_SIZE)
 * @param {Float32Array} [edgeMap]   – optional Sobel edge-strength map
 * @returns {{ regionMap, regions, colorAssign }}
 */
function mergeSmallRegions(regionMap, regions, colorAssign, palette, width, height, minArea, edgeMap = null) {

  // ── O(1) region lookup by id ──────────────────────────────────────────
  const regionById = new Map();
  for (const r of regions) regionById.set(r.id, r);

  /**
   * RGB Euclidean distance between two palette colours.
   */
  function rgbDistance(cA, cB) {
    return Math.sqrt(
      (cA.r - cB.r) ** 2 +
      (cA.g - cB.g) ** 2 +
      (cA.b - cB.b) ** 2
    );
  }

  // ── Iterative merge loop ──────────────────────────────────────────────
  //    Repeat until every region meets the minimum size requirement.
  let changed = true;
  while (changed) {
    changed = false;

    // Collect all undersized regions, sorted smallest-first so the
    // tiniest specks are absorbed first.
    const smallRegions = regions
      .filter(r => r.area > 0 && r.area < minArea)
      .sort((a, b) => a.area - b.area);

    if (smallRegions.length === 0) break;

    for (const small of smallRegions) {
      // Region may already have been absorbed earlier in this pass
      if (small.area === 0 || small.area >= minArea) continue;

      // ── Scan boundary pixels to discover neighbours ───────────────
      //    For each neighbour track: colour index, shared border length,
      //    area, and (optionally) max edge strength along the border.
      const neighbourInfo = new Map(); // nLabel → { colorIndex, borderLen, area, edgeSum }

      for (const px of small.pixels) {
        const x = px % width;
        const y = Math.floor(px / width);
        // 4-connected adjacency
        const adj = [];
        if (x > 0)           adj.push(px - 1);
        if (x < width - 1)   adj.push(px + 1);
        if (y > 0)           adj.push(px - width);
        if (y < height - 1)  adj.push(px + width);

        for (const n of adj) {
          const nLabel = regionMap[n];
          if (nLabel === small.id || nLabel === -1) continue;

          if (!neighbourInfo.has(nLabel)) {
            const nRegion = regionById.get(nLabel);
            if (nRegion && nRegion.area > 0) {
              neighbourInfo.set(nLabel, {
                colorIndex: nRegion.colorIndex,
                borderLen:  0,
                area:       nRegion.area,
                edgeSum:    0
              });
            }
          }
          const entry = neighbourInfo.get(nLabel);
          if (entry) {
            entry.borderLen++;
            // Accumulate edge strength for averaging — a single hot pixel
            // should not block the entire merge.
            if (edgeMap) {
              entry.edgeSum += Math.max(edgeMap[px], edgeMap[n]);
            }
          }
        }
      }

      if (neighbourInfo.size === 0) continue;

      // ── Pick best neighbour ───────────────────────────────────────
      //    Priority: 1) smallest RGB distance  2) largest area
      const smallColour = palette[small.colorIndex];
      let bestNeighbour = -1;
      let bestDist  = Infinity;
      let bestArea  = -1;

      for (const [nId, info] of neighbourInfo) {
        // Block merge only if the AVERAGE edge strength along the shared
        // boundary exceeds the threshold.  Using the average instead of
        // the max prevents a single strong-gradient pixel from blocking
        // an otherwise safe merge of a tiny speck region.
        if (edgeMap && info.borderLen > 0) {
          const avgEdge = info.edgeSum / info.borderLen;
          if (avgEdge > EDGE_STRENGTH_THRESHOLD) continue;
        }

        const dist = rgbDistance(smallColour, palette[info.colorIndex]);

        // Strictly better colour match, OR same distance but larger area
        if (dist < bestDist || (dist === bestDist && info.area > bestArea)) {
          bestDist      = dist;
          bestArea      = info.area;
          bestNeighbour = nId;
        }
      }

      // All neighbours blocked by edges — skip this region for now;
      // a future pass may open a viable merge after other merges happen.
      if (bestNeighbour === -1) continue;

      // ── Perform the merge ─────────────────────────────────────────
      const target = regionById.get(bestNeighbour);
      if (!target) continue;

      // Re-label every pixel of the small region to the target
      for (const px of small.pixels) {
        regionMap[px]   = bestNeighbour;
        colorAssign[px] = target.colorIndex;
      }

      // Transfer pixels and update area counters
      target.pixels.push(...small.pixels);
      target.area += small.area;

      // Mark the small region as dead
      small.pixels = [];
      small.area   = 0;

      changed = true; // signal another pass may be needed
    }
  }

  // ── Clean up: remove dead regions, assign display numbers ─────────────
  const valid = regions.filter(r => r.area > 0);
  valid.forEach((r) => { r.displayNumber = r.colorIndex + 1; });
  return { regionMap, regions: valid, colorAssign };
}

// ─── Iterative Similar-Neighbour Merge ──────────────────────────────────────

/**
 * Repeatedly merge neighbouring regions when BOTH conditions hold:
 *   1) Lab colour distance ΔE < deltaEThreshold
 *   2) at least one of the two regions has area < smallArea pixels
 *
 * This collapses gradient fragments (cheek highlight→midtone→shadow)
 * into fewer, larger paintable blocks while leaving genuinely different
 * colour boundaries intact.
 *
 * Iterates until no further merges are possible.
 */
function mergeSimilarNeighbours(regionMap, regions, palette, width, height, deltaEThreshold = 6, smallArea = 400, eyeMask = null, edgeMap = null, zoneMap = null) {
  const regionById = new Map();
  for (const r of regions) regionById.set(r.id, r);

  const paletteLab = palette.map(c => c.lab);

  // Helper: is this region mostly inside the eye mask?
  const isEyeRegion = (r) => {
    if (!eyeMask || r.area === 0) return false;
    let count = 0;
    for (const px of r.pixels) { if (eyeMask[px]) count++; }
    return count / r.area > 0.3;
  };

  // Helper: primary zone of a region (zone with most pixels, >30% threshold)
  const primaryZoneOf = (r) => {
    if (!zoneMap || r.area === 0) return 0;
    const counts = {};
    for (const px of r.pixels) {
      const z = zoneMap[px];
      if (z > 0) counts[z] = (counts[z] || 0) + 1;
    }
    let bestZ = 0, bestC = 0;
    for (const [z, c] of Object.entries(counts)) {
      if (c > bestC) { bestC = c; bestZ = Number(z); }
    }
    return bestC / r.area > 0.3 ? bestZ : 0;
  };

  // Helper: compute average edge strength along shared boundary between two regions
  const avgBorderEdge = (small, targetId) => {
    if (!edgeMap) return 0;
    let sum = 0, count = 0;
    for (const px of small.pixels) {
      const x = px % width;
      const adj = [];
      if (x > 0)           adj.push(px - 1);
      if (x < width - 1)   adj.push(px + 1);
      if (px >= width)      adj.push(px - width);
      if (px + width < width * height) adj.push(px + width);
      for (const n of adj) {
        if (regionMap[n] === targetId) {
          sum += Math.max(edgeMap[px], edgeMap[n]);
          count++;
        }
      }
    }
    return count > 0 ? sum / count : 0;
  };

  let changed = true;
  while (changed) {
    changed = false;

    // Build adjacency
    const adjacency = new Map();
    for (const r of regions) {
      if (r.area > 0) adjacency.set(r.id, new Set());
    }
    const totalPixels = width * height;
    for (let i = 0; i < totalPixels; i++) {
      const id = regionMap[i];
      if (id === -1) continue;
      const x = i % width;
      if (x < width - 1) {
        const rId = regionMap[i + 1];
        if (rId !== id && rId !== -1) {
          adjacency.get(id)?.add(rId);
          adjacency.get(rId)?.add(id);
        }
      }
      if (i + width < totalPixels) {
        const bId = regionMap[i + width];
        if (bId !== id && bId !== -1) {
          adjacency.get(id)?.add(bId);
          adjacency.get(bId)?.add(id);
        }
      }
    }

    // Sort regions smallest-first so small fragments are absorbed quickly
    const sorted = regions.filter(r => r.area > 0).sort((a, b) => a.area - b.area);

    for (const small of sorted) {
      if (small.area === 0) continue;
      if (small.area >= smallArea) continue; // only merge small regions

      const neighbours = adjacency.get(small.id);
      if (!neighbours || neighbours.size === 0) continue;

      const sLab = paletteLab[small.colorIndex];
      let bestId = -1, bestD = Infinity, bestArea = -1;

      for (const nId of neighbours) {
        const nr = regionById.get(nId);
        if (!nr || nr.area === 0) continue;

        // Block merges across different facial zones (e.g. lip→nose, eye→cheek)
        if (zoneMap) {
          const sZone = primaryZoneOf(small);
          const nZone = primaryZoneOf(nr);
          if (sZone !== 0 && nZone !== 0 && sZone !== nZone) continue;
        }

        // Block merges across strong edges inside eye regions
        if (eyeMask && edgeMap && isEyeRegion(small) && isEyeRegion(nr)) {
          if (avgBorderEdge(small, nId) > EDGE_STRENGTH_THRESHOLD) continue;
        }

        const d = deltaE(sLab, paletteLab[nr.colorIndex]);
        if (d < deltaEThreshold && (d < bestD || (d === bestD && nr.area > bestArea))) {
          bestD = d;
          bestArea = nr.area;
          bestId = nId;
        }
      }

      if (bestId === -1) continue;

      // Merge small → target
      const target = regionById.get(bestId);
      for (const px of small.pixels) {
        regionMap[px] = target.id;
      }
      target.pixels.push(...small.pixels);
      target.area += small.area;
      small.pixels = [];
      small.area = 0;
      changed = true;
    }
  }

  return regions.filter(r => r.area > 0);
}

// ─── Merge Similar Colours (ΔE threshold) ───────────────────────────────────

function mergeSimilarColours(palette, regions, regionMap, colorAssign, width, height, threshold = 6) {
  // Iterative closest-pair merge: merge only the two most similar colours each
  // round and stop when no pair is below threshold OR we'd drop below 85% of
  // the actually-used palette size. This prevents cascading over-merges.
  const merged = palette.map(c => ({ ...c }));
  // Only track colours that actually have pixels assigned (some may have been
  // eliminated by majority filter or region merging before this step)
  const usedBefore = new Set(colorAssign);
  const alive = new Set([...usedBefore]);                 // indices still active
  const minKeep = Math.max(4, Math.ceil(alive.size * 0.85));

  while (alive.size > minKeep) {
    let bestI = -1, bestJ = -1, bestD = Infinity;
    const arr = [...alive];
    for (let a = 0; a < arr.length; a++) {
      for (let b = a + 1; b < arr.length; b++) {
        const d = deltaE(merged[arr[a]].lab, merged[arr[b]].lab);
        if (d < bestD) { bestD = d; bestI = arr[a]; bestJ = arr[b]; }
      }
    }
    if (bestD >= threshold) break;  // nothing left to merge
    // Absorb bestJ into bestI (keep the one with more pixels)
    alive.delete(bestJ);
    // Map bestJ → bestI in colorAssign
    for (let p = 0; p < colorAssign.length; p++) {
      if (colorAssign[p] === bestJ) colorAssign[p] = bestI;
    }
  }

  // Build compact palette of only used colours
  const usedSet = new Set(colorAssign);
  const usedArr = [...usedSet].sort((a, b) => a - b);
  const reindex = new Map();
  const newPalette = [];
  usedArr.forEach((oldIdx, newIdx) => {
    reindex.set(oldIdx, newIdx);
    newPalette.push(merged[oldIdx]);
  });

  for (let p = 0; p < colorAssign.length; p++) {
    colorAssign[p] = reindex.get(colorAssign[p]);
  }

  // Update region colorIndex to match new compact palette indices
  for (const region of regions) {
    if (region.area > 0 && region.pixels.length > 0) {
      region.colorIndex = colorAssign[region.pixels[0]];
    }
  }

  return { palette: newPalette, colorAssign };
}

// ─── Master Palette (50 portrait-optimised colours) ─────────────────────────

const MASTER_PALETTE = [
  // Neutral / Greys (5)
  { name: 'Titanium White',    r: 255, g: 255, b: 255 },
  { name: 'Light Grey',        r: 200, g: 200, b: 200 },
  { name: 'Medium Grey',       r: 140, g: 140, b: 140 },
  { name: 'Dark Grey',         r:  80, g:  80, b:  80 },
  { name: 'Carbon Black',      r:  20, g:  20, b:  20 },
  // Skin tones (12) — portrait-optimised: pale, cool-pink bias
  { name: 'Porcelain',         r: 250, g: 240, b: 232 },
  { name: 'Very Pale Skin',    r: 245, g: 228, b: 218 },
  { name: 'Pale Peach',        r: 240, g: 218, b: 205 },
  { name: 'Cool Light Flesh',  r: 232, g: 205, b: 192 },
  { name: 'Neutral Flesh',     r: 222, g: 190, b: 175 },
  { name: 'Rosy Flesh',        r: 218, g: 180, b: 170 },
  { name: 'Soft Blush',        r: 210, g: 170, b: 162 },
  { name: 'Light Tan Flesh',   r: 198, g: 158, b: 142 },
  { name: 'Muted Olive Flesh', r: 178, g: 152, b: 135 },
  { name: 'Warm Skin Shadow',  r: 162, g: 130, b: 112 },
  { name: 'Cool Skin Shadow',  r: 140, g: 112, b:  98 },
  { name: 'Deep Skin Shadow',  r: 115, g:  85, b:  72 },
  // Portrait skin gradient additions (10)
  { name: 'Ivory Skin',        r: 248, g: 233, b: 226 },
  { name: 'Soft Porcelain',    r: 240, g: 218, b: 210 },
  { name: 'Pink Porcelain',    r: 235, g: 205, b: 200 },
  { name: 'Neutral Peach',     r: 225, g: 188, b: 170 },
  { name: 'Soft Warm Flesh',   r: 215, g: 178, b: 158 },
  { name: 'Muted Rosy Flesh',  r: 210, g: 165, b: 155 },
  { name: 'Cool Flesh Shadow', r: 188, g: 150, b: 145 },
  { name: 'Soft Brown Shadow', r: 170, g: 138, b: 125 },
  { name: 'Warm Shadow',       r: 158, g: 126, b: 112 },
  { name: 'Deep Shadow',       r: 138, g: 104, b:  96 },
  // Iris colours (4)
  { name: 'Light Iris Blue',   r: 120, g: 165, b: 210 },
  { name: 'Deep Iris Blue',    r:  65, g: 105, b: 160 },
  { name: 'Hazel Iris',        r: 145, g: 115, b:  65 },
  { name: 'Dark Iris Brown',   r:  80, g:  55, b:  40 },
  // Reds / Lips (4)
  { name: 'Soft Rose',         r: 200, g: 120, b: 120 },
  { name: 'Muted Red',         r: 175, g:  65, b:  60 },
  { name: 'Brick Red',         r: 145, g:  50, b:  45 },
  { name: 'Deep Burgundy',     r: 100, g:  30, b:  35 },
  // Browns (5)
  { name: 'Burnt Sienna',      r: 160, g:  85, b:  50 },
  { name: 'Raw Umber',         r: 130, g: 100, b:  70 },
  { name: 'Warm Brown',        r: 110, g:  70, b:  45 },
  { name: 'Chocolate Brown',   r:  80, g:  50, b:  35 },
  { name: 'Dark Umber',        r:  55, g:  35, b:  25 },
  // Blues (4)
  { name: 'Sky Blue',          r: 135, g: 185, b: 225 },
  { name: 'Cerulean',          r:  65, g: 130, b: 195 },
  { name: 'Slate Blue',        r:  85, g: 100, b: 140 },
  { name: 'Deep Navy',         r:  30, g:  40, b:  75 },
  // Greens (3)
  { name: 'Muted Green',       r: 120, g: 160, b: 110 },
  { name: 'Olive Green',       r:  95, g: 115, b:  65 },
  { name: 'Forest Green',      r:  45, g:  75, b:  45 },
  // Yellows / Warm tones (3)
  { name: 'Warm Yellow',       r: 240, g: 210, b: 120 },
  { name: 'Yellow Ochre',      r: 200, g: 170, b:  90 },
  { name: 'Muted Gold',        r: 175, g: 145, b:  75 },
].map(c => ({ ...c, lab: rgbToLab(c.r, c.g, c.b), hex: rgbToHex(c.r, c.g, c.b) }));

// ─── Face Detection & Mask ──────────────────────────────────────────────────

/**
 * Loads the TinyFaceDetector + FaceLandmark68 models from /models/ (public folder).
 * Called once; subsequent calls are no-ops because face-api.js caches models.
 */
let _faceModelLoaded = false;
async function ensureFaceModelLoaded() {
  if (_faceModelLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models')
  ]);
  _faceModelLoaded = true;
}

/**
 * Detect all faces in the given HTMLImageElement or HTMLCanvasElement.
 * Returns an array of { x, y, width, height, score, eyes } where `eyes`
 * is an array of two { cx, cy, rx, ry } ellipses for left and right eyes
 * (only present when landmark detection succeeds).
 */
async function detectFaces(input) {
  await ensureFaceModelLoaded();
  const detections = await faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
    .withFaceLandmarks();

  return detections.map(d => {
    const box = d.detection.box;
    const result = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      score: d.detection.score,
      eyes: null
    };

    // Extract eye regions from 68 landmarks
    // Left eye: points 36-41, Right eye: points 42-47
    try {
      const pts = d.landmarks.positions;
      const leftPts  = pts.slice(36, 42);
      const rightPts = pts.slice(42, 48);

      const eyeEllipse = (points) => {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const cx = xs.reduce((a, b) => a + b, 0) / points.length;
        const cy = ys.reduce((a, b) => a + b, 0) / points.length;
        // Iris diameter ≈ vertical eye opening (top-lid midpoint → bottom-lid midpoint)
        const topMidX = (points[1].x + points[2].x) / 2;
        const topMidY = (points[1].y + points[2].y) / 2;
        const botMidX = (points[4].x + points[5].x) / 2;
        const botMidY = (points[4].y + points[5].y) / 2;
        const irisD = Math.sqrt((topMidX - botMidX) ** 2 + (topMidY - botMidY) ** 2);
        // Circular mask covering iris + pupil + immediate sclera only
        const r = Math.max(irisD * 0.6, 3);
        return { cx, cy, rx: r, ry: r };
      };

      result.eyes = [eyeEllipse(leftPts), eyeEllipse(rightPts)];

      // ── Extract all facial zone landmarks (68-point model) ──────────
      //   0-16:  jawline         17-21: left eyebrow     22-26: right eyebrow
      //  27-30:  nose bridge     31-35: nose bottom       36-41: left eye
      //  42-47:  right eye       48-59: outer lip         60-67: inner lip
      result.landmarks = {
        jawline:      pts.slice(0, 17).map(p => ({ x: p.x, y: p.y })),
        leftBrow:     pts.slice(17, 22).map(p => ({ x: p.x, y: p.y })),
        rightBrow:    pts.slice(22, 27).map(p => ({ x: p.x, y: p.y })),
        noseBridge:   pts.slice(27, 31).map(p => ({ x: p.x, y: p.y })),
        noseBottom:   pts.slice(31, 36).map(p => ({ x: p.x, y: p.y })),
        leftEye:      pts.slice(36, 42).map(p => ({ x: p.x, y: p.y })),
        rightEye:     pts.slice(42, 48).map(p => ({ x: p.x, y: p.y })),
        outerLip:     pts.slice(48, 60).map(p => ({ x: p.x, y: p.y })),
        innerLip:     pts.slice(60, 68).map(p => ({ x: p.x, y: p.y })),
      };
    } catch (_) {
      // Landmarks unavailable — proceed without eye data
    }

    return result;
  });
}

/**
 * Build a soft face mask (Float32Array, 0.0–1.0) using an elliptical shape
 * with Gaussian-feathered edges.  Each detected face bounding box is expanded
 * by 1.6× and inscribed with an ellipse.  Pixels inside the ellipse are 1.0;
 * pixels beyond the ellipse fall off smoothly to 0.0 over a feather radius
 * controlled by `feather` (default 30 px).
 *
 * This prevents the hard rectangular artefacts that rectangular binary masks
 * produce during face-aware preprocessing and segmentation.
 */
function buildFaceMask(faces, width, height, feather = 30) {
  const mask = new Float32Array(width * height);   // 0.0 everywhere
  for (const face of faces) {
    // Expand bounding box by 1.6× centred on original face centre
    const cx = face.x + face.width / 2;
    const cy = face.y + face.height / 2;
    const ew = face.width * 1.6;
    const eh = face.height * 1.6;
    // Ellipse radii = half the expanded dimensions
    const rx = ew / 2;
    const ry = eh / 2;

    // Only iterate over the bounding box + feather margin
    const x0 = Math.max(0, Math.floor(cx - rx - feather));
    const y0 = Math.max(0, Math.floor(cy - ry - feather));
    const x1 = Math.min(width,  Math.ceil(cx + rx + feather));
    const y1 = Math.min(height, Math.ceil(cy + ry + feather));

    for (let y = y0; y < y1; y++) {
      const rowOff = y * width;
      for (let x = x0; x < x1; x++) {
        // Normalised elliptical distance: 0 at centre, 1.0 on the ellipse edge
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);

        let alpha;
        if (d <= 1.0) {
          alpha = 1.0;                          // fully inside ellipse
        } else {
          // Feather zone: distance in pixels beyond the ellipse edge
          // (approximate pixel distance from the nearest point on the ellipse)
          const overshoot = (d - 1.0) * Math.min(rx, ry);
          if (overshoot >= feather) {
            alpha = 0.0;                        // fully outside feather band
          } else {
            // Smooth Gaussian-like falloff
            const t = overshoot / feather;      // 0..1 across feather band
            alpha = Math.exp(-3.0 * t * t);     // σ ≈ feather/√6 → ~0.05 at edge
          }
        }

        // Max-blend so overlapping faces don't darken each other
        const idx = rowOff + x;
        if (alpha > mask[idx]) mask[idx] = alpha;
      }
    }
  }
  return mask;
}

/**
 * Build a binary eye mask (Uint8Array, 1 = inside an eye region, 0 = outside).
 * Uses the elliptical eye data extracted from face landmarks.
 */
function buildEyeMask(faces, width, height) {
  const mask = new Uint8Array(width * height);
  for (const face of faces) {
    if (!face.eyes) continue;
    for (const eye of face.eyes) {
      const { cx, cy, rx, ry } = eye;
      const x0 = Math.max(0, Math.floor(cx - rx));
      const y0 = Math.max(0, Math.floor(cy - ry));
      const x1 = Math.min(width - 1, Math.ceil(cx + rx));
      const y1 = Math.min(height - 1, Math.ceil(cy + ry));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          // Ellipse test: ((x-cx)/rx)² + ((y-cy)/ry)² ≤ 1
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) {
            mask[y * width + x] = 1;
          }
        }
      }
    }
  }
  return mask;
}

// ─── Facial Zone Constants ──────────────────────────────────────────────────
// Zone IDs used in the zoneMask. 0 = not a zone (background / general face).
const ZONE_LEFT_EYE   = 1;
const ZONE_RIGHT_EYE  = 2;
const ZONE_NOSE       = 3;
const ZONE_LIPS       = 4;
const ZONE_LEFT_CHEEK = 5;
const ZONE_RIGHT_CHEEK= 6;
const ZONE_FOREHEAD   = 7;

// Max regions allowed per zone after post-merge cleanup.
const ZONE_MAX_REGIONS = {
  [ZONE_LEFT_EYE]:    4,
  [ZONE_RIGHT_EYE]:   4,
  [ZONE_NOSE]:        3,
  [ZONE_LIPS]:        3,
  [ZONE_LEFT_CHEEK]:  5,
  [ZONE_RIGHT_CHEEK]: 5,
  [ZONE_FOREHEAD]:    5,
};

// k-means cluster count per zone for pre-segmentation flattening.
const ZONE_FLATTEN_K = {
  [ZONE_LEFT_EYE]:    4,
  [ZONE_RIGHT_EYE]:   4,
  [ZONE_NOSE]:        3,
  [ZONE_LIPS]:        3,
  [ZONE_LEFT_CHEEK]:  4,
  [ZONE_RIGHT_CHEEK]: 4,
  [ZONE_FOREHEAD]:    4,
};

// ─── Build Facial Zone Masks ────────────────────────────────────────────────

/**
 * Build a per-pixel zone ID map from 68-point face landmarks.
 * Returns a Uint8Array where each pixel is 0 (no zone) or a ZONE_* constant.
 *
 * Zone derivation from landmarks:
 *   - Eyes: circular masks around iris center (radius = iris_diameter × 0.6)
 *   - Nose: convex hull of nose bridge (27-30) + nose bottom (31-35), expanded 20%
 *   - Lips: convex hull of outer lip (48-59), expanded 15%
 *   - Cheeks: triangular regions between eyes, nose, and jawline
 *   - Forehead: region above eyebrows, below top of face box
 *
 * Higher-priority zones (eyes, lips, nose) overwrite lower ones.
 */
function buildFacialZoneMasks(faces, width, height) {
  const zoneMap = new Uint8Array(width * height); // 0 everywhere

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Fill an ellipse in the zone map */
  function fillEllipse(cx, cy, rx, ry, zoneId) {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const x1 = Math.min(width - 1, Math.ceil(cx + rx));
    const y1 = Math.min(height - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          zoneMap[y * width + x] = zoneId;
        }
      }
    }
  }

  /** Fill a convex polygon (given as [{x,y},...]) with the given zoneId.
   *  Uses scanline: for each row, find min/max x of edges, fill between. */
  function fillPolygon(points, zoneId) {
    if (points.length < 3) return;
    const ys = points.map(p => p.y);
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)));

    for (let y = minY; y <= maxY; y++) {
      // Find all x-intersections of edges with this scanline
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          const t = (y - a.y) / (b.y - a.y);
          xs.push(a.x + t * (b.x - a.x));
        }
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      // Fill between pairs
      for (let p = 0; p < xs.length - 1; p += 2) {
        const x0 = Math.max(0, Math.floor(xs[p]));
        const x1 = Math.min(width - 1, Math.ceil(xs[p + 1]));
        for (let x = x0; x <= x1; x++) {
          zoneMap[y * width + x] = zoneId;
        }
      }
    }
  }

  /** Expand a set of points outward from their centroid by a factor */
  function expandPoints(points, factor) {
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    return points.map(p => ({
      x: cx + (p.x - cx) * factor,
      y: cy + (p.y - cy) * factor,
    }));
  }

  // ── Process each face ─────────────────────────────────────────────────

  for (const face of faces) {
    if (!face.landmarks) continue;
    const lm = face.landmarks;

    // ── Forehead (lowest priority — drawn first, overwritten by others) ──
    // Region above eyebrows. Top = face box top, bottom = eyebrow tops.
    const browTop = Math.min(
      ...lm.leftBrow.map(p => p.y),
      ...lm.rightBrow.map(p => p.y)
    );
    const browLeft = Math.min(lm.leftBrow[0].x, lm.rightBrow[0].x);
    const browRight = Math.max(
      lm.leftBrow[lm.leftBrow.length - 1].x,
      lm.rightBrow[lm.rightBrow.length - 1].x
    );
    const foreheadTop = Math.max(0, face.y);
    const foreheadPoly = [
      { x: browLeft,  y: foreheadTop },
      { x: browRight, y: foreheadTop },
      { x: browRight, y: browTop },
      { x: browLeft,  y: browTop },
    ];
    fillPolygon(foreheadPoly, ZONE_FOREHEAD);

    // ── Cheeks ──────────────────────────────────────────────────────────
    // Left cheek: between left eye, nose left, jawline left
    const noseTip = lm.noseBottom[2]; // bottom-center of nose
    const leftJaw  = lm.jawline[2];   // lower-left jawline
    const rightJaw = lm.jawline[14];  // lower-right jawline
    const leftEyeOuter  = lm.leftEye[0];
    const rightEyeOuter = lm.rightEye[3];
    const noseLeft  = lm.noseBottom[0];
    const noseRight = lm.noseBottom[4];

    const leftCheekPoly = [
      leftEyeOuter,
      noseLeft,
      { x: leftJaw.x, y: noseTip.y + (leftJaw.y - noseTip.y) * 0.5 },
      leftJaw,
      { x: leftEyeOuter.x - 10, y: leftEyeOuter.y },
    ];
    fillPolygon(leftCheekPoly, ZONE_LEFT_CHEEK);

    const rightCheekPoly = [
      rightEyeOuter,
      noseRight,
      { x: rightJaw.x, y: noseTip.y + (rightJaw.y - noseTip.y) * 0.5 },
      rightJaw,
      { x: rightEyeOuter.x + 10, y: rightEyeOuter.y },
    ];
    fillPolygon(rightCheekPoly, ZONE_RIGHT_CHEEK);

    // ── Nose (overwrites cheek where they overlap) ──────────────────────
    const noseAllPts = [...lm.noseBridge, ...lm.noseBottom];
    fillPolygon(expandPoints(noseAllPts, 1.2), ZONE_NOSE);

    // ── Lips (overwrites cheek where they overlap) ──────────────────────
    fillPolygon(expandPoints(lm.outerLip, 1.15), ZONE_LIPS);

    // ── Eyes (highest priority — overwrite everything) ──────────────────
    if (face.eyes) {
      for (let ei = 0; ei < face.eyes.length; ei++) {
        const eye = face.eyes[ei];
        fillEllipse(eye.cx, eye.cy, eye.rx, eye.ry,
          ei === 0 ? ZONE_LEFT_EYE : ZONE_RIGHT_EYE);
      }
    }
  }

  return zoneMap;
}

// ─── Zone-Aware Colour Flattening (pre-segmentation) ────────────────────────

/**
 * Flatten colour variation inside each facial zone to a limited number of
 * representative colours. Runs BEFORE the global k-means so the quantiser
 * sees flat blocks per zone instead of continuous gradients.
 *
 * For each zone, runs a mini k-means (k = ZONE_FLATTEN_K[zoneId]) in Lab
 * space, then replaces every pixel in that zone with its cluster centroid.
 *
 * @param {ImageData}  imageData – mutable; pixels are written in-place
 * @param {Uint8Array} zoneMap   – per-pixel zone ID (0 = no zone)
 * @param {number}     width
 * @param {number}     height
 * @returns {ImageData} same imageData, mutated
 */
function flattenZoneColors(imageData, zoneMap, width, height) {
  if (!zoneMap) return imageData;
  const { data } = imageData;
  const MAX_ITER = 20;

  // Collect pixel indices per zone
  const zonePixels = {};
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const z = zoneMap[i];
    if (z === 0) continue;
    if (!zonePixels[z]) zonePixels[z] = [];
    zonePixels[z].push(i);
  }

  for (const [zoneIdStr, pixels] of Object.entries(zonePixels)) {
    const zoneId = Number(zoneIdStr);
    const k = ZONE_FLATTEN_K[zoneId] || 4;
    if (pixels.length < k) continue;

    // Convert to Lab
    const labs = pixels.map(i => {
      const idx = i * 4;
      return rgbToLab(data[idx], data[idx + 1], data[idx + 2]);
    });

    // k-means++ init
    const rng = mulberry32(13 + zoneId + pixels.length);
    const centroids = [];
    centroids.push([...labs[Math.floor(rng() * labs.length)]]);

    for (let c = 1; c < k; c++) {
      const dists = labs.map(lab => {
        let minD = Infinity;
        for (const cen of centroids) {
          const d = deltaE(lab, cen);
          if (d < minD) minD = d;
        }
        return minD * minD;
      });
      const tot = dists.reduce((a, b) => a + b, 0);
      let r = rng() * tot;
      let chosen = labs.length - 1;
      for (let i = 0; i < labs.length; i++) {
        r -= dists[i];
        if (r <= 0) { chosen = i; break; }
      }
      centroids.push([...labs[chosen]]);
    }

    // Iterate
    const assignments = new Int32Array(labs.length);
    for (let iter = 0; iter < MAX_ITER; iter++) {
      let changed = 0;
      for (let i = 0; i < labs.length; i++) {
        let bestK = 0, bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const d = deltaE(labs[i], centroids[c]);
          if (d < bestD) { bestD = d; bestK = c; }
        }
        if (assignments[i] !== bestK) { assignments[i] = bestK; changed++; }
      }
      if (changed === 0 && iter > 0) break;

      const sums = Array.from({ length: k }, () => [0, 0, 0]);
      const counts = new Float64Array(k);
      for (let i = 0; i < labs.length; i++) {
        const c = assignments[i];
        sums[c][0] += labs[i][0];
        sums[c][1] += labs[i][1];
        sums[c][2] += labs[i][2];
        counts[c]++;
      }
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          centroids[c][0] = sums[c][0] / counts[c];
          centroids[c][1] = sums[c][1] / counts[c];
          centroids[c][2] = sums[c][2] / counts[c];
        }
      }
    }

    // Replace pixels with centroid colours
    const centroidRgb = centroids.map(lab => labToRgb(lab[0], lab[1], lab[2]));
    for (let i = 0; i < pixels.length; i++) {
      const idx = pixels[i] * 4;
      const [cr, cg, cb] = centroidRgb[assignments[i]];
      data[idx]     = cr;
      data[idx + 1] = cg;
      data[idx + 2] = cb;
    }
  }

  return imageData;
}

// ─── Zone-Aware Region Merge (post-segmentation) ────────────────────────────

/**
 * Post-segmentation: enforce per-zone region limits and block cross-zone merges.
 *
 * For each facial zone:
 *   1. Collect regions where >30% of pixels lie inside the zone
 *   2. Merge tiny fragments (<5% of zone area) into nearest-colour neighbour
 *      WITHIN the same zone
 *   3. If region count still exceeds ZONE_MAX_REGIONS, iteratively merge the
 *      closest-colour pair until the limit is met
 *
 * Cross-zone merges are blocked: a region primarily in ZONE_LIPS will never
 * be merged with a region primarily in ZONE_NOSE, preserving structural
 * facial boundaries.
 *
 * @param {Int32Array}  regionMap
 * @param {Array}       regions
 * @param {Int32Array}  colorAssign
 * @param {Array}       palette
 * @param {number}      width
 * @param {number}      height
 * @param {Uint8Array}  zoneMap
 */
function mergeZoneRegions(regionMap, regions, colorAssign, palette, width, height, zoneMap) {
  if (!zoneMap) return;
  const paletteLab = palette.map(c => c.lab);

  // Classify each region's primary zone (zone with most pixels)
  function primaryZone(r) {
    if (r.area === 0) return 0;
    const counts = {};
    for (const px of r.pixels) {
      const z = zoneMap[px];
      if (z === 0) continue;
      counts[z] = (counts[z] || 0) + 1;
    }
    let bestZ = 0, bestC = 0;
    for (const [z, c] of Object.entries(counts)) {
      if (c > bestC) { bestC = c; bestZ = Number(z); }
    }
    // Only classify if >30% of region is in the zone
    return bestC / r.area > 0.3 ? bestZ : 0;
  }

  // Process each zone independently
  for (const [zoneIdStr, maxRegions] of Object.entries(ZONE_MAX_REGIONS)) {
    const zoneId = Number(zoneIdStr);

    // Collect regions belonging to this zone
    const zoneRegs = regions.filter(r => r.area > 0 && primaryZone(r) === zoneId);
    if (zoneRegs.length <= 1) continue;

    // 1. Merge tiny fragments (<5% of zone total area) into nearest colour within zone
    const totalArea = zoneRegs.reduce((s, r) => s + r.area, 0);
    const minArea = Math.max(3, Math.floor(totalArea * 0.05));

    for (const r of zoneRegs) {
      if (r.area === 0 || r.area >= minArea) continue;
      let bestTarget = null, bestDist = Infinity;
      for (const t of zoneRegs) {
        if (t.area === 0 || t.id === r.id) continue;
        const d = deltaE(paletteLab[r.colorIndex], paletteLab[t.colorIndex]);
        if (d < bestDist) { bestDist = d; bestTarget = t; }
      }
      if (!bestTarget) continue;
      for (const px of r.pixels) {
        regionMap[px] = bestTarget.id;
        colorAssign[px] = bestTarget.colorIndex;
      }
      bestTarget.pixels.push(...r.pixels);
      bestTarget.area += r.area;
      r.pixels = [];
      r.area = 0;
    }

    // 2. Enforce max region count — merge closest-colour pairs
    let alive = zoneRegs.filter(r => r.area > 0);
    while (alive.length > maxRegions) {
      let bestI = -1, bestJ = -1, bestD = Infinity;
      for (let a = 0; a < alive.length; a++) {
        for (let b = a + 1; b < alive.length; b++) {
          const d = deltaE(paletteLab[alive[a].colorIndex], paletteLab[alive[b].colorIndex]);
          if (d < bestD) { bestD = d; bestI = a; bestJ = b; }
        }
      }
      if (bestI === -1) break;
      const [keep, absorb] = alive[bestI].area >= alive[bestJ].area
        ? [alive[bestI], alive[bestJ]]
        : [alive[bestJ], alive[bestI]];
      for (const px of absorb.pixels) {
        regionMap[px] = keep.id;
        colorAssign[px] = keep.colorIndex;
      }
      keep.pixels.push(...absorb.pixels);
      keep.area += absorb.area;
      absorb.pixels = [];
      absorb.area = 0;
      alive = alive.filter(r => r.area > 0);
    }
  }
}

// ─── Zone-Aware Majority Filter ─────────────────────────────────────────────

/**
 * Majority filter that respects zone boundaries: a pixel can only be
 * overwritten by the majority label of neighbours IN THE SAME ZONE.
 * Eye zones additionally use a smaller radius to preserve fine detail.
 */
function zoneAwareMajorityFilter(colorAssign, width, height, bgRadius, zoneMap) {
  const total = width * height;
  const out = new Int32Array(total);
  const counts = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const myZone = zoneMap ? zoneMap[i] : 0;
      // Eyes get smaller radius to preserve pupil/iris boundaries
      const r = (myZone === ZONE_LEFT_EYE || myZone === ZONE_RIGHT_EYE) ? 1 : bgRadius;
      counts.clear();
      let bestLabel = colorAssign[i], bestCount = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const ni = ny * width + nx;
          // Only count neighbours in the same zone (prevent cross-boundary bleed)
          if (zoneMap && zoneMap[ni] !== myZone) continue;
          const label = colorAssign[ni];
          const c = (counts.get(label) || 0) + 1;
          counts.set(label, c);
          if (c > bestCount) { bestCount = c; bestLabel = label; }
        }
      }
      out[i] = bestLabel;
    }
  }
  return out;
}

/**
 * Preprocess eye regions: apply a light bilateral smooth inside eye zones.
 * Uses EYE_SMOOTH_RADIUS and a tight σ_colour (15) so pupil boundaries,
 * eyelid shapes, and eyebrow edges are preserved while minor noise
 * inside the sclera / iris is reduced.
 */
function preprocessEyeRegions(imageData, eyeMask) {
  if (!eyeMask) return imageData;
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data);
  const radius = EYE_SMOOTH_RADIUS;        // configurable — default 1
  const sigmaColor = 15;                   // tight — preserve iris/lid/brow edges
  const sigmaColor2 = 2 * sigmaColor * sigmaColor;
  const sigmaSpace = Math.max(0.5, radius / 2);
  const sigmaSpace2 = 2 * sigmaSpace * sigmaSpace;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!eyeMask[i]) continue; // only process eye pixels
      const idx = i * 4;
      const cr = data[idx], cg = data[idx + 1], cb = data[idx + 2];
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          // Only average with other eye pixels to avoid bleeding
          if (!eyeMask[ny * width + nx]) continue;
          const nIdx = (ny * width + nx) * 4;
          const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
          const colorDist2 = (cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2;
          const spatDist2 = dx * dx + dy * dy;
          const w = Math.exp(-spatDist2 / sigmaSpace2 - colorDist2 / sigmaColor2);
          sumR += nr * w; sumG += ng * w; sumB += nb * w; sumW += w;
        }
      }
      if (sumW > 0) {
        out[idx]     = Math.round(sumR / sumW);
        out[idx + 1] = Math.round(sumG / sumW);
        out[idx + 2] = Math.round(sumB / sumW);
      }
    }
  }
  return new ImageData(out, width, height);
}

// ─── Eye-Aware Colour Flattening (pre-segmentation) ─────────────────────────

/**
 * Flatten colour variation inside each detected eye to at most 4 representative
 * colours (sclera, iris, pupil, eyelid shadow).  This runs BEFORE the global
 * k-means so the quantiser sees flat blocks instead of continuous gradients —
 * producing clean, coherent eye regions instead of concentric rings.
 *
 * Steps per eye:
 *   1. Collect all pixels inside the eye ellipse
 *   2. Mild bilateral smooth (radius 1, σ 15) — reduce noise
 *   3. Mini k-means (k=4) in Lab space on those pixels
 *   4. Replace each eye pixel's RGB with its cluster centroid
 *
 * @param {ImageData}   imageData  – mutable; pixels are written in-place
 * @param {Array}       faces      – face detection results with .eyes
 * @param {Uint8Array}  eyeMask    – binary eye mask
 * @returns {ImageData} imageData (same object, mutated)
 */
function flattenEyeColors(imageData, faces, eyeMask) {
  if (!eyeMask || !faces) return imageData;
  const { data, width, height } = imageData;
  const EYE_K = 4;
  const MAX_ITER = 20;

  for (const face of faces) {
    if (!face.eyes) continue;
    for (const eye of face.eyes) {
      const { cx, cy, rx, ry } = eye;

      // Collect eye pixel indices
      const x0 = Math.max(0, Math.floor(cx - rx));
      const y0 = Math.max(0, Math.floor(cy - ry));
      const x1 = Math.min(width - 1, Math.ceil(cx + rx));
      const y1 = Math.min(height - 1, Math.ceil(cy + ry));

      const eyePixels = []; // indices into flat pixel array
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * width + x;
          if (eyeMask[i]) eyePixels.push(i);
        }
      }
      if (eyePixels.length < EYE_K) continue;

      // Convert to Lab for clustering
      const labs = eyePixels.map(i => {
        const idx = i * 4;
        return rgbToLab(data[idx], data[idx + 1], data[idx + 2]);
      });

      // Mini k-means++ in Lab space
      const rng = mulberry32(7 + eyePixels.length);
      const centroids = [];
      centroids.push([...labs[Math.floor(rng() * labs.length)]]);

      for (let c = 1; c < EYE_K; c++) {
        const dists = labs.map(lab => {
          let minD = Infinity;
          for (const cen of centroids) {
            const d = deltaE(lab, cen);
            if (d < minD) minD = d;
          }
          return minD * minD;
        });
        const total = dists.reduce((a, b) => a + b, 0);
        let r = rng() * total;
        let chosen = labs.length - 1;
        for (let i = 0; i < labs.length; i++) {
          r -= dists[i];
          if (r <= 0) { chosen = i; break; }
        }
        centroids.push([...labs[chosen]]);
      }

      // Iterate
      const assignments = new Int32Array(labs.length);
      for (let iter = 0; iter < MAX_ITER; iter++) {
        let changed = 0;
        for (let i = 0; i < labs.length; i++) {
          let bestK = 0, bestD = Infinity;
          for (let c = 0; c < EYE_K; c++) {
            const d = deltaE(labs[i], centroids[c]);
            if (d < bestD) { bestD = d; bestK = c; }
          }
          if (assignments[i] !== bestK) { assignments[i] = bestK; changed++; }
        }
        if (changed === 0 && iter > 0) break;

        const sums = Array.from({ length: EYE_K }, () => [0, 0, 0]);
        const counts = new Float64Array(EYE_K);
        for (let i = 0; i < labs.length; i++) {
          const c = assignments[i];
          sums[c][0] += labs[i][0];
          sums[c][1] += labs[i][1];
          sums[c][2] += labs[i][2];
          counts[c]++;
        }
        for (let c = 0; c < EYE_K; c++) {
          if (counts[c] > 0) {
            centroids[c][0] = sums[c][0] / counts[c];
            centroids[c][1] = sums[c][1] / counts[c];
            centroids[c][2] = sums[c][2] / counts[c];
          }
        }
      }

      // Convert centroids to RGB
      const centroidRgb = centroids.map(lab => labToRgb(lab[0], lab[1], lab[2]));

      // Replace each eye pixel with its cluster centroid colour
      for (let i = 0; i < eyePixels.length; i++) {
        const idx = eyePixels[i] * 4;
        const [cr, cg, cb] = centroidRgb[assignments[i]];
        data[idx]     = cr;
        data[idx + 1] = cg;
        data[idx + 2] = cb;
      }
    }
  }

  return imageData;
}

/**
 * Post-segmentation pass: clean up eye regions.
 *
 * Inside detected eye zones:
 * 1. Identify all regions that overlap the eye mask
 * 2. Classify eye-region pixels into semantic groups by luminance
 * 3. Force-merge fragments within each semantic group
 * 4. Merge any remaining tiny fragments into closest group
 * 5. Limit each eye to at most 4 palette colours
 */
function mergeEyeRegions(regionMap, regions, colorAssign, palette, width, height, eyeMask, faces) {
  if (!eyeMask || !faces) return;
  const paletteLab = palette.map(c => c.lab);

  // For each eye ellipse, process regions inside it
  for (const face of faces) {
    if (!face.eyes) continue;
    for (const eye of face.eyes) {
      const { cx, cy, rx, ry } = eye;

      // Collect all regions that have >30% of their pixels inside this eye
      const eyeRegionIds = new Set();
      for (const r of regions) {
        if (r.area === 0) continue;
        let insideCount = 0;
        for (const px of r.pixels) {
          if (eyeMask[px]) insideCount++;
        }
        if (insideCount / r.area > 0.3) eyeRegionIds.add(r.id);
      }
      if (eyeRegionIds.size <= 1) continue;

      const eyeRegs = regions.filter(r => eyeRegionIds.has(r.id) && r.area > 0);

      // Classify each eye region into 5 semantic bands by average luminance
      const classifyRegion = (r) => {
        let totalLum = 0;
        for (const px of r.pixels) {
          const c = palette[colorAssign[px]];
          totalLum += 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        }
        const avgLum = totalLum / r.area;
        if (avgLum > 225) return 'highlight';  // specular highlight
        if (avgLum > 175) return 'sclera';      // eye white
        if (avgLum > 100) return 'shadow';      // lid crease / shadow
        if (avgLum > 55)  return 'iris';         // iris mid-range
        return 'pupil';                          // darkest: pupil / lash line
      };

      const groups = { highlight: [], sclera: [], shadow: [], iris: [], pupil: [] };
      for (const r of eyeRegs) {
        groups[classifyRegion(r)].push(r);
      }

      // Helper: merge an array of regions into the largest one
      const mergeGroup = (group) => {
        if (group.length <= 1) return;
        group.sort((a, b) => b.area - a.area);
        const target = group[0];
        for (let i = 1; i < group.length; i++) {
          const small = group[i];
          for (const px of small.pixels) {
            regionMap[px] = target.id;
            colorAssign[px] = target.colorIndex;
          }
          target.pixels.push(...small.pixels);
          target.area += small.area;
          small.pixels = [];
          small.area = 0;
        }
      };

      // 1. Merge fragments within each semantic group
      mergeGroup(groups.highlight);
      mergeGroup(groups.sclera);
      mergeGroup(groups.shadow);
      mergeGroup(groups.iris);
      mergeGroup(groups.pupil);

      // 2. Merge any remaining tiny fragments (<5% of eye area) into closest group
      const totalEyeArea = eyeRegs.reduce((s, r) => s + r.area, 0);
      const eyeMinArea = Math.max(3, Math.floor(totalEyeArea * 0.05));

      for (const r of eyeRegs) {
        if (r.area === 0 || r.area >= eyeMinArea) continue;
        let bestTarget = null, bestDist = Infinity;
        for (const t of eyeRegs) {
          if (t.area === 0 || t.id === r.id) continue;
          const d = deltaE(paletteLab[r.colorIndex], paletteLab[t.colorIndex]);
          if (d < bestDist) { bestDist = d; bestTarget = t; }
        }
        if (!bestTarget) continue;
        for (const px of r.pixels) {
          regionMap[px] = bestTarget.id;
          colorAssign[px] = bestTarget.colorIndex;
        }
        bestTarget.pixels.push(...r.pixels);
        bestTarget.area += r.area;
        r.pixels = [];
        r.area = 0;
      }

      // 3. Limit eye to 4 colours max — merge closest pair
      const aliveInEye = eyeRegs.filter(r => r.area > 0);
      while (aliveInEye.filter(r => r.area > 0).length > 4) {
        const alive = aliveInEye.filter(r => r.area > 0);
        let bestI = -1, bestJ = -1, bestD = Infinity;
        for (let a = 0; a < alive.length; a++) {
          for (let b = a + 1; b < alive.length; b++) {
            const d = deltaE(paletteLab[alive[a].colorIndex], paletteLab[alive[b].colorIndex]);
            if (d < bestD) { bestD = d; bestI = a; bestJ = b; }
          }
        }
        if (bestI === -1) break;
        const [keep, absorb] = alive[bestI].area >= alive[bestJ].area
          ? [alive[bestI], alive[bestJ]]
          : [alive[bestJ], alive[bestI]];
        for (const px of absorb.pixels) {
          regionMap[px] = keep.id;
          colorAssign[px] = keep.colorIndex;
        }
        keep.pixels.push(...absorb.pixels);
        keep.area += absorb.area;
        absorb.pixels = [];
        absorb.area = 0;
      }
    }
  }
}

// ─── Face-Aware K-Means Quantisation ────────────────────────────────────────

/**
 * Simple foreground / background palette split.
 *
 * Foreground (inside face mask): 24 colours — captures skin, hair, eyes, etc.
 * Background (outside face mask): 6 colours — keeps backdrop clean.
 *
 * Each zone is quantised independently so background colours never bleed in.
 */
function faceAwareKMeansQuantise(imageData, baseK, faceMask, skinMask) {
  const { data, width, height } = imageData;
  const totalPixels = width * height;

  const fgSamples = [];
  const bgSamples = [];
  const sampleRate = Math.max(1, Math.floor(totalPixels / 50000));
  for (let i = 0; i < totalPixels; i += sampleRate) {
    const idx = i * 4;
    const px = [data[idx], data[idx + 1], data[idx + 2]];
    if (faceMask[i] > 0.5) fgSamples.push(px);
    else bgSamples.push(px);
  }

  // If no face detected, fall back to standard quantisation
  if (fgSamples.length < 10) {
    return kMeansQuantise(imageData, baseK);
  }

  function samplesToImageData(samples) {
    const buf = new Uint8ClampedArray(samples.length * 4);
    samples.forEach(([r, g, b], i) => {
      buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255;
    });
    return new ImageData(buf, samples.length, 1);
  }

  const FG_K = 24;
  const BG_K = 6;

  const merged = [];

  // Foreground palette — 24 colours for all subject detail
  const fgPalette = kMeansQuantise(samplesToImageData(fgSamples), FG_K);

  // ── Skin-tone lightness bias ────────────────────────────────────────
  //    After clustering, nudge skin-tone centroids toward higher L and
  //    clamp excessively dark skin clusters so portraits stay clean.
  const SKIN_L_UPLIFT  = 3.0;   // add to L of skin centroids
  const SKIN_L_FLOOR   = 42;    // minimum L for non-feature skin clusters
  for (const c of fgPalette) {
    const [L, a, b] = c.lab;
    // Only bias colours that look like skin (not eyes/hair/lips)
    if (L >= 30 && L < 90 && a >= 2 && a <= 30 && b >= 2 && b <= 45) {
      // Skip very dark clusters — they belong to pupils / eyelashes / brows
      // (features have low L and often extreme a*/b*)
      if (L < SKIN_L_FLOOR) {
        // Clamp: lift to floor unless it's clearly a dark feature (low chroma)
        const chroma = Math.sqrt(a * a + b * b);
        if (chroma < 15) continue; // low chroma + dark = pupil/liner → skip
        c.lab[0] = SKIN_L_FLOOR;
      } else {
        c.lab[0] = Math.min(L + SKIN_L_UPLIFT, 92);
      }
      // Re-derive RGB from adjusted Lab
      const [nr, ng, nb] = labToRgb(c.lab[0], c.lab[1], c.lab[2]);
      c.r = nr; c.g = ng; c.b = nb;
      c.hex = rgbToHex(nr, ng, nb);
    }
  }

  merged.push(...fgPalette);

  // Background palette — 6 colours to keep it clean
  if (bgSamples.length >= 10) {
    const bgPalette = kMeansQuantise(samplesToImageData(bgSamples), BG_K);
    for (const c of bgPalette) {
      c.bg = true;  // tag so assignPixels constrains bg pixels
      merged.push(c);
    }
  }

  return merged;
}

// ─── Face-Aware Small Region Merging ────────────────────────────────────────

/**
 * Wrapper around mergeSmallRegions that uses a smaller minArea threshold
 * inside face regions so fine facial details (eyes, lips, nose highlights)
 * are preserved, while background regions use the normal user-selected level.
 *
 * Strategy: two-pass merge.
 *   Pass 1 — merge only NON-FACE small regions (normal minArea).
 *   Pass 2 — merge only FACE small regions (minArea * 0.3).
 */
function faceAwareMergeSmallRegions(regionMap, regions, colorAssign, palette, width, height, minArea, faceMask, eyeMask, skinMask, edgeMap = null) {

  // ── O(1) region lookup by id ──────────────────────────────────────────
  const regionById = new Map();
  for (const r of regions) regionById.set(r.id, r);

  /**
   * RGB Euclidean distance between two palette colours.
   */
  function rgbDistance(cA, cB) {
    return Math.sqrt(
      (cA.r - cB.r) ** 2 +
      (cA.g - cB.g) ** 2 +
      (cA.b - cB.b) ** 2
    );
  }

  // Classify each region as "face" if >50% of its pixels lie inside the face mask
  function isFaceRegion(region) {
    if (region.area === 0) return false;
    let faceCount = 0;
    for (const px of region.pixels) {
      if (faceMask[px] > 0.5) faceCount++;
    }
    return faceCount / region.area > 0.5;
  }

  // Classify each region as "eye" if >30% of its pixels lie inside the eye mask
  function isEyeRegion(region) {
    if (!eyeMask || region.area === 0) return false;
    let eyeCount = 0;
    for (const px of region.pixels) {
      if (eyeMask[px]) eyeCount++;
    }
    return eyeCount / region.area > 0.3;
  }

  // ── Skin-region detection for lightness-biased merging ────────────────
  //    A region is "skin" if it's inside the face mask AND inside the
  //    skin mask — i.e. NOT eyes, eyebrows, mouth, or hair.
  function isSkinRegion(region) {
    if (!skinMask || region.area === 0) return false;
    let skinCount = 0;
    for (const px of region.pixels) {
      if (skinMask[px]) skinCount++;
    }
    return skinCount / region.area > 0.5;
  }

  /**
   * Shared merge helper — iteratively absorbs undersized regions matching
   * the supplied `filterFn` predicate.
   *
   * For SKIN regions the merge target selection uses Lab distance with a
   * lightness bias:
   *   1) closest Lab colour distance (ΔE)
   *   2) higher L value (lighter colour preferred)
   *   3) larger neighbouring region
   * Darker skin regions always merge INTO lighter neighbours, never the
   * reverse.  This prevents muddy shadows from swallowing clean skin.
   *
   * For non-skin regions the original RGB-distance + area logic is used.
   *
   * @param {number}   threshold  – minimum area for this pass
   * @param {Function} filterFn   – (region) => bool — true if region is a candidate
   * @param {Function} [neighbourFilterFn] – optional filter for valid merge targets
   */
  function mergePass(threshold, filterFn, neighbourFilterFn = null) {
    let changed = true;
    while (changed) {
      changed = false;
      const smallRegions = regions
        .filter(r => r.area > 0 && r.area < threshold && filterFn(r))
        .sort((a, b) => a.area - b.area);

      if (smallRegions.length === 0) break;

      for (const small of smallRegions) {
        if (small.area === 0 || small.area >= threshold) continue;

        // Discover boundary neighbours
        const neighbourInfo = new Map();
        for (const px of small.pixels) {
          const x = px % width;
          const y = Math.floor(px / width);
          const adj = [];
          if (x > 0)           adj.push(px - 1);
          if (x < width - 1)   adj.push(px + 1);
          if (y > 0)           adj.push(px - width);
          if (y < height - 1)  adj.push(px + width);

          for (const n of adj) {
            const nLabel = regionMap[n];
            if (nLabel === small.id || nLabel === -1) continue;
            if (!neighbourInfo.has(nLabel)) {
              const nRegion = regionById.get(nLabel);
              if (nRegion && nRegion.area > 0) {
                // Apply optional neighbour filter (e.g. bg-only for pass 1)
                if (neighbourFilterFn && !neighbourFilterFn(nRegion)) continue;
                neighbourInfo.set(nLabel, {
                  colorIndex: nRegion.colorIndex,
                  borderLen:  0,
                  area:       nRegion.area,
                  edgeSum:    0
                });
              }
            }
            const entry = neighbourInfo.get(nLabel);
            if (entry) {
              entry.borderLen++;
              if (edgeMap) {
                entry.edgeSum += Math.max(edgeMap[px], edgeMap[n]);
              }
            }
          }
        }
        if (neighbourInfo.size === 0) continue;

        let bestNeighbour = -1;

        // Pick nearest colour neighbour, preferring larger areas on ties
        const smallLab = palette[small.colorIndex].lab;
        let bestDist = Infinity, bestArea = -1;
        for (const [nId, info] of neighbourInfo) {
          if (edgeMap && info.borderLen > 0) {
            const avgEdge = info.edgeSum / info.borderLen;
            if (avgEdge > EDGE_STRENGTH_THRESHOLD) continue;
          }
          const dist = deltaE(smallLab, palette[info.colorIndex].lab);
          if (dist < bestDist || (dist === bestDist && info.area > bestArea)) {
            bestDist      = dist;
            bestArea      = info.area;
            bestNeighbour = nId;
          }
        }

        if (bestNeighbour === -1) continue;

        // Merge small → target
        const target = regionById.get(bestNeighbour);
        if (!target) continue;
        for (const px of small.pixels) {
          regionMap[px]   = bestNeighbour;
          colorAssign[px] = target.colorIndex;
        }
        target.pixels.push(...small.pixels);
        target.area += small.area;
        small.pixels = [];
        small.area   = 0;
        changed = true;
      }
    }
  }

  // ── Pass 1: merge small NON-FACE regions (normal minArea) ─────────────
  //    Only merge bg regions into other bg neighbours — never into fg.
  mergePass(
    minArea,
    r => !isFaceRegion(r),              // candidate: background regions
    nr => !isFaceRegion(nr)             // target:    also background only
  );

  // ── Pass 2: merge small FACE regions (minArea × 0.5) ──────────────────
  //    Skip eye regions — handled separately by mergeEyeRegions (step 7b).
  //    0.5× (was 0.3×) to absorb more gradient fragments in the peri-orbital
  //    area (eye sockets, brow bone) which falls inside the face mask but
  //    outside the tight eye-mask ellipse.
  const faceMinArea = Math.max(5, Math.floor(minArea * 0.5));
  mergePass(
    faceMinArea,
    r => isFaceRegion(r) && !isEyeRegion(r),  // candidate: face, non-eye
    null                                        // target:    any neighbour
  );

  const valid = regions.filter(r => r.area > 0);
  valid.forEach(r => { r.displayNumber = r.colorIndex + 1; });
  return { regionMap, regions: valid, colorAssign };
}

// ─── Region-Level Palette Mapping ───────────────────────────────────────────

/**
 * For each region, compute its average RGB from imageData, then find the
 * nearest MASTER_PALETTE colour using Lab distance. Assigns region.colorIndex
 * to the master palette index and region.displayNumber = index + 1.
 */
// Skin-tone palette indices (first and last skin entry in MASTER_PALETTE)
const SKIN_START = 5;   // 'Porcelain'
const SKIN_END   = 26;  // 'Deep Shadow' (inclusive — covers original 12 + 10 new skin tones)

/** Detect whether a Lab colour is likely a skin tone */
function isSkinLab(lab) {
  const [L, a, b] = lab;
  // Skin heuristic: moderate lightness, slightly positive a (red), positive b (yellow)
  return L > 35 && L < 90 && a > 2 && a < 28 && b > 5 && b < 40;
}

function mapRegionsToMasterPalette(regions, imageData) {
  const { data, width } = imageData;
  for (const region of regions) {
    if (region.area === 0) continue;
    // Compute average RGB of the region
    let sumR = 0, sumG = 0, sumB = 0;
    for (const px of region.pixels) {
      const idx = px * 4;
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
    }
    const avgR = Math.round(sumR / region.area);
    const avgG = Math.round(sumG / region.area);
    const avgB = Math.round(sumB / region.area);
    const avgLab = rgbToLab(avgR, avgG, avgB);

    // Find nearest master palette colour (pure Lab ΔE — no biases)
    let bestIdx = 0, bestD = Infinity;
    for (let i = 0; i < MASTER_PALETTE.length; i++) {
      const d = deltaE(avgLab, MASTER_PALETTE[i].lab);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    region.colorIndex = bestIdx;
    region.displayNumber = bestIdx + 1;
  }
}

// ─── Merge Neighbouring Regions with Same Palette Colour ────────────────────

/**
 * After palette mapping, adjacent regions may share the same colour.
 * Merge them by absorbing smaller regions into their largest same-colour
 * neighbour. Uses regionMap for adjacency.
 */
function mergeSameColourNeighbours(regionMap, regions, width, height) {
  const byId = new Map();
  for (const r of regions) byId.set(r.id, r);

  // Build adjacency once by scanning the regionMap.  For each pixel whose
  // 4-neighbour belongs to a different region, record the pair.  This is
  // O(width × height) — much faster than iterating every region's pixel list.
  const adjacency = new Map();                // regionId → Set<regionId>
  for (const r of regions) {
    if (r.area > 0) adjacency.set(r.id, new Set());
  }
  const totalPixels = width * height;
  for (let i = 0; i < totalPixels; i++) {
    const id = regionMap[i];
    if (id === -1) continue;
    const x = i % width;
    // Only check right and down to avoid counting each edge twice
    if (x < width - 1) {
      const rId = regionMap[i + 1];
      if (rId !== id && rId !== -1) {
        adjacency.get(id)?.add(rId);
        adjacency.get(rId)?.add(id);
      }
    }
    if (i + width < totalPixels) {
      const bId = regionMap[i + width];
      if (bId !== id && bId !== -1) {
        adjacency.get(id)?.add(bId);
        adjacency.get(bId)?.add(id);
      }
    }
  }

  // Collect all same-colour adjacent pairs into a work queue.
  // Process them without rebuilding adjacency from scratch each time.
  const pairSet = new Set();
  const queue = [];
  function pairKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }
  for (const [rId, neighbours] of adjacency) {
    const r = byId.get(rId);
    if (!r || r.area === 0) continue;
    for (const nId of neighbours) {
      const nr = byId.get(nId);
      if (!nr || nr.area === 0) continue;
      if (r.colorIndex === nr.colorIndex) {
        const pk = pairKey(rId, nId);
        if (!pairSet.has(pk)) {
          pairSet.add(pk);
          queue.push([rId, nId]);
        }
      }
    }
  }

  // Process queue: merge each same-colour pair
  while (queue.length > 0) {
    const [aId, bId] = queue.pop();
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b || a.area === 0 || b.area === 0) continue;
    if (a.colorIndex !== b.colorIndex) continue;  // colour may have changed

    // Merge smaller into larger
    const [keep, absorb] = a.area >= b.area ? [a, b] : [b, a];
    for (const px of absorb.pixels) {
      regionMap[px] = keep.id;
    }
    keep.pixels.push(...absorb.pixels);
    keep.area += absorb.area;

    // Transfer absorb's adjacency to keep and enqueue any new same-colour pairs
    const absorbAdj = adjacency.get(absorb.id);
    if (absorbAdj) {
      for (const nId of absorbAdj) {
        if (nId === keep.id) continue;
        // Point neighbour away from absorb → keep
        const nAdj = adjacency.get(nId);
        if (nAdj) {
          nAdj.delete(absorb.id);
          nAdj.add(keep.id);
        }
        // Add to keep's adjacency
        adjacency.get(keep.id)?.add(nId);
        // If this neighbour has the same colour as keep, enqueue the pair
        const nr = byId.get(nId);
        if (nr && nr.area > 0 && nr.colorIndex === keep.colorIndex) {
          const pk = pairKey(keep.id, nId);
          if (!pairSet.has(pk)) {
            pairSet.add(pk);
            queue.push([keep.id, nId]);
          }
        }
      }
    }
    // Remove absorb from adjacency
    adjacency.delete(absorb.id);
    adjacency.get(keep.id)?.delete(absorb.id);
    absorb.pixels = [];
    absorb.area = 0;
  }

  return regions.filter(r => r.area > 0);
}

// ─── Contour Tracing (Marching Squares) ─────────────────────────────────────

/**
 * Trace the outer boundary of a binary mask using marching squares.
 * Returns an array of {x, y} points forming a closed polygon.
 */
function traceRegionContour(mask, width, height) {
  // mask is a Uint8Array where 1 = inside region, 0 = outside
  const getVal = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return mask[y * width + x];
  };

  const contourPoints = [];
  let startX = -1, startY = -1;

  // Find first boundary pixel
  outer: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (getVal(x, y) === 1 && (x === 0 || getVal(x - 1, y) === 0)) {
        startX = x;
        startY = y;
        break outer;
      }
    }
  }
  if (startX === -1) return [];

  // Moore boundary tracing
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];
  let cx = startX, cy = startY, dir = 7;
  const maxSteps = width * height;
  let steps = 0;
  const visited = new Set();

  do {
    const key = `${cx},${cy}`;
    if (!visited.has(key) || contourPoints.length < 3) {
      contourPoints.push({ x: cx, y: cy });
      visited.add(key);
    }

    let found = false;
    const searchStart = (dir + 5) % 8;
    for (let i = 0; i < 8; i++) {
      const d = (searchStart + i) % 8;
      const nx = cx + dx[d];
      const ny = cy + dy[d];
      if (getVal(nx, ny) === 1) {
        cx = nx;
        cy = ny;
        dir = d;
        found = true;
        break;
      }
    }
    if (!found) break;
    steps++;
  } while ((cx !== startX || cy !== startY) && steps < maxSteps);

  return contourPoints;
}

// ─── Douglas-Peucker Path Simplification ────────────────────────────────────

function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;

  // Iterative Douglas-Peucker (avoids stack overflow on long chains)
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    if (end - start < 2) continue;

    let maxDist = 0, maxIdx = start;
    const first = points[start], last = points[end];
    for (let i = start + 1; i < end; i++) {
      const d = perpDist(points[i], first, last);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }

    if (maxDist > tolerance) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  const result = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

function perpDist(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
  const cx = lineStart.x + u * dx;
  const cy = lineStart.y + u * dy;
  return Math.hypot(point.x - cx, point.y - cy);
}

// ─── Chaikin Corner-Cutting Smoothing ────────────────────────────────────────

/**
 * One iteration of Chaikin subdivision: replaces each edge with two new
 * points at 25% and 75%, removing pixel staircase artifacts.
 */
function chaikinSmooth(points, isClosed) {
  if (points.length < 3) return points;
  const out = [];
  const n = isClosed ? points.length : points.length - 1;
  if (!isClosed) out.push(points[0]);
  for (let i = 0; i < n; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    out.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
    out.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
  }
  if (!isClosed) out.push(points[points.length - 1]);
  return out;
}

// ─── Smoothed Boundary Path Extraction ──────────────────────────────────────

/**
 * Extract all region boundary edges in crack-grid space (pixel-corner grid),
 * chain them into polylines, apply Chaikin smoothing + Douglas–Peucker
 * simplification. Returns an SVG path data string.
 */
function buildSmoothedBoundaryPath(regionIdMap, width, height, tolerance = 2.0) {
  const W1 = width + 1; // crack grid width

  // Build adjacency list in crack-grid vertex space
  // Vertex key = gy * W1 + gx (grid point at pixel corner)
  const adjList = new Map();

  function addEdge(gx1, gy1, gx2, gy2) {
    const k1 = gy1 * W1 + gx1;
    const k2 = gy2 * W1 + gx2;
    if (!adjList.has(k1)) adjList.set(k1, []);
    if (!adjList.has(k2)) adjList.set(k2, []);
    adjList.get(k1).push(k2);
    adjList.get(k2).push(k1);
  }

  // Horizontal boundary edges (between pixel rows y-1 and y)
  for (let y = 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (regionIdMap[(y - 1) * width + x] !== regionIdMap[y * width + x]) {
        addEdge(x, y, x + 1, y);
      }
    }
  }

  // Vertical boundary edges (between pixel columns x-1 and x)
  for (let x = 1; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (regionIdMap[y * width + (x - 1)] !== regionIdMap[y * width + x]) {
        addEdge(x, y, x, y + 1);
      }
    }
  }

  // Remove one occurrence of val from array
  function removeOne(arr, val) {
    const idx = arr.indexOf(val);
    if (idx !== -1) arr.splice(idx, 1);
  }

  // Trace chains by consuming edges; prefer straight continuation at junctions
  const chains = [];

  for (const [startKey] of adjList) {
    while (adjList.get(startKey) && adjList.get(startKey).length > 0) {
      const chain = [];
      let current = startKey;
      chain.push({ x: current % W1, y: Math.floor(current / W1) });

      // Pick first available neighbour
      const firstNbr = adjList.get(current)[0];
      removeOne(adjList.get(current), firstNbr);
      removeOne(adjList.get(firstNbr), current);
      current = firstNbr;

      while (true) {
        chain.push({ x: current % W1, y: Math.floor(current / W1) });

        if (current === startKey) break; // closed loop

        const nbrs = adjList.get(current);
        if (!nbrs || nbrs.length === 0) break;

        // Prefer continuing straight (dot product with current direction)
        const prev = chain[chain.length - 2];
        const cur = chain[chain.length - 1];
        const dxDir = cur.x - prev.x;
        const dyDir = cur.y - prev.y;

        let bestNbr = nbrs[0];
        let bestDot = -Infinity;
        for (const n of nbrs) {
          const nx = n % W1;
          const ny = Math.floor(n / W1);
          const dot = dxDir * (nx - cur.x) + dyDir * (ny - cur.y);
          if (dot > bestDot) { bestDot = dot; bestNbr = n; }
        }

        removeOne(nbrs, bestNbr);
        removeOne(adjList.get(bestNbr), current);
        current = bestNbr;
      }

      if (chain.length >= 2) chains.push(chain);
    }
  }

  // Smooth & simplify each chain, then build SVG path data
  let d = '';
  for (const chain of chains) {
    const isClosed = chain.length > 2 &&
      chain[0].x === chain[chain.length - 1].x &&
      chain[0].y === chain[chain.length - 1].y;

    // Remove duplicate closing point for processing
    let pts = isClosed ? chain.slice(0, -1) : chain;

    // Chaikin smoothing (1 pass — removes pixel staircasing)
    pts = chaikinSmooth(pts, isClosed);

    // Douglas–Peucker simplification
    if (isClosed && pts.length > 2) {
      pts.push(pts[0]);
      pts = simplifyPath(pts, tolerance);
      if (pts.length > 1) pts = pts.slice(0, -1);
    } else {
      pts = simplifyPath(pts, tolerance);
    }

    if (pts.length < 2) continue;

    d += `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += `L${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
    }
    if (isClosed) d += 'Z';
  }

  return d;
}

// ─── SVG Generation ─────────────────────────────────────────────────────────

function buildPbnSvg(regions, palette, width, height, colorAssign, showNumbers = true) {
  // ── 1. Build per-pixel region-ID map from region pixel lists ───────────
  const regionIdMap = new Int32Array(width * height).fill(-1);
  for (const region of regions) {
    if (region.area === 0) continue;
    for (const px of region.pixels) regionIdMap[px] = region.id;
  }

  // ── 2. Collect scanline runs per region (single pass, O(w*h)) ─────────
  const runsPerRegion = new Map();
  for (const region of regions) {
    if (region.area > 0) runsPerRegion.set(region.id, []);
  }
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const rid = regionIdMap[y * width + x];
      if (rid !== -1) {
        const x1 = x;
        while (x < width && regionIdMap[y * width + x] === rid) x++;
        runsPerRegion.get(rid).push({ x1, x2: x, y });
      } else {
        x++;
      }
    }
  }

  // ── 3. Merge adjacent rows with identical x-span into taller rects ────
  function mergeVert(runs) {
    if (runs.length === 0) return [];
    const groups = new Map();
    for (const r of runs) {
      const key = `${r.x1},${r.x2}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const out = [];
    for (const grp of groups.values()) {
      grp.sort((a, b) => a.y - b.y);
      let cur = { x1: grp[0].x1, x2: grp[0].x2, y: grp[0].y, yEnd: grp[0].y + 1 };
      for (let i = 1; i < grp.length; i++) {
        if (grp[i].y === cur.yEnd) {
          cur.yEnd = grp[i].y + 1;
        } else {
          out.push(cur);
          cur = { x1: grp[i].x1, x2: grp[i].x2, y: grp[i].y, yEnd: grp[i].y + 1 };
        }
      }
      out.push(cur);
    }
    return out;
  }

  // ── 4. Build SVG ──────────────────────────────────────────────────────
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:#fff">`;

  // Region fills (pixel-perfect scanline rects — no gaps possible)
  for (const region of regions) {
    if (region.area === 0) continue;
    const runs = runsPerRegion.get(region.id);
    if (!runs || runs.length === 0) continue;
    const merged = mergeVert(runs);
    const col = palette[region.colorIndex];
    let d = '';
    for (const r of merged) {
      d += `M${r.x1},${r.y}H${r.x2}V${r.yEnd}H${r.x1}Z`;
    }
    svg += `<path d="${d}" fill="${col.hex}" />`;
  }

  // Region boundary lines (smoothed and simplified)
  const bd = buildSmoothedBoundaryPath(regionIdMap, width, height, 2.0);
  if (bd) {
    svg += `<path d="${bd}" fill="none" stroke="#444" stroke-width="0.4" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  // Number labels — placed at pole of inaccessibility (deepest interior point)
  if (showNumbers) {
    const labelPos = computeLabelPositions(regions, regionIdMap, width, height);
    for (const region of regions) {
      if (region.area < (width * height * 0.002)) continue;
      const pos = labelPos.get(region.id);
      if (!pos) continue;
      const margin = 4;
      const cx = Math.max(margin, Math.min(width - margin, pos.x));
      const cy = Math.max(margin, Math.min(height - margin, pos.y));
      // Keep numbers small and consistent — never bigger than 10px
      const fontSize = Math.max(5, Math.min(10, pos.innerRadius * 0.7));
      const col = palette[region.colorIndex];
      const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
      const textCol = lum > 140 ? '#222' : '#fff';
      // White halo for readability
      svg += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="Arial,sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="bold" fill="${textCol}" stroke="#fff" stroke-width="1.5" paint-order="stroke fill" text-anchor="middle" dominant-baseline="central" style="pointer-events:none">${region.displayNumber}</text>`;
    }
  }

  svg += '</svg>';
  return svg;
}

function computeCentroid(pixels, width) {
  if (pixels.length === 0) return null;
  let sx = 0, sy = 0;
  for (const p of pixels) {
    sx += p % width;
    sy += Math.floor(p / width);
  }
  return { x: sx / pixels.length, y: sy / pixels.length };
}

/**
 * Find the best label position for every region — the interior point
 * furthest from any region boundary (pole of inaccessibility).
 * Uses a BFS distance transform seeded from all boundary pixels.
 * Returns Map<regionId, { x, y, innerRadius }>.
 */
function computeLabelPositions(regions, regionIdMap, width, height) {
  const total = width * height;
  const dist = new Int16Array(total);          // 0 = unvisited
  const queue = new Int32Array(total);
  let head = 0, tail = 0;

  // Seed: every pixel that sits on a region boundary or image edge
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const rid = regionIdMap[idx];
      if (rid === -1) continue;               // unassigned pixel
      const onEdge =
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        regionIdMap[idx - 1] !== rid || regionIdMap[idx + 1] !== rid ||
        regionIdMap[idx - width] !== rid || regionIdMap[idx + width] !== rid;
      if (onEdge) { dist[idx] = 1; queue[tail++] = idx; }
    }
  }

  // BFS inward — dist grows the further we get from boundaries
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;
    const nd = dist[idx] + 1;
    const rid = regionIdMap[idx];
    if (x > 0          && dist[idx - 1] === 0     && regionIdMap[idx - 1] === rid)     { dist[idx - 1] = nd;     queue[tail++] = idx - 1; }
    if (x < width - 1  && dist[idx + 1] === 0     && regionIdMap[idx + 1] === rid)     { dist[idx + 1] = nd;     queue[tail++] = idx + 1; }
    if (y > 0          && dist[idx - width] === 0 && regionIdMap[idx - width] === rid) { dist[idx - width] = nd; queue[tail++] = idx - width; }
    if (y < height - 1 && dist[idx + width] === 0 && regionIdMap[idx + width] === rid) { dist[idx + width] = nd; queue[tail++] = idx + width; }
  }

  // For each region pick the pixel with the largest distance value
  const positions = new Map();
  for (const region of regions) {
    if (region.area === 0) continue;
    let best = 0, bx = 0, by = 0;
    for (const p of region.pixels) {
      if (dist[p] > best) { best = dist[p]; bx = p % width; by = (p - bx) / width; }
    }
    positions.set(region.id, { x: bx, y: by, innerRadius: best });
  }
  return positions;
}

// ─── Palette Legend SVG ─────────────────────────────────────────────────────

function buildPaletteLegendSvg(regions, palette) {
  // Build entries sorted by colour number (the number shown on the SVG)
  const entries = palette
    .map((col, idx) => {
      const masterIdx = col.masterIndex != null ? col.masterIndex : idx;
      const colourNumber = masterIdx + 1; // matches region.displayNumber on the SVG
      return { col, colourNumber, masterIdx };
    })
    .filter(e => regions.some(r => r.colorIndex === e.masterIdx && r.area > 0))
    .sort((a, b) => a.colourNumber - b.colourNumber);

  if (entries.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

  const cols = Math.min(4, entries.length);
  const swatchW = 160, swatchH = 54, padX = 12, padY = 10;
  const colW = swatchW + padX;
  const rowH = swatchH + padY;
  const rows = Math.ceil(entries.length / cols);
  const totalW = cols * colW + padX;
  const headerH = 50;
  const totalH = headerH + rows * rowH + padY;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" style="background:#fff;font-family:Arial,sans-serif">`;
  svg += `<text x="${totalW / 2}" y="32" font-size="18" font-weight="bold" fill="#333" text-anchor="middle">Colour Key</text>`;

  entries.forEach((entry, i) => {
    const { col, colourNumber } = entry;
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = padX + c * colW;
    const y = headerH + r * rowH;
    const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
    const textCol = lum > 140 ? '#222' : '#fff';

    // Colour swatch background
    svg += `<rect x="${x}" y="${y}" width="${swatchW}" height="${swatchH}" rx="6" fill="${col.hex}" stroke="#ccc" stroke-width="1"/>`;
    // Large colour number + hex
    svg += `<text x="${x + 10}" y="${y + 22}" font-size="15" font-weight="bold" fill="${textCol}">${colourNumber}  ${col.hex}</text>`;
    // Colour name
    svg += `<text x="${x + 10}" y="${y + 42}" font-size="10" fill="${textCol}" opacity="0.85">${col.name || ''}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ─── Outline-Only SVG (for pen plotter / print) ────────────────────────────

function buildOutlineSvg(regions, palette, width, height, { a4 = false } = {}) {
  // Build per-pixel region-ID map
  const regionIdMap = new Int32Array(width * height).fill(-1);
  for (const region of regions) {
    if (region.area === 0) continue;
    for (const px of region.pixels) regionIdMap[px] = region.id;
  }

  // A4 = 210×297mm; fit the image preserving aspect ratio
  let sizeAttrs;
  if (a4) {
    const imgAspect = width / height;
    const a4Aspect = 210 / 297;
    let w, h;
    if (imgAspect > a4Aspect) {        // wider than A4 → fit to width
      w = 210; h = 210 / imgAspect;
    } else {                            // taller than A4 → fit to height
      h = 297; w = 297 * imgAspect;
    }
    sizeAttrs = `width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm"`;
  } else {
    sizeAttrs = `width="${width}" height="${height}"`;
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ${sizeAttrs} style="background:#fff">`;

  // Boundary lines (smoothed and simplified for plotter output)
  const bd = buildSmoothedBoundaryPath(regionIdMap, width, height, 2.0);
  if (bd) {
    svg += `<path d="${bd}" fill="none" stroke="#000" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  // Number labels — placed at pole of inaccessibility (black text on white bg)
  const labelPos = computeLabelPositions(regions, regionIdMap, width, height);
  for (const region of regions) {
    if (region.area < (width * height * 0.002)) continue;
    const pos = labelPos.get(region.id);
    if (!pos) continue;
    const margin = 4;
    const cx = Math.max(margin, Math.min(width - margin, pos.x));
    const cy = Math.max(margin, Math.min(height - margin, pos.y));
    const fontSize = Math.max(5, Math.min(10, pos.innerRadius * 0.7));
    svg += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="Arial,sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="bold" fill="#000" text-anchor="middle" dominant-baseline="central">${region.displayNumber}</text>`;
  }

  svg += '</svg>';
  return svg;
}

// ─── Low-Res PNG Export (from SVG) ──────────────────────────────────────────

function svgToLowResPng(svgString, targetWidth = 600) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalHeight / img.naturalWidth;
      const w = targetWidth;
      const h = Math.round(w * aspect);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')); };
    img.src = url;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const MainScreenPBY = () => {
  const { user } = useAuth();

  // ─── SEO: page title, meta description, canonical & structured data ────
  useEffect(() => {
    const prev = document.title;
    document.title = 'PaintYourPhoto – Turn Any Picture Into Paint-By-Numbers Instantly | Fotonix';

    const setMeta = (name, content) => {
      let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
      if (!el) { el = document.createElement('meta'); name.startsWith('og:') || name.startsWith('twitter:') ? el.setAttribute('property', name) : el.setAttribute('name', name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    setMeta('description', 'PaintYourPhoto by Fotonix – upload any photo and instantly generate a paint-by-numbers canvas with numbered vector regions, a colour palette key, and smooth outlines. Online tool, no download required.');
    setMeta('keywords', 'paint by numbers, photo to paint by numbers, custom paint by numbers, paint by numbers generator, PaintYourPhoto, turn photo into painting, numbered painting, colour by numbers, paint by numbers online free, paint by numbers from photo, Fotonix');
    setMeta('robots', 'index, follow');
    setMeta('author', 'Fotonix');

    // Open Graph
    setMeta('og:title', 'PaintYourPhoto – Turn Any Picture Into Paint-By-Numbers Instantly');
    setMeta('og:description', 'Upload a photo and get a numbered paint-by-numbers map with colour key. Online tool by Fotonix.');
    setMeta('og:type', 'website');
    setMeta('og:url', 'https://fotonix.co.uk/tools/paint-by-numbers');
    setMeta('og:site_name', 'Fotonix');

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', 'PaintYourPhoto – Turn Any Picture Into Paint-By-Numbers Instantly');
    setMeta('twitter:description', 'Upload a photo and instantly create a custom paint-by-numbers canvas with numbered regions and a colour palette. Tool by Fotonix.');

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); }
    canonical.setAttribute('href', 'https://fotonix.co.uk/tools/paint-by-numbers');

    // JSON-LD structured data (WebApplication + HowTo)
    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          name: 'PaintYourPhoto',
          url: 'https://fotonix.co.uk/tools/paint-by-numbers',
          description: 'Turn any photo into a paint-by-numbers canvas with numbered regions and a colour palette key. Online tool by Fotonix.',
          applicationCategory: 'DesignApplication',
          operatingSystem: 'All',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
          creator: { '@type': 'Organization', name: 'Fotonix', url: 'https://fotonix.co.uk' }
        },
        {
          '@type': 'HowTo',
          name: 'How to Create a Paint-By-Numbers From Any Photo',
          description: 'Upload a photo, set your detail level, and generate a numbered paint-by-numbers map with a colour key in seconds.',
          step: [
            { '@type': 'HowToStep', name: 'Upload your photo', text: 'Upload a JPG or PNG image from your device.' },
            { '@type': 'HowToStep', name: 'Set your detail level', text: 'Adjust the detail slider to control how many colours and regions appear.' },
            { '@type': 'HowToStep', name: 'Generate', text: 'Click Generate and the engine quantises colours, segments regions, merges tiny areas, and traces smooth vector outlines with numbered labels.' },
            { '@type': 'HowToStep', name: 'Download or order', text: 'Download a preview PNG, an HD print file, or convert into a reusable laser-cut stencil set.' }
          ]
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Fotonix', item: 'https://fotonix.co.uk' },
            { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://fotonix.co.uk/tools' },
            { '@type': 'ListItem', position: 3, name: 'PaintYourPhoto', item: 'https://fotonix.co.uk/tools/paint-by-numbers' }
          ]
        }
      ]
    });
    document.head.appendChild(jsonLd);

    return () => {
      document.title = prev;
      if (jsonLd.parentNode) jsonLd.parentNode.removeChild(jsonLd);
    };
  }, []);

  // ─── State ──────────────────────────────────────────────────────────────
  const [sourceImage, setSourceImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Quantisation settings
  const [detailLevel, setDetailLevel] = useState(50); // 0=simplified, 100=max detail

  // Result data
  const [pbnSvg, setPbnSvg] = useState(null);
  const [palette, setPalette] = useState([]);
  const [regions, setRegions] = useState([]);
  const [previewPng, setPreviewPng] = useState(null);
  const quantPaletteRef = useRef([]);

  // View controls
  const [showNumbers, setShowNumbers] = useState(true);
  const [detailTip, setDetailTip] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Social proof — "X people ordered in the last 24 hours" (rotates on a timer)
  const [socialProofCount, setSocialProofCount] = useState(() => Math.floor(Math.random() * 8) + 12);
  useEffect(() => {
    const tick = () => setSocialProofCount(Math.floor(Math.random() * 8) + 12);
    const id = setInterval(tick, 45000); // refresh every 45 s
    return () => clearInterval(id);
  }, []);

  // Delivery date estimate — 4 days if ordered before 20:00, 5 days after
  const getDeliveryDate = useCallback(() => {
    const now = new Date();
    const cutoffHour = 20;
    const daysToAdd = now.getHours() < cutoffHour ? 4 : 5;
    const delivery = new Date(now);
    delivery.setDate(delivery.getDate() + daysToAdd);
    const opts = { weekday: 'long', day: 'numeric', month: 'long' };
    return delivery.toLocaleDateString('en-GB', opts);
  }, []);
  const [deliveryDateStr, setDeliveryDateStr] = useState(getDeliveryDate);
  useEffect(() => {
    // Refresh delivery estimate every minute in case user crosses 20:00 cutoff
    const id = setInterval(() => setDeliveryDateStr(getDeliveryDate()), 60000);
    return () => clearInterval(id);
  }, [getDeliveryDate]);

  // Analysis dimensions (kept for SVG)
  const [analysisWidth, setAnalysisWidth] = useState(0);
  const [analysisHeight, setAnalysisHeight] = useState(0);

  // Product configurator
  const [materialType, setMaterialType] = useState('canvas');
  const [selectedSize, setSelectedSize] = useState('20x20');

  // Shipping address
  const [shippingAddress, setShippingAddress] = useState({
    email: '',
    name: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
    phone: '',
    country: 'GB'
  });

  // Order / PayPal state
  const [orderComplete, setOrderComplete] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [uploadingToFirebase, setUploadingToFirebase] = useState(false);

  const CANVAS_SIZES = [
    { key: '20x20', label: 'Small Canvas', dims: '20 × 20 cm (8 × 8 in)', price: 17.99 },
    { key: '20x30', label: 'Small Rectangle Canvas', dims: '20 × 30 cm (8 × 12 in)', price: 21.99 },
    { key: '30x40', label: 'Medium Canvas', dims: '30 × 40 cm (12 × 16 in)', price: 25.99, regularPrice: 29.99, sale: true },
  ];
  const PAPER_SIZES = [
    { key: 'a4', label: 'A4', dims: '21 × 29.7 cm', price: 12.99 },
    { key: 'a3', label: 'A3', dims: '29.7 × 42 cm', price: 16.99 },
  ];
  const currentSizes = materialType === 'canvas' ? CANVAS_SIZES : PAPER_SIZES;
  const currentSizeObj = currentSizes.find(s => s.key === selectedSize) || currentSizes[0];

  const COUNTRIES = [
    { code: 'GB', name: 'United Kingdom', zone: 'uk' },
    { code: 'IE', name: 'Ireland', zone: 'eu' },
    { code: 'FR', name: 'France', zone: 'eu' },
    { code: 'DE', name: 'Germany', zone: 'eu' },
    { code: 'ES', name: 'Spain', zone: 'eu' },
    { code: 'IT', name: 'Italy', zone: 'eu' },
    { code: 'NL', name: 'Netherlands', zone: 'eu' },
    { code: 'BE', name: 'Belgium', zone: 'eu' },
    { code: 'PT', name: 'Portugal', zone: 'eu' },
    { code: 'AT', name: 'Austria', zone: 'eu' },
    { code: 'PL', name: 'Poland', zone: 'eu' },
    { code: 'SE', name: 'Sweden', zone: 'eu' },
    { code: 'DK', name: 'Denmark', zone: 'eu' },
    { code: 'FI', name: 'Finland', zone: 'eu' },
    { code: 'GR', name: 'Greece', zone: 'eu' },
    { code: 'CZ', name: 'Czech Republic', zone: 'eu' },
    { code: 'US', name: 'United States', zone: 'row' },
    { code: 'CA', name: 'Canada', zone: 'row' },
    { code: 'AU', name: 'Australia', zone: 'row' },
    { code: 'NZ', name: 'New Zealand', zone: 'row' },
    { code: 'JP', name: 'Japan', zone: 'row' },
    { code: 'OTHER', name: 'Other (Rest of World)', zone: 'row' }
  ];

  const handleMaterialChange = useCallback((type) => {
    setMaterialType(type);
    setSelectedSize(type === 'canvas' ? '20x20' : 'a4');
  }, []);

  // Refs
  const fileInputRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const previewContainerRef = useRef(null);
  const panRef = useRef({ active: false, startX: 0, startY: 0, origPanX: 0, origPanY: 0 });
  const paypalButtonsRef = useRef(null);
  const checkoutSectionRef = useRef(null);
  const shippingAddressRef = useRef(shippingAddress);
  shippingAddressRef.current = shippingAddress;

  // ─── PayPal SDK + order helpers ─────────────────────────────────────────
  useEffect(() => {
    if (pbnSvg && !orderComplete) {
      // If PayPal SDK is already loaded, just render buttons
      if (window.paypal) {
        renderPayPalButtons();
        return;
      }
      // Only load PayPal SDK if no script tag exists yet
      if (!document.querySelector('script[src*="paypal.com/sdk"]')) {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${
          process.env.REACT_APP_PAYPAL_CLIENT_ID || 'Aab6IHfog5quDJp4kfy5sqiuo4YcTZaQ3SR8VpwUgDoDphLXmrKwqhog_u-cktkgIaSrsXwxH8HNE-Jf'
        }&currency=GBP`;
        script.async = true;
        script.onload = () => renderPayPalButtons();
        script.onerror = (e) => console.warn('PayPal SDK failed to load', e);
        document.body.appendChild(script);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pbnSvg, orderComplete]);

  // Sync browser autofill into React state
  useEffect(() => {
    try {
      const syncAutofill = () => {
        const form = document.querySelector('.pbn-shipping-form');
        if (!form) return;
        const inputs = Array.from(form.querySelectorAll('input'));
        if (inputs.length >= 6) {
          const values = inputs.map(i => (i.value || '').toString().trim());
          const [name, addressLine1, addressLine2, city, postcode, phone] = values;
          const sa = shippingAddress || {};
          if ((!sa.name && name) || (!sa.addressLine1 && addressLine1) || (!sa.city && city) || (!sa.postcode && postcode) || (!sa.phone && phone)) {
            setShippingAddress(prev => ({
              ...prev,
              name: prev.name || name || '',
              addressLine1: prev.addressLine1 || addressLine1 || '',
              addressLine2: prev.addressLine2 || addressLine2 || '',
              city: prev.city || city || '',
              postcode: prev.postcode || postcode || '',
              phone: prev.phone || phone || ''
            }));
          }
        }
      };
      const t1 = setTimeout(syncAutofill, 700);
      const t2 = setTimeout(syncAutofill, 1500);
      const form = document.querySelector('.pbn-shipping-form');
      const inputs = form ? Array.from(form.querySelectorAll('input')) : [];
      const onFocus = () => syncAutofill();
      const onAnimation = (e) => {
        const an = e?.animationName?.toLowerCase() || '';
        if (an.includes('autofill')) setTimeout(syncAutofill, 50);
      };
      inputs.forEach(i => { i.addEventListener('focus', onFocus); i.addEventListener('animationstart', onAnimation); });
      window.addEventListener('pageshow', syncAutofill);
      return () => {
        clearTimeout(t1); clearTimeout(t2);
        inputs.forEach(i => { i.removeEventListener('focus', onFocus); i.removeEventListener('animationstart', onAnimation); });
        window.removeEventListener('pageshow', syncAutofill);
      };
    } catch (e) { /* ignore */ }
  }, []);

  const renderPayPalButtons = useCallback(() => {
    if (!window.paypal || !paypalButtonsRef.current || orderComplete) return;
    paypalButtonsRef.current.innerHTML = '';
    try {
      window.paypal.Buttons({
      createOrder: async () => {
        // Validate shipping address (read from ref to avoid stale closures)
        const addr = shippingAddressRef.current;
        if (!addr.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email)) {
          alert('Please enter a valid email address');
          throw new Error('Email required');
        }
        if (!addr.name || !addr.addressLine1 || !addr.city || !addr.postcode || !addr.phone) {
          alert('Please fill in all shipping address fields before payment');
          throw new Error('Shipping address incomplete');
        }
        try {
          const resp = await fetch(`${API_URL}/api/pbn/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productKey: selectedSize, materialType, userId: user?.id || user?.uid || null, email: addr.email, countryCode: addr.country, shippingAddress: addr })
          });
          const data = await resp.json();
          if (!resp.ok) {
            console.error('Server returned', resp.status, data);
            throw new Error(data.error || 'Failed to create order');
          }
          if (!data.orderId) throw new Error('No orderId in response');
          return data.orderId;
        } catch (error) {
          console.error('Error creating order:', error);
          alert('Failed to create order: ' + error.message);
          throw error;
        }
      },
      onApprove: async (data) => {
        setPaymentProcessing(true);
        try {
          const uploadResult = await uploadPbnToFirebase();
          const resp = await fetch(`${API_URL}/api/pbn/capture-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: data.orderID,
              userId: user?.id || user?.uid || null,
              email: shippingAddressRef.current.email,
              shippingAddress: shippingAddressRef.current,
              pbnData: {
                productKey: selectedSize,
                productLabel: currentSizeObj.label || selectedSize,
                materialType,
                selectedSize,
                pricing: (() => {
                  const isUK = shippingAddressRef.current.country === 'GB';
                  const delivery = isUK ? 0 : 4.95;
                  return { subtotal: currentSizeObj.price.toFixed(2), deliveryFee: delivery.toFixed(2), total: (currentSizeObj.price + delivery).toFixed(2) };
                })(),
                storageUrls: uploadResult.storageUrls,
                originalImageUrl: uploadResult.originalImageUrl,
                paletteColours: palette.length,
                paletteData: palette.map((col, idx) => {
                  const masterIdx = col.masterIndex != null ? col.masterIndex : idx;
                  const colourNumber = masterIdx + 1; // matches the number on the SVG
                  return { number: colourNumber, hex: col.hex, name: col.name || '' };
                }),
                detailLevel,
                regionCount: regions.filter(r => r.area > 0).length,
                analysisWidth,
                analysisHeight,
              }
            })
          });
          const result = await resp.json();
          if (result.success) { setOrderComplete(true); }
          else throw new Error('Capture failed');
        } catch (err) {
          console.error('Payment error:', err);
          alert('Payment failed. Please contact support.');
        } finally { setPaymentProcessing(false); }
      },
      onError: (err) => { console.error('PayPal error:', err); alert('Payment failed.'); setPaymentProcessing(false); }
    }).render(paypalButtonsRef.current).catch(err => {
      // Suppress cross-origin "Script error." when PayPal re-renders
      if (paypalButtonsRef.current) console.warn('PayPal render interrupted (safe to ignore):', err);
    });
    } catch (e) { console.warn('PayPal Buttons init error:', e); }


  }, [user, selectedSize, materialType, currentSizeObj, detailLevel, regions, analysisWidth, analysisHeight, orderComplete]);

  // Re-render PayPal buttons when product config changes (not on every keystroke)
  useEffect(() => {
    if (pbnSvg && !orderComplete && window.paypal) renderPayPalButtons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSize, materialType, pbnSvg, orderComplete]);

  const uploadPbnToFirebase = async () => {
    if (!user) throw new Error('Not authenticated');
    setUploadingToFirebase(true);
    const storageUrls = [];
    let originalImageUrl = null;
    try {
      const uid = user.uid;
      const ts = Date.now();
      // Upload original image
      if (imageUrl) {
        try {
          const ref = storage.ref(`users/${uid}/pbn/originals/original-${ts}.png`);
          await ref.putString(imageUrl, 'data_url');
          originalImageUrl = await ref.getDownloadURL();
        } catch (e) { console.error('Original upload failed:', e); }
      }
      // Upload PBN SVG
      if (pbnSvg) {
        const svgRef = storage.ref(`users/${uid}/pbn/pbn-${ts}.svg`);
        await svgRef.putString(pbnSvg, 'raw', { contentType: 'image/svg+xml' });
        const svgUrl = await svgRef.getDownloadURL();
        storageUrls.push({ type: 'svg', url: svgUrl });
      }
      // Upload HD PNG
      if (pbnSvg && analysisWidth) {
        try {
          const hdPng = await svgToLowResPng(pbnSvg, analysisWidth);
          const pngRef = storage.ref(`users/${uid}/pbn/pbn-hd-${ts}.png`);
          await pngRef.putString(hdPng, 'data_url');
          const pngUrl = await pngRef.getDownloadURL();
          storageUrls.push({ type: 'hd-png', url: pngUrl });
        } catch (e) { console.error('HD PNG upload failed:', e); }
      }
      // Upload outline SVG
      if (regions.length && palette.length && analysisWidth) {
        const outlineSvg = buildOutlineSvg(regions, palette, analysisWidth, analysisHeight);
        const outRef = storage.ref(`users/${uid}/pbn/pbn-outline-${ts}.svg`);
        await outRef.putString(outlineSvg, 'raw', { contentType: 'image/svg+xml' });
        const outUrl = await outRef.getDownloadURL();
        storageUrls.push({ type: 'outline-svg', url: outUrl });
      }
      // Upload palette legend SVG
      if (regions.length && palette.length) {
        try {
          const paletteSvg = buildPaletteLegendSvg(regions, palette);
          const palRef = storage.ref(`users/${uid}/pbn/pbn-palette-${ts}.svg`);
          await palRef.putString(paletteSvg, 'raw', { contentType: 'image/svg+xml' });
          const palUrl = await palRef.getDownloadURL();
          storageUrls.push({ type: 'palette-svg', url: palUrl });
        } catch (e) { console.error('Palette SVG upload failed:', e); }
      }
      return { storageUrls, originalImageUrl };
    } finally { setUploadingToFirebase(false); }
  };

  // ─── Pan / Zoom helpers ─────────────────────────────────────────────────

  const handlePreviewPointerDown = useCallback((e) => {
    if (e.button !== 0) return; // left button only
    panRef.current = { active: true, startX: e.clientX, startY: e.clientY, origPanX: panX, origPanY: panY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [panX, panY]);

  const handlePreviewPointerMove = useCallback((e) => {
    if (!panRef.current.active) return;
    setPanX(panRef.current.origPanX + (e.clientX - panRef.current.startX));
    setPanY(panRef.current.origPanY + (e.clientY - panRef.current.startY));
  }, []);

  const handlePreviewPointerUp = useCallback(() => {
    panRef.current.active = false;
  }, []);

  const resetView = useCallback(() => { setZoom(1); setPanX(0); setPanY(0); }, []);

  // Attach wheel listener as non-passive so preventDefault works
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      setZoom(prev => Math.min(5, Math.max(0.25, prev + (e.deltaY < 0 ? 0.15 : -0.15))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  });

  // ─── File Upload ────────────────────────────────────────────────────────
  const handleFileSelect = useCallback((file) => {
    if (!file || !file.type.match('image.*')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setImageUrl(e.target.result);
        setPbnSvg(null);
        setPalette([]);
        setRegions([]);
        setPreviewPng(null);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files[0]); };

  // ─── Core Processing Pipeline ──────────────────────────────────────────
  const processImage = useCallback(async () => {
    if (!sourceImage) return;
    setProcessing(true);
    setProgressMsg('Resizing image…');

    await new Promise(r => setTimeout(r, 50));

    try {
      const t0 = performance.now();

      // 1. Resize for analysis (long edge ≤ 1024)
      const MAX_EDGE = 1024;
      const scale = Math.min(1, MAX_EDGE / Math.max(sourceImage.width, sourceImage.height));
      const w = Math.round(sourceImage.width * scale);
      const h = Math.round(sourceImage.height * scale);
      setAnalysisWidth(w);
      setAnalysisHeight(h);

      const canvas = hiddenCanvasRef.current;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(sourceImage, 0, 0, w, h);
      let imageData = ctx.getImageData(0, 0, w, h);

      logPipelineStats('1. Resize', { dimensions: { w, h }, elapsed: performance.now() - t0 });

      // 1b. Face detection — run on the resized canvas before smoothing so
      //     the detector sees the original pixel content (not quantised).
      //     Produces a binary face mask used by later pipeline stages.
      setProgressMsg('Detecting faces…');
      await new Promise(r => setTimeout(r, 30));
      const tFace = performance.now();
      let faceMask = null;
      let eyeMask = null;
      let faceCount = 0;
      let detectedFaces = null;
      try {
        const faces = await detectFaces(canvas);
        detectedFaces = faces;
        faceCount = faces.length;
        if (faceCount > 0) {
          faceMask = buildFaceMask(faces, w, h);
          // Build eye mask from landmark data (if available)
          const hasEyes = faces.some(f => f.eyes);
          if (hasEyes) {
            eyeMask = buildEyeMask(faces, w, h);
          }
        }
      } catch (faceErr) {
        // Face detection is optional — if it fails (e.g. model not loaded),
        // continue with the standard pipeline without face-aware processing.
        console.warn('[PBN] Face detection failed, proceeding without face mask:', faceErr);
      }

      // Build facial zone mask from 68-point landmarks (eyes, nose, lips, cheeks, forehead)
      let zoneMap = null;
      if (detectedFaces && detectedFaces.some(f => f.landmarks)) {
        zoneMap = buildFacialZoneMasks(detectedFaces, w, h);
        const zoneCounts = {};
        for (let i = 0; i < w * h; i++) {
          const z = zoneMap[i];
          if (z > 0) zoneCounts[z] = (zoneCounts[z] || 0) + 1;
        }
        console.log('[PBN] Zone mask built:', zoneCounts);
      }

      logPipelineStats('1b. Face Detection', {
        elapsed: performance.now() - tFace,
        note: (faceMask ? `${faceCount} face(s) detected — mask active` : 'No faces detected') +
              (eyeMask ? ` / eye landmarks detected` : '')
      });

      // ── Preprocessing Pipeline ──────────────────────────────────────────

      // PP-1. Histogram stretch (contrast normalisation)
      setProgressMsg('Enhancing contrast…');
      await new Promise(r => setTimeout(r, 30));
      const tPP1 = performance.now();
      imageData = histogramStretch(imageData);
      logPipelineStats('PP-1. Histogram Stretch', { elapsed: performance.now() - tPP1 });

      // PP-2. Build skin mask (Lab heuristic inside face regions)
      let skinMask = null;
      if (faceMask) {
        setProgressMsg('Detecting skin regions…');
        await new Promise(r => setTimeout(r, 30));
        const tSkin = performance.now();
        skinMask = buildSkinMask(imageData, faceMask);
        const skinCount = skinMask ? skinMask.reduce((s, v) => s + v, 0) : 0;
        logPipelineStats('PP-2a. Skin Mask', { elapsed: performance.now() - tSkin, note: `${skinCount} skin pixels detected via Lab heuristic` });
      }

      // PP-3. Edge sharpening (unsharp mask)
      setProgressMsg('Sharpening edges…');
      await new Promise(r => setTimeout(r, 30));
      const tPP3 = performance.now();
      imageData = unsharpMask(imageData, 1, 0.6);
      logPipelineStats('PP-3. Unsharp Mask', { elapsed: performance.now() - tPP3, note: 'radius=1, amount=0.6' });

      // PP-4. Saturation boost (compensate for clustering dulling)
      setProgressMsg('Boosting colour…');
      await new Promise(r => setTimeout(r, 30));
      const tPP4 = performance.now();
      imageData = boostSaturation(imageData, 1.12);
      logPipelineStats('PP-4. Saturation Boost', { elapsed: performance.now() - tPP4, note: '+12%' });

      // ── End Preprocessing Pipeline ──────────────────────────────────────

      // 1b. Gradient compression — strong bilateral that crushes subtle
      //     tonal gradients (cheeks, forehead, nose bridge) into flat
      //     blocks while preserving real edges.  This is the key step
      //     that prevents 8-level cheek gradients from becoming 8 regions.
      setProgressMsg('Compressing gradients…');
      await new Promise(r => setTimeout(r, 30));
      const tGC = performance.now();
      imageData = edgePreservingSmooth(imageData, 4, 18);
      imageData = edgePreservingSmooth(imageData, 4, 18);
      logPipelineStats('1b. Gradient Compression', { elapsed: performance.now() - tGC, note: '2× bilateral radius=4, sigmaColor=18' });

      // 1c. Zone-aware colour flattening — run mini k-means inside each
      //     facial zone (eyes k=4, nose k=3, lips k=3, cheeks/forehead k=4)
      //     so the global quantiser sees flat blocks per zone.
      if (zoneMap) {
        setProgressMsg('Stabilising facial zones…');
        await new Promise(r => setTimeout(r, 30));
        const tZF = performance.now();
        // Also apply mild bilateral inside eye zones first
        if (eyeMask) imageData = preprocessEyeRegions(imageData, eyeMask);
        imageData = flattenZoneColors(imageData, zoneMap, w, h);
        logPipelineStats('1c. Zone Flatten', { elapsed: performance.now() - tZF, note: 'per-zone k-means: eyes=4, nose=3, lips=3, cheeks/forehead=4' });
      } else if (eyeMask && detectedFaces) {
        // Fallback: eye-only flatten if no landmarks available
        setProgressMsg('Stabilising eye regions…');
        await new Promise(r => setTimeout(r, 30));
        const tEye = performance.now();
        imageData = preprocessEyeRegions(imageData, eyeMask);
        imageData = flattenEyeColors(imageData, detectedFaces, eyeMask);
        logPipelineStats('1c. Eye Flatten', { elapsed: performance.now() - tEye, note: 'bilateral r=1 σ=15 + mini k-means k=4 per eye' });
      }

      // 2. Edge-preserving smoothing (bilateral filter)
      setProgressMsg('Smoothing image…');
      await new Promise(r => setTimeout(r, 30));
      const t1 = performance.now();
      imageData = edgePreservingSmooth(imageData, 2, 30);
      logPipelineStats('2. Bilateral Smooth', { elapsed: performance.now() - t1, note: 'radius=2, sigmaColor=30' });

      // 3. Quantise palette (single k-means for entire image — no fg/bg split)
      setProgressMsg('Quantising colours…');
      await new Promise(r => setTimeout(r, 30));
      const t2 = performance.now();
      const segK = Math.round(12 + (detailLevel / 100) * 18); // 12–30
      const quantPalette = kMeansQuantise(imageData, segK);
      quantPaletteRef.current = quantPalette;
      logPipelineStats('3. K-Means Quantise', {
        uniqueColors: quantPalette.length,
        elapsed: performance.now() - t2,
        note: `segK=${segK}`
      });

      // 4. Assign every pixel to nearest palette colour
      setProgressMsg('Assigning colours…');
      await new Promise(r => setTimeout(r, 30));
      const t3 = performance.now();
      let colorAssign = assignPixels(imageData, quantPalette);
      logPipelineStats('4. Pixel Assignment', { uniqueColors: new Set(colorAssign).size, elapsed: performance.now() - t3 });

      // 5. Progressive majority filter
      setProgressMsg('Cleaning noise…');
      await new Promise(r => setTimeout(r, 30));
      const t4 = performance.now();
      if (zoneMap) {
        // Zone-aware: respects zone boundaries, eyes get r=1
        colorAssign = zoneAwareMajorityFilter(colorAssign, w, h, 1, zoneMap);
        colorAssign = zoneAwareMajorityFilter(colorAssign, w, h, 2, zoneMap);
        colorAssign = zoneAwareMajorityFilter(colorAssign, w, h, 3, zoneMap);
        colorAssign = zoneAwareMajorityFilter(colorAssign, w, h, 4, zoneMap);
      } else if (eyeMask) {
        colorAssign = faceAwareMajorityFilter(colorAssign, w, h, 1, 1, eyeMask);
        colorAssign = faceAwareMajorityFilter(colorAssign, w, h, 2, 1, eyeMask);
        colorAssign = faceAwareMajorityFilter(colorAssign, w, h, 3, 1, eyeMask);
        colorAssign = faceAwareMajorityFilter(colorAssign, w, h, 4, 1, eyeMask);
      } else {
        colorAssign = majorityFilter(colorAssign, w, h, 1);
        colorAssign = majorityFilter(colorAssign, w, h, 2);
        colorAssign = majorityFilter(colorAssign, w, h, 3);
        colorAssign = majorityFilter(colorAssign, w, h, 4);
      }
      logPipelineStats('5. Majority Filter (progressive 1→2→3→4)', {
        uniqueColors: new Set(colorAssign).size,
        elapsed: performance.now() - t4,
        note: zoneMap ? 'zone-aware: boundaries respected, eyes r=1, rest r=1→2→3→4' : (eyeMask ? 'face-aware: eyes r=1, rest r=1→2→3→4' : 'uniform r=1→2→3→4')
      });

      // 6. Connected-component labelling directly from filtered colorAssign
      //    (no unnecessary re-quantisation through synthImgData)
      setProgressMsg('Segmenting regions…');
      await new Promise(r => setTimeout(r, 30));
      const t5 = performance.now();
      const seg = segmentFromColorAssign(colorAssign, w, h);
      logPipelineStats('6. Connected Components', {
        regionCount: seg.regions.length,
        regionSizes: seg.regions.map(r => r.area),
        elapsed: performance.now() - t5
      });

      // 7. Merge small regions.
      //    When a face mask is active, use face-aware merging which applies a
      //    much smaller minArea threshold (×0.3) inside face regions to preserve
      //    fine details like eyes, lips, and nose highlights. Background regions
      //    use the normal user-selected detail level.
      //
      //    An edge map (Sobel gradient) is computed from the original smoothed
      //    image (not the quantised version, which has artificial hard edges at
      //    every colour boundary that would block all merges).
      setProgressMsg('Cleaning micro regions…');
      await new Promise(r => setTimeout(r, 30));
      const t6 = performance.now();

      // Compute Sobel edge map from the original smoothed image — NOT the
      // quantised synthImgData, which has hard colour steps at every region
      // boundary that the Sobel operator would flag as strong edges.
      const edgeMap = computeEdgeMap(imageData);

      // Eye detail is always at least 70% — eyes are excluded from face-pass
      // merging and handled separately by mergeEyeRegions (step 7b) which
      // limits each eye to ≤6 colours with semantic grouping.
      const minAreaFrac = 0.0002 + ((100 - detailLevel) / 100) * 0.008;
      const minArea = Math.max(MIN_REGION_SIZE, Math.floor(w * h * minAreaFrac));
      const cleaned = faceMask
        ? faceAwareMergeSmallRegions(seg.regionMap, seg.regions, seg.colorAssign, quantPalette, w, h, minArea, faceMask, eyeMask, skinMask, edgeMap)
        : mergeSmallRegions(seg.regionMap, seg.regions, seg.colorAssign, quantPalette, w, h, minArea, edgeMap);
      logPipelineStats('7. Merge Small Regions', {
        regionCount: cleaned.regions.length,
        regionSizes: cleaned.regions.map(r => r.area),
        elapsed: performance.now() - t6,
        note: faceMask
          ? `face-aware: minArea=${minArea}, faceMinArea=${Math.max(5, Math.floor(minArea * 0.5))}, edgeAware=true`
          : `minArea=${minArea} (detailLevel=${detailLevel}), edgeAware=true`
      });

      // 7b. Zone-aware region merge — enforce per-zone region limits
      //     (eyes ≤4, nose ≤3, lips ≤3) and block cross-zone merges.
      if (zoneMap) {
        setProgressMsg('Enforcing facial zone limits…');
        await new Promise(r => setTimeout(r, 30));
        const t7b = performance.now();
        mergeZoneRegions(cleaned.regionMap, cleaned.regions, cleaned.colorAssign, quantPalette, w, h, zoneMap);
        cleaned.regions = cleaned.regions.filter(r => r.area > 0);
        logPipelineStats('7b. Zone Region Merge', {
          regionCount: cleaned.regions.length,
          elapsed: performance.now() - t7b,
          note: 'eyes≤4, nose≤3, lips≤3, cheeks/forehead≤5; cross-zone merges blocked'
        });
      } else if (eyeMask && detectedFaces) {
        // Fallback: eye-only merge if no zone map
        setProgressMsg('Cleaning eye regions…');
        await new Promise(r => setTimeout(r, 30));
        const t7b = performance.now();
        mergeEyeRegions(cleaned.regionMap, cleaned.regions, cleaned.colorAssign, quantPalette, w, h, eyeMask, detectedFaces);
        cleaned.regions = cleaned.regions.filter(r => r.area > 0);
        logPipelineStats('7b. Eye Region Merge', {
          regionCount: cleaned.regions.length,
          elapsed: performance.now() - t7b,
          note: 'tiny eye frags merged; limited to ≤4 colours per eye'
        });
      }

      // 7c. Iterative similar-neighbour merge — collapse gradient fragments
      //     where two adjacent regions are both similar in colour (ΔE < 6)
      //     and at least one is small (< 400 px).
      setProgressMsg('Merging similar regions…');
      await new Promise(r => setTimeout(r, 30));
      const t7c = performance.now();
      cleaned.regions = mergeSimilarNeighbours(cleaned.regionMap, cleaned.regions, quantPalette, w, h, 8, 400, eyeMask, edgeMap, zoneMap);
      logPipelineStats('7c. Similar-Neighbour Merge', {
        regionCount: cleaned.regions.length,
        elapsed: performance.now() - t7c,
        note: 'ΔE<8, smallArea<400'
      });

      // 8–9. Palette solving: assign display numbers + merge same-colour neighbours
      setProgressMsg('Solving palette…');
      await new Promise(r => setTimeout(r, 30));
      const t8 = performance.now();
      const solved = solvePaletteForRegions({
        regions: cleaned.regions,
        palette: quantPalette,
        regionMap: cleaned.regionMap,
        width: w,
        height: h,
      });
      const finalRegions = solved.regions;
      const finalPalette = solved.palette;
      logPipelineStats('8–9. Palette Solve + Same-Colour Merge', {
        regionCount: finalRegions.length,
        uniqueColors: finalPalette.length,
        elapsed: performance.now() - t8,
      });

      // 10. Build SVG
      setProgressMsg('Building SVG…');
      await new Promise(r => setTimeout(r, 30));
      const t10 = performance.now();
      const svgString = buildPbnSvg(finalRegions, quantPalette, w, h, null, true);
      logPipelineStats('10. SVG Generation', { elapsed: performance.now() - t10 });

      // 11. Preview PNG
      setProgressMsg('Generating preview…');
      const previewDataUrl = await svgToLowResPng(svgString, 600);

      const finalUsedColors = finalPalette.length;
      logPipelineStats('TOTAL', {
        elapsed: performance.now() - t0,
        uniqueColors: finalUsedColors,
        regionCount: finalRegions.length,
        note: `segK=${segK}, ${finalUsedColors} colours used / ${finalRegions.length} regions` +
              (faceMask ? ` (${faceCount} face(s) detected)` : '')
      });

      setPbnSvg(svgString);
      setPalette(finalPalette);
      setRegions(finalRegions);
      setPreviewPng(previewDataUrl);
      setProgressMsg('');
    } catch (err) {
      console.error('PBN processing error:', err);
      setProgressMsg('Processing failed. Please try a different image.');
    } finally {
      setProcessing(false);
    }
  }, [sourceImage, detailLevel]);

  // Regenerate SVG when showNumbers changes (if we already have results)
  useEffect(() => {
    if (regions.length > 0 && palette.length > 0 && analysisWidth > 0) {
      const svgStr = buildPbnSvg(regions, quantPaletteRef.current, analysisWidth, analysisHeight, null, showNumbers);
      setPbnSvg(svgStr);
      svgToLowResPng(svgStr, 600).then(setPreviewPng).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNumbers]);

  // ─── Download low-res PNG ──────────────────────────────────────────────
  const downloadPreviewPng = useCallback(() => {
    if (!previewPng) return;
    const a = document.createElement('a');
    a.href = previewPng;
    a.download = 'paintyourphoto-preview.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [previewPng]);

  // ─── Download full-res PNG (rendered from SVG at full analysis size) ───
  const downloadFullResPng = useCallback(async () => {
    if (!pbnSvg || !analysisWidth || !analysisHeight) return;
    try {
      const dataUrl = await svgToLowResPng(pbnSvg, analysisWidth);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'paintyourphoto-hd.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('HD PNG export failed:', err);
    }
  }, [pbnSvg, analysisWidth, analysisHeight]);

  // ─── Download SVG (outline + numbers only, no colour fills) ───────────
  const downloadSvg = useCallback(() => {
    if (!regions.length || !palette.length || !analysisWidth) return;
    const outlineSvg = buildOutlineSvg(regions, palette, analysisWidth, analysisHeight, { a4: true });
    const blob = new Blob([outlineSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paintyourphoto.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [regions, palette, analysisWidth, analysisHeight]);

  // ─── Region Count Summary ──────────────────────────────────────────────
  const regionCount = regions.filter(r => r.area > 0).length;
  const usedColours = palette.length;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Site Header */}
      <Header currentPage="paint-by-numbers" onLogoClick={() => { window.location.href = '/'; }} />

      {/* Processing Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md mx-4 shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-purple-200 dark:border-purple-900" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" />
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse flex items-center justify-center">
                <Palette className="h-8 w-8 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Generating Your PaintYourPhoto
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">{progressMsg}</p>
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 h-full animate-pulse" style={{ width: '100%' }} />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-4 flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Please don't close this window
            </p>
          </div>
        </div>
      )}

      {/* Payment Processing Overlay */}
      {(paymentProcessing || uploadingToFirebase) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md mx-4 shadow-2xl border border-gray-200 dark:border-slate-700">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-amber-200 dark:border-amber-900" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-500 animate-spin" />
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 animate-pulse flex items-center justify-center">
                <ShoppingCart className="h-8 w-8 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
              {uploadingToFirebase ? 'Uploading Your Design' : 'Processing Payment'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              {uploadingToFirebase
                ? 'Securely uploading your custom design to our servers…'
                : 'Finalising your order with PayPal…'}
            </p>

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                uploadingToFirebase
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}>
                {uploadingToFirebase ? <Loader className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Upload
              </div>
              <div className="w-6 h-0.5 bg-gray-300 dark:bg-slate-600" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                paymentProcessing && !uploadingToFirebase
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
              }`}>
                {paymentProcessing && !uploadingToFirebase ? <Loader className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                Payment
              </div>
            </div>

            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 h-full animate-pulse" style={{ width: '100%' }} />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-4 flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Please don't close this window
            </p>
          </div>
        </div>
      )}

      {/* Page Header Bar */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-slate-700 shadow-lg" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={pbyLogo} alt="PaintYourPhoto logo" className="h-14 w-auto" />
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                  PaintYourPhoto
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Turn any picture into Paint-By-Numbers instantly
                </p>
              </div>
            </div>


          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
        {/* Semantic SEO heading (visually hidden, crawlable) */}
        <h2 className="sr-only">Upload a photo and generate paint-by-numbers canvas online – PaintYourPhoto by Fotonix</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ─── Left Panel: Upload & Settings ─────────────────────────────── */}
          <div className="lg:col-span-1 space-y-6">

            {/* Upload Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Image
                </h2>
              </div>

              <div className="p-6">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-105'
                      : 'border-gray-300 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                  {imageUrl ? (
                    <div className="space-y-3">
                      <img src={imageUrl} alt="Source" className="max-h-40 mx-auto rounded-lg shadow-md" />
                      <div className="text-sm text-gray-600 dark:text-gray-400">Click to change image</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ImageIcon className="h-16 w-16 mx-auto text-gray-400" />
                      <div className="text-lg font-medium text-gray-700 dark:text-gray-300">Drop image here</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">or click to browse</div>
                      <div className="text-xs text-gray-400">Supports JPG &amp; PNG</div>
                    </div>
                  )}
                </div>

                {imageUrl && (
                  <div className="mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceImage(null);
                        setImageUrl(null);
                        setPbnSvg(null);
                        setPalette([]);
                        setRegions([]);
                        setPreviewPng(null);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear Image
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Settings Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Settings
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Detail Level (controls segmentation density + region merging) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Detail Level: {detailLevel}%
                    </label>
                    <div className="relative group">
                      <button type="button" onClick={() => setDetailTip(t => !t)} className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                        <Info className="h-4 w-4 text-gray-400 hover:text-purple-500 cursor-pointer transition-colors" />
                      </button>
                      {detailTip && (
                        <div className="fixed inset-0 z-20" onClick={() => setDetailTip(false)} />
                      )}
                      <div className={`absolute right-0 top-8 z-30 w-72 p-3 bg-gray-900 text-white text-xs leading-relaxed rounded-lg shadow-xl transition-all duration-200 ${detailTip ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
                        Increasing detail creates a more faithful painting with additional colours, more paint pots, and smaller paint regions. This improves realism but also increases production complexity, so higher detail kits are priced slightly higher.
                        <div className="absolute -top-1.5 right-2 w-3 h-3 bg-gray-900 rotate-45" />
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={detailLevel}
                    onChange={(e) => setDetailLevel(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>0% (simplified)</span>
                    <span>100% (max detail)</span>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    More detail = more regions and more palette colours used.
                  </p>
                </div>

                {/* Show Numbers Toggle */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-300">
                        Show Region Numbers
                      </label>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                        Display numbered labels inside each region
                      </p>
                    </div>
                    <button
                      onClick={() => setShowNumbers(!showNumbers)}
                      className={`px-4 py-2 rounded-lg transition-all ${
                        showNumbers
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {showNumbers ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={processImage}
                  disabled={!sourceImage || processing}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {processing ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Sliders className="h-5 w-5" />
                      Generate PaintYourPhoto
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ─── Product Configurator ─────────────────────────────────────── */}
            {pbnSvg && !orderComplete && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Order Your Kit
                  </h2>
                </div>

                <div className="p-6 space-y-5">
                  {/* 1️⃣ Material Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Material</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ key: 'canvas', label: 'Canvas' }, { key: 'paper', label: 'Paper' }].map(m => (
                        <button
                          key={m.key}
                          onClick={() => handleMaterialChange(m.key)}
                          className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                            materialType === m.key
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 shadow-md'
                              : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-500'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2️⃣ Size Options */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Size</label>
                    <div className="space-y-2">
                      {currentSizes.map(size => (
                        <button
                          key={size.key}
                          onClick={() => setSelectedSize(size.key)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 text-left transition-all ${
                            selectedSize === size.key
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md'
                              : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                          }`}
                        >
                          <div>
                            <div className={`text-sm font-semibold ${
                              selectedSize === size.key ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {size.label}
                              {size.sale && (
                                <span className="ml-2 inline-block px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded uppercase">Sale</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{size.dims}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {size.sale ? (
                              <div>
                                <span className="text-xs text-gray-400 line-through">£{size.regularPrice.toFixed(2)}</span>
                                <span className="ml-1.5 text-base font-bold text-red-600 dark:text-red-400">£{size.price.toFixed(2)}</span>
                              </div>
                            ) : (
                              <span className={`text-base font-bold ${
                                selectedSize === size.key ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'
                              }`}>£{size.price.toFixed(2)}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Free UK Delivery */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <Truck className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-green-700 dark:text-green-300">Free UK Delivery</span>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Order now, receive by <span className="font-bold">{deliveryDateStr}</span></p>
                    </div>
                  </div>

                  {/* Shipping Address Form */}
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Shipping Address
                      </h3>
                      <div className="pbn-shipping-form space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address *</label>
                          <input type="email" name="email" autoComplete="email" value={shippingAddress.email}
                            onInput={(e) => setShippingAddress({ ...shippingAddress, email: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="you@example.com" required />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">For order confirmation &amp; tracking updates</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                          <input type="text" name="name" autoComplete="name" value={shippingAddress.name}
                            onInput={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="John Smith" required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 1 *</label>
                          <input type="text" name="address-line1" autoComplete="address-line1" value={shippingAddress.addressLine1}
                            onInput={(e) => setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="123 High Street" required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 2</label>
                          <input type="text" name="address-line2" autoComplete="address-line2" value={shippingAddress.addressLine2}
                            onInput={(e) => setShippingAddress({ ...shippingAddress, addressLine2: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="Apartment, suite, etc. (optional)" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City *</label>
                            <input type="text" name="address-level2" autoComplete="address-level2" value={shippingAddress.city}
                              onInput={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              placeholder="London" required />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Postcode *</label>
                            <input type="text" name="postal-code" autoComplete="postal-code" value={shippingAddress.postcode}
                              onInput={(e) => setShippingAddress({ ...shippingAddress, postcode: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              placeholder="SW1A 1AA" required />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number *</label>
                          <input type="tel" name="tel" autoComplete="tel" value={shippingAddress.phone}
                            onInput={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="07123 456789" required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country *</label>
                          <select name="country" value={shippingAddress.country}
                            onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" required>
                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                          </select>
                          {shippingAddress.country !== 'GB' && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">International shipping rates apply</p>
                          )}
                        </div>
                      </div>
                    </div>

                  {/* Price Summary & PayPal */}
                  <div className="border-t border-gray-200 dark:border-slate-700 pt-4" ref={checkoutSectionRef}>
                    {/* Social proof in checkout */}
                    <div className="flex items-center gap-2 mb-3 text-xs text-green-700 dark:text-green-400">
                      <span className="relative flex h-2 w-2 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      <span><span className="font-bold">{socialProofCount} people</span> ordered in the last 24 hours</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                      <div className="flex items-baseline gap-2">
                        {currentSizeObj.sale && (
                          <span className="text-sm text-gray-400 line-through">£{currentSizeObj.regularPrice.toFixed(2)}</span>
                        )}
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">£{currentSizeObj.price.toFixed(2)}</span>
                      </div>
                    </div>
                    {shippingAddress.country === 'GB' && (
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-3 flex items-center gap-1">
                        <Truck className="h-3 w-3" /> Free UK delivery — order now, receive by <span className="font-bold">{deliveryDateStr}</span>
                      </p>
                    )}

                    {(uploadingToFirebase || paymentProcessing) ? (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {uploadingToFirebase ? 'Uploading your design...' : 'Processing payment...'}
                        </span>
                      </div>
                    ) : (
                      <div ref={paypalButtonsRef} className="min-h-[50px]" />
                    )}

                    <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">Includes your custom design &amp; colour palette key</p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Order Complete Card ──────────────────────────────────────── */}
            {orderComplete && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-green-300 dark:border-green-700 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Order Confirmed!
                  </h2>
                </div>
                <div className="p-6 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Thank you for your order!</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Your custom paint-by-numbers kit is being prepared. You'll receive a confirmation email shortly.
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-left">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Order ID</p>
                    <p className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">{orderComplete}</p>
                  </div>
                  <button
                    onClick={() => { setOrderComplete(null); setPbnSvg(null); setImageUrl(null); }}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-semibold"
                  >
                    Create Another Design
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── Right Panel: Preview & Palette ────────────────────────────── */}          <div className="lg:col-span-2 space-y-6">

            {/* Preview Card */}
            {(pbnSvg || imageUrl) && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Preview
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        title="Zoom out"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </button>
                      <span className="text-sm px-3 py-1 bg-white/20 rounded-lg">{Math.round(zoom * 100)}%</span>
                      <button
                        onClick={() => setZoom(prev => Math.min(5, prev + 0.25))}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        title="Zoom in"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                      <button
                        onClick={resetView}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        title="Reset view"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div
                    ref={previewContainerRef}
                    className="relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-900 dark:to-slate-800 rounded-lg overflow-hidden select-none"
                    style={{ minHeight: '400px', cursor: zoom > 1 ? 'grab' : 'default', touchAction: 'none' }}
                    onPointerDown={handlePreviewPointerDown}
                    onPointerMove={handlePreviewPointerMove}
                    onPointerUp={handlePreviewPointerUp}
                    onPointerCancel={handlePreviewPointerUp}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: panRef.current.active ? 'none' : 'transform 200ms ease'
                      }}
                    >
                      {pbnSvg && !showOriginal ? (
                        <div
                          className="max-w-full max-h-full"
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                          dangerouslySetInnerHTML={{ __html: pbnSvg }}
                        />
                      ) : imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="Original"
                          className="max-w-full max-h-full object-contain"
                          style={{ pointerEvents: 'none' }}
                          draggable={false}
                        />
                      ) : null}
                    </div>

                    {pbnSvg && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 z-20" onPointerDown={e => e.stopPropagation()}>
                        <button
                          onClick={() => setShowOriginal(!showOriginal)}
                          className="px-3 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium"
                        >
                          {showOriginal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showOriginal ? 'Show PBN' : 'Show Original'}
                        </button>
                        <button
                          onClick={downloadSvg}
                          className="px-3 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300"
                        >
                          <Download className="h-4 w-4" />
                          Download SVG
                        </button>
                      </div>
                    )}

                    {/* Region stats overlay */}
                    {pbnSvg && !showOriginal && (
                      <div className="absolute bottom-4 right-4 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300" onPointerDown={e => e.stopPropagation()}>
                        <span title="Palette colours actually used in regions">{usedColours} colours</span>
                        {' · '}
                        <span title="Number of paintable areas (regions ≠ colours — each colour can appear in multiple separate regions)">{regionCount} paintable areas</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Palette Legend */}
            {palette.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Colour Key ({usedColours} colours)
                  </h2>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {palette.map((col, idx) => {
                      // Find regions using this colour (match by master palette index)
                      const masterIdx = col.masterIndex != null ? col.masterIndex : idx;
                      const regionNums = regions.filter(r => r.colorIndex === masterIdx && r.area > 0).map(r => r.displayNumber);
                      if (regionNums.length === 0) return null;
                      const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-slate-600 hover:shadow-md transition-shadow"
                        >
                          <div
                            className="w-10 h-10 rounded-lg border-2 border-white shadow-md flex-shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: col.hex }}
                          >
                            <span className="text-xs font-bold" style={{ color: lum > 140 ? '#222' : '#fff' }}>
                              {regionNums[0]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{col.hex}</div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              Regions: {regionNums.join(', ')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TEST: Paint Pot List (master palette mapping) */}
            {palette.length > 0 && regions.length > 0 && (() => {
              const paintList = buildPaintList(palette, regions);
              return (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-orange-300 dark:border-orange-600 overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Paintbrush className="h-5 w-5" />
                      Paint Pot List (TEST)
                    </h2>
                    <p className="text-xs opacity-80 mt-1">Maps each numbered colour → closest physical paint from master palette</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-700 text-left">
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Screen</th>
                          <th className="px-3 py-2 font-medium">Paint Name</th>
                          <th className="px-3 py-2 font-medium">Paint</th>
                          <th className="px-3 py-2 font-medium">ΔE</th>
                          <th className="px-3 py-2 font-medium">Regions</th>
                          <th className="px-3 py-2 font-medium">Pixels</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paintList.map((p, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-750'}>
                            <td className="px-3 py-2 font-bold">{p.number}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: p.quantisedHex }} />
                                <span className="font-mono text-xs">{p.quantisedHex}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 font-medium">{p.paintName}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: p.paintHex }} />
                                <span className="font-mono text-xs">{p.paintHex}</span>
                              </div>
                            </td>
                            <td className={`px-3 py-2 font-mono ${p.deltaE <= 3 ? 'text-green-600' : p.deltaE <= 6 ? 'text-yellow-600' : 'text-red-600'}`}>{p.deltaE}</td>
                            <td className="px-3 py-2 text-center">{p.regionCount}</td>
                            <td className="px-3 py-2 text-right font-mono">{p.totalPixels.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Info Box – shown when no image uploaded */}
            {!sourceImage && (
              <>
                {/* Hero showcase */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="relative">
                    <img
                      src={dogShowcase}
                      alt="Dog portrait converted to paint-by-numbers — before and after example"
                      className="w-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="text-white text-xl font-bold mb-1">Turn Any Photo Into a Masterpiece</h3>
                      <p className="text-white/80 text-sm">Upload your own photo and get a custom numbered canvas — ready to paint.</p>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1">
                        <div className="w-3 h-3 rounded-full bg-red-400 border border-white" />
                        <div className="w-3 h-3 rounded-full bg-amber-400 border border-white" />
                        <div className="w-3 h-3 rounded-full bg-green-400 border border-white" />
                        <div className="w-3 h-3 rounded-full bg-blue-400 border border-white" />
                        <div className="w-3 h-3 rounded-full bg-purple-400 border border-white" />
                      </div>
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Smart colour quantisation &amp; region detection</span>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
                    >
                      Try It Now
                    </button>
                  </div>
                </div>

                {/* Social proof ticker */}
                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3">
                  <span className="relative flex h-3 w-3 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                  </span>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    <span className="font-bold">{socialProofCount} people</span> ordered a paint-by-numbers kit in the last 24 hours
                  </p>
                </div>

                {/* Customer testimonial */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">E</div>
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                        "Tried other paint-by-numbers generators and they all produced tiny unusable fragments. This one merges small regions intelligently so you actually get paintable areas. The printed pages are beautiful and so easy to follow."
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(s => <span key={s} className="text-sm text-amber-400">★</span>)}
                        </div>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">— Emma L., Verified Buyer</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* How it works */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                        How PaintYourPhoto Works
                      </h3>
                      <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-2">
                        <li>• Upload any photo (JPG or PNG) — portraits, landscapes, and pets work best</li>
                        <li>• Set your detail level — higher detail keeps more fine features, lower detail gives simpler, bolder areas</li>
                        <li>• PaintYourPhoto analyses colours, merges similar shades, and segments regions</li>
                        <li>• Tiny fragments are absorbed into neighbouring areas for clean, paintable shapes</li>
                        <li>• Each region is traced into a smooth vector outline and numbered</li>
                        <li>• A colour key maps every number to its paint swatch — ready to paint!</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Fotonix App banner – same as StencilGenerator */}
            <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-xl p-6 text-white shadow-lg">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold mb-2 flex items-center justify-center gap-2">
                  <Smartphone className="h-5 w-5" /> Get the Fotonix App
                </h3>
                <p className="text-white/90 text-sm leading-relaxed max-w-md mx-auto">
                  Your painting companion — view your PaintYourPhoto canvas on your phone, tap any region to see exactly which colour to use, and match paints in real time using your camera. Create stencils on the go too!
                </p>
                <p className="text-white/70 text-xs mt-2">
                  Sign in with your Fotonix account to access your orders instantly.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <div className="flex items-center gap-4 bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="bg-white p-2 rounded-lg shadow-md">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://play.google.com/store/apps/details?id=com.densigner.fotonix"
                      alt="Google Play"
                      className="w-16 h-16"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-white/70 uppercase tracking-wide">Get it on</p>
                    <p className="font-bold text-lg flex items-center gap-1"><span className="text-green-300">▶</span> Google Play</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="bg-white p-2 rounded-lg shadow-md">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://apps.apple.com/us/app/fotonix/id6748742850"
                      alt="App Store"
                      className="w-16 h-16"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-white/70 uppercase tracking-wide">Download on the</p>
                    <p className="font-bold text-lg flex items-center gap-1"> App Store</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Semantic footer section for SEO content */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12" aria-label="About PaintYourPhoto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">PaintYourPhoto — Online Paint-By-Numbers Generator</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Card 1 – How It Works */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">How It Works</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload a JPG or PNG, set your detail level, and your image is instantly converted into clean, numbered paint-by-numbers regions with a matching colour key — all processed in your browser, in seconds.
            </p>
          </div>

          {/* Card 2 – Smart Region Detection */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                <Palette className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Region Detection</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Each design includes <strong>numbered vector regions</strong> and a matching <strong>colour palette key</strong>. Unlike basic posterise filters, PaintYourPhoto preserves major features — eyes, noses, and mouths stay as single paintable areas instead of being split into tiny fragments.
            </p>
          </div>

          {/* Card 3 – Multiple Export Formats */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                <Download className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Order &amp; Delivery</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Order a professionally printed canvas or paper kit delivered straight to your door — complete with numbered regions and colour key.
            </p>
          </div>

          {/* Card 4 – Works With Everything */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                <ImageIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Works With Everything</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Portraits, landscapes, pet photos, artwork, and more. Runs entirely in your browser — your photos are never uploaded to a server.
            </p>
          </div>

        </div>
      </section>

      {/* ─── Customer Reviews Section ─────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16" aria-label="Customer Reviews">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <a href="https://endorsed.review/#/biz/fotonix" target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-md border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-shadow" title="Verified by Endorsed Review">
              <img src={endorsedReviewLogo} alt="Endorsed Review" className="h-8 w-auto" />
            </a>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Reviews</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className="text-xl text-amber-400">★</span>
                  ))}
                </div>
                <span className="font-bold text-lg text-amber-700 dark:text-amber-300">4.8</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">based on 47 verified reviews</span>
              </div>
            </div>
          </div>
          <a
            href="https://endorsed.review/#/biz/fotonix"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors"
          >
            See all Fotonix reviews on Endorsed Review →
          </a>
        </div>

        {/* Rating Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: big rating */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-900 dark:text-white">4.8</div>
                <div className="flex mt-1 justify-center">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={`text-xl ${star <= 5 ? 'text-amber-400' : 'text-gray-300'}`}>★</span>
                  ))}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">47 reviews</div>
              </div>
              <div className="flex-1 space-y-1.5">
                {[
                  { stars: 5, count: 38, pct: 81 },
                  { stars: 4, count: 6, pct: 13 },
                  { stars: 3, count: 2, pct: 4 },
                  { stars: 2, count: 1, pct: 2 },
                  { stars: 1, count: 0, pct: 0 },
                ].map(row => (
                  <div key={row.stars} className="flex items-center gap-2 text-sm">
                    <span className="w-8 text-right text-gray-600 dark:text-gray-400">{row.stars}★</span>
                    <div className="flex-1 h-2.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className="w-8 text-gray-500 dark:text-gray-400 text-xs">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Right: highlights */}
            <div className="space-y-3">
              {[
                { label: 'Ease of Use', pct: 96 },
                { label: 'Print Quality', pct: 92 },
                { label: 'Colour Accuracy', pct: 88 },
                { label: 'Value for Money', pct: 94 },
              ].map(h => (
                <div key={h.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{h.label}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{h.pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full" style={{ width: `${h.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Review Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { author: 'Sarah M.', rating: 5, date: '14 Feb 2026', verified: true, comment: 'Absolutely love this tool! I uploaded a photo of my dog and the numbered regions were so clear and easy to follow. The HD PNG print was pin-sharp. Already ordered a canvas — can\'t wait to start painting.' },
            { author: 'James T.', rating: 5, date: '9 Feb 2026', verified: true, comment: 'Tried other paint-by-numbers generators and they all produced tiny unusable fragments. This one merges small regions intelligently so you actually get paintable areas. The printed pages are crisp and the numbered regions are really easy to follow.' },
            { author: 'Claire W.', rating: 5, date: '3 Feb 2026', verified: true, comment: 'Got this printed on canvas for my mum\'s birthday. She was over the moon. The colour palette key made mixing paints really straightforward. Will definitely be ordering again.' },
            { author: 'David R.', rating: 4, date: '28 Jan 2026', verified: true, comment: 'Really impressed with the quality. Only reason for 4 stars is I\'d love more palette options (36+ colours). But for what it does, it\'s brilliant. The bilateral smoothing really tidies up noisy phone photos.' },
            { author: 'Emma L.', rating: 5, date: '21 Jan 2026', verified: true, comment: 'Used it for a family portrait and the result was stunning. Each face was preserved as clean regions — no weird fragmentation. Downloaded the SVG and printed it A3. Professional quality honestly.' },
            { author: 'Michael P.', rating: 5, date: '15 Jan 2026', verified: true, comment: 'This is exactly what I was looking for. I run art workshops and needed custom paint-by-numbers for my classes. The ability to control palette size and detail level is a game changer. Bulk ordered canvases — students love them.' },
            { author: 'Hannah K.', rating: 4, date: '8 Jan 2026', verified: true, comment: 'Lovely tool, very intuitive. Uploaded a landscape photo of the Lake District and it came out beautifully. The zoom and pan for checking regions is really handy. Would love dark mode on the preview.' },
            { author: 'Tom B.', rating: 5, date: '2 Jan 2026', verified: true, comment: 'Blown away that this runs entirely in the browser — no uploading to some random server. Privacy is important to me. The generated SVG is crisp and scales to any size. 10/10.' },
            { author: 'Olivia S.', rating: 5, date: '27 Dec 2025', verified: true, comment: 'Ordered the 30×40 canvas on sale — absolute bargain. The print arrived with all the numbered regions perfectly legible. Paints matched the colour key exactly. My best Christmas gift this year!' },
          ].map((review, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    {review.author.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{review.author}</span>
                      {review.verified && (
                        <span className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" /> Verified
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{review.date}</span>
                  </div>
                </div>
                <div className="flex flex-shrink-0">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={`text-sm ${star <= review.rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}>★</span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                "{review.comment}"
              </p>
            </div>
          ))}
        </div>

        {/* Footer Attribution */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="https://endorsed.review/#/biz/fotonix" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <img src={endorsedReviewLogo} alt="Endorsed Review" className="h-5 w-auto opacity-70" />
            <span>See all Fotonix reviews on Endorsed Review</span>
          </a>
        </div>
      </section>

      {/* Hidden canvas for image processing */}
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />

      {/* Disable right-click on the whole page (SVG protection) */}
      <style>{`
        .pbn-svg-container svg {
          pointer-events: none;
          user-select: none;
        }
      `}</style>
    </div>
  );
};

export default MainScreenPBY;
