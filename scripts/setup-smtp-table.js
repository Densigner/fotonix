/**
 * Setup SMTP Credentials Table
 * 
 * This script creates the smtp_credentials table in your PostgreSQL database
 * and populates it with default configuration from your .env file
 * 
 * Usage: node scripts/setup-smtp-table.js
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is required.');
    console.error('Make sure your .env file is properly configured.');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const client = new Client({ connectionString: databaseUrl });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read and execute SQL file
    const sqlPath = path.join(__dirname, '..', 'sql', 'create_smtp_credentials_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🔄 Creating smtp_credentials table...');
    await client.query(sql);
    console.log('✅ smtp_credentials table created successfully');

    // Verify the table was created
    const result = await client.query(`
      SELECT COUNT(*) as count FROM smtp_credentials WHERE tenant_slug IN ('fotonix-prod', 'fotonix-default')
    `);
    
    console.log(`✅ Found ${result.rows[0].count} default SMTP configuration(s)`);
    
    // Display the configuration (without password)
    const configs = await client.query(`
      SELECT tenant_id, tenant_slug, host, port, from_address, from_name, use_tls, use_starttls 
      FROM smtp_credentials 
      ORDER BY id
    `);
    
    console.log('\n📧 SMTP Configurations:');
    configs.rows.forEach(config => {
      console.log(`\n  Tenant: ${config.tenant_slug} (ID: ${config.tenant_id})`);
      console.log(`  Host: ${config.host}:${config.port}`);
      console.log(`  From: ${config.from_name} <${config.from_address}>`);
      console.log(`  TLS: ${config.use_tls ? 'Yes' : 'No'}, STARTTLS: ${config.use_starttls ? 'Yes' : 'No'}`);
    });
    
    console.log('\n✅ Setup complete! Your VPS mail server is now configured.');
    console.log('You can now send campaign emails successfully.');
    
  } catch (error) {
    console.error('❌ Error setting up SMTP table:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
