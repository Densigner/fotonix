#!/usr/bin/env node
/**
 * Production Email Management Migration Runner
 * 
 * This script runs the full migration to normalize business email management,
 * making the system production-ready with proper schema, audit trails, and safety checks.
 * 
 * Usage:
 *   node scripts/run-email-migration.js
 * 
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string (required)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('\n📧 Production Email Management Migration\n' + '='.repeat(60));
  
  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable not set');
    console.error('   Set it like: export DATABASE_URL="postgresql://user:pass@host:5432/dbname"');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Connect to database
    console.log('\n🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Check if migration already applied
    console.log('🔍 Checking if migration already applied...');
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'business_emails'
      ) as exists
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('⚠️  business_emails table already exists');
      console.log('   Migration may have already been applied.');
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('   Continue anyway? (yes/no): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('   Migration cancelled by user');
        process.exit(0);
      }
    }

    // Backup existing data
    console.log('\n💾 Creating backup of existing data...');
    try {
      const backupResult = await client.query(`
        SELECT COUNT(*) as count FROM member_business_emails
      `);
      console.log(`✅ Found ${backupResult.rows[0].count} existing business email records`);
      
      // Export to JSON for safety
      const backupData = await client.query(`
        SELECT * FROM member_business_emails ORDER BY created_at DESC
      `);
      const backupPath = path.join(__dirname, `../backups/business_emails_backup_${Date.now()}.json`);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, JSON.stringify(backupData.rows, null, 2));
      console.log(`✅ Backup saved to: ${backupPath}`);
    } catch (err) {
      if (err.code === '42P01') {
        console.log('⚠️  member_business_emails table does not exist - fresh install');
      } else {
        throw err;
      }
    }

    // Load migration SQL
    console.log('\n📜 Loading migration SQL...');
    const migrationPath = path.join(__dirname, '../db/migrations/006_normalize_business_emails.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`✅ Loaded migration (${Math.round(migrationSQL.length / 1024)}KB)`);

    // Run migration
    console.log('\n🚀 Running migration...');
    console.log('   This may take a minute...\n');
    
    await client.query(migrationSQL);
    
    console.log('\n✅ Migration completed successfully!');

    // Verify results
    console.log('\n🔍 Verifying migration results...');
    
    const verifyQueries = [
      { 
        name: 'business_emails table', 
        query: 'SELECT COUNT(*) as count FROM business_emails' 
      },
      { 
        name: 'business_email_groups table', 
        query: 'SELECT COUNT(*) as count FROM business_email_groups' 
      },
      { 
        name: 'business_email_send_logs table', 
        query: 'SELECT COUNT(*) as count FROM business_email_send_logs' 
      },
      {
        name: 'Helper function get_member_business_emails',
        query: "SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_member_business_emails') as exists"
      },
      {
        name: 'View v_business_email_groups',
        query: "SELECT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'v_business_email_groups') as exists"
      }
    ];

    for (const check of verifyQueries) {
      try {
        const result = await client.query(check.query);
        const value = result.rows[0].count !== undefined 
          ? `${result.rows[0].count} rows`
          : (result.rows[0].exists ? '✓ exists' : '✗ missing');
        console.log(`   ✅ ${check.name}: ${value}`);
      } catch (err) {
        console.log(`   ❌ ${check.name}: ${err.message}`);
      }
    }

    // Show sample data
    console.log('\n📊 Sample data from business_emails:');
    const sampleResult = await client.query(`
      SELECT id, member_uid, business_name, email_address, email_type, is_active, is_verified
      FROM business_emails
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (sampleResult.rows.length > 0) {
      console.table(sampleResult.rows);
    } else {
      console.log('   (No data yet - run signup to create business emails)');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION SUCCESSFUL');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('  1. Restart your application server');
    console.log('  2. Test signup flow → business email creation');
    console.log('  3. Test compose → from dropdown population');
    console.log('  4. Test email send flow end-to-end');
    console.log('\nBackup location:');
    console.log(`  ${backupPath || 'N/A - no existing data'}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n⚠️  Database may be in an inconsistent state!');
    console.error('   Restore from backup if needed.');
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
