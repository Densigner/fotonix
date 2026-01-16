-- db/seed/seed_reviews.sql
INSERT INTO reviews_helpful (review_id, helpful_up, helpful_down) VALUES
('sample-1', 5, 1),
('sample-2', 2, 0)
ON CONFLICT (review_id) DO UPDATE SET helpful_up = EXCLUDED.helpful_up, helpful_down = EXCLUDED.helpful_down;
