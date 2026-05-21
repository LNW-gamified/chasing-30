-- Storage bucket for bobblehead (and future achievement) photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'achievement-photos',
  'achievement-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload achievement photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'achievement-photos');

CREATE POLICY "Public read for achievement photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'achievement-photos');

CREATE POLICY "Authenticated users can delete achievement photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'achievement-photos');
