/**
 * Create email_messages table for email tracking
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔄 Running email_messages migration...');

    const sqlPath = path.join(__dirname, '../database/migrations/007_email_messages.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);

    console.log('✅ Migration complete!');
    console.log('   Created tables:');
    console.log('   - email_messages');
    console.log('   - email_templates');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
