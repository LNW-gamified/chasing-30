-- ============================================================
-- collectible_log: fold food/drink in as a fourth category
--
-- STATUS: Already applied live, directly against the database. This
-- migration exists purely so the checked-in schema documentation
-- matches reality — it is not meant to be re-run as a live change
-- against this database. It stays idempotent so it remains safe to
-- run once when provisioning a fresh instance from scratch.
--
-- food_log had zero rows at the time of this change, so no data
-- migration was needed — food/drink logging now writes directly to
-- collectible_log with category = 'food'. food_log itself is left
-- in place, untouched and unused, rather than dropped here.
-- ============================================================

ALTER TABLE collectible_log DROP CONSTRAINT IF EXISTS collectible_log_category_check;
ALTER TABLE collectible_log ADD CONSTRAINT collectible_log_category_check
  CHECK (category IN ('giveaway', 'souvenir', 'memorabilia', 'food'));

ALTER TABLE collectible_log ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE collectible_log ADD COLUMN IF NOT EXISTS price decimal(10,2);
