require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  console.log('\n=== Checking DEV database ===');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  const memberUid = 'XSFZo8rye2YsQDjUm4zRhguZPRI2';
  
  const result = await pool.query(
    'SELECT id, email_address, member_uid FROM business_emails WHERE member_uid = $1',
    [memberUid]
  );
  
  console.log(`\nBusiness emails found: ${result.rows.length}`);
  result.rows.forEach(row => {
    console.log(`  - id=${row.id}, email=${row.email_address}`);
  });
  
  const messages = await pool.query(
    "SELECT id, to_address, from_address, direction FROM email_messages WHERE direction='inbound' LIMIT 5"
  );
  
  console.log(`\nInbound messages found: ${messages.rows.length}`);
  messages.rows.forEach(row => {
    console.log(`  - id=${row.id}, to=${row.to_address}, from=${row.from_address}`);
  });
  
  await pool.end();
}

check().catch(console.error);
