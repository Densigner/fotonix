/**
 * AM (Amplitude-Modulated) Dot Halftone Generator
 * 
 * Classic AM halftone: fixed orthogonal grid of perfectly circular dots
 * where brightness is encoded exclusively by dot radius.
 * 
 * Features:
 * - Fixed spacing grid, varying dot sizes (NOT density)
 * - Crisp circular dots that NEVER merge
 * - Smooth tone transitions, no banding
 * - Minimum feature size enforcement for Mylar/laser cutting
 * - Strict gap enforcement between all dots
 */

/**
 * Default options for classic AM halftone
 */
export const DEFAULT_HALFTONE_OPTIONS = {
  dpi: 300,
  dotSpacingMm: 1.2,
  gamma: 1.0,                    // 1.0 = linear, <1 = darker midtones, >1 = lighter midtones
  contrast: 1.3,                 // Boost contrast for punchy halftone look
  blurRadiusPx: 1.5,             // Light blur to prevent speckle
  lightCutoff: 0.88,             // Above this brightness, no dot (clean highlights)
  darkCutoff: 0.05,              // Below this brightness, use maximum dot size
  minDotSizeFraction: 0.15,      // Minimum dot as fraction of max (prevents too-small dots)
  minCutDiameterMm: 0.8,         // FIXED at 0.8mm for laser safety - do not change
  minWebMm: 0.4,                 // Minimum material between holes (dots NEVER touch)
  invert: false,
  rotationDeg: 0,                // 0 = orthogonal grid (classic look)
  maxCircles: 250000,
};

/**
 * Preset configurations for common use cases
 */
export const HALFTONE_PRESETS = {
  fine: {
    dotSpacingMm: 1.0,
    minWebMm: 0.3,
    gamma: 0.9,
    contrast: 1.4,
  },
  standard: {
    dotSpacingMm: 1.2,
    minWebMm: 0.4,
    gamma: 1.0,
    contrast: 1.3,
  },
  coarse: {
    dotSpacingMm: 2.0,
    minWebMm: 0.5,
    gamma: 1.1,
    contrast: 1.2,
  },
  bold: {
    dotSpacingMm: 1.5,
    minWebMm: 0.35,
    gamma: 0.85,
    contrast: 1.5,
  },
};

// Fixed laser safety constant - do not allow user to change
export const MIN_CUT_DIAMETER_MM = 0.8;

/**
 * Utility: clamp value between min and max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Apply default values to options
 */
function applyDefaults(opts) {
  return {
    outputWidthMm: opts.outputWidthMm,
    outputHeightMm: opts.outputHeightMm,
    dpi: opts.dpi ?? 300,
    dotSpacingMm: opts.dotSpacingMm ?? 1.2,
    rotationDeg: opts.rotationDeg ?? 0,
    gamma: opts.gamma ?? 1.0,
    contrast: opts.contrast ?? 1.3,
    blurRadiusPx: opts.blurRadiusPx ?? 1.5,
    lightCutoff: opts.lightCutoff ?? 0.88,
    darkCutoff: opts.darkCutoff ?? 0.05,
    minDotSizeFraction: opts.minDotSizeFraction ?? 0.15,
    minCutDiameterMm: opts.minCutDiameterMm ?? 0.5,
    minWebMm: opts.minWebMm ?? 0.4,
    invert: opts.invert ?? false,
    maxCircles: opts.maxCircles ?? 250000,
  };
}

/**
 * Apply contrast adjustment to image data
 * Uses sigmoid-like curve for natural contrast boost
 */
function applyContrast(imageData, contrast) {
  const data = imageData.data;
  // Standard contrast formula
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(Math.round(factor * (data[i] - 128) + 128), 0, 255);
    data[i + 1] = clamp(Math.round(factor * (data[i + 1] - 128) + 128), 0, 255);
    data[i + 2] = clamp(Math.round(factor * (data[i + 2] - 128) + 128), 0, 255);
  }

  return imageData;
}

/**
 * Fast box blur implementation (separable, 2-pass)
 * Provides smooth anti-speckle preprocessing
 */
function boxBlur(imageData, radius) {
  if (radius < 1) return imageData;

  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const temp = new Uint8ClampedArray(data.length);
  const r = Math.round(radius);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      let count = 0;

      for (let kx = -r; kx <= r; kx++) {
        const sx = clamp(x + kx, 0, width - 1);
        const idx = (y * width + sx) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        aSum += data[idx + 3];
        count++;
      }

      const outIdx = (y * width + x) * 4;
      temp[outIdx] = rSum / count;
      temp[outIdx + 1] = gSum / count;
      temp[outIdx + 2] = bSum / count;
      temp[outIdx + 3] = aSum / count;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      let count = 0;

      for (let ky = -r; ky <= r; ky++) {
        const sy = clamp(y + ky, 0, height - 1);
        const idx = (sy * width + x) * 4;
        rSum += temp[idx];
        gSum += temp[idx + 1];
        bSum += temp[idx + 2];
        aSum += temp[idx + 3];
        count++;
      }

      const outIdx = (y * width + x) * 4;
      output[outIdx] = rSum / count;
      output[outIdx + 1] = gSum / count;
      output[outIdx + 2] = bSum / count;
      output[outIdx + 3] = aSum / count;
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Preprocess image: scale to output size and apply blur + contrast
 */
function preprocessImage(source, targetWidth, targetHeight, blurRadius, contrast) {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  // Draw source image scaled to target
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = source.width;
  sourceCanvas.height = source.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  sourceCtx.putImageData(source, 0, 0);

  // Scale with high-quality interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

  // Get scaled image data
  let imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

  // Apply blur first (reduces noise before contrast boost)
  if (blurRadius > 0) {
    imageData = boxBlur(imageData, blurRadius);
  }

  // Apply contrast adjustment
  if (contrast !== 1.0) {
    imageData = applyContrast(imageData, contrast);
  }

  return imageData;
}

/**
 * Compute luminance from RGB
 * Uses standard ITU-R BT.601 coefficients
 */
function getLuminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Tone curve: maps luminance to dot size factor
 * Returns 0-1 where 0 = no dot, 1 = maximum dot
 */
function toneToSizeFactor(luminance, gamma, lightCutoff, darkCutoff, minSizeFraction) {
  // Very light areas: no dot
  if (luminance >= lightCutoff) {
    return 0;
  }
  
  // Very dark areas: maximum dot
  if (luminance <= darkCutoff) {
    return 1;
  }
  
  // Map luminance to 0-1 range within cutoffs
  // Invert: dark (low lum) = large dot (high factor)
  const normalized = (lightCutoff - luminance) / (lightCutoff - darkCutoff);
  
  // Apply gamma curve for smooth midtones
  // gamma < 1: darker midtones (larger dots in midtones)
  // gamma > 1: lighter midtones (smaller dots in midtones)
  const curved = Math.pow(normalized, gamma);
  
  // Scale to range [minSizeFraction, 1]
  // This ensures even light-ish areas have visible dots (if above cutoff)
  return minSizeFraction + curved * (1 - minSizeFraction);
}

/**
 * Generate the halftone grid
 * Classic AM: fixed positions, variable radii
 */
function generateGrid(
  imageData,
  outputWidthPx,
  outputHeightPx,
  stepPx,
  rotationDeg,
  gamma,
  lightCutoff,
  darkCutoff,
  minSizeFraction,
  minRadiusPx,
  maxRadiusPx
) {
  const dots = [];
  const { width, height, data } = imageData;

  // Rotation setup
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  // For rotated grids, extend coverage
  const diagonal = Math.sqrt(outputWidthPx ** 2 + outputHeightPx ** 2);
  const gridExtent = rotationDeg === 0 ? Math.max(outputWidthPx, outputHeightPx) : diagonal * 1.2;

  // Grid origin (center for rotation)
  const originX = outputWidthPx / 2;
  const originY = outputHeightPx / 2;

  // Calculate grid range
  const halfCols = Math.ceil(gridExtent / stepPx / 2) + 1;
  const halfRows = Math.ceil(gridExtent / stepPx / 2) + 1;

  for (let row = -halfRows; row <= halfRows; row++) {
    for (let col = -halfCols; col <= halfCols; col++) {
      // Grid position before rotation
      const gx = col * stepPx;
      const gy = row * stepPx;

      // Apply rotation around origin
      const cx = originX + gx * cos - gy * sin;
      const cy = originY + gx * sin + gy * cos;

      // Skip if outside output bounds (with small margin)
      const margin = maxRadiusPx;
      if (cx < -margin || cx >= outputWidthPx + margin || 
          cy < -margin || cy >= outputHeightPx + margin) {
        continue;
      }

      // Sample luminance at this grid position
      // Map to source image coordinates
      const sampleX = clamp(Math.floor((cx / outputWidthPx) * width), 0, width - 1);
      const sampleY = clamp(Math.floor((cy / outputHeightPx) * height), 0, height - 1);
      const idx = (sampleY * width + sampleX) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Handle transparent pixels as white (no dot)
      if (a < 128) {
        continue;
      }

      // Calculate luminance
      const luminance = getLuminance(r, g, b);

      // Get dot size factor from tone curve
      const sizeFactor = toneToSizeFactor(luminance, gamma, lightCutoff, darkCutoff, minSizeFraction);

      // Skip if no dot needed
      if (sizeFactor <= 0) {
        continue;
      }

      // Calculate actual radius
      let radius = sizeFactor * maxRadiusPx;

      // Enforce minimum radius (laser safety)
      if (radius < minRadiusPx) {
        // For very small dots, either skip or use minimum
        if (sizeFactor < minSizeFraction * 0.5) {
          // Too small, skip entirely
          continue;
        }
        radius = minRadiusPx;
      }

      // Clamp to maximum (ensures gap between dots)
      radius = Math.min(radius, maxRadiusPx);

      dots.push({ cx, cy, radius });
    }
  }

  return dots;
}

/**
 * Build the final SVG string
 * Clean vector output with circles
 */
function buildSVG(dots, widthPx, heightPx, widthMm, heightMm, invert) {
  const precision = 3;
  const lines = [];

  // SVG header with mm dimensions and px viewBox
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthPx} ${heightPx}">`
  );

  // Metadata comment
  lines.push(`  <!-- AM Dot Halftone | ${dots.length} circles -->`);

  if (invert) {
    // Inverted: background is cut, dots remain as material
    lines.push(`  <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="black"/>`);
    lines.push(`  <g fill="white">`);
  } else {
    // Normal: dots are cut (black = laser cut area)
    lines.push(`  <g fill="black">`);
  }

  // Output all circles
  for (const dot of dots) {
    lines.push(
      `    <circle cx="${dot.cx.toFixed(precision)}" cy="${dot.cy.toFixed(precision)}" r="${dot.radius.toFixed(precision)}"/>`
    );
  }

  lines.push(`  </g>`);
  lines.push(`</svg>`);

  return lines.join('\n');
}

/**
 * Main entry point: generates an SVG string from an image using AM halftone
 * 
 * Classic AM halftone: fixed orthogonal grid of perfectly circular dots
 * where brightness is encoded exclusively by dot radius.
 * 
 * @param {ImageData} imageData - Source image data
 * @param {Object} opts - Halftone options
 * @returns {string} SVG string
 */
export function generateDotHalftoneSVG(imageData, opts) {
  // Apply defaults
  const config = applyDefaults(opts);

  // Calculate output pixel dimensions from mm and dpi
  const outputWidthPx = Math.round((config.outputWidthMm / 25.4) * config.dpi);
  const outputHeightPx = Math.round((config.outputHeightMm / 25.4) * config.dpi);

  // Convert mm to px for spacing and constraints
  const stepPx = (config.dotSpacingMm / 25.4) * config.dpi;
  const minWebPx = (config.minWebMm / 25.4) * config.dpi;
  const minCutDiameterPx = (config.minCutDiameterMm / 25.4) * config.dpi;

  // Calculate max dot radius: ensures dots NEVER touch
  // maxDiameter = stepPx - minWebPx (leaves gap between adjacent dots)
  const maxDiameterPx = stepPx - minWebPx;
  const maxRadiusPx = maxDiameterPx / 2;

  // Minimum radius for laser cutting
  const minRadiusPx = minCutDiameterPx / 2;

  // Validate configuration
  if (maxRadiusPx < minRadiusPx) {
    console.warn(
      `[dotHalftone] Warning: Grid spacing too tight for min web. ` +
      `maxRadius (${maxRadiusPx.toFixed(2)}px) < minRadius (${minRadiusPx.toFixed(2)}px). ` +
      `Increase dotSpacingMm or decrease minWebMm.`
    );
  }

  // Check circle count estimate
  const estimatedCols = Math.ceil(outputWidthPx / stepPx);
  const estimatedRows = Math.ceil(outputHeightPx / stepPx);
  const estimatedCircles = estimatedCols * estimatedRows;

  let effectiveStepPx = stepPx;
  let effectiveMaxRadiusPx = maxRadiusPx;

  if (estimatedCircles > config.maxCircles) {
    // Auto-increase spacing to stay within limits
    const scaleFactor = Math.sqrt(estimatedCircles / config.maxCircles);
    effectiveStepPx = stepPx * scaleFactor;
    effectiveMaxRadiusPx = (effectiveStepPx - minWebPx) / 2;
    console.warn(
      `[dotHalftone] Warning: ${estimatedCircles} circles exceeds max ${config.maxCircles}. ` +
      `Increasing spacing by ${scaleFactor.toFixed(2)}x.`
    );
  }

  // Preprocess: scale, blur, contrast
  const processedImage = preprocessImage(
    imageData,
    outputWidthPx,
    outputHeightPx,
    config.blurRadiusPx,
    config.contrast
  );

  // Generate dot grid
  const dots = generateGrid(
    processedImage,
    outputWidthPx,
    outputHeightPx,
    effectiveStepPx,
    config.rotationDeg,
    config.gamma,
    config.lightCutoff,
    config.darkCutoff,
    config.minDotSizeFraction,
    minRadiusPx,
    effectiveMaxRadiusPx
  );

  console.log(`[dotHalftone] Generated ${dots.length} dots at ${effectiveStepPx.toFixed(1)}px spacing`);

  // Build SVG
  const svg = buildSVG(
    dots,
    outputWidthPx,
    outputHeightPx,
    config.outputWidthMm,
    config.outputHeightMm,
    config.invert
  );

  return svg;
}

/**
 * Helper function to load an image from URL/file and get ImageData
 * @param {string} src - Image source URL
 * @returns {Promise<ImageData>}
 */
export async function loadImageAsImageData(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Helper function to get ImageData from a canvas element
 * @param {HTMLCanvasElement} canvas
 * @returns {ImageData}
 */
export function getImageDataFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
