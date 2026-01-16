const net = require('net');

const payload = JSON.stringify({
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: {
    id: 'TEST_ORDER_123',
    amount: { value: '25.00', currency_code: 'GBP' },
    purchase_units: [{ custom_id: 'click_test_1' }]
  }
});

const host = '127.0.0.1';
const port = 4000;
const path = '/api/paypal/webhook';

const reqLines = [];
reqLines.push(`POST ${path} HTTP/1.1`);
reqLines.push(`Host: ${host}:${port}`);
reqLines.push('Content-Type: application/json');
reqLines.push(`Content-Length: ${Buffer.byteLength(payload)}`);
// Include a fake transmission id so webhook idempotency can be tested
reqLines.push('paypal-transmission-id: test-transmission-12345');
reqLines.push('Connection: close');
reqLines.push('');
reqLines.push(payload);

const reqText = reqLines.join('\r\n');

const client = net.createConnection({ host, port }, () => {
  client.write(reqText);
});

let resp = '';
client.on('data', (d) => { resp += d.toString(); });
client.on('end', () => {
  const statusMatch = resp.match(/HTTP\/1\.1 (\d{3})/);
  console.log('RAW_RESPONSE_STATUS', statusMatch ? statusMatch[1] : 'N/A');
  const bodySplit = resp.split('\r\n\r\n');
  console.log('RAW_RESPONSE_BODY', bodySplit[1] || '');
});
client.on('error', (e) => console.error('socket err', e));
