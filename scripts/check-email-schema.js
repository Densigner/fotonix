require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'email_messages' ORDER BY ordinal_position`)
  .then(r => {console.table(r.rows); pool.end()})
  .catch(e => {console.error(e.message); pool.end()});
