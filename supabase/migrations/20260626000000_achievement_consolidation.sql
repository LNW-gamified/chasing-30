-- Achievement consolidation migration
-- Records any legacy achievement_claims that reference removed IDs.
-- These rows are preserved as-is (they won't display but cause no errors).
--
-- Removed IDs and their disposition:
--   walk_off_win        → deleted from static-experiences; auto-detected via walk_off_witness
--   first_special_event → removed (redundant with specific event achievements)
--   east_coast          → removed (redundant with division achievements)
--   midwest             → removed (redundant with division achievements)
--   west_coast          → removed (redundant with division achievements)
--   factory_tour        → split into louisville_slugger_visit + rawlings_factory_visit
--   minor_league_attendance → replaced by minor_league_explorer ladder (no claims stored)
--   first_game/five_stadiums/etc. → replaced by stadium_explorer ladder (no claims stored)
--   five_games/ten_games → replaced by games_attended ladder (no claims stored)
--
-- Only walk_off_win could have manual achievement_claims rows.
-- Tag them so they're identifiable without deleting user data.

UPDATE achievement_claims
SET notes = COALESCE(notes || ' ', '') || '[legacy: walk_off_win]'
WHERE achievement_id = 'walk_off_win'
  AND (notes IS NULL OR notes NOT LIKE '%legacy%');
