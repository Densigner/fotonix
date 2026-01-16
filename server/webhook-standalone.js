require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4000;

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fotonix-email-webhook' });
});

// Email webhook receiver
app.post('/api/email/receive-webhook', async (req, res) => {
  try {
    console.log('[WEBHOOK] Received email:', {
      from: req.body.from,
      to: req.body.to,
      subject: req.body.subject
    });

    const { from, to, subject, text, html, message_id, in_reply_to, references } = req.body;

    // Extract email address from "Name <email>" format
    const extractEmail = (emailStr) => {
      if (!emailStr) return null;
      const match = emailStr.match(/<(.+?)>/);
      return match ? match[1] : emailStr;
    };

    // Handle to as array or string
    const toAddress = Array.isArray(to) ? extractEmail(to[0]) : extractEmail(to);

    // Find business email by to_address
    const businessEmailResult = await pool.query(
      'SELECT id, tenant_id FROM business_emails WHERE email_address = $1 AND is_active = true',
      [toAddress]
    );

    if (businessEmailResult.rows.length === 0) {
      console.log('[WEBHOOK] No matching business email found for:', to, '(extracted:', toAddress + ')');
      return res.status(404).json({ error: 'Business email not found' });
    }

    const businessEmail = businessEmailResult.rows[0];

    // Insert the email message
    const result = await pool.query(`
      INSERT INTO email_messages (
        tenant_id,
        business_email_id,
        from_address,
        to_address,
        subject,
        html,
        text,
        direction,
        status,
        message_id,
        in_reply_to,
        email_references,
        received_at,
        is_read,
        queued_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), false, NOW(), NOW(), NOW())
      RETURNING id
    `, [
      businessEmail.tenant_id,
      businessEmail.id,
      from,
      to,
      subject,
      html || '',
      text || '',
      'inbound',
      'received',
      message_id,
      in_reply_to,
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
  console.log(`Email webhook server running on port ${PORT}`);
  console.log(`Ready to receive emails at http://localhost:${PORT}/api/email/receive-webhook`);
});
