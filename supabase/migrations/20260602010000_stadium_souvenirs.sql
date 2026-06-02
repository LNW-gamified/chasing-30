-- Stadium souvenirs: classic must-buys and seasonal/special items
-- Annual update process (run each Opening Day):
--   UPDATE stadium_souvenirs SET active = FALSE
--     WHERE is_classic = FALSE AND season_year < EXTRACT(YEAR FROM NOW());
--   Then INSERT new seasonal rows for the new season_year.
CREATE TABLE IF NOT EXISTS stadium_souvenirs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id  UUID REFERENCES stadiums(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_classic  BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  season_year INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stadium_souvenirs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stadium_souvenirs"
  ON stadium_souvenirs FOR SELECT TO authenticated USING (true);
