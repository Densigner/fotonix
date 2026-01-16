require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// Payment routes
const createOrder = require('./routes/payments/create-order');
const captureOrder = require('./routes/payments/capture-order');
const subscriptions = require('./routes/payments/subscriptions');
const stencilOrder = require('./routes/payments/stencil-order');

// Affiliate routes
const affiliates = require('./routes/affiliate/affiliates');
const clicks = require('./routes/affiliate/clicks');
const leads = require('./routes/affiliate/leads');

// Merchant routes
const merchants = require('./routes/merchants/merchants');

// Product routes
const products = require('./routes/products/products');

// Store routes
const stores = require('./routes/stores/stores');

// Member routes
const member = require('./routes/member/member');

// Email routes
const emails = require('./routes/email/emails');
const emailWebhook = require('./routes/email/receive-webhook');
const emailTracking = require('./routes/email/tracking');
const shippingNotification = require('./routes/email/shipping-notification');

// Marketing routes
const chatbot = require('./routes/marketing/chatbot');

// Webhook routes
const webhook = require('./routes/webhooks/webhook');

// Auth routes
const customAuth = require('./routes/auth/custom-auth');

// OpenAI Image Proxy (AI image generation endpoint)
const openaiImageProxy = require('./openaiImageProxy');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration for React development server and production
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://fotonix.co.uk', 'https://www.fotonix.co.uk'],
  credentials: true
}));

// Use cookie parser
app.use(cookieParser(process.env.COOKIE_SECRET || 'secret'));

// webhook: must receive raw body to verify signature
// Mount this route before json body parser so express doesn't consume the body first.
app.use('/api/paypal/webhook', express.raw({ type: 'application/json' }), webhook);

// Email webhook: also needs raw body if you want to verify signatures later
app.use('/api/email/receive-webhook', express.json(), emailWebhook);

// Email tracking: open pixels and click redirects
app.use('/api/email/track', emailTracking);

// Use json for normal routes (mounted after webhook)
app.use(express.json());

// mount create + capture routes
app.use(createOrder);
app.use(captureOrder);
// mount stencil order routes
app.use(stencilOrder);
// mount clicks route (file-backed dev helper)
app.use(clicks);
// mount affiliates API
app.use('/api/affiliates', affiliates);
// mount merchants (PayPal OAuth connect / merchant management)
app.use(merchants);
// mount products API (dev file-backed list)
app.use(products);
// mount stores API (store builder CRUD)
app.use('/api/stores', stores);
// mount member API (dashboard, links, payments)
app.use('/api/member', member);
// mount subscriptions API (billing, trials, PayPal)
app.use('/api/subscriptions', subscriptions);
// mount leads API (email capture, conversion tracking)
app.use('/api/leads', leads);
// mount chatbot API (AI conversations, qualified leads)
app.use('/api/chatbot', chatbot);
// mount email API (SMTP sending, inbox management)
app.use('/api/email', emails);
// mount shipping notification API
app.use('/api/email/shipping-notification', shippingNotification);
// mount custom auth API (VPS email verification)
console.log('🔐 Mounting custom auth routes...');
app.use('/', customAuth);
console.log('✅ Custom auth routes mounted');

// mount OpenAI image proxy (AI image generation)
console.log('🎨 Mounting OpenAI image proxy routes...');
app.use(openaiImageProxy);
console.log('✅ OpenAI image proxy routes mounted at /api/generate-image');

// Download proxy for Firebase Storage files (handles CORS)
app.get('/api/download-proxy', async (req, res) => {
  try {
    const { url, filename } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    const fetch = global.fetch || require('node-fetch');
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Proxy fetch failed:', response.status, response.statusText);
      return res.status(response.status).json({ error: 'Failed to fetch file' });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    // Allow CORS from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', contentType);
    
    // Only set Content-Disposition if filename is provided (for direct downloads)
    if (filename) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Download proxy error:', error);
    res.status(500).json({ error: 'Download failed', message: error.message });
  }
});

app.listen(PORT, () => console.log('Server listening on', PORT));
