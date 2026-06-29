import { NextResponse } from 'next/server'

const MLB_ID_TO_ABBR: Record<number, string> = {
  109: 'ARI', 144: 'ATL', 110: 'BAL', 111: 'BOS', 112: 'CHC',
  145: 'CWS', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET',
  117: 'HOU', 118: 'KC',  108: 'LAA', 119: 'LAD', 146: 'MIA',
  158: 'MIL', 142: 'MIN', 121: 'NYM', 147: 'NYY', 133: 'OAK',
  143: 'PHI', 134: 'PIT', 135: 'SD',  137: 'SF',  136: 'SEA',
  138: 'STL', 139: 'TB',  140: 'TEX', 141: 'TOR', 120: 'WSH',
}

export async function GET() {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'UTC' })
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&gameType=R&hydrate=linescore`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return NextResponse.json([])
    const data = await res.json()
    const games: unknown[] = data.dates?.[0]?.games ?? []
    return NextResponse.json(
      games.map((g: any) => {
        const ls = g.linescore
        const inningNum  = ls?.currentInning ?? null
        const inningHalf = ls?.isTopInning === false ? 'Bot' : 'Top'
        const inning = inningNum ? `${inningHalf} ${inningNum}` : null
        return {
          gamePk:    g.gamePk,
          gameDate:  g.gameDate,
          awayAbbr:  MLB_ID_TO_ABBR[g.teams?.away?.team?.id as number] ?? 'MLB',
          homeAbbr:  MLB_ID_TO_ABBR[g.teams?.home?.team?.id as number] ?? 'MLB',
          awayScore: g.teams?.away?.score ?? null,
          homeScore: g.teams?.home?.score ?? null,
          isLive:    g.status?.abstractGameState === 'Live',
          isFinal:   g.status?.abstractGameState === 'Final',
          inning,
        }
      })
    )
  } catch {
    return NextResponse.json([])
  }
}
