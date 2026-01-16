require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  const memberUid = 'XSFZo8rye2YsQDjUm4zRhguZPRI2';
  
  console.log('\n=== Business Emails for User ===');
  const result = await pool.query(
    'SELECT id, email_address, member_uid, is_active FROM business_emails WHERE member_uid = $1',
    [memberUid]
  );
  
  console.log(`Found ${result.rows.length} business emails:`);
  result.rows.forEach(row => {
    console.log(`  - id=${row.id}, email=${row.email_address}, is_active=${row.is_active}`);
  });
  
  await pool.end();
}

check().catch(console.error);
