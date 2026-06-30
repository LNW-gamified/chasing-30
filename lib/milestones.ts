import type { Milestone, StadiumVisit, Stadium, SpecialEvent, BaseballLifeEntry, DestinationVisit } from '@/types'

function visitedIds(visits: StadiumVisit[]): Set<string> {
  return new Set(visits.map((v) => v.stadium_id))
}

function stadiumsInDivision(stadiums: Stadium[], league: string, division: string) {
  return stadiums.filter((s) => s.league === league && s.division === division)
}

function allVisited(group: Stadium[], visited: Set<string>): boolean {
  return group.every((s) => visited.has(s.id))
}

function milbCount(events: SpecialEvent[] | undefined, ble: BaseballLifeEntry[] | undefined): number {
  return (events ?? []).filter(e => e.event_type === 'minor_league').length +
         (ble   ?? []).filter(e => e.category   === 'minor_league').length
}

export const MILESTONES: Milestone[] = [

  // ── LADDER: Stadium Explorer ────────────────────────────────────────────────
  {
    id: 'stadium_explorer',
    name: 'Stadium Explorer',
    description: 'Visit MLB stadiums across the country',
    icon: '🏟️',
    tiers: [
      { threshold: 1,  label: 'First Pitch',   points: 25  },
      { threshold: 5,  label: 'Road Warrior',   points: 50  },
      { threshold: 10, label: 'Double Digits',  points: 75  },
      { threshold: 15, label: 'Halfway There',  points: 100 },
      { threshold: 20, label: 'On Deck',        points: 125 },
      { threshold: 25, label: 'Final Stretch',  points: 150 },
      { threshold: 30, label: 'The Full 30',    points: 300 },
    ],
    getValue: (visits) => new Set(visits.map(v => v.stadium_id)).size,
    check:    (visits) => new Set(visits.map(v => v.stadium_id)).size >= 1,
  },

  // ── LADDER: Games Attended ──────────────────────────────────────────────────
  {
    id: 'games_attended',
    name: 'Games Attended',
    description: 'Total MLB games attended in person',
    icon: '🎟️',
    tiers: [
      { threshold: 1,   label: 'First Game',           points: 25  },
      { threshold: 5,   label: 'Season Ticket Holder', points: 35  },
      { threshold: 10,  label: 'Superfan',             points: 50  },
      { threshold: 25,  label: 'Die-Hard',             points: 75  },
      { threshold: 50,  label: 'Lifer',                points: 100 },
      { threshold: 100, label: 'Legend',               points: 200 },
    ],
    getValue: (visits) => visits.length,
    check:    (visits) => visits.length >= 1,
  },

  // ── Division & League achievements ──────────────────────────────────────────
  {
    id: 'al_west',
    name: 'AL West Complete',
    description: 'Visit all 5 AL West stadiums',
    icon: '🌵',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'AL', 'West'), visitedIds(visits)),
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
      allVisited(stadiumsInDivision(stadiums, 'AL', 'Central'), visitedIds(visits)),
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
      allVisited(stadiumsInDivision(stadiums, 'NL', 'Central'), visitedIds(visits)),
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
      allVisited(stadiums.filter((s) => s.league === 'AL'), visitedIds(visits)),
  },
  {
    id: 'national_league',
    name: 'Senior Circuit',
    description: 'Visit all 15 National League stadiums',
    icon: '⭐',
    check: (visits, stadiums) =>
      allVisited(stadiums.filter((s) => s.league === 'NL'), visitedIds(visits)),
  },

  // ── Special events ──────────────────────────────────────────────────────────
  {
    id: 'world_series_attendance',
    name: 'World Series Witness',
    description: 'Attend a World Series game',
    icon: '🏆',
    check: (_v, _s, events, ble, destinationVisits) =>
      (events ?? []).some((e: SpecialEvent) => e.event_type === 'world_series') ||
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'mlb_special_event' && e.event_type?.toLowerCase().includes('world series')
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) => (dv.destination as any)?.slug === 'world_series'),
  },
  {
    id: 'all_star_attendance',
    name: 'Midsummer Classic',
    description: 'Attend the MLB All-Star Game',
    icon: '⭐',
    check: (_v, _s, events, ble, destinationVisits) =>
      (events ?? []).some((e: SpecialEvent) => e.event_type === 'all_star_game') ||
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'mlb_special_event' && (
          e.event_type?.toLowerCase().includes('all-star') ||
          e.event_type?.toLowerCase().includes('all star')
        )
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) => (dv.destination as any)?.slug === 'all_star_game'),
  },
  {
    id: 'postseason_attendance',
    name: 'October Baseball',
    description: 'Attend any MLB postseason game',
    icon: '🍂',
    check: (_v, _s, events, ble, destinationVisits) =>
      (events ?? []).some((e: SpecialEvent) => e.event_type === 'postseason') ||
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'mlb_special_event' && ['Wild Card', 'ALDS', 'NLDS', 'ALCS', 'NLCS', 'Playoff', 'World Series'].some(
          t => e.event_type?.includes(t)
        )
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) =>
        ['wild_card_game', 'division_series', 'championship_series', 'world_series'].includes((dv.destination as any)?.slug)
      ),
  },
  {
    id: 'spring_training_attendance',
    name: 'Spring Awakening',
    description: 'Attend a spring training game',
    icon: '🌸',
    check: (_v, _s, events, ble) =>
      (events ?? []).some((e: SpecialEvent) => e.event_type === 'spring_training') ||
      (ble ?? []).some((e: BaseballLifeEntry) => e.category === 'spring_training'),
  },

  // ── LADDER: Minor League Explorer ───────────────────────────────────────────
  {
    id: 'minor_league_explorer',
    name: 'Minor League Explorer',
    description: 'Attend minor league games across the country',
    icon: '🌱',
    tiers: [
      { threshold: 1,  label: 'First MiLB Game',     points: 25  },
      { threshold: 5,  label: 'MiLB Regular',         points: 50  },
      { threshold: 10, label: 'Farm System Fan',       points: 75  },
      { threshold: 25, label: 'Minor League Maven',    points: 100 },
      { threshold: 50, label: 'MiLB Devotee',          points: 150 },
    ],
    getValue: (_v, _s, events, ble) => milbCount(events, ble),
    check:    (_v, _s, events, ble) => milbCount(events, ble) >= 1,
  },

  // ── Game-event achievements (auto-detected via MLB API) ─────────────────────
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
    description: 'Watch the home team throw a shutout in person',
    icon: '💡',
    check: (visits) => visits.some(v => v.game_events?.includes('shutout')),
  },
  {
    id: 'grand_slam_witness',
    name: 'Grand Salami',
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

  // ── Destinations & pilgrimages ──────────────────────────────────────────────
  {
    id: 'hall_of_fame_visit',
    name: 'Cooperstown Pilgrim',
    description: 'Visit the National Baseball Hall of Fame',
    icon: '🏛️',
    check: (_v, _s, events, ble, destinationVisits) =>
      (events ?? []).some((e: SpecialEvent) =>
        e.event_type === 'historic_ballpark' && e.venue_name === 'National Baseball Hall of Fame'
      ) ||
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'pilgrimage' && e.venue?.toLowerCase().includes('hall of fame')
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) => (dv.destination as any)?.slug === 'hall_of_fame'),
  },
  {
    id: 'field_of_dreams_visit',
    name: 'Build It, They Come',
    description: 'Visit Field of Dreams in Iowa',
    icon: '🌽',
    check: (_v, _s, events, ble, destinationVisits) =>
      (events ?? []).some((e: SpecialEvent) =>
        e.event_type === 'historic_ballpark' && e.venue_name === 'Field of Dreams'
      ) ||
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'pilgrimage' && (
          e.venue?.toLowerCase().includes('field of dreams') ||
          e.event_type?.toLowerCase().includes('field of dreams')
        )
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) =>
        ['field_of_dreams', 'dreams_game'].includes((dv.destination as any)?.slug)
      ),
  },
  {
    id: 'louisville_slugger_visit',
    name: 'The Bat Factory',
    description: 'Visit the Louisville Slugger Museum and Factory',
    icon: '🪵',
    check: (_v, _s, events, ble, destinationVisits) =>
      (events ?? []).some((e: SpecialEvent) =>
        e.event_type === 'historic_ballpark' && e.venue_name?.toLowerCase().includes('louisville slugger')
      ) ||
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'pilgrimage' && (
          e.venue?.toLowerCase().includes('louisville slugger') ||
          e.event_type?.toLowerCase().includes('louisville slugger')
        )
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) => (dv.destination as any)?.slug === 'louisville_slugger'),
  },
  {
    id: 'rawlings_factory_visit',
    name: 'Raw Material',
    description: 'Visit the Rawlings Baseball Factory',
    icon: '⚾',
    check: (_v, _s, events, ble, destinationVisits) =>
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'pilgrimage' && (
          e.venue?.toLowerCase().includes('rawlings') ||
          e.event_type?.toLowerCase().includes('rawlings')
        )
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) => (dv.destination as any)?.slug === 'rawlings_factory'),
  },
  {
    id: 'negro_leagues_visit',
    name: 'A League of Their Own',
    description: 'Visit the Negro Leagues Baseball Museum',
    icon: '✊',
    check: (_v, _s, events, ble, destinationVisits) =>
      (events ?? []).some((e: SpecialEvent) =>
        e.event_type === 'historic_ballpark' && e.venue_name === 'Negro Leagues Baseball Museum'
      ) ||
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'pilgrimage' && (
          e.venue?.toLowerCase().includes('negro leagues') ||
          e.event_type?.toLowerCase().includes('negro leagues')
        )
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) => (dv.destination as any)?.slug === 'negro_leagues'),
  },
  {
    id: 'doubleday_visit',
    name: 'Where Baseball Was Born',
    description: 'Visit Doubleday Field in Cooperstown, NY',
    icon: '🌾',
    check: (_v, _s, events, ble, destinationVisits) =>
      (events ?? []).some((e: SpecialEvent) =>
        e.event_type === 'historic_ballpark' && e.venue_name?.toLowerCase().includes('doubleday')
      ) ||
      (ble ?? []).some((e: BaseballLifeEntry) =>
        e.category === 'pilgrimage' && (
          e.venue?.toLowerCase().includes('doubleday') ||
          e.event_type?.toLowerCase().includes('doubleday')
        )
      ) ||
      (destinationVisits ?? []).some((dv: DestinationVisit) => (dv.destination as any)?.slug === 'doubleday_field'),
  },
  {
    id: 'international_game',
    name: 'Global Ambassador',
    description: 'Attend an international MLB game',
    icon: '🌍',
    check: (_v, _s, events) =>
      (events ?? []).some((e: SpecialEvent) => e.event_type === 'international'),
  },
  {
    id: 'historic_ballparks_all',
    name: 'Baseball Historian',
    description: 'Visit all 5 historic baseball destinations',
    icon: '📜',
    check: (_v, _s, events, ble) => {
      const HISTORIC_VENUES = [
        'Louisville Slugger Museum & Factory',
        'National Baseball Hall of Fame',
        'Negro Leagues Baseball Museum',
        'Field of Dreams',
        'Rickwood Field',
      ]
      const visited = new Set<string>(
        (events ?? [])
          .filter((e: SpecialEvent) => e.event_type === 'historic_ballpark' && e.venue_name)
          .map((e: SpecialEvent) => e.venue_name as string)
      )
      for (const e of (ble ?? []).filter((e: BaseballLifeEntry) => e.category === 'pilgrimage')) {
        const v = e.venue?.toLowerCase() ?? ''
        if (v.includes('louisville slugger')) visited.add('Louisville Slugger Museum & Factory')
        if (v.includes('hall of fame'))       visited.add('National Baseball Hall of Fame')
        if (v.includes('negro leagues'))      visited.add('Negro Leagues Baseball Museum')
        if (v.includes('field of dreams'))    visited.add('Field of Dreams')
        if (v.includes('rickwood'))           visited.add('Rickwood Field')
      }
      return HISTORIC_VENUES.every((v) => visited.has(v))
    },
  },
  {
    id: 'full_experience',
    name: 'The Full Experience',
    description: 'Visit 5 or more baseball destinations',
    icon: '🗺️',
    check: (_v, _s, _e, _sv, destinationVisits) =>
      new Set((destinationVisits ?? []).map((dv: DestinationVisit) => dv.destination_id)).size >= 5,
  },

  // ── Baseball Life achievements (auto-tracked from BLE entries) ──────────────
  {
    id: 'bl_derby_day',
    name: 'Derby Day',
    description: 'Attend the Home Run Derby',
    icon: '💥',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'mlb_special_event' && x.event_type?.toLowerCase().includes('home run derby')
    ),
  },
  {
    id: 'bl_field_of_dreams_game',
    name: 'Field of Dreams Game',
    description: 'Attend the Field of Dreams Game in Iowa',
    icon: '🌽',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'mlb_special_event' && x.event_type?.toLowerCase().includes('field of dreams')
    ),
  },
  {
    id: 'bl_cactus_league',
    name: 'Cactus League',
    description: 'Attend a spring training game in Arizona',
    icon: '🌵',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'spring_training' && x.state === 'AZ'
    ),
  },
  {
    id: 'bl_grapefruit_league',
    name: 'Grapefruit League',
    description: 'Attend a spring training game in Florida',
    icon: '🍊',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'spring_training' && x.state === 'FL'
    ),
  },
  {
    id: 'bl_fenway_tour',
    name: 'The Green Monster',
    description: 'Take a tour of Fenway Park',
    icon: '🏯',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && x.venue?.toLowerCase().includes('fenway')
    ),
  },
  {
    id: 'bl_wrigley_tour',
    name: 'The Friendly Confines',
    description: 'Take a tour of Wrigley Field',
    icon: '🍀',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && x.venue?.toLowerCase().includes('wrigley')
    ),
  },
  {
    id: 'bl_yankee_tour',
    name: 'The House That Ruth Built',
    description: 'Take a tour of Yankee Stadium',
    icon: '🏛️',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && x.venue?.toLowerCase().includes('yankee')
    ),
  },
  {
    id: 'bl_dodger_tour',
    name: 'Chavez Ravine',
    description: 'Take a tour of Dodger Stadium',
    icon: '🌴',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && (x.venue?.toLowerCase().includes('dodger') || x.venue?.toLowerCase().includes('chavez ravine'))
    ),
  },
  {
    id: 'bl_oracle_tour',
    name: 'The Splash Zone',
    description: 'Take a tour of Oracle Park',
    icon: '🌉',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && x.venue?.toLowerCase().includes('oracle')
    ),
  },
  {
    id: 'bl_babe_ruth_museum',
    name: 'The Bambino',
    description: 'Visit the Babe Ruth Birthplace and Museum in Baltimore',
    icon: '👑',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && (
        x.venue?.toLowerCase().includes('babe ruth') ||
        x.venue?.toLowerCase().includes('ruth') ||
        x.event_type?.toLowerCase().includes('babe ruth')
      )
    ),
  },
  {
    id: 'bl_cape_cod_league',
    name: 'Future Stars',
    description: 'Watch a Cape Cod Baseball League game in Hyannis, MA',
    icon: '🦞',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && (x.venue?.toLowerCase().includes('cape cod') || x.venue?.toLowerCase().includes('hyannis'))
    ),
  },
  {
    id: 'bl_arizona_fall_league',
    name: 'Fall Prospects',
    description: 'Attend an Arizona Fall League game in Scottsdale, AZ',
    icon: '🌵',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && (x.venue?.toLowerCase().includes('arizona fall') || x.venue?.toLowerCase().includes('scottsdale') || x.event_type?.toLowerCase().includes('arizona fall'))
    ),
  },
  {
    id: 'bl_college_world_series',
    name: 'College Classic',
    description: 'Attend the College World Series in Omaha, NE',
    icon: '🎓',
    check: (_v, _s, _e, ble) => (ble ?? []).some((x: BaseballLifeEntry) =>
      x.category === 'pilgrimage' && (x.venue?.toLowerCase().includes('college world series') || x.venue?.toLowerCase().includes('omaha') || x.event_type?.toLowerCase().includes('college world series'))
    ),
  },
  {
    id: 'bl_grand_tour',
    name: 'The Grand Tour',
    description: 'Visit 3 or more baseball pilgrimage sites',
    icon: '🗺️',
    check: (_v, _s, _e, ble) => {
      const venues = new Set(
        (ble ?? []).filter((x: BaseballLifeEntry) => x.category === 'pilgrimage')
          .map((x: BaseballLifeEntry) => x.venue?.toLowerCase().trim())
          .filter(Boolean)
      )
      return venues.size >= 3
    },
  },
  {
    id: 'bl_full_circuit',
    name: 'The Full Circuit',
    description: 'Attend an MLB game, a minor league game, and a spring training game',
    icon: '🔄',
    check: (_v, _s, _e, ble) => {
      const cats = new Set((ble ?? []).map((x: BaseballLifeEntry) => x.category))
      return cats.has('minor_league') && cats.has('spring_training')
    },
  },
  {
    id: 'bl_baseball_lifer',
    name: 'Baseball Lifer',
    description: 'Have entries in all four Baseball Life categories',
    icon: '🎖️',
    check: (_v, _s, _e, ble) => {
      const cats = new Set((ble ?? []).map((x: BaseballLifeEntry) => x.category))
      return cats.has('minor_league') && cats.has('mlb_special_event') &&
             cats.has('spring_training') && cats.has('pilgrimage')
    },
  },
]
