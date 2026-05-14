import type { Milestone, StadiumVisit, Stadium, SpecialEvent } from '@/types'

function visitedIds(visits: StadiumVisit[]): Set<string> {
  return new Set(visits.map((v) => v.stadium_id))
}

function stadiumsInDivision(
  stadiums: Stadium[],
  league: string,
  division: string
) {
  return stadiums.filter((s) => s.league === league && s.division === division)
}

function allVisited(
  group: Stadium[],
  visited: Set<string>
): boolean {
  return group.every((s) => visited.has(s.id))
}

export const MILESTONES: Milestone[] = [
  {
    id: 'first_game',
    name: 'First Pitch',
    description: 'Attend your first MLB game',
    icon: '⚾',
    check: (visits) => visits.length >= 1,
  },
  {
    id: 'five_stadiums',
    name: 'Road Warrior',
    description: 'Visit 5 different stadiums',
    icon: '🚗',
    check: (visits) => visitedIds(visits).size >= 5,
  },
  {
    id: 'ten_stadiums',
    name: 'Double Digits',
    description: 'Visit 10 different stadiums',
    icon: '🔟',
    check: (visits) => visitedIds(visits).size >= 10,
  },
  {
    id: 'fifteen_stadiums',
    name: 'Halfway There',
    description: 'Visit 15 different stadiums',
    icon: '🏟️',
    check: (visits) => visitedIds(visits).size >= 15,
  },
  {
    id: 'twenty_stadiums',
    name: 'On Deck',
    description: 'Visit 20 different stadiums',
    icon: '🎯',
    check: (visits) => visitedIds(visits).size >= 20,
  },
  {
    id: 'twentyfive_stadiums',
    name: 'Final Stretch',
    description: 'Visit 25 different stadiums',
    icon: '🏃',
    check: (visits) => visitedIds(visits).size >= 25,
  },
  {
    id: 'all_stadiums',
    name: 'The Full 30',
    description: 'Visit all 30 MLB stadiums',
    icon: '🏆',
    check: (visits) => visitedIds(visits).size >= 30,
  },
  {
    id: 'al_east',
    name: 'AL East Complete',
    description: 'Visit all 5 AL East stadiums',
    icon: '🗽',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'AL', 'East'), visitedIds(visits)),
  },
  {
    id: 'al_central',
    name: 'AL Central Complete',
    description: 'Visit all 5 AL Central stadiums',
    icon: '🌽',
    check: (visits, stadiums) =>
      allVisited(
        stadiumsInDivision(stadiums, 'AL', 'Central'),
        visitedIds(visits)
      ),
  },
  {
    id: 'al_west',
    name: 'AL West Complete',
    description: 'Visit all 5 AL West stadiums',
    icon: '🌵',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'AL', 'West'), visitedIds(visits)),
  },
  {
    id: 'nl_east',
    name: 'NL East Complete',
    description: 'Visit all 5 NL East stadiums',
    icon: '🦅',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'NL', 'East'), visitedIds(visits)),
  },
  {
    id: 'nl_central',
    name: 'NL Central Complete',
    description: 'Visit all 5 NL Central stadiums',
    icon: '🐻',
    check: (visits, stadiums) =>
      allVisited(
        stadiumsInDivision(stadiums, 'NL', 'Central'),
        visitedIds(visits)
      ),
  },
  {
    id: 'nl_west',
    name: 'NL West Complete',
    description: 'Visit all 5 NL West stadiums',
    icon: '🌉',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'NL', 'West'), visitedIds(visits)),
  },
  {
    id: 'american_league',
    name: 'Junior Circuit',
    description: 'Visit all 15 American League stadiums',
    icon: '🇺🇸',
    check: (visits, stadiums) =>
      allVisited(
        stadiums.filter((s) => s.league === 'AL'),
        visitedIds(visits)
      ),
  },
  {
    id: 'national_league',
    name: 'Senior Circuit',
    description: 'Visit all 15 National League stadiums',
    icon: '⭐',
    check: (visits, stadiums) =>
      allVisited(
        stadiums.filter((s) => s.league === 'NL'),
        visitedIds(visits)
      ),
  },
  {
    id: 'east_coast',
    name: 'East Coast Tour',
    description: 'Visit all East division stadiums (AL + NL East)',
    icon: '🌅',
    check: (visits, stadiums) => {
      const east = stadiums.filter((s) => s.division === 'East')
      return allVisited(east, visitedIds(visits))
    },
  },
  {
    id: 'midwest',
    name: 'Midwest Swing',
    description: 'Visit all Central division stadiums (AL + NL Central)',
    icon: '🌾',
    check: (visits, stadiums) => {
      const central = stadiums.filter((s) => s.division === 'Central')
      return allVisited(central, visitedIds(visits))
    },
  },
  {
    id: 'west_coast',
    name: 'West Coast Wanderer',
    description: 'Visit all West division stadiums (AL + NL West)',
    icon: '🌊',
    check: (visits, stadiums) => {
      const west = stadiums.filter((s) => s.division === 'West')
      return allVisited(west, visitedIds(visits))
    },
  },
  {
    id: 'five_games',
    name: 'Season Ticket Holder',
    description: 'Attend 5 total games',
    icon: '🎟️',
    check: (visits) => visits.length >= 5,
  },
  {
    id: 'ten_games',
    name: 'Superfan',
    description: 'Attend 10 total games',
    icon: '🤩',
    check: (visits) => visits.length >= 10,
  },

  // Special event milestones
  {
    id: 'first_special_event',
    name: 'Beyond the Diamond',
    description: 'Log your first special baseball experience',
    icon: '🌟',
    check: (_v, _s, events) => (events ?? []).length >= 1,
  },
  {
    id: 'world_series_attendance',
    name: 'World Series Witness',
    description: 'Attend a World Series game',
    icon: '🏆',
    check: (_v, _s, events) => (events ?? []).some((e: SpecialEvent) => e.event_type === 'world_series'),
  },
  {
    id: 'all_star_attendance',
    name: 'Midsummer Classic',
    description: 'Attend the MLB All-Star Game',
    icon: '⭐',
    check: (_v, _s, events) => (events ?? []).some((e: SpecialEvent) => e.event_type === 'all_star_game'),
  },
  {
    id: 'postseason_attendance',
    name: 'October Baseball',
    description: 'Attend any MLB postseason game',
    icon: '🍂',
    check: (_v, _s, events) => (events ?? []).some((e: SpecialEvent) => e.event_type === 'postseason'),
  },
  {
    id: 'spring_training_attendance',
    name: 'Spring Awakening',
    description: 'Attend a spring training game',
    icon: '🌸',
    check: (_v, _s, events) => (events ?? []).some((e: SpecialEvent) => e.event_type === 'spring_training'),
  },
  {
    id: 'minor_league_attendance',
    name: 'Minor League Maven',
    description: 'Attend a minor league game',
    icon: '🌱',
    check: (_v, _s, events) => (events ?? []).some((e: SpecialEvent) => e.event_type === 'minor_league'),
  },
  {
    id: 'hall_of_fame_visit',
    name: 'Cooperstown Pilgrim',
    description: 'Visit the National Baseball Hall of Fame',
    icon: '🏛️',
    check: (_v, _s, events) =>
      (events ?? []).some((e: SpecialEvent) =>
        e.event_type === 'historic_ballpark' && e.venue_name === 'National Baseball Hall of Fame'
      ),
  },
  {
    id: 'field_of_dreams_visit',
    name: 'Build It, They Come',
    description: 'Visit Field of Dreams in Iowa',
    icon: '🌽',
    check: (_v, _s, events) =>
      (events ?? []).some((e: SpecialEvent) =>
        e.event_type === 'historic_ballpark' && e.venue_name === 'Field of Dreams'
      ),
  },
  {
    id: 'international_game',
    name: 'Global Ambassador',
    description: 'Attend an international MLB game',
    icon: '🌍',
    check: (_v, _s, events) => (events ?? []).some((e: SpecialEvent) => e.event_type === 'international'),
  },
  {
    id: 'historic_ballparks_all',
    name: 'Baseball Historian',
    description: 'Visit all 5 historic baseball destinations',
    icon: '📜',
    check: (_v, _s, events) => {
      const HISTORIC_VENUES = [
        'Louisville Slugger Museum & Factory',
        'National Baseball Hall of Fame',
        'Negro Leagues Baseball Museum',
        'Field of Dreams',
        'Rickwood Field',
      ]
      const visited = new Set(
        (events ?? [])
          .filter((e: SpecialEvent) => e.event_type === 'historic_ballpark' && e.venue_name)
          .map((e: SpecialEvent) => e.venue_name as string)
      )
      return HISTORIC_VENUES.every((v) => visited.has(v))
    },
  },

  // ── Game-event achievements (auto-detected via MLB API) ────────────────
  {
    id: 'walk_off_witness',
    name: 'Walk-Off Witness',
    description: 'Witness a walk-off win in person',
    icon: '🎉',
    check: (visits) => visits.some(v => v.game_events?.includes('walk_off')),
  },
  {
    id: 'double_walk_off',
    name: 'Walk-Off Addict',
    description: 'Witness 2 walk-off wins in person',
    icon: '🔁',
    check: (visits) => visits.filter(v => v.game_events?.includes('walk_off')).length >= 2,
  },
  {
    id: 'no_hit_wonder',
    name: 'No-Hit Wonder',
    description: 'Witness a no-hitter (any kind) in person',
    icon: '🙈',
    check: (visits) => visits.some(v => v.game_events?.includes('no_hitter')),
  },
  {
    id: 'perfect_day',
    name: 'Perfect Day',
    description: 'Witness a perfect game in person',
    icon: '💎',
    check: (visits) => visits.some(v => v.game_events?.includes('perfect_game')),
  },
  {
    id: 'committee_work',
    name: 'Committee Work',
    description: 'Witness a combined no-hitter in person',
    icon: '👥',
    check: (visits) => visits.some(v => v.game_events?.includes('combined_no_hitter')),
  },
  {
    id: 'extra_credit',
    name: 'Extra Credit',
    description: 'Attend a game that goes to extra innings',
    icon: '⏰',
    check: (visits) => visits.some(v => v.game_events?.includes('extra_innings')),
  },
  {
    id: 'marathon_man',
    name: 'Marathon Man',
    description: 'Survive a 12+ inning marathon',
    icon: '🏃‍♂️',
    check: (visits) => visits.some(v => v.game_events?.includes('twelve_plus_innings')),
  },
  {
    id: 'lights_out',
    name: 'Lights Out',
    description: 'Watch the home team blank their opponent',
    icon: '💡',
    check: (visits) => visits.some(v => v.game_events?.includes('shutout')),
  },
  {
    id: 'grand_slam_witness',
    name: 'Slam Dunk',
    description: 'Witness a grand slam in person',
    icon: '💥',
    check: (visits) => visits.some(v => v.game_events?.includes('grand_slam')),
  },
  {
    id: 'full_cycle',
    name: 'Full Cycle',
    description: 'Witness a hit-for-the-cycle in person',
    icon: '🔄',
    check: (visits) => visits.some(v => v.game_events?.includes('cycle')),
  },
  {
    id: 'history_maker',
    name: 'History Maker',
    description: 'Witness a milestone career home run in person',
    icon: '📜',
    check: (visits) => visits.some(v => v.game_events?.includes('milestone_hr')),
  },
  {
    id: 'run_factory',
    name: 'Run Factory',
    description: 'Attend a game where one team scores 15+ runs',
    icon: '🏭',
    check: (visits) => visits.some(v => v.game_events?.includes('run_factory')),
  },
  {
    id: 'pitchers_duel',
    name: "Pitcher's Duel",
    description: 'Watch a 1-0 masterpiece in person',
    icon: '🎯',
    check: (visits) => visits.some(v => v.game_events?.includes('pitchers_duel')),
  },
]
