-- ============================================================
-- milb_team_logos: opponent logo lookup, separate from the
-- stadium-chasing list
--
-- minor_league_stadiums is the "stadiums I'm actually tracking
-- as a chase goal" table, and the Ballparks > Minor League page
-- shows every row in it unfiltered. Farm System Today needs
-- logos for opponent teams too (Reno Aces, Las Vegas Aviators,
-- etc.), but those aren't stadiums Chris is chasing, they're
-- just needed for scoreboard display. Mixing them into
-- minor_league_stadiums would make them incorrectly show up as
-- trackable stadiums. This table keeps that fully separate.
--
-- Pre-populated with the real division rosters for Tacoma's
-- (PCL West), Arkansas's (Texas League North), and Inland
-- Empire's (Cal League South) divisions, verified directly
-- against MLB's Stats API. logo_url starts null for each and
-- gets filled in as real images are sourced and uploaded.
-- ============================================================

CREATE TABLE IF NOT EXISTS milb_team_logos (
  milb_team_id integer PRIMARY KEY,
  team_name    text NOT NULL,
  logo_url     text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE milb_team_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read milb team logos"
ON milb_team_logos FOR SELECT
TO authenticated
USING (true);

INSERT INTO milb_team_logos (milb_team_id, team_name) VALUES
  (2310, 'Reno Aces'),
  (400, 'Las Vegas Aviators'),
  (105, 'Sacramento River Cats'),
  (561, 'Salt Lake Bees'),
  (260, 'Tulsa Drillers'),
  (1350, 'Northwest Arkansas Naturals'),
  (440, 'Springfield Cardinals'),
  (3898, 'Wichita Wind Surge'),
  (526, 'Rancho Cucamonga Quakes'),
  (6482, 'Ontario Tower Buzzers'),
  (103, 'Lake Elsinore Storm')
ON CONFLICT (milb_team_id) DO NOTHING;
