import { NextResponse } from 'next/server'

export const revalidate = 3600

const MLB_TEAM_IDS: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CWS: 145,
  CIN: 113, CLE: 114, COL: 115, DET: 116, HOU: 117, KC:  118,
  LAA: 108, LAD: 119, MIA: 146, MIL: 158, MIN: 142, NYM: 121,
  NYY: 147, OAK: 133, PHI: 143, PIT: 134, SD:  135, SF:  137,
  SEA: 136, STL: 138, TB:  139, TEX: 140, TOR: 141, WSH: 120,
}

const ID_TO_ABBR: Record<number, string> = Object.fromEntries(
  Object.entries(MLB_TEAM_IDS).map(([abbr, id]) => [id, abbr])
)

function fmtGameDate(dateStr: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const parts = dateStr.split('-')
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  return `${months[m - 1]} ${d}`
}

export async function GET() {
  try {
    const now = new Date()
    const startDate = now.toISOString().slice(0, 10)
    const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`,
      { next: { revalidate: 3600 } }
    )

    if (!res.ok) return NextResponse.json({})

    const data = await res.json()
    const result: Record<string, { date: string; opponentAbbr: string }> = {}

    for (const dateObj of data.dates ?? []) {
      for (const game of dateObj.games ?? []) {
        const homeId: number = game.teams?.home?.team?.id
        const awayId: number = game.teams?.away?.team?.id
        const homeAbbr = ID_TO_ABBR[homeId]
        const awayAbbr = ID_TO_ABBR[awayId]

        if (homeAbbr && !result[homeAbbr]) {
          result[homeAbbr] = {
            date: fmtGameDate(dateObj.date),
            opponentAbbr: awayAbbr ?? '?',
          }
        }
      }
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({})
  }
}
