-- Migration: Add returns_policy column to stores table
-- Description: Stores the returns/refund policy configuration for each store
-- This is required for all stores before they can be published

-- Add returns_policy column as JSONB to store flexible policy configuration
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS returns_policy JSONB DEFAULT NULL;

-- Add a comment to describe the column
COMMENT ON COLUMN stores.returns_policy IS 'JSON object containing returns policy configuration: enabled, returnWindow, conditionRequired, refundMethod, returnShipping, exchangeOffered, customText';

-- Create index for querying stores with/without returns policy
CREATE INDEX IF NOT EXISTS idx_stores_returns_policy_enabled 
ON stores ((returns_policy->>'enabled'));
