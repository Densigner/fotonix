-- Add email verification table to your PostgreSQL database
CREATE TABLE IF NOT EXISTS user_email_verification (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  verification_token VARCHAR(255) NOT NULL UNIQUE,
  is_verified BOOLEAN DEFAULT FALSE,
  user_type VARCHAR(50) DEFAULT 'member', -- 'member', 'affiliate', 'customer'
  token_expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_token ON user_email_verification(verification_token);
CREATE INDEX IF NOT EXISTS idx_firebase_uid ON user_email_verification(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_user_type ON user_email_verification(user_type);

-- Migration: Add user_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_email_verification' 
                   AND column_name = 'user_type') THEN
        ALTER TABLE user_email_verification ADD COLUMN user_type VARCHAR(50) DEFAULT 'member';
    END IF;
END
$$;