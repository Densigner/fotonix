-- Create users + user_activity tables for the Firebase-to-Postgres user
-- sync (server/routes/auth/users.js, POST /api/users/sync). This route
-- file already existed and was already being called from every login
-- (src/contexts/AuthContext.js) but was never mounted in server/index.js
-- and this table never existed — every sync call 404'd silently (caught
-- and logged as a console warning, nothing else depended on it).
-- Column list taken directly from users.js's queries and from
-- server/routes/email/contacts.js's syncStencilUsers, which already
-- assumed this exact shape.

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  firebase_uid varchar(255) UNIQUE NOT NULL,
  email varchar(255) NOT NULL,
  username varchar(255),
  display_name varchar(255),
  photo_url text,
  user_state varchar(50) DEFAULT 'free_user',
  total_orders integer DEFAULT 0,
  total_spent numeric(10,2) DEFAULT 0,
  last_order_at timestamp with time zone,
  last_activity_at timestamp with time zone,
  email_verified boolean DEFAULT false,
  subscribed_marketing boolean DEFAULT false,
  subscribed_product_updates boolean DEFAULT false,
  signup_source varchar(100),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_activity (
  id serial PRIMARY KEY,
  firebase_uid varchar(255) NOT NULL,
  activity_type varchar(100) NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_firebase_uid_idx ON user_activity (firebase_uid);
