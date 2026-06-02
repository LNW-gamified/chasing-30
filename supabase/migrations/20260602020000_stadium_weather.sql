-- Monthly weather averages for each stadium (cached from Open-Meteo historical API)
-- Refreshed on first page load per stadium; historical averages never change so
-- data is valid indefinitely. Unique on (stadium_id, month) for safe upsert.
CREATE TABLE IF NOT EXISTS stadium_weather (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stadium_id     UUID REFERENCES stadiums(id) ON DELETE CASCADE NOT NULL,
  month          INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  avg_high_temp  DECIMAL(5,1) NOT NULL,
  avg_precip_days DECIMAL(4,1) NOT NULL,
  avg_wind_speed DECIMAL(4,1) NOT NULL,
  rating         TEXT NOT NULL CHECK (rating IN ('great', 'good', 'fair', 'avoid')),
  last_updated   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stadium_id, month)
);

ALTER TABLE stadium_weather ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stadium_weather"
  ON stadium_weather FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stadium_weather"
  ON stadium_weather FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stadium_weather"
  ON stadium_weather FOR UPDATE TO authenticated USING (true);
