-- Migration: create tracked_links and link_clicks tables

CREATE TABLE IF NOT EXISTS tracked_links (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id BIGSERIAL PRIMARY KEY,
  link_id INT REFERENCES tracked_links(id) ON DELETE CASCADE,
  channel TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_channel ON link_clicks(channel);
