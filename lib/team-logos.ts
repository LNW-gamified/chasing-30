export function getTeamLogoUrl(abbreviation: string): string {
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${abbreviation.toLowerCase()}.png`
}

// Teams whose logos are too dark to read on a dark background.
// These get a near-white background instead of the standard frosted glass.
export const LIGHT_BG_LOGO_TEAMS = new Set<string>([
  'COL', // Colorado Rockies — dark purple/black
  'KC',  // Kansas City Royals — dark navy
  'LAD', // Los Angeles Dodgers — dark navy
  'MIA', // Miami Marlins — dark navy
  'NYM', // New York Mets — dark navy/blue
  'NYY', // New York Yankees — dark navy/black
  'SD',  // San Diego Padres — dark navy/brown
  'TB',  // Tampa Bay Rays — dark navy
])

const MLB_ID_TO_ABBR: Record<number, string> = {
  109: 'ARI', 144: 'ATL', 110: 'BAL', 111: 'BOS', 112: 'CHC',
  145: 'CWS', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET',
  117: 'HOU', 118: 'KC',  108: 'LAA', 119: 'LAD', 146: 'MIA',
  158: 'MIL', 142: 'MIN', 121: 'NYM', 147: 'NYY', 133: 'OAK',
  143: 'PHI', 134: 'PIT', 135: 'SD',  137: 'SF',  136: 'SEA',
  138: 'STL', 139: 'TB',  140: 'TEX', 141: 'TOR', 120: 'WSH',
}

export function getTeamLogoUrlById(teamId: number): string {
  const abbr = MLB_ID_TO_ABBR[teamId]
  return abbr ? getTeamLogoUrl(abbr) : ''
}

export function getTeamAbbrById(teamId: number): string {
  return MLB_ID_TO_ABBR[teamId] ?? ''
}
