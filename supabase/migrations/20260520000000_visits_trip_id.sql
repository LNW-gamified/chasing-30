-- Link visits back to the trip that generated them, and allow multiple visits per stadium
ALTER TABLE stadium_visits
ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stadium_visits_trip_id ON stadium_visits (trip_id);
