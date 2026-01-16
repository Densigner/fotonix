const express = require('express');
const { testConnection, sendTestEmail } = require('../../../src/email/smtp');
const router = express.Router();

// Helper function to get tenant ID from request
function getTenantId(req) {
  return req.headers['x-tenant-id'] || req.query.tenantId || 1;
}

// Test SMTP connection
router.get('/test-connection', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const result = await testConnection(tenantId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Connection test failed'
    });
  }
});

// Send test email
router.post('/test-email', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { email, subject } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required',
        message: 'Please provide an email address'
      });
    }

    const result = await sendTestEmail(tenantId, email, subject);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Test email failed'
    });
  }
});

module.exports = router;