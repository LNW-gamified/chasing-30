-- ============================================================
-- Storage buckets: remove/scope down public listing
--
-- STATUS: Already applied live. This documents it for a fresh-instance
-- setup (these bucket policies were originally created live, not
-- through migrations checked into this repo).
--
-- Supabase's advisor flagged achievement-photos, food-photos,
-- giveaway-photos, promo-photos, and stadium-maps: each had a SELECT
-- policy on storage.objects open to the `public` role, letting anyone
-- (even unauthenticated) call .list() and enumerate every file in the
-- bucket. Public buckets don't need a SELECT policy at all for normal
-- image display — getPublicUrl() just builds a URL string and doesn't
-- consult RLS; the public bucket serves that URL directly, bypassing
-- object-level RLS entirely (see Supabase Storage Access Control docs).
--
-- Confirmed via grep that only stadium-maps' code path calls
-- .list() (app/stadiums/[id]/page.tsx, to check if a team's map
-- image exists before showing it) — achievement/food/giveaway/promo
-- never call .list()/.download(), only .upload(), .getPublicUrl(),
-- and .remove(). So:
--   - achievement-photos / food-photos / giveaway-photos / promo-photos:
--     SELECT policy dropped entirely (unused, was pure listing exposure).
--   - stadium-maps: SELECT policy kept (app needs .list()) but scoped
--     to `authenticated` instead of `public`, so at least an
--     unauthenticated caller can't enumerate the bucket.
-- ============================================================

DROP POLICY IF EXISTS "Public read for achievement photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read for food photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read for giveaway photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read for promo photos" ON storage.objects;

DROP POLICY IF EXISTS "Public read for stadium maps" ON storage.objects;
CREATE POLICY "Public read for stadium maps"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stadium-maps');
