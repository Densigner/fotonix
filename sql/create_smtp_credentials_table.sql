-- Create smtp_credentials table for VPS mail server configuration
-- This allows per-tenant SMTP configuration with fallback to environment variables

CREATE TABLE IF NOT EXISTS smtp_credentials (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255),
  tenant_slug VARCHAR(255) UNIQUE,
  provider VARCHAR(50) DEFAULT 'smtp',
  host VARCHAR(255) NOT NULL,
  port INTEGER DEFAULT 587,
  username VARCHAR(255),
  password_encrypted TEXT,
  use_tls BOOLEAN DEFAULT false,
  use_starttls BOOLEAN DEFAULT true,
  from_address VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster tenant lookups
CREATE INDEX IF NOT EXISTS idx_smtp_credentials_tenant_id ON smtp_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_smtp_credentials_tenant_slug ON smtp_credentials(tenant_slug);

-- Insert default configuration using environment variables
-- This ensures emails work immediately without database setup
INSERT INTO smtp_credentials (
  tenant_id,
  tenant_slug,
  provider,
  host,
  port,
  username,
  password_encrypted,
  use_tls,
  use_starttls,
  from_address,
  from_name
) VALUES (
  'default',
  'fotonix-prod',
  'smtp',
  'mail.fotonix.co.uk',
  587,
  'noreply@fotonix.co.uk',
  '0eGLVjWLgfvH',
  false,
  true,
  'noreply@fotonix.co.uk',
  'Fotonix'
) ON CONFLICT (tenant_slug) DO NOTHING;

-- Add another entry for tenant_id = 1 (numeric fallback)
INSERT INTO smtp_credentials (
  tenant_id,
  tenant_slug,
  provider,
  host,
  port,
  username,
  password_encrypted,
  use_tls,
  use_starttls,
  from_address,
  from_name
) VALUES (
  '1',
  'fotonix-default',
  'smtp',
  'mail.fotonix.co.uk',
  587,
  'noreply@fotonix.co.uk',
  '0eGLVjWLgfvH',
  false,
  true,
  'noreply@fotonix.co.uk',
  'Fotonix'
) ON CONFLICT (tenant_slug) DO NOTHING;
