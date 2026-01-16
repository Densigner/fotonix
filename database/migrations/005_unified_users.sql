-- Unified Users Table
-- This is the single source of truth for all user data
-- Firebase Auth handles authentication, this stores user profile & state

-- Users table - keyed by Firebase UID
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  display_name VARCHAR(255),
  photo_url TEXT,
  
  -- User state for email marketing
  user_state VARCHAR(50) DEFAULT 'lead' CHECK (user_state IN ('lead', 'free_user', 'customer', 'repeat_customer', 'vip', 'churned')),
  
  -- Engagement tracking
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  last_order_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Email marketing flags
  email_verified BOOLEAN DEFAULT FALSE,
  subscribed_marketing BOOLEAN DEFAULT TRUE,
  subscribed_product_updates BOOLEAN DEFAULT TRUE,
  
  -- Source tracking
  signup_source VARCHAR(100), -- 'stencil-generator', 'website', 'mobile-app', 'google'
  referral_code VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stencil Orders table - replaces Firebase /users/{uid}/stencilOrders
CREATE TABLE IF NOT EXISTS stencil_orders (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(100) UNIQUE NOT NULL,
  firebase_uid VARCHAR(128) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  
  -- Order details
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'free_lead', 'processing', 'shipped', 'delivered', 'cancelled')),
  order_type VARCHAR(50) DEFAULT 'paid' CHECK (order_type IN ('paid', 'free_signup', 'test')),
  
  -- Payment info
  paypal_order_id VARCHAR(100),
  paypal_capture_id VARCHAR(100),
  paypal_status VARCHAR(50),
  
  -- Pricing
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  delivery_fee DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'GBP',
  
  -- Stencil details (JSON for flexibility)
  num_stencils INTEGER DEFAULT 0,
  stencil_data JSONB DEFAULT '{}',
  storage_urls JSONB DEFAULT '[]',
  layer_colors JSONB DEFAULT '[]',
  
  -- Shipping
  shipping_address JSONB,
  
  -- Fulfillment
  fulfillment_status VARCHAR(50) DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'digital_only', 'processing', 'shipped', 'delivered')),
  tracking_number VARCHAR(100),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stencil Downloads table - replaces Firebase /users/{uid}/stencilDownloads
CREATE TABLE IF NOT EXISTS stencil_downloads (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  
  -- File details
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50), -- 'single-layer', 'all-layers', 'am-halftone', etc.
  storage_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Metadata
  layer_index INTEGER,
  threshold INTEGER,
  settings JSONB DEFAULT '{}',
  
  -- Flags
  is_download BOOLEAN DEFAULT TRUE,
  is_purchased_order BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User activity log for engagement tracking
CREATE TABLE IF NOT EXISTS user_activity (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(128) NOT NULL REFERENCES users(firebase_uid) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'login', 'stencil_created', 'download', 'order_placed', 'email_opened'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_state ON users(user_state);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_stencil_orders_uid ON stencil_orders(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_stencil_orders_status ON stencil_orders(status);
CREATE INDEX IF NOT EXISTS idx_stencil_orders_created ON stencil_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_stencil_downloads_uid ON stencil_downloads(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_user_activity_uid ON user_activity(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(activity_type);

-- Function to update user state based on orders
CREATE OR REPLACE FUNCTION update_user_state()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET
    total_orders = (SELECT COUNT(*) FROM stencil_orders WHERE firebase_uid = NEW.firebase_uid AND order_type = 'paid'),
    total_spent = (SELECT COALESCE(SUM(total), 0) FROM stencil_orders WHERE firebase_uid = NEW.firebase_uid AND order_type = 'paid'),
    last_order_at = NEW.created_at,
    user_state = CASE
      WHEN (SELECT COALESCE(SUM(total), 0) FROM stencil_orders WHERE firebase_uid = NEW.firebase_uid AND order_type = 'paid') >= 100 THEN 'vip'
      WHEN (SELECT COUNT(*) FROM stencil_orders WHERE firebase_uid = NEW.firebase_uid AND order_type = 'paid') >= 2 THEN 'repeat_customer'
      WHEN (SELECT COUNT(*) FROM stencil_orders WHERE firebase_uid = NEW.firebase_uid AND order_type = 'paid') >= 1 THEN 'customer'
      WHEN (SELECT COUNT(*) FROM stencil_orders WHERE firebase_uid = NEW.firebase_uid AND order_type = 'free_signup') >= 1 THEN 'free_user'
      ELSE 'lead'
    END,
    updated_at = NOW()
  WHERE firebase_uid = NEW.firebase_uid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update user state on new orders
DROP TRIGGER IF EXISTS trigger_update_user_state ON stencil_orders;
CREATE TRIGGER trigger_update_user_state
  AFTER INSERT ON stencil_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_user_state();

-- Comments
COMMENT ON TABLE users IS 'Unified user profiles - Firebase UID is the key, PostgreSQL is source of truth for all user data';
COMMENT ON TABLE stencil_orders IS 'All stencil orders - replaces Firebase /users/{uid}/stencilOrders and /madeOrders';
COMMENT ON TABLE stencil_downloads IS 'SVG downloads saved by users - replaces Firebase /users/{uid}/stencilDownloads';
COMMENT ON COLUMN users.user_state IS 'Auto-calculated: lead → free_user → customer → repeat_customer → vip';
