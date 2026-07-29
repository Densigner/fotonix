const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
function readJSON(name, def) {
  try {
    const p = path.join(DATA_DIR, name);
    if (!fs.existsSync(p)) return def;
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt || 'null') || def;
  } catch (e) {
    console.warn('affiliates readJSON failed', name, e);
    return def;
  }
}

function writeJSON(name, data) {
  const p = path.join(DATA_DIR, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function simpleAuth(req, code) {
  // Allow dev mode without header; otherwise require header x-affiliate-code to match code
  if (process.env.NODE_ENV === 'development') return true;
  const header = req.headers['x-affiliate-code'];
  if (!header) return false;
  return header === code;
}

// GET /api/affiliates/stats?code=AFF
router.get('/stats', (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) return res.status(400).json({ error: 'Missing code' });
    if (!simpleAuth(req, code)) return res.status(403).json({ error: 'Forbidden' });

    const attributions = readJSON('attributions.json', []);
    const orders = readJSON('orders.json', {});
    const clicks = readJSON('clicks.json', {});

    const myAttrs = attributions.filter(a => a.affiliateId === code);
    const conversions = myAttrs.length;
    const pendingCommissionCents = myAttrs.filter(a => a.status === 'pending').reduce((s, a) => s + (a.commissionCents || 0), 0);
    const approvedCommissionCents = myAttrs.filter(a => a.status === 'approved').reduce((s, a) => s + (a.commissionCents || 0), 0);

    // clicks: count unique clickIds known for this affiliate (from clicks.json)
    const clickIds = Object.keys(clicks).filter(k => clicks[k] && clicks[k].affiliateId === code);
    const clicksCount = clickIds.length;

    // timeseries: group attributions by date and sum conversions + revenue
    const map = new Map();
    for (const a of myAttrs) {
      const d = new Date(a.createdAt || a.date || Date.now()).toLocaleDateString();
      const existing = map.get(d) || { date: d, clicks: 0, conversions: 0, revenue: 0 };
      existing.conversions += 1;
      // revenue: try to read order amount
      const order = orders[a.orderId] || orders[a.orderNumber] || null;
      const amount = order ? (order.amountCents || (order.amount && order.amount.value ? Math.round(Number(order.amount.value) * 100) : 0)) : 0;
      existing.revenue += amount;
      map.set(d, existing);
    }
    const timeseries = Array.from(map.values()).sort((x, y) => new Date(x.date) - new Date(y.date));

    return res.json({
      clicks: clicksCount,
      conversions,
      pendingCommissionCents,
      approvedCommissionCents,
      currency: 'GBP',
      timeseries,
    });
  } catch (e) {
    console.error('affiliates/stats error', e);
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/affiliates/attributions?code=AFF
router.get('/attributions', (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) return res.status(400).json({ error: 'Missing code' });
    if (!simpleAuth(req, code)) return res.status(403).json({ error: 'Forbidden' });

    const attributions = readJSON('attributions.json', []);
    const orders = readJSON('orders.json', {});

    const myAttrs = attributions.filter(a => a.affiliateId === code).map(a => {
      const order = orders[a.orderId] || orders[a.orderNumber] || null;
      const amountCents = order ? (order.amountCents || (order.amount && order.amount.value ? Math.round(Number(order.amount.value) * 100) : 0)) : 0;
      return {
        id: a.id,
        orderNumber: a.orderId || a.orderNumber,
        date: a.createdAt || new Date().toISOString(),
        amountCents,
        commissionCents: a.commissionCents || 0,
        status: a.status || 'pending',
        notes: a.notes || null,
      };
    });
    return res.json(myAttrs);
  } catch (e) {
    console.error('affiliates/attributions error', e);
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/affiliates/settings
router.get('/settings', (req, res) => {
  try {
    const settings = readJSON('affiliateSettings.json', { programDefaultCommissionPct: 10 });
    return res.json(settings);
  } catch (e) {
    console.error('affiliates/settings get error', e);
    return res.status(500).json({ error: String(e) });
  }
});

// POST /api/affiliates/settings
router.post('/settings', (req, res) => {
  try {
    // simpleAuth: allow dev bypass or require header
    const code = req.headers['x-affiliate-code'] || null;
    if (!simpleAuth(req, code)) return res.status(403).json({ error: 'Forbidden' });

    const body = req.body || {};
    const programDefaultCommissionPct = Number(body.programDefaultCommissionPct || 0);
    const updated = { programDefaultCommissionPct };
    writeJSON('affiliateSettings.json', updated);
    return res.json({ success: true, settings: updated });
  } catch (e) {
    console.error('affiliates/settings post error', e);
    return res.status(500).json({ error: String(e) });
  }
});

// POST /api/affiliates/leads — capture an email from the signup page's
// exit-intent popup (people who started leaving before signing up). No
// auth required — this runs on the public, logged-out signup page.
router.post('/leads', (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const source = String((req.body && req.body.source) || 'unknown');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const leads = readJSON('leads.json', []);
    if (!leads.some(l => l.email === email)) {
      leads.push({ email, source, createdAt: new Date().toISOString() });
      writeJSON('leads.json', leads);
    }
    return res.json({ success: true });
  } catch (e) {
    console.error('affiliates/leads error', e);
    return res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
