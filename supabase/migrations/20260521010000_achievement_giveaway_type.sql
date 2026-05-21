ALTER TABLE achievement_claims
ADD COLUMN IF NOT EXISTS giveaway_type TEXT
  CHECK (giveaway_type IN ('bobblehead', 'jersey', 'hat', 'figurine', 'poster', 'other'));

-- Backfill existing bobblehead claims
UPDATE achievement_claims
SET giveaway_type = 'bobblehead'
WHERE achievement_id = 'bobblehead' AND giveaway_type IS NULL;
