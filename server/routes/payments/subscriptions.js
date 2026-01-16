const express = require('express');
const { query } = require('../../../src/db/client');

// PayPal integration - disabled for development
const paypalSubscriptions = {
  createSubscription: () => Promise.reject(new Error('PayPal not configured')),
  getSubscription: () => Promise.reject(new Error('PayPal not configured')), 
  cancelSubscription: () => Promise.reject(new Error('PayPal not configured'))
};

const router = express.Router();

// Get member UID from request (same as member.js)
function getMemberUid(req) {
  if (process.env.NODE_ENV === 'development') {
    return req.headers['x-member-uid'] || 'current-member-id';
  }
  return req.user?.uid || null;
}

/**
 * GET /api/subscriptions/status
 * Check if member has valid subscription access
 */
router.get('/status', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get subscription from database
    const result = await query(
      'SELECT * FROM member_subscriptions WHERE member_uid = $1',
      [memberUid]
    );

    if (result.rows.length === 0) {
      // No subscription found - create trial subscription
      const trialEndsAt = new Date();
      trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

      await query(`
        INSERT INTO member_subscriptions (
          member_uid, status, trial_ends_at, next_billing_date, amount_cents, currency
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        memberUid,
        'trial', 
        trialEndsAt,
        trialEndsAt,
        1199,
        'GBP'
      ]);

      return res.json({
        hasAccess: true,
        status: 'trial',
        trialEndsAt: trialEndsAt,
        daysLeft: 30,
        needsPayment: false
      });
    }

    const subscription = result.rows[0];
    const now = new Date();
    const trialEndsAt = new Date(subscription.trial_ends_at);
    const daysLeft = Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)));

    // Determine access based on subscription status
    let hasAccess = false;
    let needsPayment = false;

    if (subscription.status === 'trial' && now < trialEndsAt) {
      hasAccess = true;
      needsPayment = false;
    } else if (subscription.status === 'active') {
      hasAccess = true;
      needsPayment = false;
    } else if (subscription.status === 'trial' && now >= trialEndsAt) {
      hasAccess = false;
      needsPayment = true;
    } else {
      hasAccess = false;
      needsPayment = true;
    }

    res.json({
      hasAccess,
      status: subscription.status,
      trialEndsAt: subscription.trial_ends_at,
      nextBillingDate: subscription.next_billing_date,
      daysLeft,
      needsPayment,
      amount: `£${(subscription.amount_cents / 100).toFixed(2)}`
    });

  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

/**
 * POST /api/subscriptions/create
 * Create a new PayPal subscription
 */
router.post('/create', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { memberEmail, memberName } = req.body;
    
    if (!memberEmail || !memberName) {
      return res.status(400).json({ error: 'Member email and name required' });
    }

    // Use plan ID from environment or default
    const planId = process.env.PAYPAL_PLAN_ID;
    if (!planId) {
      return res.status(500).json({ error: 'PayPal plan not configured' });
    }

    // For development - simulate PayPal subscription creation
    if (process.env.NODE_ENV === 'development') {
      // Mock PayPal response for development
      const mockSubscriptionId = `DEV-SUB-${Date.now()}`;
      
      // Update database with mock subscription ID
      await query(`
        UPDATE member_subscriptions 
        SET paypal_subscription_id = $1, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE member_uid = $2
      `, [mockSubscriptionId, memberUid]);

      // Log the subscription event
      await query(`
        INSERT INTO subscription_events (member_uid, event_type, paypal_event_id, event_data)
        VALUES ($1, $2, $3, $4)
      `, [
        memberUid,
        'SUBSCRIPTION_CREATED',
        mockSubscriptionId,
        JSON.stringify({ 
          status: 'APPROVED',
          created: new Date().toISOString(),
          mode: 'development'
        })
      ]);

      res.json({
        subscriptionId: mockSubscriptionId,
        approvalUrl: `http://localhost:3001/subscription/success?dev=true`,
        status: 'APPROVED'
      });
    } else {
      // Production PayPal integration
      try {
        const { createSubscription } = paypalSubscriptions;
        const paypalSubscription = await createSubscription(planId, memberEmail, memberName);
        
        // Update database with PayPal subscription ID
        await query(`
          UPDATE member_subscriptions 
          SET paypal_subscription_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE member_uid = $2
        `, [paypalSubscription.id, memberUid]);

        // Log the subscription event
        await query(`
          INSERT INTO subscription_events (member_uid, event_type, paypal_event_id, event_data)
          VALUES ($1, $2, $3, $4)
        `, [
          memberUid,
          'SUBSCRIPTION_CREATED',
          paypalSubscription.id,
          JSON.stringify({ 
            status: paypalSubscription.status,
            created: paypalSubscription.create_time 
          })
        ]);

        res.json({
          subscriptionId: paypalSubscription.id,
          approvalUrl: paypalSubscription.links.find(link => link.rel === 'approve')?.href,
          status: paypalSubscription.status
        });
      } catch (error) {
        console.error('PayPal subscription creation failed:', error);
        res.status(500).json({ error: 'PayPal service unavailable' });
      }
    }

  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * POST /api/subscriptions/webhook
 * Handle PayPal subscription webhooks
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // In production, verify webhook signature here
    const event = JSON.parse(req.body.toString());
    
    console.log('📦 PayPal webhook received:', event.event_type);
    
    const subscriptionId = event.resource?.id;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No subscription ID in webhook' });
    }

    // Find member by PayPal subscription ID
    const memberResult = await query(
      'SELECT member_uid FROM member_subscriptions WHERE paypal_subscription_id = $1',
      [subscriptionId]
    );

    if (memberResult.rows.length === 0) {
      console.log('⚠️  Webhook for unknown subscription:', subscriptionId);
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const memberUid = memberResult.rows[0].member_uid;

    // Handle different webhook events
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await query(`
          UPDATE member_subscriptions 
          SET status = 'active', updated_at = CURRENT_TIMESTAMP
          WHERE paypal_subscription_id = $1
        `, [subscriptionId]);
        
        await query(`
          INSERT INTO subscription_events (member_uid, event_type, paypal_event_id, event_data)
          VALUES ($1, $2, $3, $4)
        `, [memberUid, event.event_type, event.id, JSON.stringify(event.resource)]);
        
        console.log('✅ Subscription activated for member:', memberUid);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        // Payment successful - ensure subscription is active
        await query(`
          UPDATE member_subscriptions 
          SET status = 'active', updated_at = CURRENT_TIMESTAMP
          WHERE paypal_subscription_id = $1
        `, [subscriptionId]);
        
        await query(`
          INSERT INTO subscription_events (member_uid, event_type, paypal_event_id, event_data)
          VALUES ($1, $2, $3, $4)
        `, [memberUid, event.event_type, event.id, JSON.stringify(event.resource)]);
        
        console.log('💰 Payment completed for member:', memberUid);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await query(`
          UPDATE member_subscriptions 
          SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
          WHERE paypal_subscription_id = $1
        `, [subscriptionId]);
        
        await query(`
          INSERT INTO subscription_events (member_uid, event_type, paypal_event_id, event_data)
          VALUES ($1, $2, $3, $4)
        `, [memberUid, event.event_type, event.id, JSON.stringify(event.resource)]);
        
        console.log('❌ Subscription cancelled for member:', memberUid);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await query(`
          UPDATE member_subscriptions 
          SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
          WHERE paypal_subscription_id = $1
        `, [subscriptionId]);
        
        await query(`
          INSERT INTO subscription_events (member_uid, event_type, paypal_event_id, event_data)
          VALUES ($1, $2, $3, $4)
        `, [memberUid, event.event_type, event.id, JSON.stringify(event.resource)]);
        
        console.log('⚠️  Subscription suspended for member:', memberUid);
        break;

      default:
        console.log('ℹ️  Unhandled webhook event:', event.event_type);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel member's subscription
 */
router.post('/cancel', async (req, res) => {
  try {
    const memberUid = getMemberUid(req);
    if (!memberUid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reason } = req.body;

    // Get member's subscription
    const result = await query(
      'SELECT * FROM member_subscriptions WHERE member_uid = $1',
      [memberUid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subscription = result.rows[0];
    
    if (!subscription.paypal_subscription_id) {
      return res.status(400).json({ error: 'No PayPal subscription to cancel' });
    }

    // Cancel with PayPal (skip in development)
    if (process.env.NODE_ENV !== 'development') {
      try {
        const { cancelSubscription } = paypalSubscriptions;
        await cancelSubscription(subscription.paypal_subscription_id, reason || 'Member requested cancellation');
      } catch (error) {
        console.warn('PayPal cancellation failed, continuing with local cancellation:', error.message);
      }
    }

    // Update local database
    await query(`
      UPDATE member_subscriptions 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE member_uid = $1
    `, [memberUid]);

    // Log cancellation event
    await query(`
      INSERT INTO subscription_events (member_uid, event_type, event_data)
      VALUES ($1, $2, $3)
    `, [
      memberUid,
      'SUBSCRIPTION_CANCELLED_BY_MEMBER',
      JSON.stringify({ reason, cancelled_at: new Date().toISOString() })
    ]);

    res.json({ success: true, message: 'Subscription cancelled successfully' });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;