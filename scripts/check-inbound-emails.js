require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query(`SELECT id, from_address, to_address, subject, direction, is_read, received_at FROM email_messages WHERE direction='inbound' ORDER BY received_at DESC LIMIT 3`)
  .then(r => {
    console.log('\n📨 Inbound Emails:');
    console.table(r.rows);
    pool.end();
  })
  .catch(e => {
    console.error(e.message);
    pool.end();
  });
