// Express-based Firebase Cloud Function that handles tracking clicks and opens.
// - Exports a single HTTPS function named `tracking` (functions.https.onRequest(app))
// - Uses HMAC-signed compact tokens (see ./trackingToken.js) which contain { linkId, recipientId, exp }
//
// Configuration notes:
// - Provide the HMAC secret via `firebase functions:config:set tracking.secret="..."` or the env var TRACKING_SECRET
// - In `firebase.json` hosting rewrites, route `/r/**` and `/o/pixel` to this function, e.g.:
//   {
//     "source": "/r/**",
//     "function": "tracking"
//   },
//   {
//     "source": "/o/pixel",
//     "function": "tracking"
//   }
//
// Collections used in Firestore:
// - link_clicks (individual click events)
// - link_aggregates (per-link counters: clickCount, uniqueCount)
// - link_unique (docs keyed by `${linkId}_${recipientId}` to dedupe unique clicks)
// - tracked_links (documents containing destination URL for linkId)
// - email_opens (open events)

import express from 'express';
import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import { verifyTrackingToken } from './trackingToken.js';

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const app = express();
app.set('trust proxy', true); // respect X-Forwarded-* headers (useful behind proxies / Cloud Functions)

// Simple bot detection via User-Agent or referer heuristics
const BOT_REGEX = /(bot|crawl|spider|slurp|bingpreview|facebookexternalhit|curl|wget|python-requests|postman|phantom|headless|checker)/i;

function extractIp(req) {
  const xff = req.headers['x-forwarded-for'] || req.headers['x-client-ip'];
  if (xff) {
    // x-forwarded-for may contain a list
    const ip = String(xff).split(',')[0].trim();
    if (ip) return ip;
  }
  if (req.ip) return req.ip;
  if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
  return null;
}

// Route: Redirect (click tracker)
// Example: GET /r/:token
app.get('/r/:token', async (req, res) => {
  const token = req.params.token;
  let payload;
  try {
    payload = verifyTrackingToken(token);
  } catch (err) {
    // If verify throws due to missing config, surface a 500
    console.error('verifyTrackingToken error', err);
    return res.status(500).send('Server configuration error');
  }

  const fallback = process.env.TRACKING_FALLBACK || 'https://example.com';

  if (!payload) {
    // Invalid or expired token: redirect to fallback
    return res.redirect(302, fallback);
  }

  const { linkId, recipientId, exp } = payload;

  const ip = extractIp(req);
  const userAgent = req.get('user-agent') || '';
  const referer = req.get('referer') || req.get('referrer') || '';
  const isSuspectedBot = BOT_REGEX.test(userAgent) || BOT_REGEX.test(referer);

  // Allow optional meta query params to be attached (e.g. ?utm_source=...)
  const meta = { ...(req.query || {}) };

  // Build click event
  const clickEvent = {
    tracked_link_id: linkId,
    recipient_id: recipientId,
    occurred_at: FieldValue.serverTimestamp(),
    ip: ip || null,
    user_agent: userAgent || null,
    referer: referer || null,
    is_suspected_bot: !!isSuspectedBot,
    meta,
  };

  try {
    // Write click event (non-transactional write)
    await db.collection('link_clicks').add(clickEvent);

    // Update aggregates and dedupe unique clicks in a transaction
    const aggregatesRef = db.collection('link_aggregates').doc(linkId);
    const uniqueDocId = `${linkId}_${recipientId}`;
    const uniqueRef = db.collection('link_unique').doc(uniqueDocId);

    await db.runTransaction(async (tx) => {
      // Always increment total clicks
      tx.set(
        aggregatesRef,
        { clickCount: FieldValue.increment(1) },
        { merge: true }
      );

      const uniqueSnap = await tx.get(uniqueRef);
      if (!uniqueSnap.exists) {
        // First time we've seen this recipient for this link: mark unique and increment uniqueCount
        tx.set(uniqueRef, { linkId, recipientId, createdAt: FieldValue.serverTimestamp() });
        tx.set(
          aggregatesRef,
          { uniqueCount: FieldValue.increment(1) },
          { merge: true }
        );
      }
    });
  } catch (err) {
    // Log but don't prevent redirecting the user
    console.error('Error recording tracking click:', err);
  }

  // Resolve destination from tracked_links collection
  try {
    const linkDoc = await db.collection('tracked_links').doc(linkId).get();
    let destination = fallback;
    if (linkDoc.exists) {
      const data = linkDoc.data() || {};
      destination = data.destination || data.url || destination;
    }

    // Guard: ensure destination is a string, otherwise fallback
    if (!destination || typeof destination !== 'string') destination = fallback;

    // Redirect with 302
    return res.redirect(302, destination);
  } catch (err) {
    console.error('Error resolving destination, redirecting to fallback:', err);
    return res.redirect(302, fallback);
  }
});

// Transparent 1x1 GIF (base64)
const TRANSPARENT_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const TRANSPARENT_GIF_BUFFER = Buffer.from(TRANSPARENT_GIF_BASE64, 'base64');

// Route: Pixel (open tracker)
// Example: GET /o/pixel?t=<token>
app.get('/o/pixel', async (req, res) => {
  const token = req.query.t;
  let payload;
  try {
    payload = verifyTrackingToken(token);
  } catch (err) {
    console.error('verifyTrackingToken error', err);
    return res.status(500).send('Server configuration error');
  }

  if (!payload) {
    // Invalid token: return 404 with GIF to prevent errors in email clients
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(404).send(TRANSPARENT_GIF_BUFFER);
  }

  const { linkId, recipientId, exp } = payload;
  const ip = extractIp(req);
  const userAgent = req.get('user-agent') || '';
  const referer = req.get('referer') || req.get('referrer') || '';
  const isSuspectedBot = BOT_REGEX.test(userAgent) || BOT_REGEX.test(referer);

  const meta = { ...(req.query || {}) };

  const openEvent = {
    tracked_link_id: linkId,
    recipient_id: recipientId,
    occurred_at: FieldValue.serverTimestamp(),
    ip: ip || null,
    user_agent: userAgent || null,
    referer: referer || null,
    is_suspected_bot: !!isSuspectedBot,
    meta,
  };

  try {
    await db.collection('email_opens').add(openEvent);
  } catch (err) {
    console.error('Error recording open event:', err);
    // continue to return GIF regardless
  }

  // Return 1x1 transparent GIF
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Content-Length', TRANSPARENT_GIF_BUFFER.length.toString());
  return res.status(200).send(TRANSPARENT_GIF_BUFFER);
});

// Export the function
export const tracking = functions.https.onRequest(app);

// Helpful note for deploy/config:
// - Ensure you have the secret configured:
//     firebase functions:config:set tracking.secret="YOUR_SECRET"
// - Optionally set TRACKING_FALLBACK in environment or functions config if you prefer
// - Add hosting rewrites in firebase.json to route /r/** and /o/pixel to this function so links and pixel urls work from your site
