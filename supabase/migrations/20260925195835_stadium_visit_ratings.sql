-- Personal ratings on a specific stadium visit, not the stadium overall —
-- a stadium visited multiple times can have a different rating each
-- time, and a "best ballparks" ranking averages across a stadium's
-- rated visits.
ALTER TABLE stadium_visits
  ADD COLUMN IF NOT EXISTS rating_food numeric,
  ADD COLUMN IF NOT EXISTS rating_atmosphere numeric,
  ADD COLUMN IF NOT EXISTS rating_seats numeric,
  ADD COLUMN IF NOT EXISTS rating_note text;

ALTER TABLE stadium_visits ADD CONSTRAINT stadium_visits_rating_food_range CHECK (rating_food IS NULL OR (rating_food >= 1 AND rating_food <= 5));
ALTER TABLE stadium_visits ADD CONSTRAINT stadium_visits_rating_atmosphere_range CHECK (rating_atmosphere IS NULL OR (rating_atmosphere >= 1 AND rating_atmosphere <= 5));
ALTER TABLE stadium_visits ADD CONSTRAINT stadium_visits_rating_seats_range CHECK (rating_seats IS NULL OR (rating_seats >= 1 AND rating_seats <= 5));

GRANT SELECT ON stadium_visits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON stadium_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stadium_visits TO service_role;
