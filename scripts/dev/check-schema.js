const { Client } = require('pg');
require('dotenv').config();

async function checkTableSchema() {
  console.log('Checking member_business_emails table schema...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check table schema
    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'member_business_emails'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table columns:');
    schema.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Show actual data
    const data = await client.query('SELECT * FROM member_business_emails LIMIT 1');
    console.log('\n📧 Sample record:');
    if (data.rows.length > 0) {
      console.log(JSON.stringify(data.rows[0], null, 2));
    } else {
      console.log('No records found');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkTableSchema();