const paypal = require('@paypal/checkout-server-sdk');
const { getClient } = require('../paypal');

/**
 * PayPal Subscription Management
 * Handles creation and management of PayPal subscription plans and subscriptions
 */

/**
 * Create a PayPal product for Fotonix membership
 */
async function createMembershipProduct() {
  const client = getClient();
  
  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'PayPal-Request-Id': `FOTONIX-PRODUCT-${Date.now()}`
    }
  };

  const productData = {
    name: 'Fotonix Membership',
    description: 'Monthly membership for Fotonix affiliate platform with shop builder and analytics',
    type: 'SERVICE',
    category: 'SOFTWARE',
    image_url: 'https://fotonix.co.uk/logo.png', // Update with your actual logo
    home_url: 'https://fotonix.co.uk'
  };

  try {
    const response = await client.execute({
      path: '/v1/catalogs/products',
      verb: 'POST',
      body: productData,
      headers: request.headers
    });

    console.log('✅ PayPal Product created:', response.result.id);
    return response.result;
  } catch (error) {
    console.error('❌ Error creating PayPal product:', error);
    throw error;
  }
}

/**
 * Create a subscription plan with 1-month trial + £11.99/month
 */
async function createSubscriptionPlan(productId) {
  const client = getClient();
  
  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'PayPal-Request-Id': `FOTONIX-PLAN-${Date.now()}`
    }
  };

  const planData = {
    product_id: productId,
    name: 'Fotonix Monthly Membership',
    description: 'Monthly subscription with 1-month free trial',
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: {
          interval_unit: 'MONTH',
          interval_count: 1
        },
        tenure_type: 'TRIAL',
        sequence: 1,
        total_cycles: 1
      },
      {
        frequency: {
          interval_unit: 'MONTH',
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 2,
        total_cycles: 0, // 0 = unlimited
        pricing_scheme: {
          fixed_price: {
            value: '11.99',
            currency_code: 'GBP'
          }
        }
      }
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '0',
        currency_code: 'GBP'
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
    },
    taxes: {
      percentage: '0',
      inclusive: false
    }
  };

  try {
    const response = await client.execute({
      path: '/v1/billing/plans',
      verb: 'POST', 
      body: planData,
      headers: request.headers
    });

    console.log('✅ PayPal Subscription Plan created:', response.result.id);
    return response.result;
  } catch (error) {
    console.error('❌ Error creating subscription plan:', error);
    throw error;
  }
}

/**
 * Create a subscription for a member
 */
async function createSubscription(planId, memberEmail, memberName) {
  const client = getClient();

  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'PayPal-Request-Id': `FOTONIX-SUB-${Date.now()}`
    }
  };

  const subscriptionData = {
    plan_id: planId,
    start_time: new Date(Date.now() + 60000).toISOString(), // Start in 1 minute
    quantity: 1,
    subscriber: {
      name: {
        given_name: memberName.split(' ')[0] || 'Member',
        surname: memberName.split(' ').slice(1).join(' ') || 'User'
      },
      email_address: memberEmail
    },
    application_context: {
      brand_name: 'Fotonix',
      locale: 'en-GB',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      payment_method: {
        payer_selected: 'PAYPAL',
        payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
      },
      return_url: 'https://fotonix.co.uk/subscription/success',
      cancel_url: 'https://fotonix.co.uk/subscription/cancelled'
    }
  };

  try {
    const response = await client.execute({
      path: '/v1/billing/subscriptions',
      verb: 'POST',
      body: subscriptionData,
      headers: request.headers
    });

    console.log('✅ PayPal Subscription created:', response.result.id);
    return response.result;
  } catch (error) {
    console.error('❌ Error creating subscription:', error);
    throw error;
  }
}

/**
 * Get subscription details from PayPal
 */
async function getSubscription(subscriptionId) {
  const client = getClient();

  try {
    const response = await client.execute({
      path: `/v1/billing/subscriptions/${subscriptionId}`,
      verb: 'GET'
    });

    return response.result;
  } catch (error) {
    console.error('❌ Error getting subscription:', error);
    throw error;
  }
}

/**
 * Cancel a subscription
 */
async function cancelSubscription(subscriptionId, reason = 'User requested cancellation') {
  const client = getClient();

  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  const cancelData = {
    reason: reason
  };

  try {
    const response = await client.execute({
      path: `/v1/billing/subscriptions/${subscriptionId}/cancel`,
      verb: 'POST',
      body: cancelData,
      headers: request.headers
    });

    console.log('✅ PayPal Subscription cancelled:', subscriptionId);
    return response;
  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    throw error;
  }
}

/**
 * Setup complete PayPal subscription system
 * This creates the product and plan if they don't exist
 */
async function setupPayPalSubscriptions() {
  try {
    console.log('🔄 Setting up PayPal subscription system...');
    
    // Check if we have existing product/plan IDs stored somewhere
    // For now, create new ones (in production, store these IDs)
    
    const product = await createMembershipProduct();
    const plan = await createSubscriptionPlan(product.id);
    
    console.log('✅ PayPal subscription system setup complete!');
    console.log('📋 Store these IDs in your environment:');
    console.log(`   PAYPAL_PRODUCT_ID=${product.id}`);
    console.log(`   PAYPAL_PLAN_ID=${plan.id}`);
    
    return { product, plan };
  } catch (error) {
    console.error('❌ PayPal subscription setup failed:', error);
    throw error;
  }
}

module.exports = {
  createMembershipProduct,
  createSubscriptionPlan,
  createSubscription,
  getSubscription,
  cancelSubscription,
  setupPayPalSubscriptions
};