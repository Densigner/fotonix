import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const { Pool } = pkg;

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });

// test connection and log once
(async function testConn(){
  try {
    await pool.query('SELECT 1');
    console.log('DB connected');
  } catch (e) {
    console.warn('DB connection failed:', e.message || e);
  }
})();

export async function getCounts(id) {
  const res = await pool.query('SELECT helpful_up, helpful_down FROM reviews_helpful WHERE review_id = $1', [id]);
  if (res.rows[0]) return { helpfulUp: Number(res.rows[0].helpful_up), helpfulDown: Number(res.rows[0].helpful_down) };
  return { helpfulUp: 0, helpfulDown: 0 };
}

export async function applyVote(id, vote) {
  if (vote === 'up') {
    await pool.query(`INSERT INTO reviews_helpful (review_id, helpful_up, helpful_down) VALUES ($1, 1, 0)
      ON CONFLICT (review_id) DO UPDATE SET helpful_up = reviews_helpful.helpful_up + 1`, [id]);
  } else if (vote === 'down') {
    await pool.query(`INSERT INTO reviews_helpful (review_id, helpful_up, helpful_down) VALUES ($1, 0, 1)
      ON CONFLICT (review_id) DO UPDATE SET helpful_down = reviews_helpful.helpful_down + 1`, [id]);
  } else if (vote === 'clear') {
    // no-op for now
  }
  return getCounts(id);
}

export async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
}

export default pool;
