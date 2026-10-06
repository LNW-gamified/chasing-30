-- Naming-rights and franchise name updates. Each statement is guarded on the
-- old value, so re-running it changes nothing.
--   Minute Maid Park      -> Daikin Park   (renamed for the 2025 season)
--   Guaranteed Rate Field -> Rate Field    (renamed for the 2025 season)
--   Oakland Athletics     -> Athletics     (the name MLB now uses)
update stadiums set name = 'Daikin Park' where abbreviation = 'HOU' and name = 'Minute Maid Park';
update stadiums set name = 'Rate Field' where abbreviation = 'CWS' and name = 'Guaranteed Rate Field';
update stadiums set team = 'Athletics' where abbreviation = 'OAK' and team = 'Oakland Athletics';
