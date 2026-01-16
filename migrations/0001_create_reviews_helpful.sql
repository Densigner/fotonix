-- migrations/0001_create_reviews_helpful.sql
CREATE TABLE IF NOT EXISTS reviews_helpful (
  review_id TEXT PRIMARY KEY,
  helpful_up BIGINT NOT NULL DEFAULT 0,
  helpful_down BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- simple trigger to update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON reviews_helpful;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON reviews_helpful
FOR EACH ROW EXECUTE PROCEDURE trigger_set_updated_at();
