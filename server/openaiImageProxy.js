// openaiImageProxy.js
// Minimal Express scaffold demonstrating Option A: server-held OpenAI key
// Responsibilities shown here:
// 1) Receive a prompt from the client
// 2) Run moderation on the prompt
// 3) Call OpenAI image generation (placeholder) and receive image bytes
// 4) Post-process the image to a black-only silhouette (simple threshold example)
// 5) Return the processed image as a base64 PNG

// NOTES:
// - This file is a prototype example. Install dependencies and set OPENAI_API_KEY
// - For real usage, add rate-limiting, authentication, storage, error handling, and robust moderation

// Load environment variables from the project .env when present (explicit path to avoid cwd issues)
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const FormData = require('form-data');
let multer;
let upload;
try {
  multer = require('multer');
  upload = multer({ dest: os.tmpdir() });
} catch (e) {
  console.warn('Optional dependency "multer" is not installed. To enable large-file uploads for /api/edit-image-upload, run: npm install multer');
  multer = null;
  upload = null;
}

// S3 upload helper (optional). Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
let uploadToS3 = null;
const s3Bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
if (s3Bucket && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  try {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    uploadToS3 = async (buffer, filename) => {
      const cmd = new PutObjectCommand({ Bucket: s3Bucket, Key: filename, Body: buffer, ContentType: 'image/png', ACL: 'public-read' });
      await s3.send(cmd);
      return `https://${s3Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
    };
  } catch (err) {
    console.warn('Failed to initialize AWS S3 client. To enable S3 uploads, run: npm install @aws-sdk/client-s3');
  }
}

const app = express();
// Increase limit so base64 images can be POSTed for edits (adjust as needed)
app.use(bodyParser.json({ limit: '10mb' }));

// Allow CORS so the React dev server can load generated images
app.use((req, res, next) => {
  // In dev allow all; consider restricting to your frontend origin in production
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  // Handle preflight
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve static files from the React `public` folder so proxy requests for /images/* succeed
const publicPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicPath));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const SKIP_OPENAI = (process.env.SKIP_OPENAI === '1' || String(process.env.SKIP_OPENAI).toLowerCase() === 'true');
// Log presence (masked) so we can verify dotenv loaded without printing the secret
console.log('OPENAI_API_KEY present:', Boolean(OPENAI_API_KEY));
console.log('SKIP_OPENAI dev fallback enabled:', SKIP_OPENAI);
if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set — this server prototype will not call OpenAI until you set it.');
}

// Helper: robustly parse boolean-like form fields which may arrive as string, number, boolean, or array (multer sometimes yields arrays)
function parseBoolField(v) {
  if (Array.isArray(v)) v = v[0];
  if (v === true) return true;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
  }
  return false;
}

// Simple moderation stub using OpenAI moderation endpoint (replace with real SDK if desired)
async function moderatePrompt(prompt) {
  // Dev helper: if SKIP_OPENAI is enabled, bypass OpenAI moderation so local testing can proceed
  if (SKIP_OPENAI) return { ok: true, details: { skipped: 'SKIP_OPENAI' } };
  if (!OPENAI_API_KEY) return { ok: false, reason: 'no_api_key' };
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ input: prompt })
  });
  const j = await res.json();
  // Basic check: if flagged, reject.
  const flagged = j.results && j.results[0] && j.results[0].flagged;
  return { ok: !flagged, details: j };
}

// Convert any input image buffer into a black-on-transparent PNG suitable for engraving
// Steps:
// 1) Resize to target size
// 2) Grayscale + threshold to produce a binary mask
// 3) Invert the mask so black areas become opaque (alpha=255) and white becomes transparent (alpha=0)
// 4) Compose a black RGB image and join the inverted mask as the alpha channel
async function toSilhouette(inputBuffer, size = 1024) {
  try {
    // Coerce common input shapes to Buffer
    let buf = inputBuffer;
    if (!Buffer.isBuffer(buf)) {
      if (typeof buf === 'string') {
        if (buf.startsWith('data:')) {
          const parts = buf.split(',');
          buf = Buffer.from(parts[1], 'base64');
        } else {
          buf = Buffer.from(buf);
        }
      } else if (buf && typeof buf === 'object' && buf.constructor && buf.constructor.name === 'FormData') {
        throw new Error('toSilhouette received FormData object; expected raw Buffer or data URL');
      } else if (buf && typeof buf === 'object' && typeof buf.pipe === 'function') {
        throw new Error('toSilhouette received a Stream; convert to Buffer before calling');
      } else {
        try { buf = Buffer.from(buf); } catch (e) { throw new Error('toSilhouette could not coerce input to Buffer: ' + String(e)); }
      }
    }

    // Get a single-channel binary mask (0 or 255) as raw data
    const bwObj = await sharp(buf)
      .resize(size, size, { fit: 'cover' })
      .grayscale()
      .threshold(180)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: bwData, info } = bwObj;
    const { width, height, channels } = info; // channels expected to be 1

    // Build inverted alpha (foreground opaque) by flipping each byte: 255 - value
    const alpha = Buffer.alloc(width * height);
    for (let i = 0; i < width * height; i++) alpha[i] = 255 - bwData[i];

    // Build RGBA buffer: RGB=0 (black), A=alpha
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const base = i * 4;
      rgba[base + 0] = 0; // R
      rgba[base + 1] = 0; // G
      rgba[base + 2] = 0; // B
      rgba[base + 3] = alpha[i]; // A
    }

    // Encode as PNG and return
    const outBuffer = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
    return outBuffer;
  } catch (err) {
    console.error('toSilhouette error - invalid input or sharp failure:', err && err.message ? err.message : err);
    throw err;
  }
}

// Auto-generate a mask PNG for inpainting: transparent where the algorithm detects foreground
// (areas to be edited) and opaque elsewhere. This is a heuristic; results vary by image.
// Accepts optional width/height so the generated mask can match the exact input image dimensions.
async function autoGenerateMask(inputBuffer, width = 1024, height = 1024) {
  try {
  let buf = inputBuffer;
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
    // Produce a binary mask where bright areas (background) are white (255) and darker areas are black (0)
    // Resize to the exact width/height of the original image so OpenAI accepts the mask.
    const bwObj = await sharp(buf)
      .resize(width, height, { fit: 'cover' })
      .grayscale()
      // slight blur helps reduce noise before thresholding
      .blur(1)
      .threshold(180)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data: bwData, info } = bwObj;
    const imgWidth = info.width;
    const imgHeight = info.height;

    // bwData: 0 (black) = foreground (e.g., monkey), 255 (white) = background
    // For OpenAI mask: transparent pixels (alpha=0) are replaced; opaque (alpha=255) are preserved.
    // We want foreground to be transparent (editable), so use alpha = bwData (where 0 -> 0, 255 -> 255)
    const rgba = Buffer.alloc(imgWidth * imgHeight * 4);
    for (let i = 0; i < imgWidth * imgHeight; i++) {
      const base = i * 4;
      // white RGB channel (not important), alpha from bwData
      rgba[base + 0] = 255;
      rgba[base + 1] = 255;
      rgba[base + 2] = 255;
      rgba[base + 3] = bwData[i];
    }
    const maskPng = await sharp(rgba, { raw: { width: imgWidth, height: imgHeight, channels: 4 } }).png().toBuffer();
    return maskPng;
  } catch (err) {
    console.warn('autoGenerateMask failed:', err && err.message ? err.message : err);
    throw err;
  }
}

// Process an existing mask PNG buffer: optionally tighten (erode) or invert the alpha channel.
// tighten: reduces the editable area by performing a simple neighborhood erosion on alpha.
// invert: flips alpha -> 255-alpha
async function processMaskBuffer(maskBuffer, { tighten = false, invert = false } = {}) {
  if (!maskBuffer) return null;
  // decode mask PNG into raw RGBA
  const obj = await sharp(maskBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { data, info } = obj;
  const { width, height, channels } = info; // channels should be 4
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) alpha[i] = data[i * channels + 3];

  // optional invert
  if (invert) {
    for (let i = 0; i < alpha.length; i++) alpha[i] = 255 - alpha[i];
  }

  // optional tighten (erosion): for each pixel, if any neighbor within radius 1 is transparent (alpha<128), mark transparent
  if (tighten) {
    const outAlpha = Buffer.alloc(alpha.length);
    const w = width, h = height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let keep = true;
        // check 3x3 neighborhood
        for (let ny = Math.max(0, y - 1); ny <= Math.min(h - 1, y + 1); ny++) {
          for (let nx = Math.max(0, x - 1); nx <= Math.min(w - 1, x + 1); nx++) {
            const idx = ny * w + nx;
            if (alpha[idx] < 128) { keep = false; break; }
          }
          if (!keep) break;
        }
        outAlpha[y * w + x] = keep ? 255 : 0;
      }
    }
    // copy back
    for (let i = 0; i < alpha.length; i++) alpha[i] = outAlpha[i];
  }

  // rebuild RGBA buffer (white RGB, alpha from computed alpha)
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const base = i * 4;
    rgba[base + 0] = 255;
    rgba[base + 1] = 255;
    rgba[base + 2] = 255;
    rgba[base + 3] = alpha[i];
  }

  const outPng = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return outPng;
}

// Helper: perform an OpenAI Images Edits request using image and optional mask buffers.
// Returns { imgBuffer, editJson } where imgBuffer is the resulting image bytes (if any)
async function performOpenAIImageEdit({ prompt, imageBuffer, maskBuffer = null, size = '1024x1024', n = 1, maskInvert = false, maskTighten = false }) {
  if (!OPENAI_API_KEY) throw new Error('server missing API key (set OPENAI_API_KEY)');
  const form = new FormData();
  // FormData in node-fetch accepts Buffers directly
  form.append('image', imageBuffer, { filename: 'image.png', contentType: 'image/png' });
  // If mask processing requested, transform maskBuffer accordingly before appending
  if (maskBuffer && (maskInvert || maskTighten)) {
    try {
      const processedMask = await processMaskBuffer(maskBuffer, { tighten: Boolean(maskTighten), invert: Boolean(maskInvert) });
      maskBuffer = processedMask;
    } catch (pmErr) {
      console.warn('processMaskBuffer failed, using original mask as-is:', pmErr && pmErr.message ? pmErr.message : pmErr);
    }
  }
  if (maskBuffer) form.append('mask', maskBuffer, { filename: 'mask.png', contentType: 'image/png' });
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('n', String(n));

  // Debug: write a small request dump so we can verify the server actually included the image and mask
  try {
    const reqDump = {
      prompt: (prompt || '').slice(0, 200),
      size,
      n: Number(n || 1),
      imageBytes: imageBuffer ? imageBuffer.length : 0,
      imagePrefixBase64: imageBuffer ? imageBuffer.slice(0, 24).toString('base64') : null,
      maskBytes: maskBuffer ? maskBuffer.length : 0,
      maskPrefixBase64: maskBuffer ? maskBuffer.slice(0, 24).toString('base64') : null,
      ts: Date.now()
    };
    const dumpPathReq = path.resolve(os.tmpdir(), `openai-edit-request-${Date.now()}.json`);
    fs.writeFileSync(dumpPathReq, JSON.stringify(reqDump, null, 2));
    console.log('Wrote OpenAI edit request dump to', dumpPathReq);
  } catch (e) {
    console.warn('Failed to write OpenAI edit request dump', e && e.message ? e.message : e);
  }

  const editRes = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: Object.assign({ 'Authorization': `Bearer ${OPENAI_API_KEY}` }, form.getHeaders()),
    body: form
  });
  const editJson = await editRes.json();
  // persist debug dump
  try {
    const dumpPath = path.resolve(os.tmpdir(), `openai-edit-response-${Date.now()}.json`);
    fs.writeFileSync(dumpPath, JSON.stringify(editJson, null, 2));
    console.log('Wrote OpenAI edits response to', dumpPath);
  } catch (dumpErr) { console.warn('Failed to write OpenAI edits response dump', dumpErr && dumpErr.message ? dumpErr.message : dumpErr); }

  const b64 = editJson?.data?.[0]?.b64_json;
  const remoteUrl = editJson?.data?.[0]?.url;
  let outBuf = null;
  if (!b64 && remoteUrl) {
    try {
      const r = await fetch(remoteUrl);
      if (!r.ok) throw new Error(`Failed to fetch remote image: ${r.status}`);
      outBuf = await r.buffer();
    } catch (fetchErr) {
      console.error('Error fetching remote image URL from OpenAI (edits):', fetchErr);
    }
  }
  if (!outBuf && b64) outBuf = Buffer.from(b64, 'base64');
  return { imgBuffer: outBuf, editJson };
}


// POST /api/generate-image
// body: { prompt: string }
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body || {};
  // allow client to request whether the output should be converted to a silhouette
  const silhouetteFlag = (req.body && (req.body.silhouette === true || req.body.silhouette === 'true' || req.body.silhouette === '1'));
  const maskInvertFlag = parseBoolField(req.body && req.body.maskInvert);
  const maskTightenFlag = parseBoolField(req.body && req.body.maskTighten);
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });

  try {
    const mod = await moderatePrompt(prompt);
    console.log('DEBUG /api/generate-image SKIP_OPENAI=', SKIP_OPENAI, 'moderation=', mod && (mod.ok ? 'ok' : 'rejected'));
    if (!mod.ok) {
      try { console.warn('MODERATION reject details:', JSON.stringify(mod.details, null, 2)); } catch (e) { console.warn('MODERATION reject (non-serializable details)'); }
      return res.status(400).json({ error: 'prompt rejected by moderation', details: mod.details });
    }

    if (SKIP_OPENAI) {
      // Dev-only: use a local placeholder image and run the local silhouette pipeline
      try {
        const localPath = path.resolve(publicPath, 'images', 'MonkeyBBQ.png');
        const imgBufferLocal = fs.existsSync(localPath) ? fs.readFileSync(localPath) : null;
        if (!imgBufferLocal) return res.status(500).json({ error: 'local_placeholder_missing' });
        const processedLocal = await toSilhouette(imgBufferLocal, 1024);
        const outB64Local = processedLocal.toString('base64');
        const genDir = path.resolve(publicPath, 'generated');
        fs.mkdirSync(genDir, { recursive: true });
        const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
        const outPath = path.join(genDir, filename);
        fs.writeFileSync(outPath, processedLocal);
        const publicUrl = `/generated/${filename}`;
        return res.json({ imageBase64: outB64Local, url: publicUrl, fallback: 'local_processing' });
      } catch (err) {
        console.error('SKIP_OPENAI generate fallback failed', err);
        return res.status(500).json({ error: 'local_processing_failed', details: String(err) });
      }
    }

    // If an input image is provided, call the edits endpoint so OpenAI edits the provided image
    if (req.body && (req.body.imageBase64 || req.body.imageUrl)) {
      let imgBuffer = null;
      try {
        if (req.body.imageBase64) imgBuffer = Buffer.from(req.body.imageBase64, 'base64');
        else if (req.body.imageUrl) {
          const r = await fetch(req.body.imageUrl);
          if (!r.ok) return res.status(400).json({ error: 'failed to fetch imageUrl', status: r.status });
          imgBuffer = await r.buffer();
        }
      } catch (e) {
        console.warn('Failed to fetch/construct input image for generate-image edit path:', e && e.message ? e.message : e);
      }

      if (imgBuffer) {
        const maskBase64 = req.body && req.body.maskBase64 ? req.body.maskBase64 : null;
        let maskBuf = null;
        if (maskBase64) maskBuf = Buffer.from(maskBase64, 'base64');
  const { imgBuffer: editedBuf, editJson } = await performOpenAIImageEdit({ prompt, imageBuffer: imgBuffer, maskBuffer: maskBuf, size: '1024x1024', n: 1, maskInvert: maskInvertFlag, maskTighten: maskTightenFlag });
        if (!editedBuf) return res.status(500).json({ error: 'no_image_bytes_from_openai', details: editJson });
        const processed = silhouetteFlag ? await toSilhouette(editedBuf, 1024) : await sharp(editedBuf).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();

        const outB64 = processed.toString('base64');
        let meta = {};
        try { const m = await sharp(processed).metadata(); meta.imageWidth = m.width || null; meta.imageHeight = m.height || null; } catch (metaErr) { console.warn('Failed to read processed image metadata', metaErr); }
        try {
          if (typeof uploadToS3 === 'function') {
            const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
            const publicUrl = await uploadToS3(processed, filename);
            return res.json(Object.assign({ imageBase64: outB64, url: publicUrl }, meta));
          }
          const genDir = path.resolve(publicPath, 'generated');
          fs.mkdirSync(genDir, { recursive: true });
          const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
          const outPath = path.join(genDir, filename);
          fs.writeFileSync(outPath, processed);
          const publicUrl = `/generated/${filename}`;
          return res.json(Object.assign({ imageBase64: outB64, url: publicUrl }, meta));
        } catch (fsErr) {
          console.error('Failed to write generated image to disk or upload to S3:', fsErr);
          return res.json(Object.assign({ imageBase64: outB64 }, meta));
        }
      }
    }

    // No input image provided: fall back to standard generation API
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'server missing API key (set OPENAI_API_KEY)' });
    const genRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ prompt, size: '1024x1024', n: 1 })
    });
    const genJson = await genRes.json();
    try { const dumpPath = path.resolve(os.tmpdir(), `openai-gen-response-${Date.now()}.json`); fs.writeFileSync(dumpPath, JSON.stringify(genJson, null, 2)); console.log('Wrote OpenAI generation response to', dumpPath); } catch (dumpErr) { console.warn('Failed to write OpenAI generation response dump', dumpErr && dumpErr.message ? dumpErr.message : dumpErr); }
    const b64 = genJson?.data?.[0]?.b64_json; const remoteUrl = genJson?.data?.[0]?.url;
    let imgBuffer = null;
    if (!b64 && remoteUrl) {
      try { const imgRes = await fetch(remoteUrl); if (!imgRes.ok) throw new Error(`Failed to fetch remote image: ${imgRes.status}`); imgBuffer = await imgRes.buffer(); } catch (fetchErr) { console.error('Error fetching remote image URL from OpenAI:', fetchErr); }
    }
    if (!imgBuffer && b64) imgBuffer = Buffer.from(b64, 'base64');
    if (!imgBuffer) return res.status(500).json({ error: 'image generation failed', details: genJson });
    const processed = silhouetteFlag ? await toSilhouette(imgBuffer, 1024) : await sharp(imgBuffer).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
    const outB64 = processed.toString('base64'); let meta = {};
    try { const m = await sharp(processed).metadata(); meta.imageWidth = m.width || null; meta.imageHeight = m.height || null; } catch (metaErr) { console.warn('Failed to read processed image metadata', metaErr); }
    try { if (typeof uploadToS3 === 'function') { const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`; const publicUrl = await uploadToS3(processed, filename); return res.json(Object.assign({ imageBase64: outB64, url: publicUrl }, meta)); } const genDir = path.resolve(publicPath, 'generated'); fs.mkdirSync(genDir, { recursive: true }); const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`; const outPath = path.join(genDir, filename); fs.writeFileSync(outPath, processed); const publicUrl = `/generated/${filename}`; return res.json(Object.assign({ imageBase64: outB64, url: publicUrl }, meta)); } catch (fsErr) { console.error('Failed to write generated image to disk or upload to S3:', fsErr); return res.json(Object.assign({ imageBase64: outB64 }, meta)); }
  } catch (err) {
    console.error('generate-image error', err);
    res.status(500).json({ error: 'internal_error', details: String(err) });
  }
});

// POST /api/edit-image
// body: { prompt: string, imageBase64?: string, imageUrl?: string, maskBase64?: string }
// Accepts either a base64-encoded image or a URL to an image, forwards it to OpenAI's images/edits endpoint
// (multipart/form-data) and returns the processed silhouette similarly to /api/generate-image.
app.post('/api/edit-image', async (req, res) => {
  const { prompt, imageBase64, imageUrl, maskBase64 } = req.body || {};
  // parse boolean-like fields robustly
  const silhouetteFlag = parseBoolField(req.body && req.body.silhouette);
  const autoMaskFlag = parseBoolField(req.body && req.body.autoMask);
  const maskInvertFlag = parseBoolField(req.body && req.body.maskInvert);
  const maskTightenFlag = parseBoolField(req.body && req.body.maskTighten);
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });

  try {
    const mod = await moderatePrompt(prompt);
    if (!mod.ok) {
      try { console.warn('MODERATION reject details:', JSON.stringify(mod.details, null, 2)); } catch (e) { console.warn('MODERATION reject (non-serializable details)'); }
      return res.status(400).json({ error: 'prompt rejected by moderation', details: mod.details });
    }

    if (SKIP_OPENAI) {
      // Dev-only: process the provided image locally and return silhouette
      try {
        let buf = null;
        if (imageBase64) buf = Buffer.from(imageBase64, 'base64');
        else if (imageUrl) {
          const r = await fetch(imageUrl);
          if (!r.ok) return res.status(400).json({ error: 'failed to fetch imageUrl', status: r.status });
          buf = await r.buffer();
        }
        if (!buf) return res.status(400).json({ error: 'imageBase64 or imageUrl required for SKIP_OPENAI' });
  // Respect client silhouette preference for local fallback
  const processedLocal = (silhouetteFlag) ? await toSilhouette(buf, 1024) : await sharp(buf).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
        const outB64Local = processedLocal.toString('base64');
        const genDir = path.resolve(publicPath, 'generated');
        fs.mkdirSync(genDir, { recursive: true });
        const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
        const outPath = path.join(genDir, filename);
        fs.writeFileSync(outPath, processedLocal);
        const publicUrl = `/generated/${filename}`;
        return res.json({ imageBase64: outB64Local, url: publicUrl, fallback: 'local_processing' });
      } catch (err) {
        console.error('SKIP_OPENAI edit fallback failed', err);
        return res.status(500).json({ error: 'local_processing_failed', details: String(err) });
      }
    }

    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'server missing API key (set OPENAI_API_KEY)' });

    // Prepare input image file on disk (OpenAI images/edits expects file bytes) and use central helper
    const tmpFiles = [];
    try {
      // Debug: print raw body keys/values
      try { console.log('DEBUG /api/edit-image raw req.body keys:', Object.keys(req.body || {})); } catch(e){}

      let inputPath = null;
      if (imageUrl && !imageBase64) {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) return res.status(400).json({ error: 'failed to fetch imageUrl', status: imgRes.status });
        const buf = await imgRes.buffer();
        inputPath = path.join(os.tmpdir(), `input-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`);
        fs.writeFileSync(inputPath, buf);
        tmpFiles.push(inputPath);
      } else if (imageBase64) {
        const buf = Buffer.from(imageBase64, 'base64');
        inputPath = path.join(os.tmpdir(), `input-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`);
        fs.writeFileSync(inputPath, buf);
        tmpFiles.push(inputPath);
      } else {
        return res.status(400).json({ error: 'imageBase64 or imageUrl required' });
      }

      let maskPath = null;
      if (maskBase64) {
        const mpath = path.join(os.tmpdir(), `mask-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`);
        fs.writeFileSync(mpath, Buffer.from(maskBase64, 'base64'));
        maskPath = mpath;
        tmpFiles.push(maskPath);
      }

      // If client requested autoMask and no mask was provided, generate one heuristically
      if (!maskPath && autoMaskFlag) {
        try {
          const inputBufForMask = fs.readFileSync(inputPath);
          let meta = {};
          try {
            const m = await sharp(inputBufForMask).metadata();
            meta.width = m.width || 1024;
            meta.height = m.height || 1024;
          } catch (mErr) {
            console.warn('Could not read input image metadata for autoMask, defaulting to 1024x1024', mErr && mErr.message ? mErr.message : mErr);
            meta.width = 1024;
            meta.height = 1024;
          }
          const generatedMask = await autoGenerateMask(inputBufForMask, meta.width, meta.height);
          const mpath = path.join(os.tmpdir(), `mask-auto-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`);
          fs.writeFileSync(mpath, generatedMask);
          maskPath = mpath;
          tmpFiles.push(maskPath);
          console.log('autoMask: generated mask at', mpath, 'size:', meta.width + 'x' + meta.height);
        } catch (e) {
          console.warn('autoMask generation failed, continuing without mask:', e && e.message ? e.message : e);
        }
      }

      // Read buffers for helper
      const imageBuffer = fs.readFileSync(inputPath);
      let maskBuf = null;
      if (maskPath) maskBuf = fs.readFileSync(maskPath);

      // Call central helper to perform OpenAI edits
      let editedResult = null;
      try {
        editedResult = await performOpenAIImageEdit({ prompt, imageBuffer, maskBuffer: maskBuf, size: '1024x1024', n: 1 });
      } catch (editErr) {
        console.error('performOpenAIImageEdit threw:', editErr);
        editedResult = { imgBuffer: null, editJson: { error: String(editErr) } };
      }

      const editedBuf = editedResult?.imgBuffer;
      const editJson = editedResult?.editJson;

      // Fallback to local processing when OpenAI did not return bytes
      if (!editedBuf) {
        console.warn('OpenAI did not return image bytes for edit-image; falling back to local processing', editJson);
        try {
          const fallbackBuf = imageBuffer || Buffer.from(imageBase64 || '','base64');
          if (!fallbackBuf) {
            tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
            return res.status(502).json({ error: 'openai_edit_error', details: editJson });
          }
          const processedLocal = (silhouetteFlag) ? await toSilhouette(fallbackBuf, 1024) : await sharp(fallbackBuf).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
          const outB64Local = processedLocal.toString('base64');
          let meta = {};
          try { const m = await sharp(processedLocal).metadata(); meta.imageWidth = m.width || null; meta.imageHeight = m.height || null; } catch (metaErr) { console.warn('Failed to read SKIP_OPENAI processed image metadata', metaErr); }
          if (typeof uploadToS3 === 'function') {
            const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
            const publicUrl = await uploadToS3(processedLocal, filename);
            tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
            return res.json(Object.assign({ imageBase64: outB64Local, url: publicUrl, fallback: 'local_processing' }, meta));
          }
          const genDir = path.resolve(publicPath, 'generated');
          fs.mkdirSync(genDir, { recursive: true });
          const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
          const outPath = path.join(genDir, filename);
          fs.writeFileSync(outPath, processedLocal);
          const publicUrl = `/generated/${filename}`;
          tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
          return res.json({ imageBase64: outB64Local, url: publicUrl, fallback: 'local_processing', silhouetteApplied: Boolean(silhouetteFlag), imageWidth: meta.imageWidth, imageHeight: meta.imageHeight });
        } catch (localErr) {
          tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
          console.error('Local fallback processing failed', localErr);
          return res.status(502).json({ error: 'openai_edit_error', details: editJson });
        }
      }

      // Post-process edited image (silhouette or resize)
      const processed = (silhouetteFlag) ? await toSilhouette(editedBuf, 1024) : await sharp(editedBuf).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
      const outB64 = processed.toString('base64');
      // collect metadata
      let meta = {};
      try { const m = await sharp(processed).metadata(); meta.imageWidth = m.width || null; meta.imageHeight = m.height || null; } catch (metaErr) { console.warn('Failed to read edited image metadata', metaErr); }

      try {
        if (typeof uploadToS3 === 'function') {
          const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
          const publicUrl = await uploadToS3(processed, filename);
          tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
          return res.json(Object.assign({ imageBase64: outB64, url: publicUrl }, meta));
        }
        const genDir = path.resolve(publicPath, 'generated');
        fs.mkdirSync(genDir, { recursive: true });
        const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
        const outPath = path.join(genDir, filename);
        fs.writeFileSync(outPath, processed);
        const publicUrl = `/generated/${filename}`;
        tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
        return res.json(Object.assign({ imageBase64: outB64, url: publicUrl }, meta));
      } catch (fsErr) {
        console.error('Failed to write edited image to disk or upload to S3:', fsErr);
        tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
        return res.json(Object.assign({ imageBase64: outB64 }, meta));
      }
    } catch (errInner) {
      console.error('/api/edit-image internal error', errInner);
      return res.status(500).json({ error: 'internal_error', details: String(errInner) });
    }
  } catch (err) {
    console.error('edit-image error', err);
    return res.status(500).json({ error: 'internal_error', details: String(err) });
  }
});

// POST /api/edit-image-upload
// multipart/form-data: fields: prompt (string); files: image (file), mask (optional file)
// Use this endpoint for large images to avoid JSON base64 size limits.
if (upload) {
  app.post('/api/edit-image-upload', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }]), async (req, res) => {
    const prompt = req.body && req.body.prompt;
    // multer places non-file fields on req.body; support silhouette, autoMask, maskInvert and maskTighten using robust parser
    const silhouetteFlag = parseBoolField(req.body && req.body.silhouette);
    const autoMaskFlag = parseBoolField(req.body && req.body.autoMask);
    const maskInvertFlag = parseBoolField(req.body && req.body.maskInvert);
    const maskTightenFlag = parseBoolField(req.body && req.body.maskTighten);
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });

  try {
  const tmpFiles = [];
  // Debug: show raw req.body content to confirm fields arrived from the client (multer may coerce types)
  try { console.log('DEBUG /api/edit-image-upload raw req.body keys:', Object.keys(req.body || {}), 'values sample:', JSON.stringify(req.body || {}, (k,v)=> (k.length>100? undefined: v), 2)); } catch(e){}
      let imgBuffer = null;
      let imageFileEntry = null;
      // Accept several common field names used by clients: 'image', 'file', 'image[]'
      if (req.files) {
        if (req.files.image && req.files.image[0]) imageFileEntry = req.files.image[0];
        else if (req.files.file && req.files.file[0]) imageFileEntry = req.files.file[0];
        else if (req.files['image[]'] && req.files['image[]'][0]) imageFileEntry = req.files['image[]'][0];
        else {
          // Fallback: take the first file in req.files (if any)
          const keys = Object.keys(req.files || {});
          if (keys.length > 0 && Array.isArray(req.files[keys[0]]) && req.files[keys[0]][0]) imageFileEntry = req.files[keys[0]][0];
        }
      }

      if (imageFileEntry && imageFileEntry.path) {
        const imgPath = imageFileEntry.path;
        try { tmpFiles.push(imgPath); } catch (e) {}
        imgBuffer = fs.readFileSync(imgPath);
        console.log('DEBUG /api/edit-image-upload using uploaded file field, filename:', imageFileEntry.originalname || imageFileEntry.filename || 'unknown', 'path:', imgPath, 'bufferBytes:', imgBuffer.length);
      } else {
        console.log('DEBUG /api/edit-image-upload no uploaded image file found in req.files keys:', Object.keys(req.files || {}));
        return res.status(400).json({ error: 'image file required' });
      }

      let maskPath = null;
      if (req.files && req.files.mask && req.files.mask[0]) {
        maskPath = req.files.mask[0].path;
        tmpFiles.push(maskPath);
      }

      // If client requested autoMask and no explicit mask uploaded, generate one from the uploaded image
      if (!maskPath && autoMaskFlag) {
        try {
          // Derive original image size from the uploaded buffer
          let meta = {};
          try {
            const m = await sharp(imgBuffer).metadata();
            meta.width = m.width || 1024;
            meta.height = m.height || 1024;
          } catch (mErr) {
            console.warn('Could not read uploaded image metadata for autoMask (upload), defaulting to 1024x1024', mErr && mErr.message ? mErr.message : mErr);
            meta.width = 1024;
            meta.height = 1024;
          }
          const generatedMask = await autoGenerateMask(imgBuffer, meta.width, meta.height);
          const mpath = path.join(os.tmpdir(), `mask-auto-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`);
          fs.writeFileSync(mpath, generatedMask);
          maskPath = mpath;
          tmpFiles.push(maskPath);
          console.log('autoMask (upload): generated mask at', mpath, 'size:', meta.width + 'x' + meta.height);
          // If the client requested a preview step (preview=true), persist the generated mask
          // into the public/generated folder and return its URL so the client can inspect/approve
          // before the server forwards the multipart to OpenAI.
          try {
            if (parseBoolField(req.body && req.body.preview)) {
              const genDirPreview = path.resolve(publicPath, 'generated');
              fs.mkdirSync(genDirPreview, { recursive: true });
              const previewName = `mask-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
              const previewOut = path.join(genDirPreview, previewName);
              fs.writeFileSync(previewOut, generatedMask);
              // Do not remove tmpFiles here; preserve originals until client issues a confirm edit request.
              console.log('Wrote autoMask preview to', previewOut);
              // Return mask preview metadata and stop processing so client can fetch/inspect the mask
              tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
              return res.json({ preview: true, maskUrl: `/generated/${previewName}`, imageWidth: meta.width, imageHeight: meta.height });
            }
          } catch (previewErr) {
            console.warn('Failed to write mask preview or return it to client:', previewErr && previewErr.message ? previewErr.message : previewErr);
          }
        } catch (e) {
          console.warn('autoMask (upload) generation failed, continuing without mask:', e && e.message ? e.message : e);
        }
      }

  const mod = await moderatePrompt(prompt);
      if (!mod.ok) {
        try { console.warn('MODERATION reject details:', JSON.stringify(mod.details, null, 2)); } catch (e) { console.warn('MODERATION reject (non-serializable details)'); }
        tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
        return res.status(400).json({ error: 'prompt rejected by moderation', details: mod.details });
      }

      // If SKIP_OPENAI is enabled, process locally and return early before requiring an API key
    if (SKIP_OPENAI) {
        try {
      const processedLocal = (silhouetteFlag) ? await toSilhouette(imgBuffer, 1024) : await sharp(imgBuffer).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
          const outB64Local = processedLocal.toString('base64');
          // collect metadata (help client scale correctly)
          let meta = {};
          try {
            const m = await sharp(processedLocal).metadata();
            meta.imageWidth = m.width || null;
            meta.imageHeight = m.height || null;
          } catch (metaErr) { console.warn('Failed to read SKIP_OPENAI processed image metadata', metaErr); }
          const genDir = path.resolve(publicPath, 'generated');
          fs.mkdirSync(genDir, { recursive: true });
          const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
          const outPath = path.join(genDir, filename);
          fs.writeFileSync(outPath, processedLocal);
          tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
          const publicUrl = `/generated/${filename}`;
          return res.json(Object.assign({ imageBase64: outB64Local, url: publicUrl, fallback: 'local_processing' }, meta));
        } catch (err) {
          tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
          console.error('SKIP_OPENAI upload fallback failed', err);
          return res.status(500).json({ error: 'local_processing_failed', details: String(err) });
        }
      }

      if (!OPENAI_API_KEY) {
        tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
        return res.status(500).json({ error: 'server missing API key (set OPENAI_API_KEY)' });
      }

      // Use central helper: read uploaded image and optional mask into buffers
      try {
        const imageFile = req.files.image[0];
        const imgBuffer = fs.readFileSync(imageFile.path);
        tmpFiles.push(imageFile.path);
        let maskBuf = null;
        if (maskPath) {
          maskBuf = fs.readFileSync(maskPath);
          tmpFiles.push(maskPath);
        }

        // Call helper with mask processing options
        let editedResult = null;
        try {
          editedResult = await performOpenAIImageEdit({ prompt, imageBuffer: imgBuffer, maskBuffer: maskBuf, size: '1024x1024', n: 1, maskInvert: maskInvertFlag, maskTighten: maskTightenFlag });
        } catch (editErr) {
          console.error('performOpenAIImageEdit threw (upload):', editErr);
          editedResult = { imgBuffer: null, editJson: { error: String(editErr) } };
        }

        const editedBuf = editedResult?.imgBuffer;
        const editJson = editedResult?.editJson;

        if (!editedBuf) {
          console.warn('OpenAI did not return image bytes for edit-image-upload; falling back to local processing', editJson);
          try {
            const processedLocal = (silhouetteFlag) ? await toSilhouette(imgBuffer, 1024) : await sharp(imgBuffer).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
            const outB64Local = processedLocal.toString('base64');
            let meta = {};
            try { const m = await sharp(processedLocal).metadata(); meta.imageWidth = m.width || null; meta.imageHeight = m.height || null; } catch (metaErr) { console.warn('Failed to read local-fallback processed image metadata', metaErr); }
            if (typeof uploadToS3 === 'function') {
              const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
              const publicUrl = await uploadToS3(processedLocal, filename);
              tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
              return res.json(Object.assign({ imageBase64: outB64Local, url: publicUrl, fallback: 'local_processing' }, meta));
            }
            const genDir = path.resolve(publicPath, 'generated');
            fs.mkdirSync(genDir, { recursive: true });
            const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
            const outPath = path.join(genDir, filename);
            fs.writeFileSync(outPath, processedLocal);
            const publicUrl = `/generated/${filename}`;
            tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
            return res.json(Object.assign({ imageBase64: outB64Local, url: publicUrl, fallback: 'local_processing', silhouetteApplied: Boolean(silhouetteFlag) }, meta));
          } catch (localErr) {
            tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
            console.error('Local fallback processing failed (upload):', localErr);
            return res.status(502).json({ error: 'openai_edit_error', details: editJson });
          }
        }

        // Post-process edited image
        const processed = (silhouetteFlag) ? await toSilhouette(editedBuf, 1024) : await sharp(editedBuf).resize(1024, 1024, { fit: 'cover' }).png().toBuffer();
        const outB64 = processed.toString('base64');
        try {
          let meta = {};
          try { const m = await sharp(processed).metadata(); meta.imageWidth = m.width || null; meta.imageHeight = m.height || null; } catch (metaErr) { console.warn('Failed to read edited image metadata (upload):', metaErr); }
          if (typeof uploadToS3 === 'function') {
            const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
            const publicUrl = await uploadToS3(processed, filename);
            tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
            return res.json(Object.assign({ imageBase64: outB64, url: publicUrl }, meta));
          }
          const genDir = path.resolve(publicPath, 'generated');
          fs.mkdirSync(genDir, { recursive: true });
          const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
          const outPath = path.join(genDir, filename);
          fs.writeFileSync(outPath, processed);
          const publicUrl = `/generated/${filename}`;
          tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
          return res.json(Object.assign({ imageBase64: outB64, url: publicUrl }, meta));
        } catch (fsErr) {
          console.error('Failed to write edited image to disk (upload) or upload to S3:', fsErr);
          tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
          return res.json(Object.assign({ imageBase64: outB64 }, {}));
        }
      } catch (handlerErr) {
        tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
        console.error('/api/edit-image-upload internal error', handlerErr);
        return res.status(500).json({ error: 'internal_error', details: String(handlerErr) });
      }
    } catch (err) {
      console.error('edit-image-upload error', err);
      return res.status(500).json({ error: 'internal_error', details: String(err) });
    }
  });
} else {
  app.post('/api/edit-image-upload', (req, res) => res.status(500).json({ error: 'multer_not_installed', message: 'Install multer (npm install multer) to use this endpoint' }));
}

// Health endpoint to check server is alive
app.get('/health', (req, res) => res.json({ ok: true, timestamp: Date.now() }));

// Start server if run directly
if (require.main === module) {
  const port = process.env.PORT || 5002;
  const host = process.env.HOST || '0.0.0.0'; // bind all interfaces for easier local testing
  const serverInstance = app.listen(port, host, () => {
    const addr = serverInstance.address();
    if (addr && addr.address && addr.port) {
      console.log(`openaiImageProxy prototype listening on ${addr.address}:${addr.port}`);
    } else {
      // Fallback log if address() is null (avoid TypeError)
      console.log(`openaiImageProxy prototype listening (requested) on ${host}:${port}`);
    }
  });
  serverInstance.on('error', (err) => {
    console.error('Server error on listen:', err && err.code ? `${err.code} - ${err.message}` : err);
  });
  // log uncaught exceptions to help debugging
  process.on('uncaughtException', (err) => console.error('uncaughtException', err));
  process.on('unhandledRejection', (reason) => console.error('unhandledRejection', reason));
}

module.exports = app;
