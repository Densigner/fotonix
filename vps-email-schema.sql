-- Complete email system schema for VPS

-- Individual business email addresses
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

CREATE INDEX IF NOT EXISTS idx_business_emails_member_uid ON business_emails(member_uid);
CREATE INDEX IF NOT EXISTS idx_business_emails_email_address ON business_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_business_emails_type ON business_emails(email_type);

-- Email messages table
CREATE TABLE IF NOT EXISTS email_messages (
  id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  business_email_id BIGINT REFERENCES business_emails(id) ON DELETE SET NULL,
  from_address VARCHAR(255) NOT NULL,
  to_address TEXT NOT NULL,
  subject VARCHAR(500),
  html TEXT,
  text TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Receiving columns
  direction VARCHAR(20) DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  message_id VARCHAR(255),
  in_reply_to VARCHAR(255),
  email_references TEXT,
  received_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT false,
  provider_message_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_email_messages_tenant ON email_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_business_email ON email_messages(business_email_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_from ON email_messages(from_address);
CREATE INDEX IF NOT EXISTS idx_email_messages_queued_at ON email_messages(queued_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_provider_message_id ON email_messages(provider_message_id);

-- Copy data from your local database (you'll need to do this manually)
-- Run on your local machine:
-- pg_dump -U fotonix -h 127.0.0.1 -d fotonix_dev -t business_emails --data-only > business_emails_data.sql
-- Then copy and run on VPS
