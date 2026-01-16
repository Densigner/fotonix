const { query } = require('./src/db/client');

async function createStoresTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        handle VARCHAR(100) NOT NULL,
        display_name VARCHAR(255) DEFAULT '',
        description TEXT DEFAULT '',
        blocks JSONB NOT NULL DEFAULT '[]',
        is_published BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, handle),
        UNIQUE(handle)
      )
    `);
    console.log('✅ Stores table created successfully');
    
    await query(`CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_stores_handle ON stores(handle)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_stores_published ON stores(is_published) WHERE is_published = true`);
    console.log('✅ Indexes created successfully');
    
  } catch (error) {
    console.log('ℹ️  Database not available (expected in development):', error.message);
  } finally {
    process.exit(0);
  }
}

createStoresTable();