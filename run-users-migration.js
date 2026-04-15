/**
 * Run Unified Users Migration
 * 
 * This script creates the PostgreSQL tables for the unified user system:
 * - users (keyed by Firebase UID)
 * - stencil_orders
 * - stencil_downloads
 * - user_activity
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  console.log('🚀 Running unified users migration...\n');

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'database', 'migrations', '005_unified_users.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Run migration
    console.log('📦 Creating tables...');
    await pool.query(sql);
    console.log('✅ Migration complete!\n');

    // Verify tables created
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'stencil_orders', 'stencil_downloads', 'user_activity')
      ORDER BY table_name
    `);

    console.log('📋 Tables created:');
    tables.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));

    // Show table schemas
    console.log('\n📊 Users table columns:');
    const userCols = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    userCols.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : ''}`);
    });

    console.log('\n🎉 Unified users system ready!');
    console.log('\nNext steps:');
    console.log('1. Start the server - users will auto-sync to PostgreSQL on login');
    console.log('2. Orders will be saved to both Firebase (mobile app) and PostgreSQL (email marketing)');
    console.log('3. Query PostgreSQL for email campaigns: SELECT * FROM users WHERE user_state = \'lead\'');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
