const express = require('express');
const router = express.Router();
const db = require('../../db');

// POST /api/clicks/create
// Body: { affiliateId, productId?, linkCustomRatePct? }
router.post('/api/clicks/create', async (req, res) => {
  try {
    const body = req.body || {};
    const affiliateId = String(body.affiliateId || '').trim();
    const productId = body.productId || null;
    const linkCustomRatePct = body.linkCustomRatePct !== undefined ? Number(body.linkCustomRatePct) : undefined;

    if (!affiliateId) return res.status(400).json({ error: 'affiliateId required' });

    const click = db.createClick({ affiliateId, productId, linkCustomRatePct });

    // Set a signed cookie so subsequent order creation picks it up
    try {
      res.cookie('aff_click', click.id, { signed: true, httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    } catch (e) {
      // If signed cookies are not configured, still return click id in body
      console.warn('Failed to set signed cookie aff_click', e);
    }

    res.json(click);
  } catch (e) {
    console.error('create click error', e);
    res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
