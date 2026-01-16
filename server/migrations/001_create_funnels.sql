-- Create funnels + revisions tables for Funnel Builder

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS funnels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  name text,
  slug text,
  blocks jsonb NOT NULL,
  variant char(1) DEFAULT 'A',
  published boolean DEFAULT false,
  version integer DEFAULT 1,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS funnels_user_slug_idx ON funnels (user_id, slug);

CREATE TABLE IF NOT EXISTS funnel_revisions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_id uuid REFERENCES funnels(id) ON DELETE CASCADE,
  user_id uuid,
  snapshot jsonb NOT NULL,
  version integer,
  note text,
  created_at timestamp with time zone DEFAULT now()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_update_funnels_updated_at ON funnels;
CREATE TRIGGER trg_update_funnels_updated_at
BEFORE UPDATE ON funnels
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
