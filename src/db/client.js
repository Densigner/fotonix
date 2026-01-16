require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected PG error', err);
  // In production we want the process to exit so orchestrators can restart it.
  // In local/dev environments it's annoying for the whole server to die when
  // Postgres is not available, so only exit in production.
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

module.exports = { pool, query };