-- giveaway_quantity was applied directly to the live database earlier
-- (not through a migration file), so this documents it for repo history.
-- Safe to run again if needed, IF NOT EXISTS makes it a no-op when the
-- column is already there.

ALTER TABLE collectible_log
  ADD COLUMN IF NOT EXISTS giveaway_quantity text;

COMMENT ON COLUMN collectible_log.giveaway_quantity IS 'Free-text distribution detail for giveaways, e.g. "First 15,000 fans (21+)"';
