const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Read Reddit credentials from environment. DO NOT hardcode secrets here.
const CLIENT_ID = process.env.REDDIT_CLIENT_ID || '';
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5002}`;
const REDIRECT_URI = process.env.REDDIT_REDIRECT_URI || `${BASE_URL}/api/reddit/callback`;

const TOKENS_PATH = path.join(__dirname, 'reddit_tokens.json');

// Default subreddit to post to (use lowercase to avoid mismatch)
const DEFAULT_SUBREDDIT = 'fotonix';

function saveTokens(obj) {
  try { fs.writeFileSync(TOKENS_PATH, JSON.stringify(obj, null, 2)); } catch (e) { console.warn('failed to save reddit tokens', e); }
}
function loadTokens() { try { return fs.existsSync(TOKENS_PATH) ? JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8')) : null; } catch (e) { console.warn('failed to load reddit tokens', e); return null; } }

// Start OAuth - redirect admin user to Reddit to authorize the app
router.get('/start', (req, res) => {
  if (!CLIENT_ID) return res.status(500).send('REDDIT_CLIENT_ID not configured on server');
  const state = String(Date.now());
  // Log the redirect URI and the final authorize URL for debugging redirect mismatch issues
  console.log('[reddit] REDIRECT_URI used by server:', REDIRECT_URI);
  const url = `https://www.reddit.com/api/v1/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&response_type=code&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&duration=permanent&scope=submit,identity`;
  console.log('[reddit] Redirecting user to Reddit authorize URL:', url);
  res.redirect(url);
});

// Debug route: return the redirect URI and the authorize URL so callers can copy/inspect
router.get('/debug', (req, res) => {
  const state = String(Date.now());
  const authorizeUrl = `https://www.reddit.com/api/v1/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&response_type=code&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&duration=permanent&scope=submit,identity`;
  res.json({ redirectUri: REDIRECT_URI, authorizeUrl });
});

// OAuth callback - exchange code for tokens and persist them
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(500).send('REDDIT_CLIENT_ID/SECRET not configured');
  try {
    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson || !tokenJson.access_token) return res.status(500).send('Failed to obtain token: ' + JSON.stringify(tokenJson));
    const tokens = {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (tokenJson.expires_in || 3600)
    };
    saveTokens(tokens);
    return res.send('<html><body><h2>Reddit connected</h2><p>You can close this window and return to the app.</p></body></html>');
  } catch (err) {
    console.error('reddit callback error', err);
    return res.status(500).send('reddit callback error');
  }
});

// Helper: refresh access token when needed
async function refreshTokensIfNeeded(tokens) {
  if (!tokens) return null;
  if (tokens.expires_at && Math.floor(Date.now() / 1000) < tokens.expires_at - 60) return tokens;
  if (!tokens.refresh_token) return null;
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('reddit client creds missing');
  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token })
  });
  const jr = await r.json();
  if (!jr || !jr.access_token) throw new Error('refresh failed: ' + JSON.stringify(jr));
  tokens.access_token = jr.access_token;
  tokens.expires_at = Math.floor(Date.now() / 1000) + (jr.expires_in || 3600);
  saveTokens(tokens);
  return tokens;
}

// POST /api/reddit/submit { url, title, sr }
router.post('/submit', express.json(), async (req, res) => {
  const { url, title, sr } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url required' });
  const srToUse = (sr || DEFAULT_SUBREDDIT).toString();
  console.log('[reddit] submit handler - srToUse:', srToUse, 'url:', url);
  try {
    let tokens = loadTokens();
    if (!tokens) return res.status(401).json({ error: 'not_authorized', authUrl: '/api/reddit/start' });
    tokens = await refreshTokensIfNeeded(tokens);
    if (!tokens || !tokens.access_token) return res.status(401).json({ error: 'no_access_token' });

    const postRes = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        'Authorization': 'bearer ' + tokens.access_token,
        'User-Agent': 'Fotonix/1.0 by your_reddit_username',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ sr: srToUse, kind: 'link', title: title || 'Fotonix design', url })
    });
    const pj = await postRes.json();
    try { console.log('[reddit] submit response:', JSON.stringify(pj).slice(0,2000)); } catch(e){ console.log('[reddit] submit response (raw)', pj); }
    // Try to get permalink from response
    const id = pj && pj.json && pj.json.data && pj.json.data.id;
    let postUrl = pj && pj.json && pj.json.data && pj.json.data.url;
    if (!postUrl && id) postUrl = `https://www.reddit.com/r/${srToUse}/comments/${id}`;
    return res.json({ success: true, postUrl });
  } catch (err) {
    console.error('reddit submit error', err);
    return res.status(500).json({ error: 'reddit_submit_failed', detail: String(err) });
  }
});

module.exports = router;
