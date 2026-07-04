-- ============================================================
-- collectible_log + food_log: owner-scoped RLS
--
-- STATUS: Already applied live, directly against the database, earlier
-- in the session that authored this file. This migration exists purely
-- so the checked-in schema documentation matches reality — it is not
-- meant to be re-run as a live change against this database. It stays
-- idempotent (IF NOT EXISTS / DROP ... IF EXISTS guards) so it remains
-- safe to run once when provisioning a fresh instance from scratch.
--
-- INTENTIONAL DEPARTURE FROM SCHEMA CONVENTION:
-- Every other table in this schema (stadium_visits, trips,
-- special_events, trip_stops, achievement_claims, etc.) uses shared,
-- non-owner-scoped RLS (`TO authenticated USING (true)`) — see
-- CLAUDE.md: "Both users share all data ... there's no per-user
-- isolation by design." collectible_log and food_log are a deliberate,
-- explicit exception: these two tables are scoped per-owner via
-- auth.uid() = user_id.
--
-- collectible_log and food_log were set up slightly differently live:
-- collectible_log uses four separate per-command policies (matching
-- the achievement_claims convention elsewhere in this schema), while
-- food_log uses a single FOR ALL policy ("Users can manage their own
-- food log"). Both are reproduced here exactly as they exist live,
-- rather than normalized to one style.
--
-- food_log's table definition itself predates this migration and isn't
-- defined elsewhere in supabase/schema.sql or supabase/migrations/ (it
-- was created directly against the live database), so this file only
-- documents its RLS policy, not its column structure.
-- ============================================================

CREATE TABLE IF NOT EXISTS collectible_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  stadium_visit_id uuid REFERENCES stadium_visits(id) ON DELETE SET NULL,
  baseball_life_entry_id uuid REFERENCES baseball_life_entries(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('giveaway', 'souvenir', 'memorabilia')),
  giveaway_type text,
  name text NOT NULL,
  photo_url text,
  signed_by text,
  acquired_from text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collectible_log_stadium_visit_id_idx
  ON collectible_log(stadium_visit_id);
CREATE INDEX IF NOT EXISTS collectible_log_baseball_life_entry_id_idx
  ON collectible_log(baseball_life_entry_id);

ALTER TABLE collectible_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own collectible_log" ON collectible_log;
DROP POLICY IF EXISTS "Users can insert own collectible_log" ON collectible_log;
DROP POLICY IF EXISTS "Users can update own collectible_log" ON collectible_log;
DROP POLICY IF EXISTS "Users can delete own collectible_log" ON collectible_log;

CREATE POLICY "Users can read own collectible_log"
  ON collectible_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own collectible_log"
  ON collectible_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collectible_log"
  ON collectible_log FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collectible_log"
  ON collectible_log FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- food_log: owner-scoped RLS (single FOR ALL policy, as applied live)
-- ============================================================

ALTER TABLE food_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own food log" ON food_log;

CREATE POLICY "Users can manage their own food log"
  ON food_log FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
