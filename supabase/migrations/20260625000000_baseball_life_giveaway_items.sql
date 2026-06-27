ALTER TABLE baseball_life_entries
  ADD COLUMN IF NOT EXISTS giveaway_items JSONB DEFAULT '[]';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'giveaway-photos',
  'giveaway-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload giveaway photos' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload giveaway photos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'giveaway-photos');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read for giveaway photos' AND tablename = 'objects') THEN
    CREATE POLICY "Public read for giveaway photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'giveaway-photos');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete giveaway photos' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can delete giveaway photos"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'giveaway-photos');
  END IF;
END $$;
