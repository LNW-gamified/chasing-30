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
