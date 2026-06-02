-- Traffic-aware drive time cached on each stop (represents the leg *arriving* at this stop)
-- drive_time_minutes: Google Maps Duration in Traffic
-- drive_distance_miles: Google Maps road distance
ALTER TABLE trip_stops
  ADD COLUMN IF NOT EXISTS drive_time_minutes   INTEGER,
  ADD COLUMN IF NOT EXISTS drive_distance_miles DECIMAL(8,1);
