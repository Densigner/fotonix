const { query } = require('./src/db/client');

async function testPostgreSQLConnection() {
  try {
    console.log('Testing PostgreSQL connection...');
    
    // Test basic connection
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful:', result.rows[0].current_time);
    
    // Test our tables exist
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('affiliates', 'orders', 'attributions', 'tracked_links', 'link_clicks')
      ORDER BY table_name
    `);
    
    console.log('📋 Available tables:', tables.rows.map(r => r.table_name));
    
    // Test affiliate data
    const affiliates = await query('SELECT * FROM affiliates LIMIT 5');
    console.log('👥 Sample affiliates:', affiliates.rows);
    
    // Test attributions data  
    const attributions = await query('SELECT * FROM attributions LIMIT 5');
    console.log('💰 Sample attributions:', attributions.rows);
    
    // Test orders data
    const orders = await query('SELECT * FROM orders LIMIT 5');
    console.log('🛒 Sample orders:', orders.rows);
    
    // Test link data
    const links = await query('SELECT * FROM tracked_links LIMIT 5');
    console.log('🔗 Sample links:', links.rows);
    
    console.log('\n🎉 All tests passed! PostgreSQL is ready.');
    
  } catch (error) {
    console.error('❌ PostgreSQL test failed:', error.message);
    console.error('Full error:', error);
  }
}

testPostgreSQLConnection();