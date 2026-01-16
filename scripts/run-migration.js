/**
 * Run a specific migration by number
 * Usage: node scripts/run-migration.js 008
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const migrationNumber = process.argv[2];

if (!migrationNumber) {
  console.error('❌ Please provide migration number');
  console.error('Usage: node scripts/run-migration.js 008');
  process.exit(1);
}

async function runMigration() {
  console.log(`🔄 Running migration ${migrationNumber}...\n`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Find migration file
    const migrationDir = path.join(__dirname, '../database/migrations');
    const files = fs.readdirSync(migrationDir);
    const migrationFile = files.find(f => f.startsWith(migrationNumber + '_'));
    
    if (!migrationFile) {
      throw new Error(`Migration ${migrationNumber} not found in ${migrationDir}`);
    }
    
    const migrationPath = path.join(migrationDir, migrationFile);
    console.log(`📄 Reading: ${migrationFile}`);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✅ Loaded (${migrationSQL.length} bytes)\n`);
    
    console.log('🚀 Executing...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!\n');
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
