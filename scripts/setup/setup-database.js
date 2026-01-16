const { Client } = require('pg');
require('dotenv').config();

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Create tracked_links table
    console.log('Creating tracked_links table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracked_links (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        destination_url TEXT NOT NULL,
        title TEXT,
        product_id TEXT,
        channel TEXT,
        meta JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create link_clicks table
    console.log('Creating link_clicks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS link_clicks (
        id SERIAL PRIMARY KEY,
        link_id INTEGER REFERENCES tracked_links(id) ON DELETE CASCADE,
        channel TEXT DEFAULT 'unknown',
        ip_address INET,
        user_agent TEXT,
        referrer TEXT,
        visitor_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tracked_links_user_id ON tracked_links(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(link_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_link_clicks_visitor_id ON link_clicks(visitor_id);
    `);

    console.log('✅ Database setup completed successfully!');
    
    // Test the setup by inserting a sample link
    console.log('Testing with sample data...');
    const result = await client.query(`
      INSERT INTO tracked_links (user_id, slug, destination_url, title, product_id, channel, meta)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (slug) DO UPDATE SET destination_url = EXCLUDED.destination_url
      RETURNING id, slug
    `, ['JOSHMARSUE0', 'test-link-123', 'https://example.com', 'Test Link', 'p_josh_1', 'test', JSON.stringify({customCommissionPct: 12.5})]);
    
    console.log('✅ Sample link created:', result.rows[0]);
    
    // Show table counts
    const linkCount = await client.query('SELECT COUNT(*) FROM tracked_links');
    const clickCount = await client.query('SELECT COUNT(*) FROM link_clicks');
    console.log(`📊 Current data: ${linkCount.rows[0].count} links, ${clickCount.rows[0].count} clicks`);

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

setupDatabase();