-- Member Business Email System
-- Create tables for member business email addresses

-- Member business emails table
CREATE TABLE member_business_emails (
    id SERIAL PRIMARY KEY,
    member_uid VARCHAR(255) NOT NULL,
    business_name VARCHAR(100) NOT NULL, -- 'stencils', 'marketing', etc
    main_email VARCHAR(255) NOT NULL, -- stencils@fotonix.co.uk
    noreply_email VARCHAR(255), -- noreply.stencils@fotonix.co.uk
    support_email VARCHAR(255), -- support.stencils@fotonix.co.uk (optional)
    orders_email VARCHAR(255), -- orders.stencils@fotonix.co.uk (optional)
    forward_to_email VARCHAR(255) NOT NULL, -- member's personal email
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_business_name UNIQUE (business_name),
    CONSTRAINT unique_main_email UNIQUE (main_email)
);

-- Email forwarding rules (if member wants multiple forwarding addresses)
CREATE TABLE business_email_forwarding (
    id SERIAL PRIMARY KEY,
    business_email_id INTEGER NOT NULL,
    email_type VARCHAR(50) NOT NULL, -- 'main', 'noreply', 'support', 'orders'
    forward_to_email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_business_email FOREIGN KEY (business_email_id) REFERENCES member_business_emails(id) ON DELETE CASCADE
);

-- Email usage statistics
CREATE TABLE business_email_stats (
    id SERIAL PRIMARY KEY,
    business_email_id INTEGER NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    emails_sent INTEGER DEFAULT 0,
    emails_received INTEGER DEFAULT 0,
    emails_forwarded INTEGER DEFAULT 0,
    
    CONSTRAINT fk_business_email_stats FOREIGN KEY (business_email_id) REFERENCES member_business_emails(id) ON DELETE CASCADE,
    CONSTRAINT unique_business_email_date UNIQUE (business_email_id, date)
);

-- Email templates for business emails (optional)
CREATE TABLE business_email_templates (
    id SERIAL PRIMARY KEY,
    business_email_id INTEGER NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'welcome', 'newsletter', 'transactional'
    subject VARCHAR(255) NOT NULL,
    html_content TEXT,
    text_content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_business_email_templates FOREIGN KEY (business_email_id) REFERENCES member_business_emails(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_member_business_emails_member_uid ON member_business_emails(member_uid);
CREATE INDEX idx_member_business_emails_business_name ON member_business_emails(business_name);
CREATE INDEX idx_member_business_emails_main_email ON member_business_emails(main_email);
CREATE INDEX idx_business_email_forwarding_business_email_id ON business_email_forwarding(business_email_id);
CREATE INDEX idx_business_email_stats_business_email_id ON business_email_stats(business_email_id);
CREATE INDEX idx_business_email_stats_date ON business_email_stats(date);

-- Insert sample data for testing
INSERT INTO member_business_emails (
    member_uid, 
    business_name, 
    main_email, 
    noreply_email,
    support_email,
    forward_to_email
) VALUES (
    'demo-member-123',
    'stencils',
    'stencils@fotonix.co.uk',
    'noreply.stencils@fotonix.co.uk',
    'support.stencils@fotonix.co.uk',
    'demo@example.com'
);

-- Add default forwarding rules
INSERT INTO business_email_forwarding (business_email_id, email_type, forward_to_email) VALUES
(1, 'main', 'demo@example.com'),
(1, 'support', 'demo@example.com');