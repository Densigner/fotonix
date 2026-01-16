-- Add columns for receiving emails

ALTER TABLE email_messages 
  ADD COLUMN IF NOT EXISTS direction VARCHAR(20) DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound'));

ALTER TABLE email_messages 
  ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);

ALTER TABLE email_messages 
  ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(255);

ALTER TABLE email_messages 
  ADD COLUMN IF NOT EXISTS email_references TEXT;

ALTER TABLE email_messages 
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

ALTER TABLE email_messages 
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

ALTER TABLE email_messages 
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_provider_message_id ON email_messages(provider_message_id);
