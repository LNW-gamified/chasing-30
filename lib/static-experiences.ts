export type TrackingType = 'manual_once' | 'manual_repeatable' | 'automatic'

export interface StaticExperience {
  id: string
  name: string
  description: string
  icon: string
  tracking_type: TrackingType
}

export const STATIC_EXPERIENCES: StaticExperience[] = [
  // manual_once
  { id: 'opening_day',     name: 'Opening Day',            description: 'Attend Opening Day for any team',              icon: '🌱', tracking_type: 'manual_once' },
  // automatic (earned by logging data elsewhere — no manual claim form)
  { id: 'bobblehead',      name: 'Bobblehead Collection',  description: 'Score a giveaway item at the park',           icon: '🪆', tracking_type: 'automatic' },
  // manual_repeatable
  { id: 'foul_ball',       name: 'Caught a Foul Ball',     description: 'Catch or retrieve a foul ball at a game',      icon: '⚾', tracking_type: 'manual_repeatable' },
  { id: 'autograph',       name: 'Got an Autograph',       description: 'Get a player autograph at any MLB venue',      icon: '✍️', tracking_type: 'manual_repeatable' },
  { id: 'met_player',      name: 'Met a Player',           description: 'Meet an MLB player in person',                 icon: '🤝', tracking_type: 'manual_repeatable' },
  { id: 'jumbotron',       name: 'On the Jumbotron',       description: 'Make it onto the stadium big screen',          icon: '📺', tracking_type: 'manual_repeatable' },
  { id: 'seventh_inning',  name: 'Seventh Inning Stretch', description: 'Sing Take Me Out to the Ballgame',             icon: '🎵', tracking_type: 'manual_repeatable' },
  { id: 'fireworks_night', name: 'Fireworks Night',        description: 'Stay for post-game fireworks',                 icon: '🎆', tracking_type: 'manual_repeatable' },
  { id: 'rivalry_game',    name: 'Rivalry Game',           description: 'Attend a heated rivalry matchup',              icon: '⚔️', tracking_type: 'manual_repeatable' },
  { id: 'enemy_territory', name: 'Enemy Territory',        description: 'Attend a game as a visiting team fan in enemy territory', icon: '🕵️', tracking_type: 'manual_repeatable' },
  { id: 'rain_delay',      name: 'Rain Delay',             description: 'Sit through a rain delay at a ballpark',       icon: '🌧️', tracking_type: 'manual_repeatable' },
  { id: 'early_bird',      name: 'Early Bird',             description: 'Arrive early to watch batting practice',       icon: '🌅', tracking_type: 'manual_repeatable' },
  { id: 'jersey_day',      name: 'Jersey Day',             description: 'Wear your team jersey to a game',              icon: '👕', tracking_type: 'manual_repeatable' },
  { id: 'night_owl',       name: 'Night Owl',              description: 'Stay until the very last out of a night game', icon: '🦉', tracking_type: 'manual_repeatable' },
]
