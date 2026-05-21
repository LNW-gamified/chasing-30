CREATE TABLE IF NOT EXISTS achievement_claims (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  stadium_visit_id uuid REFERENCES stadium_visits(id) ON DELETE SET NULL,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  extra_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS achievement_claims_achievement_id_idx
  ON achievement_claims(achievement_id);

ALTER TABLE achievement_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read achievement_claims"
  ON achievement_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert achievement_claims"
  ON achievement_claims FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update achievement_claims"
  ON achievement_claims FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete achievement_claims"
  ON achievement_claims FOR DELETE TO authenticated USING (true);
