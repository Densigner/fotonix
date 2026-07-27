const express = require('express');
const { Client } = require('pg');
const { loadTransport } = require('../../../src/email/smtp');
const { renderTemplate } = require('../../../src/email/renderer');
const { uploadAttachments } = require('../../email-attachments');
const router = express.Router();

// PostgreSQL helper function using same pattern as other routes
async function query(sql, params = []) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    const result = await client.query(sql, params);
    return result;
  } catch (error) {
    // If database doesn't exist or table missing, return empty for graceful handling
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return { rows: [] };
    }
    throw error;
  } finally {
    await client.end();
  }
}

// Helper function to get tenant ID from request
function getTenantId(req) {
  // Support both 'tenant' and 'tenantId' query params, and map string values.
  // Single-tenant platform — tenant_id columns are integers referencing
  // tenants(id), so slug-style values must map to the real numeric tenant (1),
  // not the string 'default' (which fails "invalid input syntax for integer").
  const tenant = req.headers['x-tenant-id'] || req.query.tenant || req.query.tenantId;

  if (tenant === 'fotonix-prod' || tenant === 'default' || !tenant) {
    return 1;
  }

  const numeric = Number(tenant);
  return Number.isFinite(numeric) ? numeric : 1;
}

// Send individual email (UPDATED with business_email support and defensive checks)
router.post('/send', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { to, from, subject, html, text, templateName, templateData, businessEmailId, attachments: rawAttachments } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'to and subject are required' });
    }

    // Upload any attachments before creating the message record, so their
    // metadata can be stored alongside it in one insert.
    let uploadedAttachments = [];
    try {
      uploadedAttachments = await uploadAttachments(rawAttachments, `send-${Date.now()}`);
    } catch (attachErr) {
      return res.status(400).json({ error: 'Attachment upload failed', detail: attachErr.message });
    }

    // Check if recipient is suppressed
    const suppressionCheck = await query(
      'SELECT * FROM email_suppressions WHERE tenant_id = $1 AND address = $2',
      [tenantId, to]
    );

    if (suppressionCheck.rows.length > 0) {
      const suppression = suppressionCheck.rows[0];
      return res.status(400).json({ 
        error: 'Email suppressed', 
        reason: suppression.reason,
        detail: suppression.detail 
      });
    }

    // If businessEmailId provided, validate and get email details
    let businessEmailInfo = null;
    if (businessEmailId) {
      const businessEmailResult = await query(
        'SELECT id, email_address, display_name, is_active, is_verified, daily_send_limit, daily_send_count FROM business_emails WHERE id = $1',
        [businessEmailId]
      );
      
      if (businessEmailResult.rows.length > 0) {
        businessEmailInfo = businessEmailResult.rows[0];
        
        // Check if email is active
        if (!businessEmailInfo.is_active) {
          return res.status(400).json({ 
            error: 'Business email is not active' 
          });
        }
        
        // Check daily send limit
        if (businessEmailInfo.daily_send_count >= businessEmailInfo.daily_send_limit) {
          return res.status(429).json({ 
            error: 'Daily send limit reached',
            limit: businessEmailInfo.daily_send_limit,
            sent: businessEmailInfo.daily_send_count
          });
        }
      }
    }

    // Load SMTP transport for this tenant (with optional custom FROM address)
    const { transport, defaultFrom } = await loadTransport(tenantId, from);
    
    // Use FROM address from business_email if available, otherwise from request, otherwise default
    const actualFrom = businessEmailInfo?.email_address || from || defaultFrom;
    const actualFromName = businessEmailInfo?.display_name || actualFrom;
    
    let finalHtml = html;
    let finalText = text;

    // If using template, render it
    if (templateName) {
      const templateResult = await query(
        'SELECT * FROM email_templates WHERE tenant_id = $1 AND name = $2 AND is_active = true',
        [tenantId, templateName]
      );
      
      if (templateResult.rows.length > 0) {
        const template = templateResult.rows[0];
        finalHtml = renderTemplate(template.html, templateData || {});
        finalText = renderTemplate(template.text, templateData || {});
      }
    }

    const attachmentMeta = uploadedAttachments.map(({ filename, contentType, size, url }) => ({ filename, contentType, size, url }));

    // Create message record (DEFENSIVE: handle empty result)
    const messageResult = await query(`
      INSERT INTO email_messages
      (tenant_id, from_address, to_address, subject, html, text, status, queued_at, meta, business_email_id, attachments)
      VALUES ($1, $2, $3, $4, $5, $6, 'queued', NOW(), $7, $8, $9)
      RETURNING id
    `, [tenantId, actualFrom, to, subject, finalHtml, finalText, JSON.stringify(req.body), businessEmailId || null, JSON.stringify(attachmentMeta)]);

    // DEFENSIVE CHECK: Ensure we got an ID back
    if (!messageResult.rows || messageResult.rows.length === 0 || !messageResult.rows[0]?.id) {
      throw new Error('Failed to create message record - INSERT returned no ID');
    }

    const messageId = messageResult.rows[0].id;

    try {
      // Send email via your VPS mail server
      const info = await transport.sendMail({
        from: `"${actualFromName}" <${actualFrom}>`,
        to: to,
        subject: subject,
        html: finalHtml,
        text: finalText,
        attachments: uploadedAttachments.map(a => ({ filename: a.filename, content: a.buffer, contentType: a.contentType })),
        headers: {
          'Message-ID': `<${messageId}@${req.get('host') || 'fotonix.co.uk'}>`,
          'X-Tenant-ID': tenantId,
          'X-Message-ID': messageId
        }
      });

      // Update message status
      await query(
        'UPDATE email_messages SET status = $1, provider_message_id = $2, sent_at = NOW() WHERE id = $3',
        ['sent', info.messageId, messageId]
      );
      
      // Increment business email send count if applicable
      if (businessEmailId && businessEmailInfo) {
        await query(
          'UPDATE business_emails SET daily_send_count = daily_send_count + 1, updated_at = NOW() WHERE id = $1',
          [businessEmailId]
        );
      }

      // Log event
      await query(`
        INSERT INTO email_events (message_id, tenant_id, event_type, payload)
        VALUES ($1, $2, 'sent', $3)
      `, [messageId, tenantId, JSON.stringify({ messageId: info.messageId, response: info.response })]);

      res.json({
        success: true,
        messageId: messageId,
        providerMessageId: info.messageId,
        from: actualFrom,
        response: info.response
      });

    } catch (sendError) {
      console.error('Email send error:', sendError);
      
      // Update message status to failed
      await query(
        'UPDATE email_messages SET status = $1, error = $2 WHERE id = $3',
        ['failed', sendError.message, messageId]
      );

      // Log failure event
      await query(`
        INSERT INTO email_events (message_id, tenant_id, event_type, payload)
        VALUES ($1, $2, 'failure', $3)
      `, [messageId, tenantId, JSON.stringify({ error: sendError.message, stack: sendError.stack })]);

      res.status(500).json({
        error: 'Failed to send email',
        detail: sendError.message
      });
    }

  } catch (error) {
    console.error('Email API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

// Send bulk emails (campaign)
router.post('/send-bulk', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { recipients, subject, html, text, templateName, templateData, campaignId, fromEmail, fromName, replyTo, attachments: rawAttachments } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients array is required' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'subject is required' });
    }

    // Upload attachments once — the same files are sent to every recipient,
    // no need to re-upload per recipient.
    let uploadedAttachments = [];
    try {
      uploadedAttachments = await uploadAttachments(rawAttachments, `campaign-${campaignId || Date.now()}`);
    } catch (attachErr) {
      return res.status(400).json({ error: 'Attachment upload failed', detail: attachErr.message });
    }
    const attachmentMeta = uploadedAttachments.map(({ filename, contentType, size, url }) => ({ filename, contentType, size, url }));
    const nodemailerAttachments = uploadedAttachments.map(a => ({ filename: a.filename, content: a.buffer, contentType: a.contentType }));

    const results = [];
    const { transport, defaultFrom } = await loadTransport(tenantId);
    
    // Use provided fromEmail or fallback to defaultFrom
    const actualFrom = fromEmail ? (fromName ? `"${fromName}" <${fromEmail}>` : fromEmail) : defaultFrom;
    const actualReplyTo = replyTo || fromEmail || defaultFrom;

    // Process in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (recipient) => {
        try {
          // Check suppression
          const suppressionCheck = await query(
            'SELECT * FROM email_suppressions WHERE tenant_id = $1 AND address = $2',
            [tenantId, recipient.email || recipient]
          );

          if (suppressionCheck.rows.length > 0) {
            return {
              email: recipient.email || recipient,
              status: 'suppressed',
              reason: suppressionCheck.rows[0].reason
            };
          }

          // Render template with recipient-specific data
          let finalHtml = html;
          let finalText = text;
          
          if (templateName) {
            const templateResult = await query(
              'SELECT * FROM email_templates WHERE tenant_id = $1 AND name = $2 AND is_active = true',
              [tenantId, templateName]
            );
            
            if (templateResult.rows.length > 0) {
              const template = templateResult.rows[0];
              const mergedData = { ...templateData, ...recipient };
              finalHtml = renderTemplate(template.html, mergedData);
              finalText = renderTemplate(template.text, mergedData);
            }
          }

          // Create message record
          const messageResult = await query(`
            INSERT INTO email_messages
            (tenant_id, from_address, to_address, subject, html, text, status, queued_at, meta, attachments)
            VALUES ($1, $2, $3, $4, $5, $6, 'queued', NOW(), $7, $8)
            RETURNING id
          `, [tenantId, fromEmail || defaultFrom, recipient.email || recipient, subject, finalHtml, finalText, JSON.stringify({ campaignId, recipient }), JSON.stringify(attachmentMeta)]);

          const messageId = messageResult.rows[0].id;

          // Send email
          const info = await transport.sendMail({
            from: actualFrom,
            replyTo: actualReplyTo,
            to: recipient.email || recipient,
            subject: subject,
            html: finalHtml,
            text: finalText,
            attachments: nodemailerAttachments,
            headers: {
              'Message-ID': `<${messageId}@${req.get('host') || 'fotonix.co.uk'}>`,
              'X-Tenant-ID': tenantId,
              'X-Message-ID': messageId,
              'X-Campaign-ID': campaignId
            }
          });

          // Update message status
          await query(
            'UPDATE email_messages SET status = $1, provider_message_id = $2, sent_at = NOW() WHERE id = $3',
            ['sent', info.messageId, messageId]
          );

          // Log event
          await query(`
            INSERT INTO email_events (message_id, tenant_id, event_type, payload)
            VALUES ($1, $2, 'sent', $3)
          `, [messageId, tenantId, JSON.stringify({ messageId: info.messageId, campaignId })]);

          return {
            email: recipient.email || recipient,
            status: 'sent',
            messageId: messageId,
            providerMessageId: info.messageId
          };

        } catch (error) {
          console.error(`Error sending to ${recipient.email || recipient}:`, error);
          return {
            email: recipient.email || recipient,
            status: 'failed',
            error: error.message
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { status: 'failed', error: r.reason }));
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const suppressed = results.filter(r => r.status === 'suppressed').length;

    res.json({
      success: true,
      total: recipients.length,
      sent: successful,
      failed: failed,
      suppressed: suppressed,
      results: results
    });

  } catch (error) {
    console.error('Bulk email error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

// Get email messages list
router.get('/messages', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    console.log('[INBOX DEBUG] tenantId:', tenantId, 'from req.query.tenant:', req.query.tenant);
    const {
      limit = 25,
      cursor,
      status,
      filter,
      label,
      q: searchQuery,
      sort = 'date:desc',
      memberUid
    } = req.query;

    // Get member's business email addresses for filtering
    let memberBusinessEmails = [];
    if (memberUid) {
      console.log('[INBOX DEBUG] memberUid:', memberUid);
      const businessEmailsResult = await query(
        'SELECT email_address FROM business_emails WHERE member_uid = $1 AND is_active = true',
        [memberUid]
      );
      console.log('[INBOX DEBUG] businessEmailsResult.rows:', businessEmailsResult.rows);
      memberBusinessEmails = businessEmailsResult.rows.map(r => r.email_address);
      console.log('[INBOX DEBUG] memberBusinessEmails:', memberBusinessEmails);
    }

    let sql = `
      SELECT 
        m.*,
        be.email_address as business_email,
        be.business_name,
        CASE 
          WHEN m.direction = 'inbound' THEN m.from_address
          ELSE m.to_address 
        END as display_address
      FROM email_messages m 
      LEFT JOIN business_emails be ON m.business_email_id = be.id
      WHERE m.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 1;

    // Filter by member's business emails if memberUid provided. Deliberately
    // fail-closed: even if this member has zero business_emails rows yet,
    // still apply the clause (it'll just match nothing) rather than skipping
    // the filter and falling through to every tenant message.
    if (memberUid) {
      sql += ` AND (
        m.to_address = ANY($${++paramIndex}::text[])
        OR m.from_address = ANY($${paramIndex}::text[])
        OR be.member_uid = $${++paramIndex}
      )`;
      params.push(memberBusinessEmails, memberUid);
    }

    // Add filters
    if (status === 'received') {
      sql += ` AND m.direction = 'inbound'`;
    } else if (status === 'sent') {
      sql += ` AND m.direction = 'outbound' AND m.status = 'sent'`;
    } else if (status === 'draft') {
      sql += ` AND m.status = 'draft'`;
    } else if (status === 'archived') {
      sql += ` AND m.status = 'archived'`;
    } else if (status === 'spam') {
      sql += ` AND m.status = 'spam'`;
    } else if (status === 'deleted') {
      sql += ` AND m.status = 'deleted'`;
    }
    
    if (filter === 'unread') {
      sql += ` AND m.is_read = false`;
    }
    if (searchQuery) {
      sql += ` AND (m.subject ILIKE $${++paramIndex} OR m.text ILIKE $${++paramIndex})`;
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }
    if (cursor) {
      sql += ` AND m.created_at < $${++paramIndex}`;
      params.push(cursor);
    }

    // Add sorting
    const [sortField, sortDir] = sort.split(':');
    const sortColumn = sortField === 'date' ? 'created_at' : 'created_at';
    const sortDirection = sortDir === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY m.${sortColumn} ${sortDirection}`;

    // Add limit
    sql += ` LIMIT $${++paramIndex}`;
    params.push(parseInt(limit) + 1); // Get one extra to check for more

    console.log('[INBOX DEBUG] Final SQL:', sql);
    console.log('[INBOX DEBUG] Params:', JSON.stringify(params));

    const result = await query(sql, params);
    console.log('[INBOX DEBUG] Query result rows:', result.rows.length);
    const messages = result.rows || [];
    
    // Check if there are more messages
    const hasMore = messages.length > parseInt(limit);
    if (hasMore) {
      messages.pop(); // Remove the extra message
    }

    // Get next cursor from last message
    const nextCursor = hasMore && messages.length > 0 ? 
      messages[messages.length - 1].created_at : null;

    res.json({
      items: messages,
      next_cursor: nextCursor,
      has_more: hasMore
    });

  } catch (error) {
    console.error('Get messages error:', error);
    
    // If table doesn't exist, return empty result instead of error
    if (error.message && error.message.includes('does not exist')) {
      res.json({
        items: [],
        next_cursor: null,
        has_more: false
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        detail: error.message
      });
    }
  }
});

// Get email message status
router.get('/messages/:messageId', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { messageId } = req.params;
    const { memberUid } = req.query;

    let memberBusinessEmails = [];
    if (memberUid) {
      const businessEmailsResult = await query(
        'SELECT email_address FROM business_emails WHERE member_uid = $1 AND is_active = true',
        [memberUid]
      );
      memberBusinessEmails = businessEmailsResult.rows.map(r => r.email_address);
    }

    let sql = `
      SELECT
        m.*,
        be.email_address as business_email,
        be.business_name,
        be.display_name as business_display_name
      FROM email_messages m
      LEFT JOIN business_emails be ON m.business_email_id = be.id
      WHERE m.id = $1 AND m.tenant_id = $2
    `;
    const params = [messageId, tenantId];

    // Same fail-closed member scoping as GET /messages — see comment there.
    if (memberUid) {
      sql += ` AND (
        m.to_address = ANY($3::text[])
        OR m.from_address = ANY($3::text[])
        OR be.member_uid = $4
      )`;
      params.push(memberBusinessEmails, memberUid);
    }

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

// Mark messages read/unread
router.post('/messages/mark-read', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { message_ids, read } = req.body || {};

    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      return res.status(400).json({ error: 'message_ids array is required' });
    }

    await query(
      `UPDATE email_messages SET is_read = $1 WHERE id = ANY($2) AND tenant_id = $3`,
      [read !== false, message_ids, tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark-read error:', error);
    res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
});

// Archive messages
router.post('/messages/archive', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { message_ids } = req.body || {};

    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      return res.status(400).json({ error: 'message_ids array is required' });
    }

    await query(
      `UPDATE email_messages SET status = 'archived' WHERE id = ANY($1) AND tenant_id = $2`,
      [message_ids, tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
});

// Delete messages (soft delete — moves to Trash, matching the 'deleted' status filter)
router.delete('/messages/delete', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { message_ids } = req.body || {};

    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      return res.status(400).json({ error: 'message_ids array is required' });
    }

    await query(
      `UPDATE email_messages SET status = 'deleted' WHERE id = ANY($1) AND tenant_id = $2`,
      [message_ids, tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
});

// Get email statistics
router.get('/stats', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { timeframe = '24h' } = req.query;
    
    let timeCondition = "created_at >= NOW() - INTERVAL '24 hours'";
    if (timeframe === '7d') timeCondition = "created_at >= NOW() - INTERVAL '7 days'";
    if (timeframe === '30d') timeCondition = "created_at >= NOW() - INTERVAL '30 days'";

    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
        COUNT(CASE WHEN status = 'suppressed' THEN 1 END) as suppressed,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked
      FROM email_messages 
      WHERE tenant_id = $1 AND ${timeCondition}
    `, [tenantId]);

    const suppressions = await query(`
      SELECT reason, COUNT(*) as count
      FROM email_suppressions 
      WHERE tenant_id = $1
      GROUP BY reason
    `, [tenantId]);

    res.json({
      stats: stats.rows[0],
      suppressions: suppressions.rows,
      timeframe: timeframe
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

// Webhook handler for email events (opens, clicks, bounces)
router.post('/webhook', async (req, res) => {
  try {
    const { type, messageId, email, timestamp, data } = req.body;

    // Verify webhook signature if needed
    // const signature = req.headers['x-webhook-signature'];
    // if (!verifyWebhookSignature(signature, req.body)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    // Find the message
    const messageResult = await query(
      'SELECT * FROM email_messages WHERE provider_message_id = $1 OR id = $2',
      [messageId, messageId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageResult.rows[0];

    // Update message based on event type
    if (type === 'open') {
      await query(
        'UPDATE email_messages SET opened_at = COALESCE(opened_at, $1) WHERE id = $2',
        [new Date(timestamp), message.id]
      );
    } else if (type === 'click') {
      await query(
        'UPDATE email_messages SET clicked_at = COALESCE(clicked_at, $1) WHERE id = $2',
        [new Date(timestamp), message.id]
      );
    } else if (type === 'bounce') {
      await query(
        'UPDATE email_messages SET status = $1 WHERE id = $2',
        ['bounced', message.id]
      );
      
      // Add to suppressions
      await query(`
        INSERT INTO email_suppressions (tenant_id, address, reason, detail)
        VALUES ($1, $2, 'bounce', $3)
        ON CONFLICT (tenant_id, address) DO UPDATE SET 
          detail = EXCLUDED.detail,
          created_at = NOW()
      `, [message.tenant_id, message.to_address, data?.bounce_reason || 'Hard bounce']);
    } else if (type === 'complaint') {
      await query(
        'UPDATE email_messages SET status = $1 WHERE id = $2',
        ['complained', message.id]
      );
      
      // Add to suppressions
      await query(`
        INSERT INTO email_suppressions (tenant_id, address, reason, detail)
        VALUES ($1, $2, 'complaint', $3)
        ON CONFLICT (tenant_id, address) DO UPDATE SET 
          detail = EXCLUDED.detail,
          created_at = NOW()
      `, [message.tenant_id, message.to_address, 'Spam complaint']);
    }

    // Log the event
    await query(`
      INSERT INTO email_events (message_id, tenant_id, event_type, payload, occurred_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [message.id, message.tenant_id, type, JSON.stringify(data || {}), new Date(timestamp)]);

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

// Add/remove email suppression
router.post('/suppressions', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { email, reason, detail } = req.body;

    if (!email || !reason) {
      return res.status(400).json({ error: 'email and reason are required' });
    }

    await query(`
      INSERT INTO email_suppressions (tenant_id, address, reason, detail)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, address) DO UPDATE SET 
        reason = EXCLUDED.reason,
        detail = EXCLUDED.detail,
        created_at = NOW()
    `, [tenantId, email, reason, detail || null]);

    res.json({ success: true });

  } catch (error) {
    console.error('Add suppression error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

router.delete('/suppressions/:email', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { email } = req.params;

    await query(
      'DELETE FROM email_suppressions WHERE tenant_id = $1 AND address = $2',
      [tenantId, email]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Remove suppression error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

// Get email labels
router.get('/labels', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // For now, return some default labels since we don't have a labels table
    const defaultLabels = [
      { id: 'important', name: 'Important', color: '#ff4444' },
      { id: 'work', name: 'Work', color: '#4488ff' },
      { id: 'personal', name: 'Personal', color: '#44ff44' },
      { id: 'shopping', name: 'Shopping', color: '#ff8844' }
    ];

    res.json(defaultLabels);

  } catch (error) {
    console.error('Get labels error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

// Get email signatures
router.get('/signatures', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // For now, return a default signature since we don't have a signatures table
    const defaultSignatures = [
      { 
        id: 1, 
        name: 'Default', 
        content: 'Best regards,\n\nFotonix Team', 
        is_default: true 
      }
    ];

    res.json(defaultSignatures);

  } catch (error) {
    console.error('Get signatures error:', error);
    res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
});

module.exports = router;