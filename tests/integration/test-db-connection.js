const { Client } = require('pg');
require('dotenv').config();

async function testDbConnection() {
  console.log('Testing database connection...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check if the table exists and has data
    const result = await client.query('SELECT COUNT(*) FROM member_business_emails');
    console.log(`📧 Total business emails in database: ${result.rows[0].count}`);
    
    // Show some sample data
    const samples = await client.query('SELECT email, business_name, member_uid FROM member_business_emails LIMIT 5');
    console.log('\n📋 Sample emails:');
    samples.rows.forEach(row => {
      console.log(`- ${row.email} (${row.business_name}) - UID: ${row.member_uid.substring(0, 8)}...`);
    });
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

testDbConnection();