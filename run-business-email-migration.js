const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    console.log('🚀 Fixing user_email_verification table...');
    
    // Drop and recreate the table with proper unique constraint
    const sql = `
      DROP TABLE IF EXISTS user_email_verification;
      
      CREATE TABLE user_email_verification (
        id BIGSERIAL PRIMARY KEY,
        firebase_uid VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        verification_token VARCHAR(255) NOT NULL UNIQUE,
        token_expires_at TIMESTAMPTZ NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_email_verification_firebase_uid ON user_email_verification(firebase_uid);
      CREATE INDEX IF NOT EXISTS idx_user_email_verification_token ON user_email_verification(verification_token);
      CREATE INDEX IF NOT EXISTS idx_user_email_verification_email ON user_email_verification(email);
    `;
    
    await pool.query(sql);
    
    console.log('✅ user_email_verification table fixed with UNIQUE constraint on firebase_uid!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
