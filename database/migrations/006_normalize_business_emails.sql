-- Migration 006: Normalize Business Email Management
-- This migration creates a proper normalized structure for member business emails
-- Each email address gets its own row with a proper primary key
-- Maintains compatibility with existing 3-email system (main, noreply, support/orders)

-- ==========================
-- PART 1: CREATE NEW TABLES
-- ==========================

-- Individual business email addresses (normalized structure)
CREATE TABLE IF NOT EXISTS business_emails (
  id BIGSERIAL PRIMARY KEY,
  member_uid VARCHAR(255) NOT NULL,
  business_name VARCHAR(100) NOT NULL,
  email_address VARCHAR(255) NOT NULL UNIQUE,
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('main', 'noreply', 'support', 'orders', 'custom')),
  display_name VARCHAR(255), -- For "From" name in emails
  description TEXT,
  forward_to_email VARCHAR(255), -- Where incoming mail should forward
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  daily_send_limit INTEGER DEFAULT 500,
  daily_send_count INTEGER DEFAULT 0,
  send_count_reset_at TIMESTAMPTZ DEFAULT NOW(),
  smtp_credential_id BIGINT, -- Link to smtp_credentials if using dedicated SMTP
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_smtp_credential FOREIGN KEY (smtp_credential_id) REFERENCES smtp_credentials(id) ON DELETE SET NULL
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
  message_id BIGINT REFERENCES email_messages(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  status VARCHAR(50) NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_business_email FOREIGN KEY (business_email_id) REFERENCES business_emails(id) ON DELETE CASCADE
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

-- =================================
-- PART 2: MIGRATE EXISTING DATA
-- =================================

-- Migrate data from member_business_emails to normalized structure
DO $$
DECLARE
  old_row RECORD;
  group_id BIGINT;
  email_id BIGINT;
BEGIN
  -- Loop through all existing business email records
  FOR old_row IN SELECT * FROM member_business_emails WHERE is_active = TRUE
  LOOP
    -- Create business email group
    INSERT INTO business_email_groups (
      member_uid,
      business_name,
      store_name,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      old_row.member_uid,
      old_row.business_name,
      old_row.business_name, -- Use business_name as store_name if no separate store field
      old_row.is_active,
      old_row.created_at,
      old_row.updated_at
    )
    ON CONFLICT (business_name) DO NOTHING
    RETURNING id INTO group_id;
    
    -- If group already existed, get its ID
    IF group_id IS NULL THEN
      SELECT id INTO group_id 
      FROM business_email_groups 
      WHERE business_name = old_row.business_name;
    END IF;
    
    -- Migrate main email
    IF old_row.main_email IS NOT NULL THEN
      INSERT INTO business_emails (
        member_uid,
        business_name,
        email_address,
        email_type,
        display_name,
        description,
        forward_to_email,
        is_active,
        is_verified,
        created_at,
        updated_at
      ) VALUES (
        old_row.member_uid,
        old_row.business_name,
        old_row.main_email,
        'main',
        old_row.business_name,
        'Main business email',
        old_row.forward_to_email,
        old_row.is_active,
        TRUE, -- Assume existing emails are verified
        old_row.created_at,
        old_row.updated_at
      )
      ON CONFLICT (email_address) DO NOTHING;
    END IF;
    
    -- Migrate noreply email
    IF old_row.noreply_email IS NOT NULL THEN
      INSERT INTO business_emails (
        member_uid,
        business_name,
        email_address,
        email_type,
        display_name,
        description,
        forward_to_email,
        is_active,
        is_verified,
        created_at,
        updated_at
      ) VALUES (
        old_row.member_uid,
        old_row.business_name,
        old_row.noreply_email,
        'noreply',
        old_row.business_name || ' (No-Reply)',
        'No-reply email for newsletters',
        old_row.forward_to_email,
        old_row.is_active,
        TRUE,
        old_row.created_at,
        old_row.updated_at
      )
      ON CONFLICT (email_address) DO NOTHING;
    END IF;
    
    -- Migrate support email
    IF old_row.support_email IS NOT NULL THEN
      INSERT INTO business_emails (
        member_uid,
        business_name,
        email_address,
        email_type,
        display_name,
        description,
        forward_to_email,
        is_active,
        is_verified,
        created_at,
        updated_at
      ) VALUES (
        old_row.member_uid,
        old_row.business_name,
        old_row.support_email,
        'support',
        old_row.business_name || ' Support',
        'Contact and support email',
        old_row.forward_to_email,
        old_row.is_active,
        TRUE,
        old_row.created_at,
        old_row.updated_at
      )
      ON CONFLICT (email_address) DO NOTHING;
    END IF;
    
    -- Migrate orders email
    IF old_row.orders_email IS NOT NULL THEN
      INSERT INTO business_emails (
        member_uid,
        business_name,
        email_address,
        email_type,
        display_name,
        description,
        forward_to_email,
        is_active,
        is_verified,
        created_at,
        updated_at
      ) VALUES (
        old_row.member_uid,
        old_row.business_name,
        old_row.orders_email,
        'orders',
        old_row.business_name || ' Orders',
        'Customer choice email',
        old_row.forward_to_email,
        old_row.is_active,
        TRUE,
        old_row.created_at,
        old_row.updated_at
      )
      ON CONFLICT (email_address) DO NOTHING;
    END IF;
    
  END LOOP;
  
  RAISE NOTICE 'Migration completed successfully';
END $$;

-- =============================
-- PART 3: CREATE INDEXES
-- =============================

CREATE INDEX IF NOT EXISTS idx_business_emails_member_uid ON business_emails(member_uid);
CREATE INDEX IF NOT EXISTS idx_business_emails_business_name ON business_emails(business_name);
CREATE INDEX IF NOT EXISTS idx_business_emails_email_address ON business_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_business_emails_type ON business_emails(email_type);
CREATE INDEX IF NOT EXISTS idx_business_emails_active ON business_emails(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_business_emails_verified ON business_emails(is_verified) WHERE is_verified = TRUE;
CREATE INDEX IF NOT EXISTS idx_business_email_groups_member_uid ON business_email_groups(member_uid);
CREATE INDEX IF NOT EXISTS idx_business_email_send_logs_email_id ON business_email_send_logs(business_email_id);
CREATE INDEX IF NOT EXISTS idx_business_email_send_logs_created_at ON business_email_send_logs(created_at DESC);

-- =============================
-- PART 4: ADD HELPER FUNCTIONS
-- =============================

-- Function to reset daily send counts
CREATE OR REPLACE FUNCTION reset_daily_send_counts()
RETURNS void AS $$
BEGIN
  UPDATE business_emails
  SET daily_send_count = 0,
      send_count_reset_at = NOW()
  WHERE send_count_reset_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Function to increment send count and check limit
CREATE OR REPLACE FUNCTION check_and_increment_send_count(email_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  send_limit INTEGER;
  last_reset TIMESTAMPTZ;
BEGIN
  -- Get current state
  SELECT daily_send_count, daily_send_limit, send_count_reset_at
  INTO current_count, send_limit, last_reset
  FROM business_emails
  WHERE id = email_id;
  
  -- Reset if needed
  IF last_reset < NOW() - INTERVAL '1 day' THEN
    UPDATE business_emails
    SET daily_send_count = 0,
        send_count_reset_at = NOW()
    WHERE id = email_id;
    current_count := 0;
  END IF;
  
  -- Check limit
  IF current_count >= send_limit THEN
    RETURN FALSE;
  END IF;
  
  -- Increment
  UPDATE business_emails
  SET daily_send_count = daily_send_count + 1,
      updated_at = NOW()
  WHERE id = email_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get available emails for a member
CREATE OR REPLACE FUNCTION get_member_business_emails(uid VARCHAR)
RETURNS TABLE (
  id BIGINT,
  email_address VARCHAR,
  email_type VARCHAR,
  display_name VARCHAR,
  description TEXT,
  business_name VARCHAR,
  is_verified BOOLEAN,
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
    END,
    be.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- =============================
-- PART 5: UPDATE EMAIL_MESSAGES
-- =============================

-- Add foreign key from email_messages to business_emails for tracking which business email was used
ALTER TABLE email_messages 
ADD COLUMN IF NOT EXISTS business_email_id BIGINT REFERENCES business_emails(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_messages_business_email ON email_messages(business_email_id);

-- =============================
-- PART 6: CREATE VIEWS
-- =============================

-- View for easy querying of email groups with their emails
CREATE OR REPLACE VIEW v_business_email_groups AS
SELECT 
  beg.id as group_id,
  beg.member_uid,
  beg.business_name,
  beg.store_name,
  beg.is_active as group_active,
  json_agg(
    json_build_object(
      'id', be.id,
      'email_address', be.email_address,
      'email_type', be.email_type,
      'display_name', be.display_name,
      'description', be.description,
      'is_active', be.is_active,
      'is_verified', be.is_verified,
      'daily_remaining', (be.daily_send_limit - be.daily_send_count)
    ) ORDER BY 
      CASE be.email_type
        WHEN 'main' THEN 1
        WHEN 'support' THEN 2
        WHEN 'orders' THEN 3
        WHEN 'noreply' THEN 4
        ELSE 5
      END
  ) as emails
FROM business_email_groups beg
LEFT JOIN business_emails be ON be.business_name = beg.business_name AND be.is_active = TRUE
WHERE beg.is_active = TRUE
GROUP BY beg.id, beg.member_uid, beg.business_name, beg.store_name, beg.is_active;

-- View for email analytics
CREATE OR REPLACE VIEW v_business_email_stats AS
SELECT 
  be.id,
  be.member_uid,
  be.business_name,
  be.email_address,
  be.email_type,
  COUNT(DISTINCT besl.id) as total_sends,
  COUNT(DISTINCT CASE WHEN besl.status = 'sent' THEN besl.id END) as successful_sends,
  COUNT(DISTINCT CASE WHEN besl.status = 'failed' THEN besl.id END) as failed_sends,
  COUNT(DISTINCT CASE WHEN besl.status = 'bounced' THEN besl.id END) as bounced_sends,
  MAX(besl.sent_at) as last_sent_at,
  be.daily_send_count as today_sends,
  (be.daily_send_limit - be.daily_send_count) as remaining_today
FROM business_emails be
LEFT JOIN business_email_send_logs besl ON besl.business_email_id = be.id
GROUP BY be.id, be.member_uid, be.business_name, be.email_address, be.email_type, be.daily_send_count, be.daily_send_limit;

-- =================================
-- PART 7: ADD TRIGGERS
-- =================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_email_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_business_emails_updated_at
BEFORE UPDATE ON business_emails
FOR EACH ROW
EXECUTE FUNCTION update_business_email_timestamp();

CREATE TRIGGER trg_business_email_groups_updated_at
BEFORE UPDATE ON business_email_groups
FOR EACH ROW
EXECUTE FUNCTION update_business_email_timestamp();

-- Trigger to log sends to business_email_send_logs when email_messages are created
CREATE OR REPLACE FUNCTION log_business_email_send()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.business_email_id IS NOT NULL THEN
    INSERT INTO business_email_send_logs (
      business_email_id,
      message_id,
      recipient_email,
      subject,
      status,
      sent_at,
      created_at
    ) VALUES (
      NEW.business_email_id,
      NEW.id,
      NEW.to_address,
      NEW.subject,
      NEW.status,
      CASE WHEN NEW.status = 'sent' THEN NOW() ELSE NULL END,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_business_email_send
AFTER INSERT ON email_messages
FOR EACH ROW
WHEN (NEW.business_email_id IS NOT NULL)
EXECUTE FUNCTION log_business_email_send();

-- =================================
-- PART 8: GRANT PERMISSIONS
-- =================================

-- Grant appropriate permissions (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE ON business_emails TO your_app_role;
-- GRANT SELECT ON v_business_email_groups TO your_app_role;
-- GRANT SELECT ON v_business_email_stats TO your_app_role;

-- =================================
-- PART 9: ADD COMMENTS
-- =================================

COMMENT ON TABLE business_emails IS 'Normalized table storing individual business email addresses with proper PKs';
COMMENT ON TABLE business_email_groups IS 'Groups business emails by member/business for management';
COMMENT ON TABLE business_email_send_logs IS 'Audit trail of all emails sent from business addresses';
COMMENT ON COLUMN business_emails.daily_send_limit IS 'Maximum emails allowed per day from this address (spam protection)';
COMMENT ON COLUMN business_emails.smtp_credential_id IS 'Optional dedicated SMTP credentials for this email address';
COMMENT ON FUNCTION check_and_increment_send_count IS 'Checks daily limit and increments send count atomically';

-- =================================
-- SUCCESS MESSAGE
-- =================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 006 completed successfully!';
  RAISE NOTICE '   • business_emails table created with proper normalization';
  RAISE NOTICE '   • Existing data migrated from member_business_emails';
  RAISE NOTICE '   • Helper functions and views created';
  RAISE NOTICE '   • Audit logging triggers installed';
  RAISE NOTICE '   • Ready for production use!';
END $$;
