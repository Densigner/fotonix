const { Client } = require('pg');
require('dotenv').config();

async function createVerificationTable() {
  console.log('Creating email verification table...');
  
  const client = new Client({ 
    connectionString: process.env.DATABASE_URL 
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_email_verification (
        id SERIAL PRIMARY KEY,
        firebase_uid VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        verification_token VARCHAR(255) NOT NULL UNIQUE,
        is_verified BOOLEAN DEFAULT FALSE,
        token_expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_token ON user_email_verification(verification_token);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_firebase_uid ON user_email_verification(firebase_uid);
    `);
    
    console.log('✅ Email verification table created successfully');
    console.log('✅ Database indexes created');
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
  } finally {
    await client.end();
  }
}

createVerificationTable();