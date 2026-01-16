const http = require('http');
const clickId = process.argv[2] || 'click_1761664477976_1257';
const payload = JSON.stringify({
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  id: 'TEST_EVT_2_' + Date.now(),
  resource: {
    id: 'ORDER_WEBHOOK_' + Date.now(),
    amount: { value: '19.99', currency_code: 'GBP' },
    purchase_units: [{ custom_id: clickId }]
  }
});

const opts = {
  hostname: 'localhost',
  port: Number(process.argv[3] || process.env.PORT || 4001),
  path: '/api/paypal/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log('Posting webhook to', `http://localhost:${opts.port}/api/paypal/webhook`, 'clickId=', clickId);

const req = http.request(opts, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try { console.log('BODY', JSON.parse(body)); } catch(e) { console.log('BODY RAW', body); }
  });
});
req.on('error', (e) => console.error('REQUEST ERROR', e));
req.write(payload);
req.end();
