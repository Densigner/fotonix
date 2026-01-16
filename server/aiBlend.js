const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { Readable } = require('stream');
const OpenAI = require('openai');

const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

async function composeImages({ guidelinePath, renderingBuffer, width, height, overlayScale = 0.8, overlayX, overlayY, overlayOpacity = 1, fit = 'contain' }) {
  // Load base (guideline)
  let base = sharp(guidelinePath).removeAlpha();
  if (width && height) {
    base = base.resize(width, height, { fit, background: { r: 255, g: 255, b: 255 } });
  }
  const baseMeta = await base.metadata();

    // Prepare overlay from buffer
    let overlay;
    let overlayMeta;
    try {
      overlay = sharp(renderingBuffer);
      overlayMeta = await overlay.metadata();
    } catch (sharpErr) {
      console.error('ai-blend: sharp failed to read renderingBuffer — unsupported image format or corrupt data', { err: sharpErr && sharpErr.message ? sharpErr.message : sharpErr, length: renderingBuffer.length, sample: renderingBuffer.slice(0, 16).toString('hex') });
      throw new Error('Input buffer contains unsupported image format');
    }

  if (overlayScale && overlayScale > 0 && overlayScale <= 1) {
    const targetOverlayW = Math.round((baseMeta.width || overlayMeta.width) * overlayScale);
    overlay = overlay.resize({ width: targetOverlayW });
  }

  const overlayBuffer = await overlay.png().toBuffer();
  const overlayMeta2 = await sharp(overlayBuffer).metadata();

  const ox = Number.isFinite(overlayX) ? overlayX : Math.round(((baseMeta.width || 0) - (overlayMeta2.width || 0)) / 2);
  const oy = Number.isFinite(overlayY) ? overlayY : Math.round(((baseMeta.height || 0) - (overlayMeta2.height || 0)) / 2);

  const composedBuffer = await base
    .composite([
      {
        input: overlayBuffer,
        left: Math.max(0, ox),
        top: Math.max(0, oy),
        ...(typeof overlayOpacity === 'number' ? { opacity: overlayOpacity } : {}),
      },
    ])
    .png()
    .toBuffer();

  return composedBuffer;
}

// POST /api/ai-blend
// Accepts either JSON { renderingBase64: 'data:...' } or multipart/form-data with file fields 'image' and optional 'mask'
router.post('/', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }]), express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const { renderingBase64, overlayScale, overlayX, overlayY, overlayOpacity, width, height, prompt } = req.body || {};

    // Prefer multipart file upload (req.files.image[0].buffer) when provided, otherwise fall back to renderingBase64
    let renderingBuffer = null;
    if (req.files && req.files.image && req.files.image[0] && req.files.image[0].buffer) {
      renderingBuffer = req.files.image[0].buffer;
    } else if (renderingBase64) {
      // parse data URL or raw base64
      let renderB64 = renderingBase64;
      // Accept data URLs like data:image/png;base64,<data>
      const m = String(renderingBase64).match(/^data:\w+\/[\-+.\w]+;base64,(.+)$/);
      if (m) renderB64 = m[1];
      renderingBuffer = Buffer.from(renderB64, 'base64');
    }

    if (!renderingBuffer) {
      return res.status(400).json({ error: 'renderingBase64 (JSON) or multipart file field "image" is required' });
    }

    // mask: prefer multipart file field 'mask' else accept maskBase64 in JSON
    let maskBuffer = null;
    if (req.files && req.files.mask && req.files.mask[0] && req.files.mask[0].buffer) {
      maskBuffer = req.files.mask[0].buffer;
    } else if (req.body && req.body.maskBase64) {
      const mm = String(req.body.maskBase64).match(/^data:\w+\/[\-+.\w]+;base64,(.+)$/);
      const maskB64 = mm ? mm[1] : req.body.maskBase64;
      try { maskBuffer = Buffer.from(maskB64, 'base64'); } catch (e) { /* ignore */ }
    }
    // Optionally, let the client tell us to use the server-side mask image saved at public/images/mask_preview.png
    if (!maskBuffer && req.body && (req.body.useServerMask === true || String(req.body.useServerMask) === 'true')) {
      try {
        const serverMaskPath = path.resolve(__dirname, '..', 'public', 'images', 'mask_preview.png');
        if (fs.existsSync(serverMaskPath)) {
          maskBuffer = fs.readFileSync(serverMaskPath);
        } else {
          console.warn('ai-blend: requested useServerMask but mask_preview.png not found at', serverMaskPath);
        }
      } catch (e) {
        console.warn('ai-blend: failed to read server mask_preview.png', e && e.message ? e.message : e);
      }
    }

    // Basic magic-byte checks to give clearer errors when clients send invalid data
    try {
      const prefix = renderingBuffer.slice(0, 8).toString('hex');
      const isPng = prefix === '89504e470d0a1a0a';
      const isJpg = renderingBuffer.slice(0, 3).toString('hex') === 'ffd8ff';
      if (!isPng && !isJpg) {
        console.warn('ai-blend: incoming rendering buffer does not look like PNG/JPEG. prefix=', prefix, 'len=', renderingBuffer.length);
        // still attempt to proceed; sharp will likely throw but we provide more context
      }
    } catch (chkErr) {
      console.warn('ai-blend: failed magic-byte check for incoming rendering buffer', chkErr && chkErr.message ? chkErr.message : chkErr);
    }

    // allow the client to choose a guideline image name (e.g. 'exampleImage.png')
    const guidelineName = (req.body && (req.body.guidelineName || req.body.guideline)) || 'mask_preview.png';
    const guidelinePath = path.resolve(__dirname, '..', 'public', 'images', guidelineName);
    if (!fs.existsSync(guidelinePath)) return res.status(500).json({ error: `guideline missing on server: ${guidelineName}` });

    const compositeBuffer = await composeImages({ guidelinePath, renderingBuffer, width, height, overlayScale, overlayX, overlayY, overlayOpacity });

    // If SKIP_OPENAI is enabled, return composite as base64
    const SKIP_OPENAI = (process.env.SKIP_OPENAI === '1' || String(process.env.SKIP_OPENAI).toLowerCase() === 'true');
    if (SKIP_OPENAI || !process.env.OPENAI_API_KEY) {
      const b = compositeBuffer.toString('base64');
      return res.json({ imageBase64: b, fallback: SKIP_OPENAI ? 'local_composite' : 'no_api_key' });
    }

    // call OpenAI image edits with merged composite
    // Prepare a multipart/form-data request like the other proxy helper does so OpenAI sees the file as image/png
    const FormData = require('form-data');
    const fetch = require('node-fetch');

    // Ensure the composite is an RGBA PNG — OpenAI edits expects images with alpha (RGBA/LA/L)
    let uploadBuffer = compositeBuffer;
    try {
      uploadBuffer = await sharp(compositeBuffer).ensureAlpha().png().toBuffer();
    } catch (convErr) {
      console.warn('ai-blend: failed to normalize composite to RGBA PNG, will try to send original buffer', convErr && convErr.message ? convErr.message : convErr);
      uploadBuffer = compositeBuffer;
    }

    const form = new FormData();
    form.append('image', uploadBuffer, { filename: 'composite.png', contentType: 'image/png' });
    // If maskBuffer available, send it so OpenAI can inpaint the transparent areas
    if (maskBuffer) {
      form.append('mask', maskBuffer, { filename: 'mask.png', contentType: 'image/png' });
    }
    form.append('prompt', prompt || 'Inpaint only the masked acrylic panel. Preserve the panel shape and base location. Render the provided design as laser-engraved acrylic: thin crisp strokes, slight depth, internal light scatter, and a gentle LED rim glow consistent with scene lighting. Do not modify desk, walls, colors, or objects outside the mask. No extra text, logos, or effects. Maintain original perspective and realism.');
    form.append('size', '1024x1024');

    // persist the exact composite/upload buffer so the user can inspect what was sent to OpenAI
    try {
      const genDir = path.resolve(__dirname, '..', 'public', 'generated');
      fs.mkdirSync(genDir, { recursive: true });
      const compositeName = `ai-blend-composite-${Date.now()}.png`;
      const compositePath = path.join(genDir, compositeName);
      fs.writeFileSync(compositePath, uploadBuffer);
      // public URL for client to download (the dev server serves /public)
      var sentCompositeUrl = `/generated/${compositeName}`;
    } catch (writeErr) {
      console.warn('ai-blend: failed to write composite to disk', writeErr && writeErr.message ? writeErr.message : writeErr);
      var sentCompositeUrl = null;
    }

    const editRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: Object.assign({ Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, form.getHeaders()),
      body: form,
    });

    const editJson = await editRes.json();
    // Prefer inline base64, otherwise fetch remote URL
    const b64 = editJson?.data?.[0]?.b64_json;
    const remoteUrl = editJson?.data?.[0]?.url;
    let outBuf = null;
    if (b64) outBuf = Buffer.from(b64, 'base64');
    else if (remoteUrl) {
      try {
        const r = await fetch(remoteUrl);
        if (!r.ok) throw new Error(`Failed to fetch remote image: ${r.status}`);
        outBuf = await r.buffer();
      } catch (fetchErr) {
        console.error('Error fetching remote image URL from OpenAI (ai-blend):', fetchErr);
      }
    }

    if (!outBuf) return res.status(500).json({ error: 'OpenAI returned no image data', raw: editJson, sentCompositeUrl });

    // persist raw OpenAI response for debugging
    try {
      const dumpPath = path.resolve(require('os').tmpdir(), `openai-aiBlend-response-${Date.now()}.json`);
      fs.writeFileSync(dumpPath, JSON.stringify(editJson, null, 2));
    } catch (dumpErr) { /* ignore */ }

    return res.json({ result_b64: outBuf.toString('base64'), raw: editJson, sentCompositeUrl });
  } catch (err) {
    console.error('ai-blend error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'internal_error', detail: String(err) });
  }
});

// POST /api/ai-blend/compose
// Return composed image (base64) and the local sentCompositeUrl but do NOT call OpenAI.
// Accepts either JSON { renderingBase64 } or multipart/form-data with file field 'image'
router.post('/compose', upload.single('image'), express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const { renderingBase64, overlayScale, overlayX, overlayY, overlayOpacity, width, height } = req.body || {};

    let renderingBuffer = null;
    if (req.file && req.file.buffer) {
      renderingBuffer = req.file.buffer;
    } else if (renderingBase64) {
      const m = String(renderingBase64).match(/^data:\w+\/[\-+.\w]+;base64,(.+)$/);
      const renderB64 = m ? m[1] : renderingBase64;
      renderingBuffer = Buffer.from(renderB64, 'base64');
    }

    if (!renderingBuffer) return res.status(400).json({ error: 'renderingBase64 (JSON) or multipart file field "image" is required' });

  const guidelineName = (req.body && (req.body.guidelineName || req.body.guideline)) || 'mask_preview.png';
  const guidelinePath = path.resolve(__dirname, '..', 'public', 'images', guidelineName);
  if (!fs.existsSync(guidelinePath)) return res.status(500).json({ error: `guideline missing on server: ${guidelineName}` });

    const compositeBuffer = await composeImages({ guidelinePath, renderingBuffer, width, height, overlayScale, overlayX, overlayY, overlayOpacity });

    // normalize and persist composite for inspection
    let uploadBuffer = compositeBuffer;
    try { uploadBuffer = await sharp(compositeBuffer).ensureAlpha().png().toBuffer(); } catch (e) { /* ignore, use original */ }

    try {
      const genDir = path.resolve(__dirname, '..', 'public', 'generated');
      fs.mkdirSync(genDir, { recursive: true });
      const compositeName = `ai-blend-composite-${Date.now()}.png`;
      const compositePath = path.join(genDir, compositeName);
      fs.writeFileSync(compositePath, uploadBuffer);
      const sentCompositeUrl = `/generated/${compositeName}`;
      return res.json({ imageBase64: uploadBuffer.toString('base64'), sentCompositeUrl });
    } catch (writeErr) {
      console.warn('ai-blend/compose: failed to write composite to disk', writeErr && writeErr.message ? writeErr.message : writeErr);
      return res.json({ imageBase64: uploadBuffer.toString('base64'), sentCompositeUrl: null });
    }
  } catch (err) {
    console.error('ai-blend/compose error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'internal_error', detail: String(err) });
  }
});

module.exports = router;
