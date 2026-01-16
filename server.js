const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// require local routers using __dirname to avoid cwd-dependent MODULE_NOT_FOUND errors
const uploadRouter = require(path.join(__dirname, 'openaiImageProxy'));
// mount the OpenAI image proxy router which implements /api/generate-image and related endpoints
const openaiProxyRouter = require(path.join(__dirname, 'server', 'openaiImageProxy'));
const redditRouter = require('./server/reddit');

const app = express();
const PORT = process.env.PORT || 5002;

app.use(express.json({ limit: '20mb' }));

// Debug helper: log incoming requests (method and path) to help diagnose routing issues
app.use((req, res, next) => {
  try { console.log('REQ', req.method, req.path); } catch (e) {}
  next();
});

// Global CORS middleware: ensure browser preflight and CORS headers are always present.
// This runs before any routers so it reliably covers all /api endpoints.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  // respond to preflight quickly
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// mount upload-preview router
app.use('/api/upload-preview', uploadRouter);

// mount OpenAI image generation/edit proxy at root so the router's internal /api/* paths
// (e.g. /api/generate-image) are preserved and available to the frontend proxy
app.use(openaiProxyRouter);

// mount AI blend endpoint which composes server guideline and client preview
const aiBlendRouter = require('./server/aiBlend');
app.use('/api/ai-blend', aiBlendRouter);

// mount reddit oauth/submit routes
app.use('/api/reddit', redditRouter);

// Dev-friendly affiliates endpoints: provide mock responses so the frontend
// doesn't hit 404s when the full affiliates service isn't wired up locally.
app.get('/api/affiliates/stats', (req, res) => {
  const code = String(req.query.code || '');
  if (!code) return res.status(400).json({ error: 'code required' });
  return res.json({ code, clicks: 42, conversions: 2, earnings: 9.50, lastActive: new Date().toISOString() });
});

app.get('/api/affiliates/attributions', (req, res) => {
  const code = String(req.query.code || '');
  if (!code) return res.status(400).json({ error: 'code required' });
  // Return an array directly — frontend expects an array of rows
  return res.json([{ id: 1, orderNumber: 'ORD-1001', amountCents: 3500, commissionCents: 350, date: new Date().toISOString(), status: 'pending', notes: '' }]);
});

// mount render/inliner route
const renderRouter = require('./server/render');
app.use(renderRouter);

// mount template CRUD
const templatesRouter = require('./server/templates');
app.use(templatesRouter);

// mount campaigns/test route
const campaignsRouter = require('./server/campaigns');
app.use(campaignsRouter);

// mount subscription API routes
try {
  const subscriptionsRouter = require('./server/routes/subscriptions');
  app.use('/api/subscriptions', subscriptionsRouter);
  console.log('✅ Subscriptions routes mounted');
} catch (error) {
  console.error('❌ Failed to mount subscriptions routes:', error.message);
}

// mount member API routes
try {
  const memberRouter = require('./server/routes/member');
  app.use('/api/member', memberRouter);
  console.log('✅ Member routes mounted');
} catch (error) {
  console.error('❌ Failed to mount member routes:', error.message);
}

// mount leads API routes
try {
  const leadsRouter = require('./server/routes/leads');
  app.use('/api/leads', leadsRouter);
  console.log('✅ Leads routes mounted');
} catch (error) {
  console.error('❌ Failed to mount leads routes:', error.message);
}

// mount chatbot API routes
try {
  const chatbotRouter = require('./server/routes/chatbot');
  app.use('/api/chatbot', chatbotRouter);
  console.log('✅ Chatbot routes mounted');
} catch (error) {
  console.error('❌ Failed to mount chatbot routes:', error.message);
}

// mount contacts API routes
try {
  const contactsRouter = require('./server/routes/contacts');
  app.use('/api/contacts', contactsRouter);
  console.log('✅ Contacts routes mounted');
} catch (error) {
  console.error('❌ Failed to mount contacts routes:', error.message);
}

// mount email API routes
try {
  const emailsRouter = require('./server/routes/emails');
  app.use('/api/emails', emailsRouter);
  console.log('✅ Email routes mounted');
} catch (error) {
  console.error('❌ Failed to mount email routes:', error.message);
}

// mount SMTP test routes
try {
  const smtpTestRouter = require('./server/routes/smtp-test');
  app.use('/api/smtp', smtpTestRouter);
  console.log('✅ SMTP test routes mounted');
} catch (error) {
  console.error('❌ Failed to mount SMTP test routes:', error.message);
}

// mount stencil order/payment routes
try {
  const stencilOrderRouter = require('./server/routes/payments/stencil-order');
  app.use(stencilOrderRouter);  // Mount at root since routes include full /api/stencil/ paths
  console.log('✅ Stencil order routes mounted');
} catch (error) {
  console.error('❌ Failed to mount stencil order routes:', error.message);
}

// mount user sync routes (Firebase Auth -> PostgreSQL)
try {
  const usersRouter = require('./server/routes/auth/users');
  app.use('/api/users', usersRouter);
  console.log('✅ User sync routes mounted');
} catch (error) {
  console.error('❌ Failed to mount user sync routes:', error.message);
}

// helper: upload image via existing endpoint then submit to reddit using server tokens
app.post('/api/submit-to-reddit', async (req, res) => {
  try {
    const { imageDataUrl, title, sr } = req.body || {};
    if (!imageDataUrl) return res.status(400).json({ error: 'imageDataUrl required' });
    // call local upload-preview endpoint
    const upl = await fetch(`http://localhost:${PORT}/api/upload-preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageDataUrl })
    });
    if (!upl.ok) return res.status(500).json({ error: 'upload_failed', status: upl.status });
    const j = await upl.json();
  // prefer the product page URL for better SEO and canonical linking; fall back to image/public page
  const urlForReddit = j.productUrl || j.publicUrl || j.imageUrl || j.url;
    if (!urlForReddit) return res.status(500).json({ error: 'no_url_from_upload' });
    // call reddit submit route
    const submitRes = await fetch(`http://localhost:${PORT}/api/reddit/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: urlForReddit, title: title || 'Check out my mirror design!', sr })
    });
    const sj = await submitRes.json();
    if (!submitRes.ok) return res.status(500).json({ error: 'reddit_submit_failed', detail: sj });
    return res.json({ success: true, reddit: sj, upload: j });
  } catch (err) {
    console.error('submit-to-reddit error', err);
    return res.status(500).json({ error: 'submit_error', detail: String(err) });
  }
});

// serve uploads and public
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Simple health check route to confirm server is running
app.get('/__health', (req, res) => {
  res.json({ ok: true, time: Date.now(), env: { baseUrl: process.env.BASE_URL || null } });
});

app.listen(PORT, () => {
  console.log(`Preview upload server listening on http://localhost:${PORT}`);
});
