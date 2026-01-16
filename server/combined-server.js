// combined-server.js - Production server with all routes including OpenAI Image Proxy
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

// Import the openaiImageProxy app (it exports an express app)
const openaiImageProxy = require('./openaiImageProxy');

// Payment routes
const createOrder = require('./routes/payments/create-order');
const captureOrder = require('./routes/payments/capture-order');
const stencilOrder = require('./routes/payments/stencil-order');

const app = express();
const PORT = process.env.PORT || 4000;

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// CORS - allow all origins for now, restrict in production
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'https://fotonix.co.uk', 'https://www.fotonix.co.uk'],
  credentials: true
}));

// Cookie parser for affiliate tracking
app.use(cookieParser(process.env.COOKIE_SECRET || 'secret'));

// Parse JSON bodies
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fotonix-api-combined', timestamp: Date.now() });
});

// Mount PayPal payment routes
console.log('💳 Mounting PayPal payment routes...');
app.use(createOrder);
app.use(captureOrder);
app.use(stencilOrder);
console.log('✅ PayPal routes mounted');

// Mount openaiImageProxy routes (includes /api/generate-image)
console.log('🎨 Mounting OpenAI image proxy routes...');
app.use(openaiImageProxy);
console.log('✅ OpenAI image proxy routes mounted');

// Email webhook receiver
app.post('/api/email/receive-webhook', async (req, res) => {
  try {
    console.log('[WEBHOOK] Received email:', {
      from: req.body.from,
      to: req.body.to,
      subject: req.body.subject
    });

    const { from, to, subject, text, html, message_id, in_reply_to, references } = req.body;
    
    const extractEmail = (emailStr) => {
      if (!emailStr) return null;
      const match = emailStr.match(/<(.+?)>/);
      return match ? match[1] : emailStr;
    };

    const toAddress = Array.isArray(to) ? extractEmail(to[0]) : extractEmail(to);

    const businessEmailResult = await pool.query(
      'SELECT id, tenant_id FROM business_emails WHERE email_address = $1 AND is_active = true',
      [toAddress]
    );

    if (businessEmailResult.rows.length === 0) {
      console.log('[WEBHOOK] No matching business email found for:', to);
      return res.status(404).json({ error: 'Business email not found' });
    }

    const businessEmail = businessEmailResult.rows[0];

    const result = await pool.query(`
      INSERT INTO email_messages (
        tenant_id, business_email_id, from_address, to_address, subject,
        html, text, direction, status, message_id, in_reply_to,
        email_references, received_at, is_read, queued_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), false, NOW(), NOW(), NOW())
      RETURNING id
    `, [
      businessEmail.tenant_id, businessEmail.id, from, to, subject,
      html || '', text || '', 'inbound', 'received', message_id, in_reply_to,
      references ? JSON.stringify(Array.isArray(references) ? references : [references]) : null
    ]);

    console.log('[WEBHOOK] Email saved with ID:', result.rows[0].id);
    res.json({ success: true, id: result.rows[0].id });

  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    res.status(500).json({ error: 'Failed to process email', detail: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Combined server running on port ${PORT}`);
  console.log(`OpenAI Image API: http://localhost:${PORT}/api/generate-image`);
  console.log(`Email webhook: http://localhost:${PORT}/api/email/receive-webhook`);
});
