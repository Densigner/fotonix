/**
 * Lead Tracking Database Schema Setup
 * 
 * Creates tables for comprehensive lead capture and conversion tracking
 * Supports exit-intent popups, social proof, and conversion funnel analytics
 */

const db = require('./db');

async function setupLeadTables() {
  try {
    console.log('Setting up lead tracking tables...');

    // Leads table - core lead information
    await db.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        company VARCHAR(255),
        phone VARCHAR(50),
        first_source VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'new',
        lead_score INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Lead sources - track all touchpoints for a lead
    await db.query(`
      CREATE TABLE IF NOT EXISTS lead_sources (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        source VARCHAR(100) NOT NULL,
        lead_magnet VARCHAR(100),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_agent TEXT,
        referrer TEXT,
        ip_address INET,
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        UNIQUE(lead_id, source)
      )
    `);

    // Page visits - track visitor behavior before conversion
    await db.query(`
      CREATE TABLE IF NOT EXISTS page_visits (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255),
        page_url TEXT NOT NULL,
        referrer TEXT,
        user_agent TEXT,
        ip_address INET,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        duration_seconds INTEGER,
        source VARCHAR(100),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100)
      )
    `);

    // Conversion events - track specific conversion actions
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversion_events (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_value VARCHAR(255),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        session_id VARCHAR(255),
        page_url TEXT,
        source VARCHAR(100)
      )
    `);

    // Email campaigns - track email sends and opens
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        campaign_type VARCHAR(100) NOT NULL,
        subject VARCHAR(255),
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        opened_at TIMESTAMP WITH TIME ZONE,
        clicked_at TIMESTAMP WITH TIME ZONE,
        unsubscribed_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Daily stats - aggregate statistics for dashboard
    await db.query(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        metric VARCHAR(100) NOT NULL,
        value INTEGER DEFAULT 0,
        source VARCHAR(100),
        UNIQUE(date, metric, source)
      )
    `);

    // Social proof events - track events for social proof widgets
    await db.query(`
      CREATE TABLE IF NOT EXISTS social_proof_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        user_name VARCHAR(100),
        user_location VARCHAR(100),
        amount DECIMAL(10,2),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        display_until TIMESTAMP WITH TIME ZONE
      )
    `);

    // Chatbot conversations - store qualified lead data from AI chatbot
    await db.query(`
      CREATE TABLE IF NOT EXISTS chatbot_conversations (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        business_type VARCHAR(100),
        monthly_revenue VARCHAR(50),
        current_affiliates INTEGER,
        main_concern TEXT,
        lead_score INTEGER DEFAULT 0,
        conversation_data JSONB,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Chatbot interactions - track all interaction events
    await db.query(`
      CREATE TABLE IF NOT EXISTS chatbot_interactions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        timestamp TIMESTAMP WITH TIME ZONE,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(first_source);
      
      CREATE INDEX IF NOT EXISTS idx_lead_sources_lead_id ON lead_sources(lead_id);
      CREATE INDEX IF NOT EXISTS idx_lead_sources_source ON lead_sources(source);
      CREATE INDEX IF NOT EXISTS idx_lead_sources_timestamp ON lead_sources(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_page_visits_session ON page_visits(session_id);
      CREATE INDEX IF NOT EXISTS idx_page_visits_timestamp ON page_visits(timestamp);
      CREATE INDEX IF NOT EXISTS idx_page_visits_source ON page_visits(source);
      
      CREATE INDEX IF NOT EXISTS idx_conversion_events_lead_id ON conversion_events(lead_id);
      CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON conversion_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_conversion_events_timestamp ON conversion_events(timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
      CREATE INDEX IF NOT EXISTS idx_daily_stats_metric ON daily_stats(metric);
      
      CREATE INDEX IF NOT EXISTS idx_social_proof_timestamp ON social_proof_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_social_proof_display_until ON social_proof_events(display_until);
      
      CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_lead_id ON chatbot_conversations(lead_id);
      CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_session ON chatbot_conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_score ON chatbot_conversations(lead_score);
      CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_created ON chatbot_conversations(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_session ON chatbot_interactions(session_id);
      CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_event ON chatbot_interactions(event_type);
      CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_timestamp ON chatbot_interactions(timestamp);
    `);

    // Insert sample social proof events for immediate social proof
    await db.query(`
      INSERT INTO social_proof_events (event_type, user_name, user_location, amount, timestamp, display_until)
      VALUES 
        ('signup', 'Sarah M.', 'London', NULL, NOW() - INTERVAL '2 minutes', NOW() + INTERVAL '1 hour'),
        ('signup', 'Mike R.', 'Manchester', NULL, NOW() - INTERVAL '5 minutes', NOW() + INTERVAL '1 hour'),
        ('earning', 'James T.', 'Birmingham', 127.50, NOW() - INTERVAL '3 minutes', NOW() + INTERVAL '1 hour'),
        ('earning', 'Lisa K.', 'Edinburgh', 89.25, NOW() - INTERVAL '7 minutes', NOW() + INTERVAL '1 hour'),
        ('signup', 'Emma S.', 'Bristol', NULL, NOW() - INTERVAL '12 minutes', NOW() + INTERVAL '1 hour'),
        ('earning', 'David P.', 'Leeds', 234.75, NOW() - INTERVAL '15 minutes', NOW() + INTERVAL '1 hour')
      ON CONFLICT DO NOTHING
    `);

    // Insert initial daily stats
    await db.query(`
      INSERT INTO daily_stats (date, metric, value, source)
      VALUES 
        (CURRENT_DATE, 'lead_captures', 23, 'exit-intent-popup'),
        (CURRENT_DATE, 'lead_captures', 15, 'social-proof-banner'),
        (CURRENT_DATE, 'lead_captures', 8, 'subscription-gate'),
        (CURRENT_DATE, 'page_visits', 1247, 'organic'),
        (CURRENT_DATE, 'page_visits', 342, 'direct'),
        (CURRENT_DATE, 'conversions', 46, 'total')
      ON CONFLICT (date, metric, source) DO NOTHING
    `);

    console.log('✅ Lead tracking tables created successfully');
    console.log('✅ Sample data inserted');
    console.log('✅ Indexes created for performance');

  } catch (error) {
    console.error('❌ Error setting up lead tables:', error);
    throw error;
  }
}

// Run setup if called directly
if (require.main === module) {
  setupLeadTables()
    .then(() => {
      console.log('Lead tracking setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Lead tracking setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupLeadTables;