-- Applied directly to the live database earlier (not through a migration
-- file), so this documents it for repo history.
--
-- Root cause of every "Photo upload failed: new row violates row-level
-- security policy" error on giveaways, souvenirs, memorabilia, and food
-- photos: Supabase Storage's upload flow does an INSERT followed by a
-- RETURNING * to hand the client back the new object's metadata. Without
-- a matching SELECT policy on the bucket, that read-back step gets
-- blocked by RLS, and the entire upload is reported as a row-level
-- security violation, even when the actual INSERT would have succeeded.
--
-- achievement-photos, giveaway-photos, food-photos, and promo-photos only
-- ever had INSERT/DELETE policies, never SELECT. game-photos and
-- stadium-maps already had this right, which is why those never had the
-- problem.
--
-- Confirmed via the browser's real network response before this fix:
-- {"statusCode":"403","error":"Unauthorized","message":"new row violates
-- row-level security policy","code":"AccessDenied"}

CREATE POLICY IF NOT EXISTS "Authenticated users can view achievement photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'achievement-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can view giveaway photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'giveaway-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can view food photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'food-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can view promo photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'promo-photos');
