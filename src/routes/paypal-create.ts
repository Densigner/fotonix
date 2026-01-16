import { Router } from 'express';
import getClient from '../paypal';

const router = Router();

function toCents(amount: any) {
  return Math.round(Number(amount) * 100);
}

function centsToDecimalString(cents: any) {
  return (Number(cents) / 100).toFixed(2);
}

router.post('/api/paypal/create-order', async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const currency = body.currency || 'GBP';

  // compute total in cents
  let totalCents = 0;
  items.forEach((it: any) => { const unit = Number(it.unitAmount || 0); const qty = Number(it.quantity || 1); totalCents += Math.round(unit * qty); });

    // read affiliate clickId from signed cookie 'aff_click' (fallback to empty)
    const clickId = (req.signedCookies && req.signedCookies.aff_click) || '';

    const client = getClient();
    const request = new (require('@paypal/checkout-server-sdk').orders.OrdersCreateRequest)();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: centsToDecimalString(totalCents),
          },
          custom_id: clickId || undefined,
        }
      ]
    });

    const resp = await client.execute(request);
    const orderId = resp && resp.result && resp.result.id;
    res.json({ id: orderId });
  } catch (e) {
    console.error('create-order error', e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
