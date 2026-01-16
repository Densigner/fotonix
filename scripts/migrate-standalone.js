/**
 * Standalone migration runner - does NOT start the server
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  console.log('🔄 Starting database migration...\n');
  
  // Create direct database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Read migration SQL file
    const migrationPath = path.join(__dirname, '../db/migrations/006_minimal_business_emails.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✅ Migration file loaded (${migrationSQL.length} bytes)\n`);
    
    // Execute migration
    console.log('🚀 Executing migration SQL...');
    await pool.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('business_emails', 'business_email_groups', 'business_email_send_logs', 'business_email_verifications')
      ORDER BY table_name
    `);
    
    console.log(`✅ Found ${tableCheck.rows.length} tables:`);
    tableCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Check if any data was migrated
    const dataCheck = await pool.query('SELECT COUNT(*) as count FROM business_emails');
    console.log(`\n📊 business_emails table has ${dataCheck.rows[0].count} rows`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('👉 You can now create a new member account and send emails.');
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    console.error('\nFull error:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
