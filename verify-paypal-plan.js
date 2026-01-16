// Load environment variables
require('dotenv').config();

const { getClient } = require('./server/paypal');

async function verifyPayPalPlan() {
  try {
    console.log('🔍 Verifying PayPal plan exists...');
    console.log(`Plan ID: ${process.env.PAYPAL_PLAN_ID}`);
    console.log(`Environment: ${process.env.PAYPAL_ENV}`);
    console.log('');

    const client = getClient();
    
    // Get plan details
    const response = await client.execute({
      path: `/v1/billing/plans/${process.env.PAYPAL_PLAN_ID}`,
      verb: 'GET'
    });

    const plan = response.result;
    
    console.log('✅ Plan found successfully!');
    console.log('📋 Plan Details:');
    console.log(`  - Name: ${plan.name}`);
    console.log(`  - Status: ${plan.status}`);
    console.log(`  - Product ID: ${plan.product_id}`);
    console.log(`  - Created: ${plan.create_time}`);
    
    if (plan.billing_cycles) {
      console.log('  - Billing Cycles:');
      plan.billing_cycles.forEach((cycle, index) => {
        console.log(`    ${index + 1}. ${cycle.tenure_type}: ${cycle.frequency.interval_count} ${cycle.frequency.interval_unit.toLowerCase()}`);
        if (cycle.pricing_scheme) {
          console.log(`       Price: ${cycle.pricing_scheme.fixed_price?.currency_code} ${cycle.pricing_scheme.fixed_price?.value}`);
        }
      });
    }
    
    console.log('');
    console.log('🔗 Direct PayPal Links:');
    console.log(`Sandbox Plan: https://www.sandbox.paypal.com/billing/plans/${process.env.PAYPAL_PLAN_ID}`);
    console.log(`Sandbox Dashboard: https://www.sandbox.paypal.com/billing/plans`);
    
  } catch (error) {
    console.error('❌ Error verifying plan:', error.message);
    
    if (error.message.includes('404') || error.message.includes('NOT_FOUND')) {
      console.log('');
      console.log('💡 The plan might not exist. Possible issues:');
      console.log('1. Plan was created in a different PayPal account');
      console.log('2. Plan creation failed but didn\'t show an error');
      console.log('3. Wrong environment (sandbox vs live)');
    }
  }
}

verifyPayPalPlan();