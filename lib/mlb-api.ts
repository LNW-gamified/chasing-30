export const MLB_TEAM_IDS: Record<string, number> = {
  LAA: 108, ARI: 109, BAL: 110, BOS: 111,
  CHC: 112, CIN: 113, CLE: 114, COL: 115,
  DET: 116, HOU: 117, KC: 118, LAD: 119,
  WSH: 120, NYM: 121, OAK: 133, PHI: 143,
  PIT: 134, SD: 135, SEA: 136, SF: 137,
  STL: 138, TB: 139, TEX: 140, TOR: 141,
  MIN: 142, NYY: 147, MIA: 146, MIL: 158,
  ATL: 144, CWS: 145,
}

export const MLB_ID_TO_ABBR: Record<number, string> = Object.fromEntries(
  Object.entries(MLB_TEAM_IDS).map(([abbr, id]) => [id, abbr])
)

export const STADIUM_TZ: Record<string, string> = {
  ARI: 'America/Phoenix',
  ATL: 'America/New_York',  BAL: 'America/New_York',  BOS: 'America/New_York',
  CHC: 'America/Chicago',   CWS: 'America/Chicago',   CIN: 'America/New_York',
  CLE: 'America/New_York',  COL: 'America/Denver',    DET: 'America/Detroit',
  HOU: 'America/Chicago',   KC:  'America/Chicago',
  LAA: 'America/Los_Angeles', LAD: 'America/Los_Angeles',
  MIA: 'America/New_York',  MIL: 'America/Chicago',   MIN: 'America/Chicago',
  NYM: 'America/New_York',  NYY: 'America/New_York',
  OAK: 'America/Los_Angeles', PHI: 'America/New_York', PIT: 'America/New_York',
  SD:  'America/Los_Angeles', SF:  'America/Los_Angeles', SEA: 'America/Los_Angeles',
  STL: 'America/Chicago',   TB:  'America/New_York',  TEX: 'America/Chicago',
  TOR: 'America/Toronto',   WSH: 'America/New_York',
}

export const TZ_LABEL: Record<string, string> = {
  'America/New_York':    'ET',
  'America/Chicago':     'CT',
  'America/Denver':      'MT',
  'America/Phoenix':     'AZT',
  'America/Los_Angeles': 'PT',
  'America/Detroit':     'ET',
  'America/Toronto':     'ET',
}

export interface UpcomingGame {
  gamePk: number
  gameDate: string
  homeTeam: string
  awayTeam: string
  venue: string
  status: string
}

export async function fetchUpcomingHomeGames(teamAbbr: string, days = 14): Promise<UpcomingGame[]> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return []

  const today = new Date().toISOString().split('T')[0]
  const end = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
  const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&startDate=${today}&endDate=${end}&sportId=1&hydrate=team,venue`

  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()

    const games: UpcomingGame[] = []
    for (const date of data.dates ?? []) {
      for (const game of date.games ?? []) {
        const homeId = game.teams?.home?.team?.id
        if (homeId !== teamId) continue
        games.push({
          gamePk: game.gamePk,
          gameDate: game.gameDate,
          homeTeam: game.teams.home.team.name,
          awayTeam: game.teams.away.team.name,
          venue: game.venue?.name ?? '',
          status: game.status?.abstractGameState ?? '',
        })
      }
    }
    return games.slice(0, 5)
  } catch {
    return []
  }
}

export interface SeasonGame {
  gamePk: number
  gameDate: string      // UTC ISO from MLB API
  homeTeam: string
  homeTeamAbbr: string
  awayTeam: string
  awayTeamAbbr: string
  status: string        // 'Final' | 'Live' | 'Preview' | etc.
  isFinal: boolean
  isLive: boolean
}

export async function fetchSeasonHomeGames(teamAbbr: string): Promise<SeasonGame[]> {
  const teamId = MLB_TEAM_IDS[teamAbbr]
  if (!teamId) return []

  // Full 2026 regular season window
  const startDate = '2026-03-19'
  const endDate   = '2026-09-30'
  const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&sportId=1&gameType=R`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()

    const games: SeasonGame[] = []
    for (const dateEntry of data.dates ?? []) {
      for (const game of dateEntry.games ?? []) {
        const homeTeamId: number = game.teams?.home?.team?.id
        if (homeTeamId !== teamId) continue
        const awayTeamId: number = game.teams?.away?.team?.id
        games.push({
          gamePk:       game.gamePk,
          gameDate:     game.gameDate,
          homeTeam:     game.teams.home.team.name,
          homeTeamAbbr: teamAbbr,
          awayTeam:     game.teams.away.team.name,
          awayTeamAbbr: MLB_ID_TO_ABBR[awayTeamId] ?? '',
          status:       game.status?.abstractGameState ?? '',
          isFinal:      game.status?.abstractGameState === 'Final',
          isLive:       game.status?.abstractGameState === 'Live',
        })
      }
    }
    return games
  } catch {
    return []
  }
}
