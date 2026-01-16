const { query } = require('./src/db/client');

async function updateSubscription() {
  try {
    console.log('🔄 Updating subscription to active...');
    
    await query(
      "UPDATE member_subscriptions SET status = 'active' WHERE member_uid = 'current-member-id'"
    );
    
    console.log('✅ Subscription updated to active!');
    
    // Verify the update
    const result = await query(
      "SELECT * FROM member_subscriptions WHERE member_uid = 'current-member-id'"
    );
    
    if (result.rows.length > 0) {
      const sub = result.rows[0];
      console.log('👤 Updated Subscription Status:');
      console.log(`  - Status: ${sub.status}`);
      console.log(`  - Trial ends: ${sub.trial_ends_at}`);
      console.log(`  - Amount: £${(sub.amount_cents / 100).toFixed(2)}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating subscription:', error.message);
    process.exit(1);
  }
}

updateSubscription();