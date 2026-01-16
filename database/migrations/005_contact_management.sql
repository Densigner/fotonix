-- Add missing audience_segment_members table for proper segment management
CREATE TABLE IF NOT EXISTS audience_segment_members (
  id BIGSERIAL PRIMARY KEY,
  segment_id BIGINT NOT NULL REFERENCES audience_segments(id) ON DELETE CASCADE,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(segment_id, contact_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audience_segment_members_segment ON audience_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_audience_segment_members_contact ON audience_segment_members(contact_id);

-- Add unsubscribe token support to email_messages for secure unsubscribe links
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_email_messages_unsubscribe_token ON email_messages(unsubscribe_token);

-- Ensure email_suppressions table exists with proper structure
CREATE TABLE IF NOT EXISTS email_suppressions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, address)
);

-- Add suppression list indexes
CREATE INDEX IF NOT EXISTS idx_email_suppressions_tenant ON email_suppressions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_address ON email_suppressions(address);

-- Add contact activity tracking for engagement scoring
CREATE TABLE IF NOT EXISTS contact_activities (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- email_open, email_click, form_submit, etc.
  activity_data JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_activities_contact ON contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_tenant ON contact_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_type ON contact_activities(activity_type);

-- Add function to update contact engagement scores based on activities
CREATE OR REPLACE FUNCTION update_contact_engagement_score(contact_id_param BIGINT)
RETURNS VOID AS $$
DECLARE
    recent_opens INTEGER;
    recent_clicks INTEGER;
    total_activities INTEGER;
    new_score DECIMAL(3,2);
BEGIN
    -- Count recent activities (last 30 days)
    SELECT 
        COUNT(*) FILTER (WHERE activity_type = 'email_open') as opens,
        COUNT(*) FILTER (WHERE activity_type = 'email_click') as clicks,
        COUNT(*) as total
    INTO recent_opens, recent_clicks, total_activities
    FROM contact_activities 
    WHERE contact_id = contact_id_param 
    AND occurred_at >= NOW() - INTERVAL '30 days';
    
    -- Calculate engagement score (0.0 to 1.0)
    -- Opens worth 0.1, clicks worth 0.3, cap at 1.0
    new_score := LEAST(1.0, 
        0.1 + 
        (recent_opens * 0.05) + 
        (recent_clicks * 0.15)
    );
    
    -- Update contact
    UPDATE contacts 
    SET 
        engagement_score = new_score,
        contact_frequency = total_activities,
        updated_at = NOW()
    WHERE id = contact_id_param;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE audience_segment_members IS 'Many-to-many relationship between contacts and segments';
COMMENT ON TABLE contact_activities IS 'Tracks all contact interactions for engagement scoring';
COMMENT ON FUNCTION update_contact_engagement_score IS 'Updates engagement score based on recent activity';