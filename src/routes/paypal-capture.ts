import { Router } from 'express';
import getClient from '../paypal';

const router = Router();

router.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const orderId = req.body && req.body.orderId;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    const client = getClient();
    const OrdersCaptureRequest = require('@paypal/checkout-server-sdk').orders.OrdersCaptureRequest;
    const request = new OrdersCaptureRequest(orderId);
    request.prefer('return=representation');
    const resp = await client.execute(request);
    res.json(resp.result || resp);
  } catch (e) {
    console.error('capture-order error', e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
