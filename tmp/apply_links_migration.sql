-- Migration: add product_id, channel, meta to tracked_links and visitor_id to link_clicks

ALTER TABLE tracked_links
  ADD COLUMN IF NOT EXISTS product_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS channel TEXT NULL,
  ADD COLUMN IF NOT EXISTS meta JSONB NULL;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tracked_links_product_id ON tracked_links(product_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_channel ON tracked_links(channel);

-- Add visitor_id to link_clicks to enable better unique visitor counting
ALTER TABLE link_clicks
  ADD COLUMN IF NOT EXISTS visitor_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_link_clicks_visitor_id ON link_clicks(visitor_id);

BEGIN;
ALTER TABLE tracked_links ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE tracked_links ALTER COLUMN user_id TYPE TEXT USING user_id::text;
CREATE INDEX IF NOT EXISTS idx_tracked_links_user_id_text ON tracked_links (user_id);
COMMIT;
