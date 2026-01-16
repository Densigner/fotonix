/**
 * Migration script to add user_type column to user_email_verification table
 */
const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    // Add user_type column if it doesn't exist
    await client.query(`
      ALTER TABLE user_email_verification 
      ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'member'
    `);
    
    console.log('✅ Added user_type column to user_email_verification table');
    
    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'user_email_verification' 
      AND column_name = 'user_type'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column verified:', result.rows[0]);
    } else {
      console.log('⚠️ Column may not have been added');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
