const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

router.post('/', async (req, res) => {
  try {
    const { imageDataUrl } = req.body || {};
    if (!imageDataUrl || typeof imageDataUrl !== 'string') return res.status(400).json({ error: 'imageDataUrl required' });
    const m = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'invalid data URL' });
    const mime = m[1];
    const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
    const b64 = m[2];
    const buffer = Buffer.from(b64, 'base64');

    const id = Date.now();
    const fileName = `preview-${id}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    // create a simple html page with OG/Twitter tags referencing the image
    const pageName = `preview-${id}.html`;
    const pagePath = path.join(uploadsDir, pageName);
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
  // product path configurable via PRODUCT_PATH env var (defaults to '/')
  const productPath = (process.env.PRODUCT_PATH || '/').startsWith('/') ? (process.env.PRODUCT_PATH || '/') : `/${process.env.PRODUCT_PATH || ''}`;
  const productUrl = `${req.protocol}://${req.get('host')}${productPath}`;
  // optional external stylesheet URL for the preview page so it can match site styles
  const previewCssUrl = process.env.PREVIEW_CSS_URL || '';
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Mirror Preview</title>
    ${previewCssUrl ? `<link rel="stylesheet" href="${previewCssUrl}">` : ''}
    <!-- Canonical URL -->
    <link rel="canonical" href="${productUrl}" />
    <!-- Open Graph -->
    <meta property="og:title" content="Fotonix Mirror Preview" />
    <meta property="og:description" content="Check out this mirror design from Fotonix" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${productUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Fotonix" />
    <meta property="og:locale" content="en_GB" />
    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Fotonix Mirror Preview" />
    <meta name="twitter:description" content="Check out this mirror design from Fotonix" />
    <meta name="twitter:image" content="${imageUrl}" />
    <style>
      /* Inline minimal styles so the preview page looks like the site */
      body { margin:0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background: #0b1220; color:#fff; }
      .container { text-align:center; max-width:920px; padding:28px; margin:0 auto; }
      .preview-img { max-width:100%; height:auto; border-radius:8px; box-shadow: 0 8px 30px rgba(2,6,23,.6); }
      /* Button uses .site-btn so your stylesheet can override when PREVIEW_CSS_URL is set */
      .btn, .site-btn { display:inline-block; margin-top:18px; padding:12px 18px; border-radius:8px; background:linear-gradient(90deg,#2563eb,#06b6d4); color:#fff; text-decoration:none; font-weight:600; }
      .meta { opacity:0.85; margin-top:8px; }
    </style>
  </head>
  <body>
    <div class="container">
  <h1 style="margin:0 0 8px 0;">Fotonix Mirror Preview</h1>
      <img src="${imageUrl}" alt="Preview" class="preview-img"/>
      <div>
        <a class="btn" href="${productUrl}" target="_blank" rel="noopener noreferrer">Make your own</a>
      </div>
    </div>
  </body>
</html>`;
    fs.writeFileSync(pagePath, html, 'utf8');

  const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${pageName}`;
  return res.json({ publicUrl, imageUrl, productUrl });
  } catch (e) {
    console.error('upload-preview error', e);
    return res.status(500).json({ error: 'upload failed' });
  }
});

module.exports = router;
