ALTER TABLE user_profiles
  RENAME COLUMN notif_morning_briefing TO notification_game_day;

ALTER TABLE user_profiles
  RENAME COLUMN notif_trip_countdown TO notification_trip_countdown;

ALTER TABLE user_profiles
  RENAME COLUMN notif_milestone TO notification_milestones;

ALTER TABLE user_profiles
  RENAME COLUMN show_stadium_time TO show_local_time;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS home_state text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
