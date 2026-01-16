require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_messages')`)
.then(r => {
  console.log('email_messages table exists:', r.rows[0].exists);
  if (!r.rows[0].exists) {
    console.log('\n❌ Table does NOT exist - this is why email sending fails!');
    console.log('   Need to create email_messages table');
  } else {
    console.log('✅ Table exists');
  }
  pool.end();
})
.catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
