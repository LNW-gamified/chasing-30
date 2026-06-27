INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'game-photos',
  'game-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Authenticated users can upload game photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can view their own game photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'game-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete game photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'game-photos');
