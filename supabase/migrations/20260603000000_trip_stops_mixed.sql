-- Allow trip stops to be either a stadium game stop or a destination stop.
-- Existing stops default to 'stadium' preserving all existing data.

-- Make stadium_id nullable so destination stops don't require one
ALTER TABLE trip_stops ALTER COLUMN stadium_id DROP NOT NULL;

-- Discriminator column
ALTER TABLE trip_stops
  ADD COLUMN IF NOT EXISTS stop_type TEXT NOT NULL DEFAULT 'stadium'
    CHECK (stop_type IN ('stadium', 'destination'));

-- Destination reference (null for stadium stops)
ALTER TABLE trip_stops
  ADD COLUMN IF NOT EXISTS destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL;

-- Experience type for destination stops (matches destination_visits.experience_type)
ALTER TABLE trip_stops
  ADD COLUMN IF NOT EXISTS experience_type TEXT
    CHECK (experience_type IN ('tour', 'game', 'festival', 'pilgrimage', 'other'));

-- RLS policies for new column (inherits existing authenticated-user policies)
-- No new policies needed — the existing trip_stops policies cover all columns.
