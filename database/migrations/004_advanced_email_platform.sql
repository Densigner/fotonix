-- Advanced Email Platform Database Schema
-- This extends the existing email schema with world-class features

-- Enhanced email_messages table with advanced features
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS thread_id BIGINT REFERENCES email_messages(id);
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 3); -- 0=normal, 1=low, 2=high, 3=urgent
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS is_snoozed BOOLEAN DEFAULT FALSE;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS read_receipt_requested BOOLEAN DEFAULT FALSE;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS importance_score DECIMAL(3,2) DEFAULT 0.5; -- AI-calculated importance 0.0-1.0
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2) DEFAULT 0.5; -- AI-calculated sentiment 0.0-1.0
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS spam_score DECIMAL(3,2) DEFAULT 0.0; -- Spam probability 0.0-1.0
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE; -- For auto-replies, etc.
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS original_message_id BIGINT REFERENCES email_messages(id); -- For forwards
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS tracking_data JSONB DEFAULT '{}';
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Email attachments table
CREATE TABLE IF NOT EXISTS email_attachments (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT, -- Local storage path
  cloud_url TEXT, -- Cloud storage URL (S3, etc.)
  is_inline BOOLEAN DEFAULT FALSE,
  content_id TEXT, -- For inline images
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email labels/tags system
CREATE TABLE IF NOT EXISTS email_labels (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6', -- Hex color
  parent_id BIGINT REFERENCES email_labels(id), -- For nested labels
  is_system BOOLEAN DEFAULT FALSE, -- System labels like Inbox, Sent, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Message-label relationships
CREATE TABLE IF NOT EXISTS email_message_labels (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  label_id BIGINT NOT NULL REFERENCES email_labels(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, label_id)
);

-- Email filters/rules
CREATE TABLE IF NOT EXISTS email_filters (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  conditions JSONB NOT NULL, -- Complex filter conditions
  actions JSONB NOT NULL, -- Actions to take (label, forward, etc.)
  priority INTEGER DEFAULT 0, -- Execution order
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email signatures
CREATE TABLE IF NOT EXISTS email_signatures (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  html_content TEXT,
  text_content TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contact management
CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  notes TEXT,
  is_vip BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  first_contacted_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  contact_frequency INTEGER DEFAULT 0, -- How often they email
  engagement_score DECIMAL(3,2) DEFAULT 0.5, -- 0.0-1.0
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Email tracking (opens, clicks, etc.)
CREATE TABLE IF NOT EXISTS email_tracking (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'download', 'print', 'forward')),
  user_agent TEXT,
  ip_address INET,
  location_data JSONB, -- GeoIP data
  click_url TEXT, -- For click tracking
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign management tables
CREATE TABLE IF NOT EXISTS email_campaigns (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id BIGINT REFERENCES email_templates(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('broadcast', 'automation', 'ab_test', 'drip')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  subject_line TEXT,
  from_name TEXT,
  from_address TEXT,
  reply_to TEXT,
  html_content TEXT,
  text_content TEXT,
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  unsubscribe_count INTEGER DEFAULT 0,
  bounce_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}', -- Campaign-specific settings
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A/B testing for campaigns
CREATE TABLE IF NOT EXISTS campaign_variants (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL, -- 'A', 'B', 'C', etc.
  subject_line TEXT,
  html_content TEXT,
  text_content TEXT,
  recipient_percentage DECIMAL(5,2) DEFAULT 50.00, -- % of recipients
  is_winner BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email automation workflows
CREATE TABLE IF NOT EXISTS automation_workflows (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('signup', 'purchase', 'abandon_cart', 'date', 'behavior', 'api')),
  trigger_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  workflow_steps JSONB NOT NULL, -- Visual workflow definition
  stats JSONB DEFAULT '{}', -- Performance stats
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workflow executions (instances)
CREATE TABLE IF NOT EXISTS workflow_executions (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  current_step INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_data JSONB DEFAULT '{}'
);

-- Audience segments
CREATE TABLE IF NOT EXISTS audience_segments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL, -- Segmentation rules
  contact_count INTEGER DEFAULT 0,
  is_dynamic BOOLEAN DEFAULT TRUE, -- Auto-update vs static
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-responders
CREATE TABLE IF NOT EXISTS auto_responders (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_conditions JSONB NOT NULL, -- When to trigger
  response_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  cooldown_hours INTEGER DEFAULT 24, -- Don't respond again for X hours
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled sends
CREATE TABLE IF NOT EXISTS scheduled_sends (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id BIGINT REFERENCES email_messages(id),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email analytics aggregations
CREATE TABLE IF NOT EXISTS email_analytics_daily (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  emails_unsubscribed INTEGER DEFAULT 0,
  unique_opens INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_priority ON email_messages(tenant_id, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_unread ON email_messages(tenant_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_starred ON email_messages(tenant_id, is_starred, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_snoozed ON email_messages(tenant_id, is_snoozed, snooze_until);
CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON email_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_message ON email_tracking(message_id, event_type);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email ON contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_vip ON contacts(tenant_id, is_vip, last_contacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON email_campaigns(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_active ON automation_workflows(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_sends_pending ON scheduled_sends(status, scheduled_for);

-- System labels for every tenant
INSERT INTO email_labels (tenant_id, name, color, is_system) 
SELECT id, 'Inbox', '#3B82F6', TRUE FROM tenants WHERE NOT EXISTS (
  SELECT 1 FROM email_labels WHERE tenant_id = tenants.id AND name = 'Inbox'
);

INSERT INTO email_labels (tenant_id, name, color, is_system) 
SELECT id, 'Sent', '#10B981', TRUE FROM tenants WHERE NOT EXISTS (
  SELECT 1 FROM email_labels WHERE tenant_id = tenants.id AND name = 'Sent'
);

INSERT INTO email_labels (tenant_id, name, color, is_system) 
SELECT id, 'Drafts', '#F59E0B', TRUE FROM tenants WHERE NOT EXISTS (
  SELECT 1 FROM email_labels WHERE tenant_id = tenants.id AND name = 'Drafts'
);

INSERT INTO email_labels (tenant_id, name, color, is_system) 
SELECT id, 'Archive', '#6B7280', TRUE FROM tenants WHERE NOT EXISTS (
  SELECT 1 FROM email_labels WHERE tenant_id = tenants.id AND name = 'Archive'
);

INSERT INTO email_labels (tenant_id, name, color, is_system) 
SELECT id, 'Spam', '#EF4444', TRUE FROM tenants WHERE NOT EXISTS (
  SELECT 1 FROM email_labels WHERE tenant_id = tenants.id AND name = 'Spam'
);

INSERT INTO email_labels (tenant_id, name, color, is_system) 
SELECT id, 'Trash', '#6B7280', TRUE FROM tenants WHERE NOT EXISTS (
  SELECT 1 FROM email_labels WHERE tenant_id = tenants.id AND name = 'Trash'
);