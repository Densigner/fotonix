#!/usr/bin/env node

/**
 * Setup Member Business Email Database Tables
 */

require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

async function setupDatabase() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    console.log('📄 Reading SQL file...');
    const sqlContent = fs.readFileSync('setup-member-business-emails.sql', 'utf8');
    
    console.log('🚀 Executing SQL...');
    await client.query(sqlContent);
    
    console.log('✅ Member business email tables created successfully!');
    console.log('\n📋 Created tables:');
    console.log('   • member_business_emails - Store business email addresses');
    console.log('   • business_email_forwarding - Email forwarding rules');
    console.log('   • business_email_stats - Usage statistics');
    console.log('   • business_email_templates - Email templates');
    
    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%business_email%' 
      OR table_name LIKE 'member_business%'
      ORDER BY table_name;
    `);
    
    console.log('\n🔍 Verification - Tables created:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Check sample data
    const sampleData = await client.query('SELECT * FROM member_business_emails LIMIT 1;');
    if (sampleData.rows.length > 0) {
      console.log('\n📧 Sample business email created:');
      const sample = sampleData.rows[0];
      console.log(`   Business: ${sample.business_name}`);
      console.log(`   Main Email: ${sample.main_email}`);
      console.log(`   NoReply Email: ${sample.noreply_email}`);
      console.log(`   Forwards to: ${sample.forward_to_email}`);
    }
    
    console.log('\n🎉 Database setup complete!');
    console.log('📝 Next steps:');
    console.log('   1. Create API endpoints for member email management');
    console.log('   2. Build React component for email creation');
    console.log('   3. Configure VPS email routing');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

setupDatabase();