#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false
});

const createTablesSQL = `
-- Create tracked_links table
CREATE TABLE IF NOT EXISTS tracked_links (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    destination_url TEXT NOT NULL,
    title VARCHAR(255),
    product_id VARCHAR(255),
    channel VARCHAR(100),
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug);
CREATE INDEX IF NOT EXISTS idx_tracked_links_user_id ON tracked_links(user_id);

-- Create link_clicks table
CREATE TABLE IF NOT EXISTS link_clicks (
    id SERIAL PRIMARY KEY,
    link_id INTEGER REFERENCES tracked_links(id) ON DELETE CASCADE,
    channel VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    visitor_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_visitor_id ON link_clicks(visitor_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_created_at ON link_clicks(created_at);

-- Create email-related tables (from the server code)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_messages (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    template_id INTEGER,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html TEXT,
    text TEXT,
    status VARCHAR(50) DEFAULT 'queued',
    provider_message_id VARCHAR(255),
    error TEXT,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    queued_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS email_events (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES email_messages(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB DEFAULT '{}',
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_suppressions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, address)
);

CREATE TABLE IF NOT EXISTS smtp_credentials (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    from_address VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    html TEXT,
    text TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function setupDatabase() {
  try {
    console.log('🔌 Testing database connection...');
    
    // Test connection
    const testResult = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connection successful!');
    console.log('📅 Current time:', testResult.rows[0].current_time);
    console.log('🗄️ PostgreSQL version:', testResult.rows[0].pg_version.split(' ')[1]);
    
    console.log('\n🏗️ Creating database tables...');
    
    // Execute table creation
    await pool.query(createTablesSQL);
    console.log('✅ All tables created successfully!');
    
    // Verify tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log('  ✓', row.table_name);
    });
    
    // Insert default tenant for development if not exists
    const tenantResult = await pool.query(`
      INSERT INTO tenants (slug, name) 
      VALUES ('fotonix-dev', 'Fotonix Development') 
      ON CONFLICT (slug) DO NOTHING
      RETURNING id;
    `);
    
    if (tenantResult.rows.length > 0) {
      console.log('\n🏢 Created default tenant: fotonix-dev');
    } else {
      console.log('\n🏢 Default tenant already exists');
    }
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your server: npm run start:server');
    console.log('   2. Test link creation and tracking');
    console.log('   3. Links will be stored in PostgreSQL database');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure PostgreSQL is installed and running');
    console.error('   2. Check if database "fotonix" exists');
    console.error('   3. Verify DATABASE_URL in .env file');
    console.error('   4. Check PostgreSQL user permissions');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 PostgreSQL appears to be not running. Try starting it:');
      console.error('   - Windows: Start PostgreSQL service in Services manager');
      console.error('   - Or install PostgreSQL if not installed');
    }
  } finally {
    await pool.end();
    process.exit(0);
  }
}

setupDatabase();