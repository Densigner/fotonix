require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// Payment routes
const createOrder = require('./routes/payments/create-order');
const captureOrder = require('./routes/payments/capture-order');
const subscriptions = require('./routes/payments/subscriptions');

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

// Marketing routes
const chatbot = require('./routes/marketing/chatbot');

// Webhook routes
const webhook = require('./routes/webhooks/webhook');

// Auth routes
const customAuth = require('./routes/auth/custom-auth');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration
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

// Use json for normal routes (mounted after webhook)
app.use(express.json());

// mount create + capture routes
app.use(createOrder);
app.use(captureOrder);
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
// mount custom auth API (VPS email verification)
console.log('🔐 Mounting custom auth routes...');
app.use('/', customAuth);
console.log('✅ Custom auth routes mounted');

app.listen(PORT, () => console.log('Server listening on', PORT));
