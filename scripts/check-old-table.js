require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'member_business_emails'
  ORDER BY ordinal_position
`)
.then(r => {
  console.log('member_business_emails columns:');
  console.table(r.rows);
  return pool.query(`SELECT * FROM member_business_emails LIMIT 1`);
})
.then(r => {
  console.log('\nSample data:');
  console.log(JSON.stringify(r.rows, null, 2));
  pool.end();
})
.catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
