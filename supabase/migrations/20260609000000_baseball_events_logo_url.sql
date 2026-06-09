-- Add logo_url to baseball_events for card icon display (separate from image_url background photo)
ALTER TABLE baseball_events ADD COLUMN IF NOT EXISTS logo_url TEXT;
