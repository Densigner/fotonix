-- Simplified Migration: Create business_emails tables without smtp_credentials dependency
-- This creates the core structure needed for normalized business emails

-- Individual business email addresses (normalized structure)
CREATE TABLE IF NOT EXISTS business_emails (
  id BIGSERIAL PRIMARY KEY,
  member_uid VARCHAR(255) NOT NULL,
  business_name VARCHAR(100) NOT NULL,
  email_address VARCHAR(255) NOT NULL UNIQUE,
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('main', 'noreply', 'support', 'orders', 'custom')),
  display_name VARCHAR(255),
  description TEXT,
  forward_to_email VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT TRUE, -- Default to true for now
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  daily_send_limit INTEGER DEFAULT 500,
  daily_send_count INTEGER DEFAULT 0,
  send_count_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Business email groups (for managing the set of emails per business)
CREATE TABLE IF NOT EXISTS business_email_groups (
  id BIGSERIAL PRIMARY KEY,
  member_uid VARCHAR(255) NOT NULL,
  business_name VARCHAR(100) NOT NULL UNIQUE,
  store_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email send logs for audit trail  
CREATE TABLE IF NOT EXISTS business_email_send_logs (
  id BIGSERIAL PRIMARY KEY,
  business_email_id BIGINT NOT NULL REFERENCES business_emails(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  status VARCHAR(50) NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS business_email_verifications (
  id BIGSERIAL PRIMARY KEY,
  business_email_id BIGINT NOT NULL REFERENCES business_emails(id) ON DELETE CASCADE,
  verification_token VARCHAR(255) NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_emails_member_uid ON business_emails(member_uid);
CREATE INDEX IF NOT EXISTS idx_business_emails_email_address ON business_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_business_emails_type ON business_emails(email_type);
CREATE INDEX IF NOT EXISTS idx_business_email_groups_member_uid ON business_email_groups(member_uid);
CREATE INDEX IF NOT EXISTS idx_business_email_send_logs_email_id ON business_email_send_logs(business_email_id);
CREATE INDEX IF NOT EXISTS idx_business_email_send_logs_created_at ON business_email_send_logs(created_at);

-- Add business_email_id column to email_messages if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_messages' AND column_name = 'business_email_id'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN business_email_id BIGINT;
    CREATE INDEX IF NOT EXISTS idx_email_messages_business_email_id ON email_messages(business_email_id);
  END IF;
END $$;

-- Create helper function to get member's business emails
CREATE OR REPLACE FUNCTION get_member_business_emails(uid VARCHAR)
RETURNS TABLE (
  id BIGINT,
  email_address VARCHAR,
  email_type VARCHAR,
  display_name VARCHAR,
  description TEXT,
  business_name VARCHAR,
  is_verified BOOLEAN,
  daily_limit INTEGER,
  daily_sent INTEGER,
  daily_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    be.id,
    be.email_address,
    be.email_type,
    be.display_name,
    be.description,
    be.business_name,
    be.is_verified,
    be.daily_send_limit,
    be.daily_send_count,
    (be.daily_send_limit - be.daily_send_count) as daily_remaining
  FROM business_emails be
  WHERE be.member_uid = uid
    AND be.is_active = TRUE
  ORDER BY 
    CASE be.email_type
      WHEN 'main' THEN 1
      WHEN 'support' THEN 2
      WHEN 'orders' THEN 3
      WHEN 'noreply' THEN 4
      ELSE 5
    END;
END;
$$ LANGUAGE plpgsql;

-- Create function to check and increment send count
CREATE OR REPLACE FUNCTION check_and_increment_send_count(email_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  limit_value INTEGER;
BEGIN
  SELECT daily_send_count, daily_send_limit
  INTO current_count, limit_value
  FROM business_emails
  WHERE id = email_id AND is_active = TRUE;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  IF current_count >= limit_value THEN
    RETURN FALSE;
  END IF;
  
  UPDATE business_emails
  SET daily_send_count = daily_send_count + 1,
      updated_at = NOW()
  WHERE id = email_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to reset daily send counts (run daily via cron)
CREATE OR REPLACE FUNCTION reset_daily_send_counts()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  UPDATE business_emails
  SET daily_send_count = 0,
      send_count_reset_at = NOW(),
      updated_at = NOW()
  WHERE send_count_reset_at < CURRENT_DATE;
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Business emails tables created successfully!';
  RAISE NOTICE '📊 Tables: business_emails, business_email_groups, business_email_send_logs, business_email_verifications';
  RAISE NOTICE '🔧 Helper functions: get_member_business_emails(), check_and_increment_send_count(), reset_daily_send_counts()';
END $$;
