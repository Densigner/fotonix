const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const r = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='user_email_verification'");
  console.log('Columns:', r.rows.map(row => row.column_name).join(', '));
  await client.end();
}
check();
