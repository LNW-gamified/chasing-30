-- ============================================================
-- Special Visits table
-- Covers everything outside regular MLB home games:
-- Minor League, Spring Training, International, All-Star,
-- World Series, Playoffs, Stadium/Factory Tours, College,
-- Independent League, and Other Special Events.
-- ============================================================

CREATE TABLE IF NOT EXISTS special_visits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_type          TEXT NOT NULL CHECK (visit_type IN (
                        'minor_league', 'spring_training', 'international',
                        'all_star', 'world_series', 'playoff',
                        'stadium_tour', 'college', 'independent', 'other'
                      )),
  venue               TEXT NOT NULL,
  city                TEXT,
  state               TEXT,
  visit_date          DATE NOT NULL,
  teams               TEXT,
  description         TEXT,
  notes               TEXT,
  is_mlb_event        BOOLEAN NOT NULL DEFAULT false,
  game_pk             INTEGER,
  ticket_section      TEXT,
  ticket_row          TEXT,
  ticket_seats        TEXT[],
  ticket_confirmation TEXT,
  moments             TEXT[],
  photos              TEXT[],
  game_data           JSONB,
  attendance          INTEGER,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE special_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read special_visits"
  ON special_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert special_visits"
  ON special_visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update special_visits"
  ON special_visits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete special_visits"
  ON special_visits FOR DELETE TO authenticated USING (true);
