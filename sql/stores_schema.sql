-- Store Builder Database Schema
-- Run this SQL to create the stores table

CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  handle VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) DEFAULT '',
  description TEXT DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]',
  is_published BOOLEAN DEFAULT false,
  theme JSONB DEFAULT NULL,
  logo TEXT DEFAULT NULL,
  returns_policy JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure each user can only have one store per handle
  UNIQUE(user_id, handle),
  
  -- Ensure handles are globally unique
  UNIQUE(handle)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_handle ON stores(handle);
CREATE INDEX IF NOT EXISTS idx_stores_published ON stores(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_stores_returns_policy_enabled ON stores ((returns_policy->>'enabled'));

-- Add comment to describe returns_policy column
COMMENT ON COLUMN stores.returns_policy IS 'JSON object containing returns policy configuration: enabled, returnWindow, conditionRequired, refundMethod, returnShipping, exchangeOffered, customText';

-- Optional: Add some sample data for testing
-- INSERT INTO stores (user_id, handle, display_name, description, blocks, is_published) VALUES
-- ('test-user-123', 'teststore', 'Test Store', 'A sample store for testing', '[]', false);