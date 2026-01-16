/**
 * Run the advanced email platform migration
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runAdvancedMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/fotonix'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'db', 'migrations', '004_advanced_email_platform.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running advanced email platform migration...');
    await client.query(migrationSQL);
    console.log('✅ Advanced email platform migration completed successfully!');

    // Add some sample data
    console.log('Adding sample labels and settings...');
    
    await client.query(`
      INSERT INTO email_signatures (tenant_id, name, html_content, text_content, is_default)
      SELECT id, 'Default Signature', 
        '<p>Best regards,<br><strong>Fotonix Team</strong><br>📧 support@fotonix.co.uk | 🌐 fotonix.co.uk</p>',
        'Best regards,\nFotonix Team\nsupport@fotonix.co.uk | fotonix.co.uk',
        true
      FROM tenants 
      WHERE slug = 'fotonix-prod'
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Sample data added successfully!');

  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await client.end();
  }
}

runAdvancedMigration();