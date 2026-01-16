const { Client } = require('pg');
require('dotenv').config();

async function setupProductsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Create products table
    console.log('Creating products table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        owner_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        price_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'GBP',
        images JSONB DEFAULT '[]'::jsonb,
        tags JSONB DEFAULT '[]'::jsonb,
        category TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
        inventory_count INTEGER DEFAULT 0,
        sku TEXT,
        weight_grams INTEGER,
        dimensions JSONB DEFAULT '{}'::jsonb,
        seo_title TEXT,
        seo_description TEXT,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_owner_uid ON products(owner_uid);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
    `);

    // Create trigger for updated_at
    console.log('Creating updated_at trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_products_updated_at ON products;
      CREATE TRIGGER update_products_updated_at
          BEFORE UPDATE ON products
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Products table setup completed successfully!');
    
    // Insert sample products
    console.log('Inserting sample products...');
    const sampleProducts = [
      {
        owner_uid: 'test_user_1',
        title: 'Fotonix Lumina Mirror',
        description: 'Create a one-of-a-kind mirror using our industry‑leading online designer Or use AI to help you create your perfect mirror.',
        price_cents: 2999, // £29.99
        images: JSON.stringify(['/images/usethisonfrontscreen.png']),
        tags: JSON.stringify(['mirror', 'led', 'custom', 'lumina']),
        category: 'mirrors',
        inventory_count: 50,
        sku: 'FTX-LUM-001'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Pre-Made Styles Mirror',
        description: 'Browse our Pre‑Made Styles collection, personalize with names or room-specific finishes.',
        price_cents: 2499, // £24.99
        images: JSON.stringify(['/images/realameliaimg.jpg']),
        tags: JSON.stringify(['mirror', 'pre-made', 'personalized']),
        category: 'mirrors',
        inventory_count: 75,
        sku: 'FTX-PMS-001'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Custom Shape Mirror',
        description: 'Got a business that needs uniquely shaped mirrors or want something different at home?',
        price_cents: 4000, // £40.00
        images: JSON.stringify(['/images/quoteimg.png']),
        tags: JSON.stringify(['mirror', 'custom', 'shape', 'bespoke']),
        category: 'mirrors',
        inventory_count: 25,
        sku: 'FTX-CSM-001'
      }
    ];

    for (const product of sampleProducts) {
      await client.query(`
        INSERT INTO products (owner_uid, title, description, price_cents, images, tags, category, inventory_count, sku)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `, [
        product.owner_uid,
        product.title,
        product.description,
        product.price_cents,
        product.images,
        product.tags,
        product.category,
        product.inventory_count,
        product.sku
      ]);
    }
    
    // Show table summary
    const productCount = await client.query('SELECT COUNT(*) FROM products');
    console.log(`📊 Products table now has ${productCount.rows[0].count} products`);

    // Show sample data
    const sampleData = await client.query('SELECT id, title, price_cents, owner_uid FROM products LIMIT 3');
    console.log('📋 Sample products:');
    sampleData.rows.forEach(row => {
      console.log(`  - ${row.title} (£${(row.price_cents / 100).toFixed(2)}) - Owner: ${row.owner_uid}`);
    });

  } catch (error) {
    console.error('❌ Products table setup failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

setupProductsTable();