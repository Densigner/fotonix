const { Client } = require('pg');
require('dotenv').config();

async function updateProductOwner() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    const realUserId = 'isRZr0flxicvV8nvftBQHDBEjpm1';
    const testUserId = 'test_user_1';
    
    console.log(`Updating products from ${testUserId} to ${realUserId}...`);
    
    const result = await client.query(
      'UPDATE products SET owner_uid = $1 WHERE owner_uid = $2',
      [realUserId, testUserId]
    );
    
    console.log(`✅ Updated ${result.rowCount} products to use real Firebase user ID`);
    
    // Verify the update
    const check = await client.query(
      'SELECT COUNT(*) as count FROM products WHERE owner_uid = $1',
      [realUserId]
    );
    
    console.log(`📊 Total products for ${realUserId}: ${check.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error updating products:', error.message);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

updateProductOwner();