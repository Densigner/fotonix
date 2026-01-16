const { query } = require('./src/db/client');

async function createSubscriptionTables() {
  try {
    console.log('🗄️  Creating subscription tables...');
    
    // Connect to database
    console.log('Connecting to database...');
    
    // Create member_subscriptions table
    console.log('Creating member_subscriptions table...');
    await query(`
      CREATE TABLE IF NOT EXISTS member_subscriptions (
        id SERIAL PRIMARY KEY,
        member_uid VARCHAR(255) UNIQUE NOT NULL,
        paypal_subscription_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'trial',
        trial_ends_at TIMESTAMP,
        next_billing_date TIMESTAMP,
        amount_cents INTEGER DEFAULT 1199,
        currency VARCHAR(3) DEFAULT 'GBP',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_status CHECK (status IN ('trial', 'active', 'cancelled', 'expired', 'past_due'))
      )
    `);

    // Create subscription_events table for audit trail
    console.log('Creating subscription_events table...');
    await query(`
      CREATE TABLE IF NOT EXISTS subscription_events (
        id SERIAL PRIMARY KEY,
        member_uid VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        paypal_event_id VARCHAR(255),
        event_data JSONB,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_uid) REFERENCES member_subscriptions(member_uid)
      )
    `);

    // Create indexes for performance
    console.log('Creating indexes...');
    await query('CREATE INDEX IF NOT EXISTS idx_member_subscriptions_uid ON member_subscriptions(member_uid)');
    await query('CREATE INDEX IF NOT EXISTS idx_member_subscriptions_status ON member_subscriptions(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_member_subscriptions_trial_ends ON member_subscriptions(trial_ends_at)');
    await query('CREATE INDEX IF NOT EXISTS idx_subscription_events_member ON subscription_events(member_uid)');
    await query('CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type)');

    // Insert sample subscription data for current member
    console.log('Inserting sample subscription data...');
    
    // Check if subscription already exists
    const existingSubscription = await query(
      'SELECT * FROM member_subscriptions WHERE member_uid = $1', 
      ['current-member-id']
    );

    if (existingSubscription.rows.length === 0) {
      // Create trial subscription for current member
      const trialEndsAt = new Date();
      trialEndsAt.setMonth(trialEndsAt.getMonth() + 1); // 1 month from now

      await query(`
        INSERT INTO member_subscriptions (
          member_uid, status, trial_ends_at, next_billing_date, amount_cents, currency
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'current-member-id',
        'trial',
        trialEndsAt,
        trialEndsAt, // Next billing starts when trial ends
        1199, // £11.99 in pence
        'GBP'
      ]);

      console.log('✅ Sample subscription created for current-member-id');
    } else {
      console.log('ℹ️  Subscription already exists for current-member-id');
    }

    console.log('✅ Subscription tables setup completed successfully!');

    // Display current subscription data
    const subscriptions = await query('SELECT COUNT(*) as count FROM member_subscriptions');
    const events = await query('SELECT COUNT(*) as count FROM subscription_events');
    
    console.log('📊 Subscription Database Summary:');
    console.log(`  - ${subscriptions.rows[0].count} member subscriptions`);
    console.log(`  - ${events.rows[0].count} subscription events`);

    // Show current member subscription status
    const currentMember = await query(
      'SELECT * FROM member_subscriptions WHERE member_uid = $1', 
      ['current-member-id']
    );
    
    if (currentMember.rows.length > 0) {
      const sub = currentMember.rows[0];
      console.log('👤 Current Member Subscription:');
      console.log(`  - Status: ${sub.status}`);
      console.log(`  - Trial ends: ${sub.trial_ends_at}`);
      console.log(`  - Amount: £${(sub.amount_cents / 100).toFixed(2)}`);
    }

  } catch (error) {
    console.error('❌ Error creating subscription tables:', error);
    throw error;
  }
}

// Run the setup
createSubscriptionTables()
  .then(() => {
    console.log('🎉 Subscription system setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  });