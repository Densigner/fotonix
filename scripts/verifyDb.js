#!/usr/bin/env node
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Please set DATABASE_URL environment variable (e.g. postgres://user:pass@host:5432/db)');
    process.exit(2);
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log('Connected to', url.replace(/^(.*:\/\/).*@/, '$1***@'));

    const t = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='reviews_helpful'");
    if (!t.rows.length) {
      console.log('Table reviews_helpful does NOT exist in public schema.');
      process.exit(0);
    }
    console.log('Table reviews_helpful exists.');

    const schema = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='reviews_helpful' ORDER BY ordinal_position");
    console.log('Schema:');
    schema.rows.forEach(r => console.log(`  ${r.column_name} : ${r.data_type}`));

    const rows = await client.query('SELECT * FROM reviews_helpful LIMIT 10');
    console.log('Sample rows (up to 10):', rows.rows);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error connecting or querying DB:', err.message || err);
    try { await client.end(); } catch (e) {}
    process.exit(3);
  }
}

main();
