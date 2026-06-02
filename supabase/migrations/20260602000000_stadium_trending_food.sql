-- Stadium trending food: classic ballpark staples and seasonal specials
CREATE TABLE IF NOT EXISTS stadium_trending_food (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id  UUID REFERENCES stadiums(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_classic  BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  season_year INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stadium_trending_food ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stadium_trending_food"
  ON stadium_trending_food FOR SELECT TO authenticated USING (true);
