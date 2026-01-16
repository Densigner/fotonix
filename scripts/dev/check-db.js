require('dotenv').config();
const { Client } = require('pg');

async function checkDatabase() {
  console.log('Checking database connection...');
  console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
  
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    console.log('✅ Database connected successfully');
    
    // Check if table exists
    const tableCheck = await client.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'member_business_emails')`);
    console.log('member_business_emails table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      const count = await client.query('SELECT COUNT(*) FROM member_business_emails');
      console.log('Total emails in database:', count.rows[0].count);
      
      const recent = await client.query('SELECT email, business_name, member_uid, created_at FROM member_business_emails ORDER BY created_at DESC LIMIT 5');
      console.log('\nRecent emails:');
      recent.rows.forEach(row => {
        console.log(' -', row.email, '|', row.business_name, '|', row.member_uid?.substring(0, 8) + '...');
      });
    }
    
    await client.end();
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

checkDatabase();