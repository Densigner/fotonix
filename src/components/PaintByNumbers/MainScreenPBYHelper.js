// ─── PBN Palette Helper ─────────────────────────────────────────────────────
//
// Pure functions for palette solving, region classification, and colour mapping.
// No UI dependencies — operates only on region data.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Colour Science ─────────────────────────────────────────────────────────

function rgbToLab(r, g, b) {
  let lr = r / 255, lg = g / 255, lb = b / 255;
  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;
  let x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  let y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750);
  let z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

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

// ─── Master Palette ─────────────────────────────────────────────────────────

const MASTER_PALETTE = [
  { name: 'Titanium White',    r: 255, g: 255, b: 255 },
  { name: 'Light Grey',        r: 200, g: 200, b: 200 },
  { name: 'Medium Grey',       r: 140, g: 140, b: 140 },
  { name: 'Dark Grey',         r:  80, g:  80, b:  80 },
  { name: 'Carbon Black',      r:  20, g:  20, b:  20 },
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
  { name: 'Light Iris Blue',   r: 120, g: 165, b: 210 },
  { name: 'Deep Iris Blue',    r:  65, g: 105, b: 160 },
  { name: 'Hazel Iris',        r: 145, g: 115, b:  65 },
  { name: 'Dark Iris Brown',   r:  80, g:  55, b:  40 },
  { name: 'Soft Rose',         r: 200, g: 120, b: 120 },
  { name: 'Muted Red',         r: 175, g:  65, b:  60 },
  { name: 'Brick Red',         r: 145, g:  50, b:  45 },
  { name: 'Deep Burgundy',     r: 100, g:  30, b:  35 },
  { name: 'Burnt Sienna',      r: 160, g:  85, b:  50 },
  { name: 'Raw Umber',         r: 130, g: 100, b:  70 },
  { name: 'Warm Brown',        r: 110, g:  70, b:  45 },
  { name: 'Chocolate Brown',   r:  80, g:  50, b:  35 },
  { name: 'Dark Umber',        r:  55, g:  35, b:  25 },
  { name: 'Sky Blue',          r: 135, g: 185, b: 225 },
  { name: 'Cerulean',          r:  65, g: 130, b: 195 },
  { name: 'Slate Blue',        r:  85, g: 100, b: 140 },
  { name: 'Deep Navy',         r:  30, g:  40, b:  75 },
  { name: 'Muted Green',       r: 120, g: 160, b: 110 },
  { name: 'Olive Green',       r:  95, g: 115, b:  65 },
  { name: 'Forest Green',      r:  45, g:  75, b:  45 },
  { name: 'Warm Yellow',       r: 240, g: 210, b: 120 },
  { name: 'Yellow Ochre',      r: 200, g: 170, b:  90 },
  { name: 'Muted Gold',        r: 175, g: 145, b:  75 },
].map(c => ({ ...c, lab: rgbToLab(c.r, c.g, c.b), hex: rgbToHex(c.r, c.g, c.b) }));

// ─── Skin Detection ─────────────────────────────────────────────────────────

function isSkinLab(lab) {
  const [L, a, b] = lab;
  return L > 35 && L < 90 && a > 2 && a < 28 && b > 5 && b < 40;
}

/**
 * Detect potential skin regions using colour heuristics.
 *
 * @param {Array} regions  – region objects with .pixels, .area
 * @param {ImageData} imageData – source image pixel data
 * @returns {number[]} array of region IDs likely to be skin
 */
function detectSkinRegions(regions, imageData) {
  const { data } = imageData;
  const skinIds = [];
  for (const region of regions) {
    if (region.area === 0) continue;
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

    // Quick RGB heuristic: skin typically has R > B and moderate warmth
    if (avgR > avgB + 15 && avgR > 60 && avgG > 40) {
      const avgLab = rgbToLab(avgR, avgG, avgB);
      if (isSkinLab(avgLab)) {
        skinIds.push(region.id);
      }
    }
  }
  return skinIds;
}

// ─── Same-Colour Neighbour Merge ────────────────────────────────────────────

function mergeSameColourNeighbours(regionMap, regions, width, height) {
  const byId = new Map();
  for (const r of regions) byId.set(r.id, r);

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

  while (queue.length > 0) {
    const [aId, bId] = queue.pop();
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b || a.area === 0 || b.area === 0) continue;
    if (a.colorIndex !== b.colorIndex) continue;

    const [keep, absorb] = a.area >= b.area ? [a, b] : [b, a];
    for (const px of absorb.pixels) {
      regionMap[px] = keep.id;
    }
    keep.pixels.push(...absorb.pixels);
    keep.area += absorb.area;

    const absorbAdj = adjacency.get(absorb.id);
    if (absorbAdj) {
      for (const nId of absorbAdj) {
        if (nId === keep.id) continue;
        const nAdj = adjacency.get(nId);
        if (nAdj) {
          nAdj.delete(absorb.id);
          nAdj.add(keep.id);
        }
        adjacency.get(keep.id)?.add(nId);
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
    adjacency.delete(absorb.id);
    adjacency.get(keep.id)?.delete(absorb.id);
    absorb.pixels = [];
    absorb.area = 0;
  }

  return regions.filter(r => r.area > 0);
}

// ─── Palette Solving ────────────────────────────────────────────────────────

/**
 * Solve palette assignment for a set of segmented regions.
 *
 * Assigns sequential display numbers and merges adjacent regions that
 * share the same colour index. This is the post-segmentation palette step.
 *
 * @param {Object} opts
 * @param {Array}    opts.regions    – region objects from segmentation
 * @param {Array}    opts.palette    – quantised palette (from k-means)
 * @param {Int32Array} opts.regionMap – pixel → region ID map
 * @param {number}   opts.width
 * @param {number}   opts.height
 * @returns {{ regions: Array, palette: Array }} final regions and compact palette
 */
function solvePaletteForRegions({ regions, palette, regionMap, width, height }) {
  // 1. Assign sequential display numbers based on used colour indices
  const usedColorIndices = [
    ...new Set(regions.filter(r => r.area > 0).map(r => r.colorIndex))
  ].sort((a, b) => a - b);

  const colorToNumber = new Map();
  usedColorIndices.forEach((ci, i) => colorToNumber.set(ci, i + 1));

  for (const region of regions) {
    if (region.area === 0) continue;
    region.displayNumber = colorToNumber.get(region.colorIndex) || 0;
  }

  // 2. Merge adjacent regions sharing the same colour
  const finalRegions = mergeSameColourNeighbours(regionMap, regions, width, height);

  // 3. Build compact palette of only used colours
  const usedIndices = [
    ...new Set(finalRegions.map(r => r.colorIndex))
  ].sort((a, b) => a - b);
  const finalPalette = usedIndices.map(i => ({ ...palette[i], masterIndex: i }));

  return { regions: finalRegions, palette: finalPalette };
}

// ─── Snap to Master Palette ─────────────────────────────────────────────────

/**
 * Map region colours to the closest master palette colour AFTER segmentation.
 *
 * Computes each region's average RGB from imageData, converts to Lab, and
 * finds the nearest MASTER_PALETTE entry by ΔE. Assigns region.colorIndex
 * and region.displayNumber accordingly.
 *
 * @param {Array}     regions       – region objects with .pixels, .area
 * @param {Object}    masterPalette – palette array (defaults to MASTER_PALETTE)
 * @param {ImageData} imageData     – source image pixel data
 */
function snapRegionColoursToPalette(regions, imageData, masterPalette = MASTER_PALETTE) {
  const { data } = imageData;
  for (const region of regions) {
    if (region.area === 0) continue;
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

    let bestIdx = 0, bestD = Infinity;
    for (let i = 0; i < masterPalette.length; i++) {
      const d = deltaE(avgLab, masterPalette[i].lab);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    region.colorIndex = bestIdx;
    region.displayNumber = bestIdx + 1;
  }
}

// ─── Paint List for Fulfillment ─────────────────────────────────────────────

/**
 * Build a paint mixing list that maps each numbered colour in the PBN
 * to the closest physical paint from the master palette.
 *
 * This is a READ-ONLY operation — it does NOT modify regions or the SVG.
 * Use it after order placement to generate the paint pot list for production.
 *
 * @param {Array} finalPalette  – compact palette from solvePaletteForRegions
 *                                (each entry has r, g, b, hex, masterIndex)
 * @param {Array} regions       – final regions (each has .displayNumber, .colorIndex, .area)
 * @param {Array} [masterPalette=MASTER_PALETTE] – physical paint reference
 * @returns {Array} paint list sorted by display number:
 *   [{
 *     number:        1,           // display number on the canvas
 *     quantisedHex:  '#A1B2C3',   // the k-means colour shown on screen
 *     paintName:     'Warm Shadow',// closest master palette paint name
 *     paintHex:      '#9E7E70',   // master palette hex
 *     paintIndex:    25,          // index in MASTER_PALETTE
 *     deltaE:        4.2,         // Lab distance (lower = closer match)
 *     regionCount:   3,           // how many regions use this number
 *     totalPixels:   12400,       // combined pixel area
 *   }]
 */
function buildPaintList(finalPalette, regions, masterPalette = MASTER_PALETTE) {
  // Map displayNumber → regions using it
  const numberToRegions = new Map();
  for (const r of regions) {
    if (r.area === 0) continue;
    const n = r.displayNumber;
    if (!numberToRegions.has(n)) numberToRegions.set(n, []);
    numberToRegions.get(n).push(r);
  }

  const paintList = [];

  for (const palEntry of finalPalette) {
    const qLab = palEntry.lab || rgbToLab(palEntry.r, palEntry.g, palEntry.b);
    const qHex = palEntry.hex || rgbToHex(palEntry.r, palEntry.g, palEntry.b);

    // Find closest master palette entry
    let bestIdx = 0, bestD = Infinity;
    for (let i = 0; i < masterPalette.length; i++) {
      const d = deltaE(qLab, masterPalette[i].lab);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }

    // Find which display number this palette entry maps to
    const matchingRegions = regions.filter(
      r => r.area > 0 && r.colorIndex === palEntry.masterIndex
    );
    const displayNum = matchingRegions.length > 0 ? matchingRegions[0].displayNumber : 0;

    paintList.push({
      number:       displayNum,
      quantisedHex: qHex,
      paintName:    masterPalette[bestIdx].name,
      paintHex:     masterPalette[bestIdx].hex,
      paintIndex:   bestIdx,
      deltaE:       Math.round(bestD * 10) / 10,
      regionCount:  matchingRegions.length,
      totalPixels:  matchingRegions.reduce((sum, r) => sum + r.area, 0),
    });
  }

  paintList.sort((a, b) => a.number - b.number);
  return paintList;
}

// ─── Exports ────────────────────────────────────────────────────────────────

export {
  solvePaletteForRegions,
  snapRegionColoursToPalette,
  detectSkinRegions,
  mergeSameColourNeighbours,
  buildPaintList,
  MASTER_PALETTE,
};
