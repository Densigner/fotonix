/**
 * Email Webhook Receiver - Receives POSTs from mail server when emails arrive
 * This is the CORRECT approach for multi-tenant email receiving
 */

const express = require('express');
const { Client } = require('pg');
const { uploadAttachments } = require('../../email-attachments');
const router = express.Router();

// PostgreSQL helper
async function query(sql, params = []) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    const result = await client.query(sql, params);
    return result;
  } finally {
    await client.end();
  }
}

/**
 * Webhook endpoint for receiving emails
 * Your mail server (Postfix) will POST to this when emails arrive
 * 
 * Expected payload (from mail server):
 * {
 *   from: "sender@example.com",
 *   to: ["contact.abc123@fotonix.co.uk"],
 *   subject: "Email subject",
 *   html: "<p>HTML content</p>",
 *   text: "Plain text content",
 *   headers: {
 *     message-id: "<abc@xyz.com>",
 *     in-reply-to: "<def@xyz.com>",
 *     references: ["<ghi@xyz.com>"]
 *   }
 * }
 */
router.post('/', async (req, res) => {
  try {
    console.log('📨 Incoming email webhook:', {
      from: req.body.from,
      to: req.body.to,
      subject: req.body.subject
    });

    const {
      from,
      to,
      subject,
      html,
      text,
      headers = {},
      attachments: rawAttachments
    } = req.body;

    // Validate webhook secret for security
    const webhookSecret = req.headers['x-webhook-secret'];
    if (webhookSecret !== process.env.WEBHOOK_SECRET) {
      console.error('❌ Invalid webhook secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Attachments are the same for every recipient on this one incoming email.
    let attachmentMeta = [];
    try {
      const uploaded = await uploadAttachments(rawAttachments, `inbound-${headers['message-id'] || Date.now()}`);
      attachmentMeta = uploaded.map(({ filename, contentType, size, url }) => ({ filename, contentType, size, url }));
    } catch (attachErr) {
      console.error('⚠️  Attachment upload failed, saving message without them:', attachErr.message);
    }

    // Extract recipient addresses (may be array)
    const recipients = Array.isArray(to) ? to : [to];

    // Process each recipient (in case of multiple To: addresses)
    for (const recipientAddress of recipients) {
      // Find which business email this was sent to
      const businessEmailResult = await query(
        'SELECT id, member_uid, business_name FROM business_emails WHERE email_address = $1 LIMIT 1',
        [recipientAddress]
      );

      let businessEmailId = null;
      let memberUid = null;
      
      if (businessEmailResult.rows.length > 0) {
        businessEmailId = businessEmailResult.rows[0].id;
        memberUid = businessEmailResult.rows[0].member_uid;
        console.log(`   ✅ Email for business: ${recipientAddress} (member: ${memberUid})`);
      } else {
        console.log(`   ⚠️  Email to unknown address: ${recipientAddress}`);
        // Still save it, but with null business_email_id
      }

      // Insert into email_messages table
      const result = await query(`
        INSERT INTO email_messages
        (
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
          created_at,
          attachments
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'inbound', 'received', $8, $9, $10, NOW(), false, NOW(), $11)
        RETURNING id
      `, [
        1, // tenant_id — single-tenant platform, integer column (was the string 'default', which always failed)
        businessEmailId,
        from,
        recipientAddress,
        subject,
        html || '',
        text || '',
        headers['message-id'] || null,
        headers['in-reply-to'] || null,
        JSON.stringify(headers['references'] || []),
        JSON.stringify(attachmentMeta)
      ]);

      const messageId = result.rows[0].id;
      console.log(`   ✅ Saved as message ID: ${messageId}`);
    }

    res.json({ success: true, message: 'Email received and processed' });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ 
      error: 'Failed to process email',
      detail: error.message 
    });
  }
});

module.exports = router;
