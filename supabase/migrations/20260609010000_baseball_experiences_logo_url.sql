-- Add logo_url to baseball_experiences for card icon display (separate from image_url background photo)
ALTER TABLE baseball_experiences ADD COLUMN IF NOT EXISTS logo_url TEXT;
