require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  // First check what columns exist
  const columns = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='email_messages' ORDER BY ordinal_position"
  );
  console.log('\n=== Available columns ===');
  console.log(columns.rows.map(r => r.column_name).join(', '));
  
  const result = await pool.query(
    "SELECT * FROM email_messages WHERE direction='inbound' ORDER BY id DESC LIMIT 1"
  );
  
  console.log('\n=== Email Message ===');
  console.log(JSON.stringify(result.rows[0], null, 2));
  
  await pool.end();
}

check().catch(console.error);
