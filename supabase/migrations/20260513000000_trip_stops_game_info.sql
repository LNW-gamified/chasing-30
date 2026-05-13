ALTER TABLE trip_stops
ADD COLUMN IF NOT EXISTS game_time        text,
ADD COLUMN IF NOT EXISTS opponent         text,
ADD COLUMN IF NOT EXISTS opponent_team_id integer;
