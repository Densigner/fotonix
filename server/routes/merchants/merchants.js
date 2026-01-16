const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const { readJSON, writeJSON } = (() => {
  // minimal helpers matching server/db.js style for file access
  const fs = require('fs');
  const path = require('path');
  const DATA_DIR = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  function r(name, def) {
    try {
      const p = path.join(DATA_DIR, name);
      if (!fs.existsSync(p)) return def;
      return JSON.parse(fs.readFileSync(p, 'utf8') || 'null') || def;
    } catch (e) {
      console.warn('readJSON fail', e);
      return def;
    }
  }
  function w(name, data) {
    const p = path.join(DATA_DIR, name);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  }
  return { readJSON: r, writeJSON: w };
})();

const router = express.Router();

// Basic encryption helper using AES-256-GCM. Requires ENCRYPTION_KEY env var (base64) or falls back to COOKIE_SECRET.
function getKey() {
  const k = process.env.ENCRYPTION_KEY || process.env.COOKIE_SECRET || 'dev_fallback_key_please_set_env';
  // ensure 32 bytes
  const buf = Buffer.from(k, 'base64');
  if (buf.length === 32) return buf;
  // derive 32-byte key from whatever string was provided
  return crypto.createHash('sha256').update(k).digest();
}

function encryptText(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptText(b64) {
  try {
    const key = getKey();
    const data = Buffer.from(b64, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const enc = data.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(enc), decipher.final()]);
    return out.toString('utf8');
  } catch (e) {
    return null;
  }
}

function listMerchants() {
  return readJSON('merchants.json', {});
}

function saveMerchant(id, obj) {
  const m = listMerchants();
  m[id] = obj;
  writeJSON('merchants.json', m);
  return m[id];
}

function getMerchant(id) {
  const m = listMerchants();
  return m[id] || null;
}

// Ensure token metadata (expires_at) exists when storing tokens
function attachTokenMeta(tokenJson) {
  const t = Object.assign({}, tokenJson);
  const now = Date.now();
  if (t.expires_in && !t.expires_at) t.expires_at = now + Number(t.expires_in) * 1000;
  // if expires_at already present keep it
  return t;
}

// Refresh merchant access token if expired (uses merchant refresh_token)
async function refreshAndGetAccessToken(merchantId) {
  const m = getMerchant(merchantId);
  if (!m || !m.tokens_enc) return null;
  const tokStr = decryptText(m.tokens_enc);
  if (!tokStr) return null;
  let tokenJson = null;
  try { tokenJson = JSON.parse(tokStr); } catch (e) { return null; }

  const now = Date.now();
  const expiresAt = tokenJson.expires_at || (tokenJson.expires_in ? now + Number(tokenJson.expires_in) * 1000 : 0);
  // consider token valid if expires in more than 60s
  if (tokenJson.access_token && expiresAt - now > 60 * 1000) return tokenJson.access_token;

  // Attempt refresh using refresh_token
  if (!tokenJson.refresh_token) return null;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const tokenEndpoint = paypalBase() + '/v1/identity/openidconnect/tokenservice';
  const body = new URLSearchParams();
  body.append('grant_type', 'refresh_token');
  body.append('refresh_token', tokenJson.refresh_token);

  try {
    const fetch = global.fetch || require('node-fetch');
    const resp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('merchant token refresh failed', resp.status, txt);
      return null;
    }
    const newTok = await resp.json();
    // merge and attach meta
    const merged = Object.assign({}, tokenJson, newTok);
    const withMeta = attachTokenMeta(merged);
    m.tokens_enc = encryptText(JSON.stringify(withMeta));
    m.lastSeen = new Date().toISOString();
    saveMerchant(merchantId, m);
    return withMeta.access_token;
  } catch (e) {
    console.error('merchant token refresh error', e);
    return null;
  }
}

// Build PayPal endpoints based on env
function paypalBase() {
  const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  if (env === 'live' || env === 'production') return 'https://api-m.paypal.com';
  return 'https://api-m.sandbox.paypal.com';
}

// Step 1: Redirect merchant to PayPal login/authorize
// GET /api/merchants/connect?returnTo=... optional
router.get('/api/merchants/connect', (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) return res.status(500).send('PAYPAL_CLIENT_ID not configured');
  const redirectUri = process.env.PAYPAL_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/api/merchants/callback`;
  const stateObj = { ts: Date.now(), returnTo: req.query.returnTo || '/', nonce: Math.random().toString(36).slice(2) };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
  // store state in httpOnly cookie for verification
  res.cookie('paypal_oauth_state', state, { httpOnly: true, sameSite: 'lax' });
  // scopes: adjust as needed. For full partner flows you will need partner/referral etc.
  const scopes = encodeURIComponent('openid profile email https://uri.paypal.com/services/paypalattributes');
  const env = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
  const host = env === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
  const url = `${host}/signin/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  res.redirect(url);
});

// Step 2: Callback — exchange code for tokens and fetch userinfo
router.get('/api/merchants/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const saved = req.cookies && req.cookies.paypal_oauth_state;
    if (!state || !saved || state !== saved) {
      // allow debug when not present but warn
      console.warn('state mismatch or missing');
      // continue but mark unverified
    }

    if (!code) return res.status(400).send('missing code');

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(500).send('PayPal client credentials not configured');

    // Exchange code for tokens
    const tokenEndpoint = paypalBase() + '/v1/identity/openidconnect/tokenservice';
    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('redirect_uri', process.env.PAYPAL_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/api/merchants/callback`);

    const tokenResp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      console.error('token exchange failed', tokenResp.status, txt);
      return res.status(500).send('token exchange failed');
    }
    const tokenJson = await tokenResp.json();

    // fetch userinfo
    const userinfoUrl = paypalBase() + '/v1/identity/openidconnect/userinfo/?schema=openid';
    const userResp = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });
    if (!userResp.ok) {
      const txt = await userResp.text();
      console.error('userinfo failed', txt);
      return res.status(500).send('userinfo fetch failed');
    }
    const user = await userResp.json();

    // Use user_sub / user_id as merchant id; fall back to payer_id if present
    const merchantId = user.user_id || user.user_sub || user.payer_id || (user.email && user.email.split('@')[0]) || `m_${Date.now()}`;

    // Persist merchant record with encrypted tokens
    const record = {
      id: merchantId,
      email: user.email || null,
      name: user.name || null,
      userinfo: user,
      tokens_enc: encryptText(JSON.stringify(attachTokenMeta(tokenJson))),
      scope: tokenJson.scope || null,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
    saveMerchant(merchantId, record);

    // redirect back to returnTo if provided in state
    let returnTo = '/';
    try {
      const st = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      if (st && st.returnTo) returnTo = st.returnTo;
    } catch (e) {}

    // set a cookie for logged-in merchant id (short-lived)
    res.cookie('merchant_id', merchantId, { httpOnly: false, sameSite: 'lax' });
    res.redirect(returnTo);
  } catch (err) {
    console.error('merchant callback error', err);
    res.status(500).send('merchant callback error');
  }
});

// GET merchant info (non-authenticated — in prod guard this)
router.get('/api/merchants/:id', (req, res) => {
  const id = req.params.id;
  const m = getMerchant(id);
  if (!m) return res.status(404).send('merchant not found');
  const out = Object.assign({}, m);
  delete out.tokens_enc;
  res.json(out);
});

// Admin: list merchants (simpleAuth expected in affiliates route — here we'll allow if COOKIE_SECRET matches via header)
router.get('/api/merchants', (req, res) => {
  // very small guard: check simple admin header
  if (req.headers['x-admin-secret'] && req.headers['x-admin-secret'] === (process.env.ADMIN_SECRET || process.env.COOKIE_SECRET)) {
    return res.json(listMerchants());
  }
  return res.status(401).send('unauthorized');
});

// Register a webhook for a merchant (requires merchant tokens)
// POST /api/merchants/:id/register-webhook { url: 'https://...', event_types: ['PAYMENT.CAPTURE.COMPLETED'] }
router.post('/api/merchants/:id/register-webhook', async (req, res) => {
  const id = req.params.id;
  const m = getMerchant(id);
  if (!m) return res.status(404).send('merchant not found');
  const payload = req.body;
  if (!payload || !payload.url) return res.status(400).send('missing url');

  // decrypt tokens
  const tok = decryptText(m.tokens_enc);
  if (!tok) return res.status(500).send('cannot decrypt tokens');
  const tokenJson = JSON.parse(tok);
  const access = tokenJson.access_token;
  if (!access) return res.status(500).send('merchant access token missing');

  // call PayPal to create webhook on merchant account
  const endpoint = paypalBase() + '/v1/notifications/webhooks';
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: payload.url, event_types: (payload.event_types || [{ name: 'PAYMENT.CAPTURE.COMPLETED' }]) })
    });
    const j = await resp.json();
    if (!resp.ok) return res.status(500).json({ error: j });
    // persist webhook id on merchant record
    m.webhook = m.webhook || {};
    m.webhook.id = j.id;
    m.webhook.url = payload.url;
    saveMerchant(id, m);
    return res.json({ ok: true, webhook: j });
  } catch (e) {
    console.error('register webhook error', e);
    return res.status(500).send('register webhook error');
  }
});

// Export helper functions alongside the router so other routes can reuse them
module.exports = Object.assign(router, { refreshAndGetAccessToken, paypalBase, getMerchant });
