const express = require('express');
const router = express.Router();
const juice = require('juice');

// POST /api/tenants/:tid/templates/render
// Body: { html, mergeVars }
router.post('/api/tenants/:tid/templates/render', async (req, res) => {
  try {
    const { html, mergeVars } = req.body || {};
    if (!html) return res.status(400).json({ error: 'html required' });
    // Very simple mergeVars replacement
    let processed = html;
    if (mergeVars && typeof mergeVars === 'object') {
      for (const k of Object.keys(mergeVars)) {
        const re = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
        processed = processed.replace(re, String(mergeVars[k]));
      }
    }
    // Use juice to inline styles
    const inlined = juice(processed, { webResources: { relativeTo: process.cwd() } });
    return res.json({ ok: true, html: inlined });
  } catch (err) {
    console.error('render error', err);
    return res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
