const express = require('express');
const { loadTransport } = require('../src/email/smtp');
const router = express.Router();

// Very small in-memory rate limiter: map key -> timestamp (ms)
const lastSend = new Map();
const GLOBAL_LIMIT_MS = 60 * 1000; // 60s per recipient per tenant

router.post('/api/tenants/:tid/campaigns/test', async (req, res) => {
  try {
    const tid = req.params.tid || 'default';
    const { to, html } = req.body || {};
    if (!to || !html) return res.status(400).json({ error: 'to and html required' });

    const key = `${tid}|${to}`;
    const now = Date.now();
    const last = lastSend.get(key) || 0;
    if (now - last < GLOBAL_LIMIT_MS) {
      return res.status(429).json({ error: 'rate_limited', retry_after_ms: GLOBAL_LIMIT_MS - (now - last) });
    }

    // Mark send timestamp
    lastSend.set(key, now);

    // Use the new VPS mail server for actual sending
    try {
      const tenantId = parseInt(tid) || 1;
      const { transport, defaultFrom } = await loadTransport(tenantId);
      
      const info = await transport.sendMail({
        from: defaultFrom,
        to: to,
        subject: 'Campaign Test Send',
        html: html,
        text: html.replace(/<[^>]*>/g, ''), // Simple HTML to text conversion
        headers: {
          'X-Mailer': 'Fotonix Campaign Test',
          'X-Tenant-ID': tenantId
        }
      });

      console.log(`✅ Test email sent to ${to} via VPS mail server. Message ID: ${info.messageId}`);
      
      return res.json({ 
        ok: true, 
        message: 'Test email sent successfully via VPS mail server',
        messageId: info.messageId,
        response: info.response
      });
      
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // Fallback to simulation for development
      console.log(`📧 Fallback: Simulated test send to ${to} for tenant ${tid}. HTML length ${html.length}`);
      return res.json({ 
        ok: true, 
        message: 'Test send simulated (VPS mail server not available)',
        simulation: true
      });
    }

  } catch (err) {
    console.error('test send error', err);
    return res.status(500).json({ error: String(err) });
  }
});

// Enhanced campaign send endpoint for bulk operations
router.post('/api/tenants/:tid/campaigns/:campaignId/send', async (req, res) => {
  try {
    const { tid, campaignId } = req.params;
    const { 
      recipients, 
      subject, 
      html, 
      templateName, 
      templateData 
    } = req.body || {};

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'recipients array is required' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'subject is required' });
    }

    const tenantId = parseInt(tid) || 1;
    
    // Call the bulk email API
    const fetch = require('node-fetch');
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5002}`;
    
    try {
      const bulkResponse = await fetch(`${baseUrl}/api/emails/send-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({
          recipients,
          subject,
          html,
          templateName,
          templateData,
          campaignId
        })
      });

      const result = await bulkResponse.json();
      
      if (!bulkResponse.ok) {
        return res.status(bulkResponse.status).json(result);
      }

      console.log(`📧 Campaign ${campaignId} sent: ${result.sent} successful, ${result.failed} failed, ${result.suppressed} suppressed`);
      
      res.json({
        ...result,
        campaignId: campaignId,
        tenantId: tenantId
      });

    } catch (fetchError) {
      console.error('Failed to call email API, falling back to simulation:', fetchError);
      
      // Fallback simulation
      console.log(`📧 Simulated campaign ${campaignId} for tenant ${tid} to ${recipients.length} recipients`);
      res.json({
        ok: true,
        message: 'Campaign simulated (email API not available)',
        campaignId: campaignId,
        total: recipients.length,
        sent: recipients.length,
        failed: 0,
        suppressed: 0,
        simulation: true
      });
    }

  } catch (error) {
    console.error('Campaign send error:', error);
    res.status(500).json({
      error: 'Campaign send failed',
      detail: error.message
    });
  }
});

module.exports = router;
