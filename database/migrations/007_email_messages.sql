-- Create email_messages table for tracking sent emails

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_tenant ON email_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_business_email ON email_messages(business_email_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_from ON email_messages(from_address);
CREATE INDEX IF NOT EXISTS idx_email_messages_queued_at ON email_messages(queued_at);

-- Also create email_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_templates (
  id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(500),
  html TEXT,
  text TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
