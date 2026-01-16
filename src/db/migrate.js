const fs = require('fs');
const path = require('path');
const { query } = require('./client');

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'db', 'migrations');

async function ensureTable() {
  await query(`
    create table if not exists _migrations (
      id bigserial primary key,
      filename text not null unique,
      run_at timestamptz not null default now()
    );
  `);
}

async function applied() {
  const { rows } = await query('select filename from _migrations order by filename asc;');
  return new Set(rows.map(r => r.filename));
}

async function migrateUp() {
  await ensureTable();
  const done = await applied();
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    console.log('↗ running', f);
    await query('begin');
    try {
      await query(sql);
      await query('insert into _migrations (filename) values ($1);', [f]);
      await query('commit');
      console.log('✓ applied', f);
    } catch (e) {
      await query('rollback');
      console.error('✗ failed', f, e.message);
      process.exit(1);
    }
  }
  console.log('All migrations up to date.');
}

async function main() {
  const cmd = process.argv[2] || 'up';
  if (cmd === 'up') await migrateUp();
  else if (cmd === 'down') console.log('Down migrations not implemented. Use psql to rollback manually.');
  else console.log('Unknown command');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });