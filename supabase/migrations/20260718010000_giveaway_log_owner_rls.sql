-- ============================================================
-- giveaway_log: enable RLS (was fully exposed — anon/authenticated
-- could read or write every row)
--
-- STATUS: Already applied live, directly against the database. This
-- migration exists purely so the checked-in schema documentation
-- matches reality.
--
-- giveaway_log is dead: 0 rows, not referenced anywhere in the app
-- code. Its shape (user_id, stadium_visit_id, baseball_life_entry_id,
-- category, photo_url) is the direct predecessor of collectible_log,
-- which superseded it. Scoped owner-scoped RLS here to match
-- collectible_log's convention (see
-- 20260703000000_collectible_log_and_food_log_owner_rls.sql) rather
-- than dropping the table outright, since removal wasn't requested.
-- ============================================================

ALTER TABLE giveaway_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own giveaway_log" ON giveaway_log;
DROP POLICY IF EXISTS "Users can insert own giveaway_log" ON giveaway_log;
DROP POLICY IF EXISTS "Users can update own giveaway_log" ON giveaway_log;
DROP POLICY IF EXISTS "Users can delete own giveaway_log" ON giveaway_log;

CREATE POLICY "Users can read own giveaway_log"
  ON giveaway_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own giveaway_log"
  ON giveaway_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own giveaway_log"
  ON giveaway_log FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own giveaway_log"
  ON giveaway_log FOR DELETE TO authenticated USING (auth.uid() = user_id);
