import { NextResponse } from 'next/server'
import { MLB_TEAM_IDS, MLB_ID_TO_ABBR as ID_TO_ABBR } from '@/lib/mlb-api'

export const revalidate = 3600

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
