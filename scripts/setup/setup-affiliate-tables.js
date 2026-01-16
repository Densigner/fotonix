const { Client } = require('pg');
require('dotenv').config();

async function createAffiliatesTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Create affiliates table
    console.log('Creating affiliates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS affiliates (
        id SERIAL PRIMARY KEY,
        affiliate_code TEXT UNIQUE NOT NULL,
        member_uid TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        email TEXT NOT NULL,
        paypal_email TEXT,
        paypal_username TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table  
    console.log('Creating orders table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        customer_email TEXT,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'GBP',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    // Create attributions table
    console.log('Creating attributions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS attributions (
        id SERIAL PRIMARY KEY,
        attribution_id TEXT UNIQUE NOT NULL,
        order_id TEXT NOT NULL,
        click_id TEXT,
        affiliate_id TEXT NOT NULL,
        commission_cents INTEGER NOT NULL DEFAULT 0,
        rate_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        voided_at TIMESTAMP,
        void_reason TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_affiliates_member_uid ON affiliates(member_uid);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_code ON affiliates(affiliate_code);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attributions_affiliate_id ON attributions(affiliate_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attributions_order_id ON attributions(order_id);
    `);

    // Insert sample affiliate data
    console.log('Inserting sample affiliate data...');
    await client.query(`
      INSERT INTO affiliates (affiliate_code, member_uid, contact_name, email, paypal_email, paypal_username, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (affiliate_code) DO UPDATE SET
        member_uid = EXCLUDED.member_uid,
        contact_name = EXCLUDED.contact_name,
        email = EXCLUDED.email,
        paypal_email = EXCLUDED.paypal_email,
        paypal_username = EXCLUDED.paypal_username,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
    `, ['JOSHMARSUE0', 'current-member-id', 'Josh Marsue', 'josh@example.com', 'josh@paypal.com', 'joshmarsue', 'Test affiliate for development']);

    // Insert sample orders
    console.log('Inserting sample orders...');
    const orders = [
      ['JOSH_ORDER_001', 'customer1@example.com', 12760, 'GBP', 'completed'],
      ['JOSH_ORDER_002', 'customer2@example.com', 2500, 'GBP', 'completed'],
      ['JOSH_ORDER_003', 'customer3@example.com', 1800, 'GBP', 'refunded']
    ];

    for (const order of orders) {
      await client.query(`
        INSERT INTO orders (order_id, customer_email, amount_cents, currency, status, created_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day')
        ON CONFLICT (order_id) DO UPDATE SET
          customer_email = EXCLUDED.customer_email,
          amount_cents = EXCLUDED.amount_cents,
          currency = EXCLUDED.currency,
          status = EXCLUDED.status
      `, order);
    }

    // Insert sample attributions
    console.log('Inserting sample attributions...');
    const attributions = [
      ['attr_1761743300000_1001', 'JOSH_ORDER_001', 'click_1761743200000_1001', 'JOSHMARSUE0', 1595, 12.5, 'pending'],
      ['attr_1761743400000_1002', 'JOSH_ORDER_002', 'click_1761743300000_1002', 'JOSHMARSUE0', 275, 11.0, 'approved'],
      ['attr_1761743500000_1003', 'JOSH_ORDER_003', 'click_1761743400000_1003', 'JOSHMARSUE0', 180, 10.0, 'void']
    ];

    for (const attr of attributions) {
      await client.query(`
        INSERT INTO attributions (attribution_id, order_id, click_id, affiliate_id, commission_cents, rate_pct, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP - INTERVAL '2 hours')
        ON CONFLICT (attribution_id) DO UPDATE SET
          order_id = EXCLUDED.order_id,
          click_id = EXCLUDED.click_id,
          affiliate_id = EXCLUDED.affiliate_id,
          commission_cents = EXCLUDED.commission_cents,
          rate_pct = EXCLUDED.rate_pct,
          status = EXCLUDED.status
      `, attr);
    }

    // Update approved attribution
    await client.query(`
      UPDATE attributions 
      SET approved_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
      WHERE attribution_id = 'attr_1761743400000_1002' AND status = 'approved'
    `);

    // Update voided attribution
    await client.query(`
      UPDATE attributions 
      SET voided_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes', void_reason = 'refund'
      WHERE attribution_id = 'attr_1761743500000_1003' AND status = 'void'
    `);

    console.log('✅ Affiliate tables setup completed successfully!');
    
    // Show table counts
    const affiliateCount = await client.query('SELECT COUNT(*) FROM affiliates');
    const orderCount = await client.query('SELECT COUNT(*) FROM orders');
    const attributionCount = await client.query('SELECT COUNT(*) FROM attributions');
    const linkCount = await client.query('SELECT COUNT(*) FROM tracked_links');
    const clickCount = await client.query('SELECT COUNT(*) FROM link_clicks');
    
    console.log('📊 Database Summary:');
    console.log(`  - ${affiliateCount.rows[0].count} affiliates`);
    console.log(`  - ${orderCount.rows[0].count} orders`);
    console.log(`  - ${attributionCount.rows[0].count} attributions`);
    console.log(`  - ${linkCount.rows[0].count} tracked links`);
    console.log(`  - ${clickCount.rows[0].count} link clicks`);

  } catch (error) {
    console.error('❌ Affiliate tables setup failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

createAffiliatesTables();