const http = require('http');
const data = JSON.stringify({ affiliateId: 'AFF_TEST', productId: 'p_test', linkCustomRatePct: 12.5 });
const port = Number(process.argv[2] || process.env.PORT || 5002);

const opts = {
  hostname: 'localhost',
  port,
  path: '/api/clicks/create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

console.log('Posting test click to', `http://localhost:${port}/api/clicks/create`);

const req = http.request(opts, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try {
      console.log('BODY', JSON.parse(body));
    } catch (e) {
      console.log('BODY RAW', body);
    }
  });
});

req.on('error', (e) => console.error('REQUEST ERROR', e));
req.write(data);
req.end();
