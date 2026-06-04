-- Promotion data fetched from MLB Stats API when a game is selected on a trip stop.
-- promotions: array of promotion names for the selected game
-- promotion_photos: JSONB map of { "Promo Name": "https://storage-url/..." }

ALTER TABLE trip_stops
  ADD COLUMN IF NOT EXISTS promotions TEXT[];

ALTER TABLE trip_stops
  ADD COLUMN IF NOT EXISTS promotion_photos JSONB;

-- Storage bucket for promotion photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promo-photos',
  'promo-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload promo photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'promo-photos');

CREATE POLICY "Public read for promo photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'promo-photos');

CREATE POLICY "Authenticated users can delete promo photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'promo-photos');
