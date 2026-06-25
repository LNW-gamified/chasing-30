-- Add giveaway_items column to baseball_life_entries
ALTER TABLE baseball_life_entries
  ADD COLUMN IF NOT EXISTS giveaway_items JSONB DEFAULT '[]';

-- Storage bucket for giveaway photos (minor league game entries)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'giveaway-photos',
  'giveaway-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Authenticated users can upload giveaway photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'giveaway-photos');

CREATE POLICY IF NOT EXISTS "Public read for giveaway photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'giveaway-photos');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete giveaway photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'giveaway-photos');
