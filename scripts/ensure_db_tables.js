#!/usr/bin/env node
// scripts/ensure_db_tables.js
// Usage: set DATABASE_URL in environment, then: node scripts/ensure_db_tables.js

const { Client } = require('pg');

const sqlCreate = {
  email_messages: `
CREATE TABLE IF NOT EXISTS email_messages (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  html TEXT,
  text TEXT,
  status TEXT,
  queued_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  provider_message_id TEXT,
  meta JSONB,
  thread_id INTEGER,
  priority INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_snoozed BOOLEAN DEFAULT false,
  snooze_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`,

  smtp_credentials: `
CREATE TABLE IF NOT EXISTS smtp_credentials (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  host TEXT,
  port INTEGER,
  secure BOOLEAN DEFAULT false,
  username TEXT,
  password TEXT,
  from_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`,

  affiliates: `
CREATE TABLE IF NOT EXISTS affiliates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  member_uid TEXT,
  code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`
};

async function ensure() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable not set. Set it to your Postgres connection string and re-run.');
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Connected to database.');

    for (const [name, createSql] of Object.entries(sqlCreate)) {
      console.log(`\nChecking table: ${name}`);
      try {
        await client.query(`SELECT 1 FROM ${name} LIMIT 1`);
        console.log(`  Table '${name}' exists.`);
      } catch (err) {
        // Postgres error 42P01 = undefined_table
        if (err.code === '42P01' || /does not exist/.test(err.message)) {
          console.log(`  Table '${name}' does not exist — creating it now.`);
          await client.query(createSql);
          console.log(`  Table '${name}' created.`);
        } else {
          console.error(`  Unexpected error checking table ${name}:`, err.message || err);
        }
      }
    }

    console.log('\nAll done. You can now restart the server and re-test the send flow.');
    await client.end();
    process.exit(0);
  } catch (e) {
    console.error('Database error:', e.message || e);
    try { await client.end(); } catch(_) {}
    process.exit(1);
  }
}

ensure();
