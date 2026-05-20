ALTER TABLE stadium_visits
ADD COLUMN IF NOT EXISTS boxscore_data JSONB;
