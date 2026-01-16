// Compact HMAC-signed tracking token utilities (ES module)
//
// Token format (compact): base64url(payload).base64url(signature)
// - payload: JSON string containing { linkId, recipientId, exp } where exp is epoch seconds
// - signature: HMAC-SHA256(secret, payload)
//
// Usage:
//   import { generateTrackingToken, verifyTrackingToken } from './functions/trackingToken.js'
//
// Security notes:
// - Secret is read from functions.config().tracking.secret (if available) or process.env.TRACKING_SECRET
// - Uses crypto.timingSafeEqual when comparing signatures to avoid timing attacks
// - Returns null for invalid or expired tokens

import crypto from 'crypto';

// Default TTL: 30 days in seconds
const DEFAULT_TTL = 30 * 24 * 60 * 60; // 30 days

// Helper: base64url encode a Buffer
function base64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper: base64url decode to Buffer
function base64urlDecode(str) {
  // Replace URL-safe chars, pad with '=' to multiple of 4
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// Read secret from functions config (if running in Firebase functions) or env
function getSecret() {
  try {
    // functions.config may exist in some serverless runtimes (Firebase)
    // We avoid requiring 'firebase-functions' directly; instead try to access a global if provided
    // If the user has a `functions` global, use it. Otherwise fallback to env var.
    if (typeof functions !== 'undefined' && typeof functions.config === 'function') {
      const cfg = functions.config();
      if (cfg && cfg.tracking && cfg.tracking.secret) return cfg.tracking.secret;
    }
  } catch (e) {
    // ignore and fallback to env
  }

  return process.env.TRACKING_SECRET || null;
}

// Build HMAC-SHA256 signature for a given payload string
function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest();
}

// Generate a tracking token
// input: { linkId, recipientId, ttlSeconds }
// returns: compact token string
export function generateTrackingToken({ linkId, recipientId, ttlSeconds } = {}) {
  const secret = getSecret();
  if (!secret) throw new Error('Tracking secret not configured. Set functions.config().tracking.secret or TRACKING_SECRET env var.');

  if (!linkId || !recipientId) throw new Error('linkId and recipientId are required');

  const ttl = typeof ttlSeconds === 'number' ? ttlSeconds : DEFAULT_TTL;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;

  const payloadObj = { linkId: String(linkId), recipientId: String(recipientId), exp };
  const payloadJson = JSON.stringify(payloadObj);
  const payloadBuf = Buffer.from(payloadJson, 'utf8');
  const payloadB64 = base64urlEncode(payloadBuf);

  const sig = sign(payloadJson, secret); // Buffer
  const sigB64 = base64urlEncode(sig);

  return `${payloadB64}.${sigB64}`;
}

// Verify a tracking token. Returns { linkId, recipientId, exp } on success, otherwise null
export function verifyTrackingToken(token) {
  const secret = getSecret();
  if (!secret) throw new Error('Tracking secret not configured. Set functions.config().tracking.secret or TRACKING_SECRET env var.');

  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;

  let payloadBuf, sigBuf;
  try {
    payloadBuf = base64urlDecode(payloadB64);
    sigBuf = base64urlDecode(sigB64);
  } catch (e) {
    return null;
  }

  const payloadJson = payloadBuf.toString('utf8');

  // Compute expected signature
  const expectedSig = sign(payloadJson, secret);

  // Use timingSafeEqual; lengths must match
  if (!Buffer.isBuffer(expectedSig) || !Buffer.isBuffer(sigBuf)) return null;
  if (expectedSig.length !== sigBuf.length) return null;

  const match = crypto.timingSafeEqual(expectedSig, sigBuf);
  if (!match) return null;

  // Parse payload JSON
  let payloadObj;
  try {
    payloadObj = JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }

  // Validate required fields
  if (!payloadObj.linkId || !payloadObj.recipientId || typeof payloadObj.exp !== 'number') return null;

  const now = Math.floor(Date.now() / 1000);
  if (payloadObj.exp < now) return null; // expired

  return { linkId: payloadObj.linkId, recipientId: payloadObj.recipientId, exp: payloadObj.exp };
}
