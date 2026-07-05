import { NextRequest, NextResponse } from 'next/server'
import { fetchMinorLeagueAffiliates, fetchFarmSystemToday } from '@/lib/mlb-api'

export async function GET(req: NextRequest) {
  try {
    const team = req.nextUrl.searchParams.get('team')
    if (!team) return NextResponse.json([])
    const affiliates = await fetchMinorLeagueAffiliates(team)
    if (affiliates.length === 0) return NextResponse.json([])
    const games = await fetchFarmSystemToday(affiliates)
    return NextResponse.json(games)
  } catch {
    return NextResponse.json([])
  }
}
