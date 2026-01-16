-- Update SMTP credentials for VPS mail server
-- Run this after setting up your OVH VPS mail server

-- Example configuration for your VPS mail server
-- Replace with your actual VPS details

INSERT INTO smtp_credentials (
  tenant_id,
  provider,
  host,
  port,
  username,
  password_encrypted,
  from_name,
  from_address,
  use_tls,
  use_starttls,
  rate_limit_per_minute
) VALUES (
  1, -- Your tenant ID
  'smtp',
  'mail.your-domain.com', -- Your VPS mail server hostname
  587, -- STARTTLS port (or 25 for non-encrypted, 465 for SSL/TLS)
  'noreply@your-domain.com', -- Your email username
  'your-secure-password', -- Your email password (encrypt this in production!)
  'Fotonix',
  'noreply@your-domain.com',
  false, -- use_tls (false for STARTTLS on port 587)
  true, -- use_starttls (true for STARTTLS on port 587)
  60 -- emails per minute (adjust based on your VPS capacity)
) ON CONFLICT (tenant_id, from_address) DO UPDATE SET
  host = EXCLUDED.host,
  port = EXCLUDED.port,
  username = EXCLUDED.username,
  password_encrypted = EXCLUDED.password_encrypted,
  use_tls = EXCLUDED.use_tls,
  use_starttls = EXCLUDED.use_starttls,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute;

-- Add email identity verification (for DMARC compliance)
INSERT INTO email_identities (
  tenant_id,
  type,
  identity,
  is_verified
) VALUES 
  (1, 'domain', 'your-domain.com', true),
  (1, 'address', 'noreply@your-domain.com', true)
ON CONFLICT (tenant_id, identity) DO UPDATE SET
  is_verified = EXCLUDED.is_verified;

-- Create a tenant record if it doesn't exist
INSERT INTO tenants (id, name, slug) 
VALUES (1, 'Fotonix', 'fotonix')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug;