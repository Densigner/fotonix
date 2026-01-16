import { Router } from 'express';
import getClient from '../paypal';

const router = Router();

// Helper to call PayPal verify endpoint via SDK if available or fetch
async function verifyWebhookSignature(rawBody: any, headers: any) {
  try {
    const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || '';
    const client = getClient();
    const webhooks = require('@paypal/checkout-server-sdk').notifications;
    if (webhooks && webhooks.WebhookEventVerifySignatureRequest) {
      // SDK path
      const req = new webhooks.WebhookEventVerifySignatureRequest();
      req.requestBody({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody.toString())
      });
      const resp = await client.execute(req);
      return resp && resp.result && resp.result.verification_status === 'SUCCESS';
    }
  } catch (e) {
    console.warn('verifyWebhookSignature SDK path failed', e);
  }

  // fallback: call the REST verify endpoint
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
        webhook_event: JSON.parse(rawBody.toString())
      })
    });
    const j = await resp.json();
    return j && j.verification_status === 'SUCCESS';
  } catch (e) {
    console.error('verifyWebhookSignature fallback failed', e);
    return false;
  }
}

router.post('/api/paypal/webhook', async (req, res) => {
  try {
    const rawBody = req.body; // we expect raw body (express.raw)
    const headers = {
      'paypal-transmission-id': req.headers['paypal-transmission-id'],
      'paypal-transmission-time': req.headers['paypal-transmission-time'],
      'paypal-cert-url': req.headers['paypal-cert-url'],
      'paypal-transmission-sig': req.headers['paypal-transmission-sig'],
      'paypal-auth-algo': req.headers['paypal-auth-algo'],
    };

    const ok = await verifyWebhookSignature(rawBody, headers);
    if (!ok) return res.status(400).json({ error: 'Webhook verification failed' });

    const event = JSON.parse(rawBody.toString());
    const type = event.event_type;
    const resource = event.resource || {};

    if (type === 'PAYMENT.CAPTURE.COMPLETED') {
      const purchase = resource.purchase_units && resource.purchase_units[0];
      const clickId = purchase && purchase.custom_id;
      const amount = resource.amount && resource.amount.value;
      const currency = resource.amount && resource.amount.currency_code;
      const orderId = resource.id || (resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id) || null;

      // Placeholder upsert logic: log to console. Replace with DB upsert / attribution.
      console.log('PayPal capture completed', { orderId, amount, currency, clickId });

      // If clickId present, attribute (placeholder)
      if (clickId) {
        console.log('Attribution candidate for clickId', clickId);
        // TODO: find Click by clickId, compute commission, insert Attribution
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('paypal webhook error', e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
