#!/usr/bin/env node
// Simple migration runner that executes SQL files against DATABASE_URL using pg
const fs = require('fs');
const path = require('path');
async function run() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('Please set DATABASE_URL environment variable (example: postgres://user:pass@localhost:5432/dbname)');
    process.exit(2);
  }
  const { Client } = require('pg');
  
  // Get migration file path from command line argument
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Usage: node runMigration.js <migration-file>');
    console.error('Example: node runMigration.js db/migrations/005_contact_management.sql');
    process.exit(1);
  }
  
  const sqlPath = path.resolve(migrationFile);
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    process.exit(2);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB, running migration...');
    await client.query(sql);
    console.log('Migration applied successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(3);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}
run();
