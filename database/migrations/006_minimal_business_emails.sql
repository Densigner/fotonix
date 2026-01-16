-- Minimal Migration: Create ONLY business_emails tables (no dependencies)

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
  is_verified BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  daily_send_limit INTEGER DEFAULT 500,
  daily_send_count INTEGER DEFAULT 0,
  send_count_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Business email groups
CREATE TABLE IF NOT EXISTS business_email_groups (
  id BIGSERIAL PRIMARY KEY,
  member_uid VARCHAR(255) NOT NULL,
  business_name VARCHAR(100) NOT NULL UNIQUE,
  store_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email send logs
CREATE TABLE IF NOT EXISTS business_email_send_logs (
  id BIGSERIAL PRIMARY KEY,
  business_email_id BIGINT NOT NULL REFERENCES business_emails(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email verifications
CREATE TABLE IF NOT EXISTS business_email_verifications (
  id BIGSERIAL PRIMARY KEY,
  business_email_id BIGINT NOT NULL REFERENCES business_emails(id) ON DELETE CASCADE,
  verification_token VARCHAR(255) NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_emails_member_uid ON business_emails(member_uid);
CREATE INDEX IF NOT EXISTS idx_business_emails_email_address ON business_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_business_email_groups_member_uid ON business_email_groups(member_uid);

SELECT '✅ Migration completed - business_emails tables created!' AS status;
