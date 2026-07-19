-- giveaway_log was confirmed dead (0 rows, unreferenced in app code,
-- superseded by collectible_log) and was scoped with owner RLS in
-- 20260718010000_giveaway_log_owner_rls.sql as an interim safety fix.
-- Dropping it outright removes the exposed attack surface entirely.
-- Already applied live; this documents it for a fresh-instance setup.

DROP TABLE IF EXISTS giveaway_log;
