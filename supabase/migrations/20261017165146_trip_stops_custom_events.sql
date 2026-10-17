-- ============================================================
-- trip_stops: fields for custom event stops
--
-- A custom event stop is a game that isn't in the MLB schedule API
-- (Banana Ball, college, Fall League, and so on). It is stored as a
-- normal destination-type stop with no destination_id, so existing
-- counts, routing and trip-completion logic keep working. These columns
-- hold what a destination row or a stadium would normally supply.
-- event_slug ties the stop to a baseball_events row (e.g. 'banana-ball').
-- ============================================================

ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS event_slug      TEXT;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS event_home_team TEXT;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS event_away_team TEXT;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS event_venue     TEXT;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS event_city      TEXT;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS event_state     TEXT;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS event_lat       DOUBLE PRECISION;
ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS event_lng       DOUBLE PRECISION;
