-- ============================================================
-- trips: add custom_name / custom_city for non-curated destinations
--
-- The destination trip form has always let a user log a trip to a
-- place that isn't on the curated destinations list ("custom mode"),
-- and has always sent custom_name/custom_city to the API. But these
-- columns never existed, so the API silently dropped the city (and
-- relied on the trip's own `name` field to carry the location name).
-- This adds the missing columns so that data actually gets saved.
-- ============================================================

ALTER TABLE trips ADD COLUMN IF NOT EXISTS custom_name TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS custom_city TEXT;
