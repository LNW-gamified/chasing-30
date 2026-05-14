-- Feature: Game Events (MLB API auto-detectable game events)
-- Adds game_events TEXT[] column to stadium_visits and retroactively
-- populates it from stats already stored in the database.

ALTER TABLE stadium_visits ADD COLUMN IF NOT EXISTS game_events TEXT[] DEFAULT '{}';

-- Retroactively compute game events for visits that already have stats
UPDATE stadium_visits
SET game_events = ARRAY_REMOVE(ARRAY[

  -- Walk-off: home team wins and scored in the bottom of the last inning
  CASE
    WHEN home_runs IS NOT NULL AND away_runs IS NOT NULL
      AND home_runs > away_runs
      AND inning_scores IS NOT NULL
      AND jsonb_array_length(inning_scores) > 0
      AND COALESCE(
        (inning_scores->((jsonb_array_length(inning_scores))-1)->>'home')::int,
        0
      ) > 0
    THEN 'walk_off'
  END,

  -- Shutout: home team blanks the visitors
  CASE
    WHEN away_runs IS NOT NULL AND away_runs = 0
      AND home_runs IS NOT NULL AND home_runs > 0
    THEN 'shutout'
  END,

  -- No-hitter: 0 away hits (combined vs solo indistinguishable from stored data)
  CASE
    WHEN away_hits IS NOT NULL AND away_hits = 0
    THEN 'no_hitter'
  END,

  -- Extra innings (10th inning or beyond)
  CASE
    WHEN inning_scores IS NOT NULL AND jsonb_array_length(inning_scores) > 9
    THEN 'extra_innings'
  END,

  -- Marathon: 12+ innings
  CASE
    WHEN inning_scores IS NOT NULL AND jsonb_array_length(inning_scores) >= 12
    THEN 'twelve_plus_innings'
  END,

  -- Run factory: either team scores 15+
  CASE
    WHEN GREATEST(COALESCE(home_runs, 0), COALESCE(away_runs, 0)) >= 15
    THEN 'run_factory'
  END,

  -- Pitcher's duel: 1-0 final score
  CASE
    WHEN home_runs IS NOT NULL AND away_runs IS NOT NULL
      AND home_runs + away_runs = 1
    THEN 'pitchers_duel'
  END

], NULL)
WHERE stats_auto_populated = true;

-- Note: perfect_game, combined_no_hitter, grand_slam, cycle, and milestone_hr
-- require live feed data and will only be detected on new autofill runs.
