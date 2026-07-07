export const RANK_TIERS = [
  { name: 'Sandlot Kid',       minPts: 0,    icon: '⚾', description: 'Where every legend begins' },
  { name: 'Minor Leaguer',     minPts: 75,   icon: '🚌', description: 'Working your way up' },
  { name: 'September Call-Up', minPts: 200,  icon: '📈', description: 'The bigs are calling' },
  { name: 'Rotation Ace',      minPts: 400,  icon: '🔥', description: "You're the real deal" },
  { name: 'All-Star',          minPts: 700,  icon: '⭐', description: 'The fans voted you in' },
  { name: 'Hall of Famer',     minPts: 1200, icon: '🏆', description: 'Your plaque is waiting' },
]

export const MILESTONE_POINTS: Record<string, number> = {
  al_east: 50, al_central: 50, al_west: 50, nl_east: 50, nl_central: 50, nl_west: 50,
  american_league: 100, national_league: 100,
  world_series_attendance: 150, all_star_attendance: 100, postseason_attendance: 100,
  spring_training_attendance: 50,
  hall_of_fame_visit: 75, field_of_dreams_visit: 75,
  louisville_slugger_visit: 50, rawlings_factory_visit: 50,
  negro_leagues_visit: 75, doubleday_visit: 50,
  international_game: 100, historic_ballparks_all: 200,
  full_experience: 100,
  walk_off_witness: 75, double_walk_off: 125,
  no_hit_wonder: 150, perfect_day: 300, committee_work: 100,
  extra_credit: 50, marathon_man: 75,
  lights_out: 50, grand_slam_witness: 75,
  full_cycle: 150, history_maker: 200,
  run_factory: 50, pitchers_duel: 75,
  bl_derby_day: 75, bl_field_of_dreams_game: 75,
  bl_cactus_league: 50, bl_grapefruit_league: 50,
  bl_fenway_tour: 50, bl_wrigley_tour: 50, bl_yankee_tour: 50,
  bl_dodger_tour: 50, bl_oracle_tour: 50, bl_babe_ruth_museum: 75,
  bl_cape_cod_league: 75,
  bl_arizona_fall_league: 75, bl_college_world_series: 75,
  bl_grand_tour: 100, bl_full_circuit: 100, bl_baseball_lifer: 150,
  opening_day_attendance: 75, double_header_day: 100, hat_trick: 100,
  rain_delay_survivor: 50, bl_rickwood_field: 75, bl_jackie_robinson_museum: 75,
  bl_london_series: 150, bl_mexico_series: 150, bl_puerto_rico_series: 150,
  bl_banana_ball: 75,
  // Manual/static experiences (components/MilestoneGrid.tsx "Manual" cards) —
  // these have no auto-tracked equivalent, so points are assigned here using
  // the same 50/75/100 scale rather than a separate system.
  bobblehead: 50,
  foul_ball: 100, autograph: 100, met_player: 100,
  jumbotron: 75, seventh_inning: 50, fireworks_night: 50,
  rivalry_game: 50, enemy_territory: 75, rain_delay: 75,
  early_bird: 50, jersey_day: 50, night_owl: 50,
}

export function getRank(pts: number) {
  return [...RANK_TIERS].reverse().find(r => pts >= r.minPts) ?? RANK_TIERS[0]
}

export function getNextRank(pts: number) {
  return RANK_TIERS.find(r => r.minPts > pts) ?? null
}
