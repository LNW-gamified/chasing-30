export const GAME_MOMENTS = [
  { id: 'foul_ball',    icon: '⚾', label: 'Caught a Foul Ball'       },
  { id: 'autograph',    icon: '✍️', label: 'Got an Autograph'          },
  { id: 'giveaway',     icon: '🎁', label: 'Received a Giveaway'       },
  { id: 'jumbotron',    icon: '📺', label: 'On the Jumbotron'          },
  { id: 'met_player',   icon: '🤝', label: 'Met a Player'              },
  { id: 'rain_delay',   icon: '🌧️', label: 'Rain Delay'                },
  { id: 'brawl',        icon: '🥊', label: 'Witnessed a Brawl'         },
  { id: 'occasion',     icon: '💍', label: 'Special Occasion'          },
  { id: 'first_beer',   icon: '🍺', label: 'First Beer at This Park'   },
  { id: 'jersey',       icon: '👕', label: 'Bought a Jersey'           },
  { id: 'mascot_photo', icon: '📸', label: 'Got a Photo with Mascot'   },
  { id: 'team_store',   icon: '🏆', label: 'Visited Team Store'        },
] as const

export type MomentId = typeof GAME_MOMENTS[number]['id']
