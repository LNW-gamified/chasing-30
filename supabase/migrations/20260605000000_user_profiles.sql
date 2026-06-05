-- user_profiles was created by a prior branch with different column names.
-- This file documents the final schema after renaming via 20260605000001_user_profiles_rename_columns.sql

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id                     text PRIMARY KEY,
  display_name                text,
  home_city                   text,
  home_state                  text,
  notification_game_day       boolean NOT NULL DEFAULT true,
  notification_trip_countdown boolean NOT NULL DEFAULT true,
  notification_milestones     boolean NOT NULL DEFAULT true,
  show_local_time             boolean NOT NULL DEFAULT false,
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own profile" ON user_profiles
  FOR ALL USING (auth.uid()::text = user_id);
