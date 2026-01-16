-- Migration to add support for inbound emails
-- Add 'received' status to email_messages check constraint

-- Drop the existing constraint
ALTER TABLE email_messages DROP CONSTRAINT IF EXISTS email_messages_status_check;

-- Add the new constraint with 'received' status
ALTER TABLE email_messages ADD CONSTRAINT email_messages_status_check 
  CHECK (status IN ('queued','sending','sent','failed','bounced','complained','suppressed','received'));

-- Update the email_events constraint as well
ALTER TABLE email_events DROP CONSTRAINT IF EXISTS email_events_event_type_check;
ALTER TABLE email_events ADD CONSTRAINT email_events_event_type_check 
  CHECK (event_type IN ('queued','sending','sent','open','click','bounce','complaint','unsubscribe','failure','received'));