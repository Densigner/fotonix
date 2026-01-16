-- Migration: Create subscription tables
-- Purpose: Enable subscription management and billing for Fotonix members

-- Create member_subscriptions table
CREATE TABLE IF NOT EXISTS member_subscriptions (
    id SERIAL PRIMARY KEY,
    member_uid VARCHAR(255) UNIQUE NOT NULL,
    paypal_subscription_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'trial', -- trial, active, cancelled, expired, past_due
    trial_ends_at TIMESTAMP,
    next_billing_date TIMESTAMP,
    amount_cents INTEGER DEFAULT 1199, -- £11.99
    currency VARCHAR(3) DEFAULT 'GBP',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subscription_events table for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
    id SERIAL PRIMARY KEY,
    member_uid VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- SUBSCRIPTION_CREATED, PAYMENT_COMPLETED, etc.
    paypal_event_id VARCHAR(255),
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create conversion_leads table for tracking leads from conversion funnel
CREATE TABLE IF NOT EXISTS conversion_leads (
    id SERIAL PRIMARY KEY,
    member_uid VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    source VARCHAR(100) NOT NULL, -- exit_intent, chatbot, social_proof
    lead_score INTEGER DEFAULT 0,
    intent_level VARCHAR(50) DEFAULT 'low', -- low, medium, high
    captured_data JSONB,
    converted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create chatbot_conversations table for AI chatbot interactions
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id SERIAL PRIMARY KEY,
    member_uid VARCHAR(255),
    session_id VARCHAR(255) NOT NULL,
    message_count INTEGER DEFAULT 0,
    lead_score INTEGER DEFAULT 0,
    intent_signals JSONB,
    conversation_data JSONB,
    outcome VARCHAR(50), -- converted, abandoned, ongoing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_uid ON member_subscriptions(member_uid);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_status ON member_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_member ON subscription_events(member_uid);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conversion_leads_email ON conversion_leads(email);
CREATE INDEX IF NOT EXISTS idx_conversion_leads_source ON conversion_leads(source);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_session ON chatbot_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_member ON chatbot_conversations(member_uid);

-- Comments for documentation
COMMENT ON TABLE member_subscriptions IS 'Tracks member subscription status, trials, and billing information';
COMMENT ON TABLE subscription_events IS 'Audit trail for all subscription-related events and PayPal webhooks';
COMMENT ON TABLE conversion_leads IS 'Tracks leads captured through conversion optimization funnel';
COMMENT ON TABLE chatbot_conversations IS 'Stores AI chatbot conversation data and lead scoring';