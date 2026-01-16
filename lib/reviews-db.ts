/**
 * reviews-db.ts
 * Small DB abstraction for helpful counts. Uses `pg` when DATABASE_URL is set,
 * otherwise falls back to an in-process map (demo). Designed so you can
 * later wire a real Postgres instance and run migrations.
 */

type Counts = { helpfulUp: number; helpfulDown: number };

let INMEM: Record<string, Counts> = {};

let PG: any = null;
let pool: any = null;

export async function initDbIfNeeded() {
  if (pool) return;
  try {
    const { Pool } = require('pg');
    const conn = process.env.DATABASE_URL;
    if (!conn) return; // no-op: will use in-memory fallback
    pool = new Pool({ connectionString: conn });
    // optional: verify connection
    await pool.query('SELECT 1');
    PG = true;
  } catch (e) {
    // leave pool null to indicate in-memory
    pool = null;
  }
}

export async function getCounts(id: string): Promise<Counts> {
  await initDbIfNeeded();
  if (pool) {
    const res = await pool.query('SELECT helpful_up, helpful_down FROM reviews_helpful WHERE review_id = $1', [id]);
    if (res.rows && res.rows[0]) {
      return { helpfulUp: Number(res.rows[0].helpful_up || 0), helpfulDown: Number(res.rows[0].helpful_down || 0) };
    }
    return { helpfulUp: 0, helpfulDown: 0 };
  }
  INMEM[id] = INMEM[id] || { helpfulUp: 0, helpfulDown: 0 };
  return INMEM[id];
}

export async function applyVote(id: string, vote: 'up' | 'down' | 'clear'): Promise<Counts> {
  await initDbIfNeeded();
  if (pool) {
    // transactional update: insert or update counts
    if (vote === 'up') {
      await pool.query(`INSERT INTO reviews_helpful (review_id, helpful_up, helpful_down) VALUES ($1, 1, 0)
        ON CONFLICT (review_id) DO UPDATE SET helpful_up = reviews_helpful.helpful_up + 1`, [id]);
    } else if (vote === 'down') {
      await pool.query(`INSERT INTO reviews_helpful (review_id, helpful_up, helpful_down) VALUES ($1, 0, 1)
        ON CONFLICT (review_id) DO UPDATE SET helpful_down = reviews_helpful.helpful_down + 1`, [id]);
    } else if (vote === 'clear') {
      // no-op for now — clearing requires user identity
    }
    const res = await pool.query('SELECT helpful_up, helpful_down FROM reviews_helpful WHERE review_id = $1', [id]);
    return { helpfulUp: Number(res.rows[0].helpful_up || 0), helpfulDown: Number(res.rows[0].helpful_down || 0) };
  }

  INMEM[id] = INMEM[id] || { helpfulUp: 0, helpfulDown: 0 };
  if (vote === 'up') INMEM[id].helpfulUp = INMEM[id].helpfulUp + 1;
  else if (vote === 'down') INMEM[id].helpfulDown = INMEM[id].helpfulDown + 1;
  // clear is no-op
  return INMEM[id];
}

export async function resetInMemory() {
  INMEM = {};
}

export default { initDbIfNeeded, getCounts, applyVote, resetInMemory };
