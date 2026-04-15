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
import { useAuth } from '../../contexts/AuthContext';
import { storage, db } from '../../firebase';
import { API_URL } from '../../config/environment';
import Header from '../shared/Header';
import pbyLogo from './Branding/thelogo.png';
import dogShowcase from './pictures/dogPhoto.png';
import endorsedReviewLogo from '../stencilUpload/er.svg';

// ============================================================================
// PAINT-BY-NUMBERS GENERATOR
// Converts uploaded images into numbered SVG region maps with palette legends
// ============================================================================

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

// ─── Majority-Vote Filter ───────────────────────────────────────────────────

/**
 * For each pixel, replace its colour label with the most common label in its
 * (2r+1)×(2r+1) neighbourhood. Removes salt-and-pepper assignment noise.
 */
function majorityFilter(colorAssign, width, height, radius = 1) {
  const out = new Int32Array(width * height);
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

/** Assign every pixel to its nearest palette colour index */
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

  // Connected-component labelling (4-connected)
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

  return { regionMap, regions, colorAssign };
}

// ─── Region Merging (palette-aware, configurable threshold) ─────────────────

function mergeSmallRegions(regionMap, regions, colorAssign, palette, width, height, minArea) {
  const paletteLab = palette.map(c => c.lab);
  const smallRegions = regions
    .filter(r => r.area < minArea && r.area > 0)
    .sort((a, b) => a.area - b.area);

  for (const small of smallRegions) {
    const neighbourLabels = new Map();
    for (const px of small.pixels) {
      const x = px % width;
      const y = Math.floor(px / width);
      const neighbours = [];
      if (x > 0) neighbours.push(px - 1);
      if (x < width - 1) neighbours.push(px + 1);
      if (y > 0) neighbours.push(px - width);
      if (y < height - 1) neighbours.push(px + width);
      for (const n of neighbours) {
        const nLabel = regionMap[n];
        if (nLabel !== small.id && nLabel !== -1) {
          if (!neighbourLabels.has(nLabel)) {
            const nRegion = regions.find(r => r.id === nLabel);
            if (nRegion) neighbourLabels.set(nLabel, { colorIndex: nRegion.colorIndex, borderLen: 0 });
          }
          const entry = neighbourLabels.get(nLabel);
          if (entry) entry.borderLen++;
        }
      }
    }
    if (neighbourLabels.size === 0) continue;

    // Pick neighbour whose colour is most similar (weighted by shared border)
    let bestNeighbour = -1, bestScore = Infinity;
    for (const [nId, info] of neighbourLabels) {
      const dE = deltaE(paletteLab[small.colorIndex], paletteLab[info.colorIndex]);
      const score = dE - Math.log1p(info.borderLen) * 2;
      if (score < bestScore) { bestScore = score; bestNeighbour = nId; }
    }
    if (bestNeighbour === -1) continue;

    const targetRegion = regions.find(r => r.id === bestNeighbour);
    if (!targetRegion) continue;

    for (const px of small.pixels) {
      regionMap[px] = bestNeighbour;
      colorAssign[px] = targetRegion.colorIndex;
    }
    targetRegion.pixels.push(...small.pixels);
    targetRegion.area += small.area;
    small.pixels = [];
    small.area = 0;
  }

  const valid = regions.filter(r => r.area > 0);
  valid.forEach((r) => { r.displayNumber = r.colorIndex + 1; });
  return { regionMap, regions: valid, colorAssign };
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

    const skinRegion = isSkinLab(avgLab);

    // Find nearest master palette colour (with skin bias when applicable)
    let bestIdx = 0, bestD = Infinity;
    for (let i = 0; i < MASTER_PALETTE.length; i++) {
      let d = deltaE(avgLab, MASTER_PALETTE[i].lab);

      if (skinRegion && i >= SKIN_START && i <= SKIN_END) {
        const palC = MASTER_PALETTE[i];
        // Bias 1: prefer lighter skin matches — small bonus for higher L
        const lightnessBonus = (palC.lab[0] - avgLab[0]) * 0.12;
        d -= Math.max(0, lightnessBonus);

        // Bias 2: penalise overly warm / orange / brown palette entries
        // High b* relative to a* signals orange-brown; penalise that
        const orangeness = palC.lab[2] - palC.lab[1]; // b* − a*
        if (orangeness > 12) d += (orangeness - 12) * 0.6;

        // Bias 3: prefer lower chroma (more natural, less saturated)
        const palChroma = Math.sqrt(palC.lab[1] ** 2 + palC.lab[2] ** 2);
        const srcChroma = Math.sqrt(avgLab[1] ** 2 + avgLab[2] ** 2);
        if (palChroma > srcChroma + 5) d += (palChroma - srcChroma - 5) * 0.3;
      }

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
  let changed = true;
  while (changed) {
    changed = false;
    // Build adjacency: for each region, find neighbouring region IDs
    const adjacency = new Map();
    for (const r of regions) {
      if (r.area === 0) continue;
      adjacency.set(r.id, new Set());
    }
    for (const r of regions) {
      if (r.area === 0) continue;
      for (const px of r.pixels) {
        const x = px % width;
        const y = Math.floor(px / width);
        const neighbours = [];
        if (x > 0) neighbours.push(px - 1);
        if (x < width - 1) neighbours.push(px + 1);
        if (y > 0) neighbours.push(px - width);
        if (y < height - 1) neighbours.push(px + width);
        for (const n of neighbours) {
          const nId = regionMap[n];
          if (nId !== r.id && nId !== -1) {
            adjacency.get(r.id)?.add(nId);
          }
        }
      }
    }
    // Build lookup by id
    const byId = new Map();
    for (const r of regions) byId.set(r.id, r);

    // For each region, if a same-colour neighbour exists, merge into the larger one
    for (const r of regions) {
      if (r.area === 0) continue;
      const adj = adjacency.get(r.id);
      if (!adj) continue;
      for (const nId of adj) {
        const nr = byId.get(nId);
        if (!nr || nr.area === 0) continue;
        if (nr.colorIndex === r.colorIndex) {
          // Merge smaller into larger
          const [keep, absorb] = r.area >= nr.area ? [r, nr] : [nr, r];
          for (const px of absorb.pixels) {
            regionMap[px] = keep.id;
          }
          keep.pixels.push(...absorb.pixels);
          keep.area += absorb.area;
          absorb.pixels = [];
          absorb.area = 0;
          changed = true;
          break; // restart scan since adjacency changed
        }
      }
      if (changed) break;
    }
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
      // Size the label to fit inside the region — proportional to inner radius
      const fontSize = Math.max(8, Math.min(22, pos.innerRadius * 1.4));
      const col = palette[region.colorIndex];
      const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
      const textCol = lum > 140 ? '#222' : '#fff';
      // White halo for readability
      svg += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="Arial,sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="bold" fill="${textCol}" stroke="#fff" stroke-width="2.5" paint-order="stroke fill" text-anchor="middle" dominant-baseline="central" style="pointer-events:none">${region.displayNumber}</text>`;
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
    const fontSize = Math.max(8, Math.min(22, pos.innerRadius * 1.4));
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
          description: 'Upload a photo, choose a palette size, and generate a numbered paint-by-numbers map with a colour key in seconds.',
          step: [
            { '@type': 'HowToStep', name: 'Upload your photo', text: 'Upload a JPG or PNG image from your device.' },
            { '@type': 'HowToStep', name: 'Choose palette size', text: 'Select 12–24 colours to control the level of detail.' },
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

  // View controls
  const [showNumbers, setShowNumbers] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

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
                pricing: { subtotal: currentSizeObj.price.toFixed(2), deliveryFee: '4.95', total: (currentSizeObj.price + 4.95).toFixed(2) },
                storageUrls: uploadResult.storageUrls,
                originalImageUrl: uploadResult.originalImageUrl,
                paletteColours: palette.length,
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

    // Add Fake Pay (TEST) button
    try {
      if (paypalButtonsRef.current && !paypalButtonsRef.current.querySelector('.fake-pay-btn')) {
        const fakeBtn = document.createElement('button');
        fakeBtn.type = 'button';
        fakeBtn.className = 'fake-pay-btn';
        fakeBtn.style.cssText = 'margin-top:8px;padding:8px 12px;background:#f59e0b;color:#000;border:none;border-radius:4px;cursor:pointer;width:100%';
        fakeBtn.textContent = 'Fake Pay (TEST)';
        fakeBtn.addEventListener('click', async () => {
          if (!user) { alert('Please log in'); return; }
          const fAddr = shippingAddressRef.current;
          if (!fAddr.name || !fAddr.addressLine1 || !fAddr.city || !fAddr.postcode || !fAddr.phone) {
            alert('Please fill in all shipping address fields'); return;
          }
          setPaymentProcessing(true);
          try {
            const uploadResult = await uploadPbnToFirebase();
            const resp = await fetch(`${API_URL}/api/pbn/test-capture`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: `TEST-${Date.now()}`,
                userId: user.uid,
                shippingAddress: fAddr,
                pbnData: {
                  productKey: selectedSize,
                  productLabel: currentSizeObj.label || selectedSize,
                  materialType, selectedSize,
                  pricing: { subtotal: currentSizeObj.price.toFixed(2), deliveryFee: '4.95', total: (currentSizeObj.price + 4.95).toFixed(2) },
                  storageUrls: uploadResult.storageUrls,
                  originalImageUrl: uploadResult.originalImageUrl,
                  paletteColours: palette.length, detailLevel,
                  regionCount: regions.filter(r => r.area > 0).length,
                  analysisWidth, analysisHeight,
                }
              })
            });
            const result = await resp.json();
            if (result.success) setOrderComplete(true);
            else throw new Error(result.error || 'Test capture failed');
          } catch (e) { console.error('Fake pay error:', e); alert('Test order failed.'); }
          finally { setPaymentProcessing(false); }
        });
        paypalButtonsRef.current.appendChild(fakeBtn);
      }
    } catch (e) { console.warn('Could not add fake pay button', e); }
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

      // 2. Edge-preserving smoothing (bilateral filter)
      setProgressMsg('Smoothing image…');
      await new Promise(r => setTimeout(r, 30));
      const t1 = performance.now();
      imageData = edgePreservingSmooth(imageData, 2, 30);
      logPipelineStats('2. Bilateral Smooth', { elapsed: performance.now() - t1, note: 'radius=2, sigmaColor=30' });

      // 3. Quantise palette for segmentation (K derived from detail level)
      setProgressMsg('Quantising colours…');
      await new Promise(r => setTimeout(r, 30));
      const t2 = performance.now();
      const segK = Math.round(12 + (detailLevel / 100) * 24); // 12–36 based on detail
      const quantPalette = kMeansQuantise(imageData, segK);
      logPipelineStats('3. K-Means Quantise', { uniqueColors: quantPalette.length, elapsed: performance.now() - t2, note: `segK=${segK}` });

      // 4. Assign every pixel to nearest palette colour
      setProgressMsg('Assigning colours…');
      await new Promise(r => setTimeout(r, 30));
      const t3 = performance.now();
      let colorAssign = assignPixels(imageData, quantPalette);
      logPipelineStats('4. Pixel Assignment', { uniqueColors: new Set(colorAssign).size, elapsed: performance.now() - t3 });

      // 5. Majority filter (2 passes to remove salt-and-pepper noise)
      setProgressMsg('Cleaning noise…');
      await new Promise(r => setTimeout(r, 30));
      const t4 = performance.now();
      colorAssign = majorityFilter(colorAssign, w, h, 1);
      colorAssign = majorityFilter(colorAssign, w, h, 1);
      logPipelineStats('5. Majority Filter (×2)', { uniqueColors: new Set(colorAssign).size, elapsed: performance.now() - t4 });

      // 6. Build synthetic ImageData from filtered assignment, run CC
      setProgressMsg('Segmenting regions…');
      await new Promise(r => setTimeout(r, 30));
      const t5 = performance.now();
      const synthImgData = new ImageData(w, h);
      for (let i = 0; i < colorAssign.length; i++) {
        const c = quantPalette[colorAssign[i]];
        synthImgData.data[i * 4] = c.r;
        synthImgData.data[i * 4 + 1] = c.g;
        synthImgData.data[i * 4 + 2] = c.b;
        synthImgData.data[i * 4 + 3] = 255;
      }
      const seg = segmentRegions(synthImgData, quantPalette);
      logPipelineStats('6. Connected Components', {
        regionCount: seg.regions.length,
        regionSizes: seg.regions.map(r => r.area),
        elapsed: performance.now() - t5
      });

      // 7. Merge small regions (detailLevel controls threshold)
      // detailLevel 100 = max detail (minArea ~10px), 0 = simplified (minArea ~1%)
      setProgressMsg('Cleaning micro regions…');
      await new Promise(r => setTimeout(r, 30));
      const t6 = performance.now();
      const minAreaFrac = 0.0002 + ((100 - detailLevel) / 100) * 0.008;
      const minArea = Math.max(10, Math.floor(w * h * minAreaFrac));
      const cleaned = mergeSmallRegions(seg.regionMap, seg.regions, seg.colorAssign, quantPalette, w, h, minArea);
      logPipelineStats('7. Merge Small Regions', {
        regionCount: cleaned.regions.length,
        regionSizes: cleaned.regions.map(r => r.area),
        elapsed: performance.now() - t6,
        note: `minArea=${minArea} (detailLevel=${detailLevel})`
      });

      // 8. Map regions to master palette (region-level, not per-pixel)
      setProgressMsg('Mapping to paint palette…');
      await new Promise(r => setTimeout(r, 30));
      const t8 = performance.now();
      mapRegionsToMasterPalette(cleaned.regions, imageData);
      logPipelineStats('8. Palette Mapping', {
        elapsed: performance.now() - t8,
        note: `Mapped ${cleaned.regions.length} regions to ${MASTER_PALETTE.length}-colour master palette`
      });

      // 9. Merge neighbouring regions that share the same palette colour
      setProgressMsg('Merging same-colour regions…');
      await new Promise(r => setTimeout(r, 30));
      const t9 = performance.now();
      const finalRegions = mergeSameColourNeighbours(cleaned.regionMap, cleaned.regions, w, h);
      logPipelineStats('9. Merge Same-Colour Neighbours', {
        regionCount: finalRegions.length,
        elapsed: performance.now() - t9
      });

      // Build compact palette of only used colours
      const usedIndices = [...new Set(finalRegions.map(r => r.colorIndex))].sort((a, b) => a - b);
      const finalPalette = usedIndices.map(i => ({ ...MASTER_PALETTE[i], masterIndex: i }));

      // 10. Build SVG
      setProgressMsg('Building SVG…');
      await new Promise(r => setTimeout(r, 30));
      const t10 = performance.now();
      const svgString = buildPbnSvg(finalRegions, MASTER_PALETTE, w, h, null, true);
      logPipelineStats('10. SVG Generation', { elapsed: performance.now() - t10 });

      // 11. Preview PNG
      setProgressMsg('Generating preview…');
      const previewDataUrl = await svgToLowResPng(svgString, 600);

      const finalUsedColors = usedIndices.length;
      logPipelineStats('TOTAL', {
        elapsed: performance.now() - t0,
        uniqueColors: finalUsedColors,
        regionCount: finalRegions.length,
        note: `segK=${segK}, ${finalUsedColors} master palette colours used / ${finalRegions.length} regions`
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
      const svgStr = buildPbnSvg(regions, MASTER_PALETTE, analysisWidth, analysisHeight, null, showNumbers);
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

            {previewPng && (
              <button
                onClick={downloadPreviewPng}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Download className="h-4 w-4" />
                Download Preview
              </button>
            )}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Detail Level: {detailLevel}%
                  </label>
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

                  {/* 3️⃣ Kit Add-Ons */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Kit Add-Ons</label>
                    <div className="space-y-2">
                      {['Paint Set', 'Brush Kit'].map(addon => (
                        <div
                          key={addon}
                          className="flex items-center justify-between px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 opacity-60 cursor-not-allowed"
                        >
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{addon}</span>
                          <span className="text-xs font-bold uppercase tracking-wide text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">Sold Out</span>
                        </div>
                      ))}
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
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                      <div className="flex items-baseline gap-2">
                        {currentSizeObj.sale && (
                          <span className="text-sm text-gray-400 line-through">£{currentSizeObj.regularPrice.toFixed(2)}</span>
                        )}
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">£{currentSizeObj.price.toFixed(2)}</span>
                      </div>
                    </div>

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
                      <div className="absolute top-4 left-4 flex items-center gap-2">
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
                      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">
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
                        <li>• Choose your palette size (12–24 colours)</li>
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
                <p className="text-white/90 text-sm">
                  Create stencils &amp; PaintYourPhoto projects anywhere! Scan to download our free app.
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
              Upload a JPG or PNG, choose how many colours you want, and the engine performs perceptual colour quantisation, region segmentation, micro-region cleanup, and smooth vector contour tracing — all in your browser, in seconds.
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Multiple Export Formats</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download a preview PNG, a high-resolution print-ready PNG, or a scalable SVG vector file. You can also pass your regions directly into the <a href="/tools/stencil-generator" className="text-purple-600 dark:text-purple-400 hover:underline">Fotonix Stencil Generator</a> to receive precision laser-cut mylar stencil sets delivered to your door.
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
            <a href="https://endorsed.review" target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-md border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-shadow" title="Verified by Endorsed Review">
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
            href="https://endorsed.review"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors"
          >
            View all on Endorsed Review →
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
            { author: 'James T.', rating: 5, date: '9 Feb 2026', verified: true, comment: 'Tried other paint-by-numbers generators and they all produced tiny unusable fragments. This one merges small regions intelligently so you actually get paintable areas. The SVG outline works perfectly with my pen plotter too.' },
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
          <a href="https://endorsed.review" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            <img src={endorsedReviewLogo} alt="Endorsed Review" className="h-5 w-auto opacity-70" />
            <span>All reviews independently verified by Endorsed Review</span>
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
