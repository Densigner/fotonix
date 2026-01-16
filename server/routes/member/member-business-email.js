/**
 * Member Business Email Management API Routes
 * Handles creation and management of member business email addresses
 */

const express = require('express');
const { Client } = require('pg');
const router = express.Router();

// PostgreSQL helper function
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

// Validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidBusinessName(name) {
  // Allow letters, numbers, and hyphens only, 3-30 characters
  const nameRegex = /^[a-zA-Z0-9-]{3,30}$/;
  return nameRegex.test(name);
}

// Check if business name is available
router.get('/business-email/check/:businessName', async (req, res) => {
  try {
    const { businessName } = req.params;
    
    if (!isValidBusinessName(businessName)) {
      return res.status(400).json({ 
        error: 'Invalid business name. Use 3-30 characters, letters, numbers, and hyphens only.' 
      });
    }
    
    const result = await query(
      'SELECT id FROM member_business_emails WHERE LOWER(business_name) = LOWER($1)',
      [businessName]
    );
    
    const available = result.rows.length === 0;
    
    res.json({
      businessName: businessName.toLowerCase(),
      available,
      suggestedEmails: available ? {
        main: `${businessName.toLowerCase()}@fotonix.co.uk`,
        noreply: `noreply.${businessName.toLowerCase()}@fotonix.co.uk`,
        support: `support.${businessName.toLowerCase()}@fotonix.co.uk`,
        orders: `orders.${businessName.toLowerCase()}@fotonix.co.uk`
      } : null
    });
    
  } catch (error) {
    console.error('Check business name error:', error);
    res.status(500).json({ error: 'Failed to check business name availability' });
  }
});

// Create new business email address
router.post('/business-email/create', async (req, res) => {
  try {
    const { 
      memberUid, 
      businessName, 
      forwardToEmail,
      includeNoreply = true,
      includeSupport = false,
      includeOrders = false 
    } = req.body;
    
    // Validation
    if (!memberUid || !businessName || !forwardToEmail) {
      return res.status(400).json({ 
        error: 'memberUid, businessName, and forwardToEmail are required' 
      });
    }
    
    if (!isValidBusinessName(businessName)) {
      return res.status(400).json({ 
        error: 'Invalid business name format' 
      });
    }
    
    if (!isValidEmail(forwardToEmail)) {
      return res.status(400).json({ 
        error: 'Invalid forwarding email address' 
      });
    }
    
    // Check if business name is already taken
    const existingResult = await query(
      'SELECT id FROM member_business_emails WHERE LOWER(business_name) = LOWER($1)',
      [businessName]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Business name already taken',
        suggestion: `Try ${businessName}2, ${businessName}pro, or ${businessName}store`
      });
    }
    
    // Create email addresses
    const cleanBusinessName = businessName.toLowerCase();
    const mainEmail = `${cleanBusinessName}@fotonix.co.uk`;
    const noreplyEmail = includeNoreply ? `noreply.${cleanBusinessName}@fotonix.co.uk` : null;
    const supportEmail = includeSupport ? `support.${cleanBusinessName}@fotonix.co.uk` : null;
    const ordersEmail = includeOrders ? `orders.${cleanBusinessName}@fotonix.co.uk` : null;
    
    // Insert into database
    const insertResult = await query(`
      INSERT INTO member_business_emails (
        member_uid, business_name, main_email, noreply_email, 
        support_email, orders_email, forward_to_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [memberUid, cleanBusinessName, mainEmail, noreplyEmail, supportEmail, ordersEmail, forwardToEmail]);
    
    const businessEmail = insertResult.rows[0];
    
    // Create forwarding rules
    const forwardingRules = [
      { type: 'main', email: mainEmail }
    ];
    
    if (noreplyEmail) forwardingRules.push({ type: 'noreply', email: noreplyEmail });
    if (supportEmail) forwardingRules.push({ type: 'support', email: supportEmail });
    if (ordersEmail) forwardingRules.push({ type: 'orders', email: ordersEmail });
    
    for (const rule of forwardingRules) {
      await query(`
        INSERT INTO business_email_forwarding (business_email_id, email_type, forward_to_email)
        VALUES ($1, $2, $3)
      `, [businessEmail.id, rule.type, forwardToEmail]);
    }
    
    // Initialize stats
    await query(`
      INSERT INTO business_email_stats (business_email_id)
      VALUES ($1)
    `, [businessEmail.id]);
    
    console.log(`✅ Created business email for ${memberUid}: ${mainEmail}`);
    
    res.status(201).json({
      success: true,
      businessEmail: {
        id: businessEmail.id,
        businessName: cleanBusinessName,
        emails: {
          main: mainEmail,
          noreply: noreplyEmail,
          support: supportEmail,
          orders: ordersEmail
        },
        forwardTo: forwardToEmail,
        createdAt: businessEmail.created_at
      },
      message: 'Business email addresses created successfully'
    });
    
  } catch (error) {
    console.error('Create business email error:', error);
    res.status(500).json({ error: 'Failed to create business email addresses' });
  }
});

// Get member's business emails
router.get('/api/member/business-emails/:memberUid', async (req, res) => {
  try {
    const { memberUid } = req.params;
    
    const result = await query(`
      SELECT id, business_name, main_email, noreply_email, support_email, orders_email, 
             forward_to_email, is_active, created_at, updated_at
      FROM member_business_emails 
      WHERE member_uid = $1 AND is_active = true
      ORDER BY created_at DESC
    `, [memberUid]);
    
    if (result.rows.length === 0) {
      return res.json([]);
    }
    
    // Transform the data to match what the frontend expects
    const businessEmails = result.rows.map(row => {
      const emails = [];
      
      // Add available emails
      if (row.main_email) {
        emails.push({
          email: row.main_email,
          type: 'main',
          description: 'Main business email'
        });
      }
      
      if (row.noreply_email) {
        emails.push({
          email: row.noreply_email,
          type: 'noreply',
          description: 'No-reply email for newsletters'
        });
      }
      
      if (row.support_email) {
        emails.push({
          email: row.support_email,
          type: 'support',
          description: 'Contact and support email'
        });
      }
      
      if (row.orders_email) {
        emails.push({
          email: row.orders_email,
          type: 'orders',
          description: 'Customer choice email'
        });
      }
      
      return {
        businessName: row.business_name,
        emails: emails,
        forwardingEmail: row.forward_to_email,
        createdAt: row.created_at
      };
    });
    
    res.json(businessEmails);
    
  } catch (error) {
    console.error('Get business emails error:', error);
    res.status(500).json({ error: 'Failed to fetch business emails' });
  }
});

// Update business email forwarding
router.put('/business-email/:id/forwarding', async (req, res) => {
  try {
    const { id } = req.params;
    const { memberUid, forwardToEmail } = req.body;
    
    if (!memberUid || !forwardToEmail || !isValidEmail(forwardToEmail)) {
      return res.status(400).json({ error: 'Valid memberUid and forwardToEmail are required' });
    }
    
    // Verify ownership
    const ownershipResult = await query(
      'SELECT id FROM member_business_emails WHERE id = $1 AND member_uid = $2',
      [id, memberUid]
    );
    
    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business email not found or access denied' });
    }
    
    // Update main record
    await query(
      'UPDATE member_business_emails SET forward_to_email = $1, updated_at = NOW() WHERE id = $2',
      [forwardToEmail, id]
    );
    
    // Update all forwarding rules
    await query(
      'UPDATE business_email_forwarding SET forward_to_email = $1 WHERE business_email_id = $2',
      [forwardToEmail, id]
    );
    
    res.json({
      success: true,
      message: 'Forwarding email updated successfully'
    });
    
  } catch (error) {
    console.error('Update forwarding error:', error);
    res.status(500).json({ error: 'Failed to update forwarding email' });
  }
});

// Delete business email
router.delete('/api/member/business-email/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { memberUid } = req.body;
    
    if (!memberUid) {
      return res.status(400).json({ error: 'memberUid is required' });
    }
    
    // Verify ownership
    const ownershipResult = await query(
      'SELECT business_name, main_email FROM member_business_emails WHERE id = $1 AND member_uid = $2',
      [id, memberUid]
    );
    
    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business email not found or access denied' });
    }
    
    const businessEmail = ownershipResult.rows[0];
    
    // Soft delete (deactivate)
    await query(
      'UPDATE member_business_emails SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );
    
    // Deactivate forwarding rules
    await query(
      'UPDATE business_email_forwarding SET is_active = false WHERE business_email_id = $1',
      [id]
    );
    
    console.log(`🗑️ Deactivated business email: ${businessEmail.main_email}`);
    
    res.json({
      success: true,
      message: `Business email ${businessEmail.business_name} deactivated successfully`
    });
    
  } catch (error) {
    console.error('Delete business email error:', error);
    res.status(500).json({ error: 'Failed to delete business email' });
  }
});

// Get business email statistics
router.get('/business-email/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { memberUid } = req.query;
    
    // Verify ownership
    const ownershipResult = await query(
      'SELECT business_name FROM member_business_emails WHERE id = $1 AND member_uid = $2',
      [id, memberUid]
    );
    
    if (ownershipResult.rows.length === 0) {
      return res.status(404).json({ error: 'Business email not found or access denied' });
    }
    
    // Get statistics for last 30 days
    const statsResult = await query(`
      SELECT 
        date,
        emails_sent,
        emails_received,
        emails_forwarded
      FROM business_email_stats 
      WHERE business_email_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY date DESC
    `, [id]);
    
    const totalResult = await query(`
      SELECT 
        COALESCE(SUM(emails_sent), 0) as total_sent,
        COALESCE(SUM(emails_received), 0) as total_received,
        COALESCE(SUM(emails_forwarded), 0) as total_forwarded
      FROM business_email_stats 
      WHERE business_email_id = $1
    `, [id]);
    
    res.json({
      businessEmail: ownershipResult.rows[0].business_name,
      daily: statsResult.rows,
      totals: totalResult.rows[0]
    });
    
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Check mailing eligibility (subscription and account age)
router.get('/mailing-eligibility/:memberUid', async (req, res) => {
  try {
    const { memberUid } = req.params;
    
    if (!memberUid) {
      return res.status(400).json({ error: 'Member UID is required' });
    }

    // Check account age (simplified - you'll need to check your users table)
    // For now, we'll assume the account is old enough if they have any subscription
    const subscriptionResult = await query(`
      SELECT created_at, status, plan_type 
      FROM member_subscriptions 
      WHERE member_uid = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [memberUid]);

    if (subscriptionResult.rows.length === 0) {
      return res.json({
        eligible: false,
        reason: 'no_active_subscription',
        message: 'You need an active subscription to send mail campaigns.'
      });
    }

    const subscription = subscriptionResult.rows[0];
    const accountAge = new Date() - new Date(subscription.created_at);
    const monthInMs = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    // Check if account is at least 1 month old
    if (accountAge < monthInMs) {
      return res.json({
        eligible: false,
        reason: 'account_too_new',
        message: 'Your account must be at least one month old to send mail campaigns.',
        accountAge: Math.floor(accountAge / (24 * 60 * 60 * 1000)), // days
        required: 30
      });
    }

    // Check if they have active subscription (not just trial)
    if (subscription.status !== 'active' || subscription.plan_type === 'trial') {
      return res.json({
        eligible: false,
        reason: 'no_active_subscription',
        message: 'You need an active subscription (not trial) to send mail campaigns.'
      });
    }

    return res.json({
      eligible: true,
      subscription: {
        status: subscription.status,
        plan_type: subscription.plan_type,
        account_age_days: Math.floor(accountAge / (24 * 60 * 60 * 1000))
      }
    });
    
  } catch (error) {
    console.error('Mailing eligibility check error:', error);
    res.status(500).json({ error: 'Failed to check mailing eligibility' });
  }
});

// Create standard business emails (no_reply, theirchoice, contact)
router.post('/api/member/business-email/create-standard', async (req, res) => {
  try {
    const { memberUid, storeName, businessName, customEmail } = req.body;
    
    if (!memberUid || !storeName || !businessName) {
      return res.status(400).json({ 
        error: 'Member UID, store name, and business name are required' 
      });
    }

    if (!isValidBusinessName(storeName)) {
      return res.status(400).json({ 
        error: 'Invalid store name. Use 3-30 characters, letters, numbers, and hyphens only.' 
      });
    }

    // Validate custom email if provided
    if (customEmail && !isValidBusinessName(customEmail)) {
      return res.status(400).json({ 
        error: 'Invalid custom email prefix. Use 3-30 characters, letters, numbers, and hyphens only.' 
      });
    }

    // Check if business emails already exist for this member
    const existingResult = await query(
      'SELECT id FROM member_business_emails WHERE member_uid = $1',
      [memberUid]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Business emails already exist for this member'
      });
    }

    // Create the business email record with all standard emails
    const mainEmail = customEmail ? `${customEmail}.${storeName}@fotonix.co.uk` : `${storeName}@fotonix.co.uk`;
    const noreplyEmail = `no_reply.${storeName}@fotonix.co.uk`;
    const supportEmail = `contact.${storeName}@fotonix.co.uk`;
    const ordersEmail = `theirchoice.${storeName}@fotonix.co.uk`;

    const result = await query(`
      INSERT INTO member_business_emails 
      (member_uid, business_name, main_email, noreply_email, support_email, orders_email, forward_to_email, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      RETURNING *
    `, [
      memberUid,
      businessName,
      mainEmail,
      noreplyEmail,
      supportEmail,
      ordersEmail,
      'user@example.com' // Default forwarding email - user can change later
    ]);
    
    const createdRecord = result.rows[0];
    
    res.json({
      success: true,
      message: 'Standard business emails created successfully',
      emails: {
        main: createdRecord.main_email,
        noreply: createdRecord.noreply_email,
        support: createdRecord.support_email,
        orders: createdRecord.orders_email
      },
      storeName,
      record: createdRecord
    });
    
  } catch (error) {
    console.error('Create standard emails error:', error);
    res.status(500).json({ error: 'Failed to create standard business emails' });
  }
});

module.exports = router;