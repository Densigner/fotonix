const express = require('express');
const router = express.Router();
const { getClient } = require('../../paypal');
const merchants = require('../merchants/merchants');
const fetch = global.fetch || require('node-fetch');
const { toCents, parseCurrency } = require('../../utils');

function centsToDecimalString(cents) { return (Number(cents) / 100).toFixed(2); }

async function createOrderHandler(req, res) {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const currency = parseCurrency(body.currency);

    // compute total in cents; unitAmount may be passed as cents or decimal dollars
    let totalCents = 0;
    items.forEach((it) => {
      const unitCents = toCents(it.unitAmount || 0);
      const qty = Number(it.quantity || 1);
      totalCents += Math.round(unitCents * qty);
    });

    const clickId = (req.signedCookies && req.signedCookies.aff_click) || '';

    // If merchant_id cookie present, try to create order using merchant access token
    const merchantId = (req.cookies && req.cookies.merchant_id) || null;
    if (merchantId) {
      try {
        const access = await merchants.refreshAndGetAccessToken(merchantId);
        if (access) {
          const paypalBase = merchants.paypalBase();
          const url = `${paypalBase}/v2/checkout/orders`;
          const mbody = {
            intent: 'CAPTURE',
            purchase_units: [
              {
                amount: { currency_code: currency, value: centsToDecimalString(totalCents) },
                custom_id: clickId || 'no_aff'
              }
            ]
          };
          const r = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(mbody)
          });
          const j = await r.json();
          if (!r.ok) {
            console.warn('merchant order creation failed, falling back to platform', j);
          } else {
            return res.json({ id: j.id });
          }
        }
      } catch (e) {
        console.warn('merchant order attempt failed', e);
      }
    }

    // Fallback to platform/order using SDK
    const client = getClient();
    const OrdersCreateRequest = require('@paypal/checkout-server-sdk').orders.OrdersCreateRequest;
    const request = new OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: centsToDecimalString(totalCents),
          },
          custom_id: clickId || 'no_aff',
        }
      ]
    });
    const resp = await client.execute(request);
    res.json({ id: resp.result && resp.result.id });
  } catch (e) {
    console.error('create-order error', e);
    res.status(500).json({ error: String(e) });
  }
}

// original route
router.post('/api/paypal/create-order', createOrderHandler);
// alias for backward-compat / convenience
router.post('/api/paypal-create', createOrderHandler);

module.exports = router;
