// Load environment variables
require('dotenv').config();

const { setupPayPalSubscriptions } = require('./server/billing/paypal-subscriptions');

async function setupPayPal() {
  try {
    console.log('🔄 Setting up PayPal subscription system...');
    console.log('⚠️  Make sure you have PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your .env file');
    console.log('');

    const result = await setupPayPalSubscriptions();

    console.log('');
    console.log('✅ PayPal setup complete!');
    console.log('');
    console.log('📋 Add these to your .env file:');
    console.log(`PAYPAL_PRODUCT_ID=${result.product.id}`);
    console.log(`PAYPAL_PLAN_ID=${result.plan.id}`);
    console.log('');
    console.log('🔗 You can view your plans at:');
    console.log('Sandbox: https://www.sandbox.paypal.com/billing/plans');
    console.log('Live: https://www.paypal.com/billing/plans');

  } catch (error) {
    console.error('❌ PayPal setup failed:', error.message);
    console.log('');
    console.log('💡 Common issues:');
    console.log('1. Check your PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env');
    console.log('2. Make sure PAYPAL_ENV is set to "sandbox" for testing');
    console.log('3. Verify your PayPal business account has API access');
  }
}

setupPayPal();