CREATE TABLE IF NOT EXISTS milb_tickets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stadium_id UUID REFERENCES minor_league_stadiums(id) ON DELETE CASCADE,
  game_pk    BIGINT NOT NULL,
  game_date  DATE NOT NULL,
  opponent   TEXT NOT NULL,
  time_str   TEXT,
  promotions TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, game_pk)
);

ALTER TABLE milb_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tickets"
  ON milb_tickets FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
