-- ============================================================
-- stadium-maps bucket: allow public read of object listings
--
-- The stadium-maps bucket was created with public:true, which lets
-- anyone fetch a file directly by URL. But listing files (used to
-- check whether a given stadium has a map uploaded before showing
-- the section) is governed separately by RLS on storage.objects.
-- Every other public bucket (food-photos, giveaway-photos, etc.)
-- already had this policy; stadium-maps was missing it, which is
-- why uploaded maps weren't showing up in the app.
-- ============================================================

CREATE POLICY "Public read for stadium maps"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stadium-maps');
