ALTER TABLE stadium_visits
  ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';

UPDATE stadium_visits
  SET photos = ARRAY[photo_url]
  WHERE photo_url IS NOT NULL AND (photos IS NULL OR photos = '{}');
