const express = require('express');
const router = express.Router();
const { getClient } = require('../../paypal');
const db = require('../../db');
const merchants = require('../merchants/merchants');
const { toCents } = require('../../utils');

async function verifyWebhookSignature(rawBody, headers) {
  // Accept Buffer, string, or already-parsed object
  function rawToEvent(raw) {
    try {
      if (Buffer.isBuffer(raw)) return JSON.parse(raw.toString());
      if (typeof raw === 'string') return JSON.parse(raw);
      if (typeof raw === 'object') return raw;
    } catch (e) {
      // fall through
    }
    return null;
  }

  const webhookEvent = rawToEvent(rawBody);

  try {
    const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
    const client = getClient();
    const notifications = require('@paypal/checkout-server-sdk').notifications;
    if (notifications && notifications.WebhookEventVerifySignatureRequest) {
      const req = new notifications.WebhookEventVerifySignatureRequest();
      req.requestBody({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: webhookEvent
      });
      console.log('DEBUG verifyWebhookSignature sending webhook_event sample:', JSON.stringify(webhookEvent).slice(0,400));
      console.log('DEBUG: calling SDK verify');
      const resp = await client.execute(req);
      console.log('DEBUG: SDK verify response:', resp && resp.result ? JSON.stringify(resp.result).slice(0,1000) : String(resp));
      return resp && resp.result && resp.result.verification_status === 'SUCCESS';
    }
  } catch (e) {
    console.warn('verifyWebhookSignature SDK path failed', e);
  }

  try {
    const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
    const url = '/v1/notifications/verify-webhook-signature';
    const fetch = global.fetch || require('node-fetch');
    const resp = await fetch('https://api.' + (process.env.PAYPAL_ENV === 'live' ? '' : 'sandbox.') + 'paypal.com' + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from((process.env.PAYPAL_CLIENT_ID || '') + ':' + (process.env.PAYPAL_CLIENT_SECRET || '')).toString('base64') },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: webhookEvent
      })
    });
  const j = await resp.json();
  console.log('DEBUG: REST verify response:', JSON.stringify(j).slice(0,1000));
  return j && j.verification_status === 'SUCCESS';
  } catch (e) {
    console.error('verifyWebhookSignature fallback failed', e);
    return false;
  }
}

router.post('/', async (req, res) => {
  try {
    const rawBody = req.body; // express.raw body if raw middleware applied
    // Debug logging to help diagnose parsing issues in dev
    try {
      const isBuf = Buffer.isBuffer(rawBody);
      console.log('Webhook rawBody type:', typeof rawBody, 'isBuffer:', isBuf);
      if (isBuf) {
        const sample = rawBody.toString().slice(0, 400);
        console.log('rawBody (sample):', sample);
      } else if (typeof rawBody === 'object') {
        console.log('rawBody object keys:', Object.keys(rawBody));
      } else {
        console.log('rawBody string sample:', String(rawBody).slice(0, 400));
      }
    } catch (e) {
      console.warn('Failed to inspect rawBody', e);
    }
    const headers = {
      'paypal-transmission-id': req.headers['paypal-transmission-id'],
      'paypal-transmission-time': req.headers['paypal-transmission-time'],
      'paypal-cert-url': req.headers['paypal-cert-url'],
      'paypal-transmission-sig': req.headers['paypal-transmission-sig'],
      'paypal-auth-algo': req.headers['paypal-auth-algo'],
    };

    // Dev-only bypass: when developing locally you can set NODE_ENV=development
    // and DISABLE_PAYPAL_WEBHOOK_VERIFY=1 to skip PayPal signature verification.
    const devBypass = (process.env.NODE_ENV === 'development') && (process.env.DISABLE_PAYPAL_WEBHOOK_VERIFY === '1');
    if (devBypass) {
      console.log('Dev bypass enabled: skipping PayPal webhook signature verification');
    } else {
      // Require PayPal signature headers to be present
      const requiredHeaderKeys = ['paypal-transmission-id','paypal-transmission-time','paypal-cert-url','paypal-transmission-sig','paypal-auth-algo'];
      const missing = requiredHeaderKeys.filter(k => !headers[k]);
      if (missing.length) {
        console.warn('Missing PayPal webhook signature headers:', missing);
        return res.status(400).json({ error: 'Missing PayPal webhook signature headers', missing });
      }

      // Require webhook id and perform verification.
      const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
      let verified = false;

      // If a platform webhook id is configured, try verifying with platform credentials first
      if (PAYPAL_WEBHOOK_ID) {
        const ok = await verifyWebhookSignature(rawBody, headers);
        if (ok) verified = true;
      }

      // If not verified by platform, attempt to infer merchant and verify using merchant webhook id + merchant token
      if (!verified) {
        // attempt to parse event and find merchant identifier
        let possibleEvent = null;
        try {
          possibleEvent = Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString()) : (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody);
        } catch (e) { possibleEvent = null; }
        let inferredMerchantId = null;
        if (possibleEvent && possibleEvent.resource) {
          const r = possibleEvent.resource;
          inferredMerchantId = r.merchant_id || (r.payee && r.payee.merchant_id) || (r.payee && r.payee.email_address) || null;
        }

        if (inferredMerchantId) {
          const merchant = merchants.getMerchant(inferredMerchantId);
          if (merchant && merchant.webhook && merchant.webhook.id) {
            // get merchant access token
            const access = await merchants.refreshAndGetAccessToken(inferredMerchantId);
            if (access) {
              try {
                const verifyUrl = merchants.paypalBase() + '/v1/notifications/verify-webhook-signature';
                const fetch = global.fetch || require('node-fetch');
                const payload = {
                  auth_algo: headers['paypal-auth-algo'],
                  cert_url: headers['paypal-cert-url'],
                  transmission_id: headers['paypal-transmission-id'],
                  transmission_sig: headers['paypal-transmission-sig'],
                  transmission_time: headers['paypal-transmission-time'],
                  webhook_id: merchant.webhook.id,
                  webhook_event: possibleEvent
                };
                const r = await fetch(verifyUrl, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const j = await r.json();
                if (r.ok && j && j.verification_status === 'SUCCESS') verified = true;
              } catch (e) {
                console.warn('Merchant webhook verify attempt failed', e);
              }
            }
          }
        }

        if (!verified) {
          console.warn('Webhook verification failed for both platform and inferred merchant');
          return res.status(400).json({ error: 'Webhook verification failed' });
        }
      }
    }
  // Parse event from rawBody which may be Buffer, string, or object
    let event = null;
    try {
      if (Buffer.isBuffer(rawBody)) event = JSON.parse(rawBody.toString());
      else if (typeof rawBody === 'string') event = JSON.parse(rawBody);
      else if (typeof rawBody === 'object') event = rawBody;
    } catch (e) {
      console.warn('Failed to parse webhook event body', e);
      return res.status(400).json({ error: 'Invalid webhook JSON' });
    }
    const type = event.event_type;
    const resource = event.resource || {};

    // Idempotency: check PayPal transmission id (preferred) or event id
    const transmissionId = (req.headers['paypal-transmission-id']) || null;
    const eventId = event && event.id ? event.id : null;
    const seenId = transmissionId || eventId;
    if (seenId && db.hasProcessedId(seenId)) {
      console.log('Webhook event already processed, skipping:', seenId);
      return res.json({ ok: true, skipped: true });
    }

    // Handle completed captures (new successful payments)
    if (type === 'PAYMENT.CAPTURE.COMPLETED') {
      // resource may be a capture object
      const purchase = resource.purchase_units && resource.purchase_units[0];
      const clickId = (purchase && purchase.custom_id) || (resource.custom_id) || null;
      const amountStr = (resource.amount && resource.amount.value) || (resource.amount && resource.amount.total) || null;
      const currency = (resource.amount && resource.amount.currency_code) || (resource.amount && resource.amount.currency) || 'GBP';
      const orderId = resource.id || (resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id) || null;

      const amountCents = toCents(amountStr);

      console.log('PayPal capture completed', { orderId, amountCents, currency, clickId });

      // Persist the order
      if (orderId) {
        db.upsertOrder(orderId, { amountCents, currency, status: 'completed', paidAt: new Date().toISOString(), raw: resource });
      }

      // If this capture includes a custom_id (affiliate click), try to attribute
      if (clickId) {
        const click = db.getClick(clickId);
        if (click && click.affiliateId) {
          const ratePct = Number(click.ratePct || 0);
          const commissionCents = Math.round((amountCents || 0) * (ratePct / 100));
          const attr = db.createAttribution({ orderId, affiliateId: click.affiliateId, clickId, commissionCents, ratePct, status: 'pending' });
          console.log('Created attribution', attr.id, 'for affiliate', click.affiliateId);
        } else {
          console.log('Click found but missing affiliateId or click not found', clickId, !!click);
        }
      }

      // Mark the event as processed for idempotency
      if (seenId) db.markProcessedId(seenId);
    }

    // Handle refunds or voids to mark attributions as void
    if (type === 'PAYMENT.CAPTURE.REFUNDED' || type === 'PAYMENT.SALE.REFUNDED' || type === 'PAYMENT.AUTHORIZATION.VOIDED') {
      const orderId = resource.id || (resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id) || null;
      console.log('PayPal refund/void event for order', orderId, 'type', type);
      if (orderId) {
        const voided = db.voidAttributionsForOrder(orderId, type);
        console.log('Voided attributions', voided.length);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('paypal webhook error', e);
    res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
