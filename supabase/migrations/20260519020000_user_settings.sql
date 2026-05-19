CREATE TABLE IF NOT EXISTS user_settings (
  user_id  text PRIMARY KEY,
  favorite_team_abbr text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid()::text = user_id);
