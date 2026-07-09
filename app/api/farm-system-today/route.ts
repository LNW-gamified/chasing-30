import { NextRequest, NextResponse } from 'next/server'
import { fetchMinorLeagueAffiliates, fetchFarmSystemToday } from '@/lib/mlb-api'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    const team = req.nextUrl.searchParams.get('team')
    const tz = req.nextUrl.searchParams.get('tz') || 'America/Los_Angeles'
    if (!team) return NextResponse.json([])
    const affiliates = await fetchMinorLeagueAffiliates(team)
    if (affiliates.length === 0) return NextResponse.json([])
    const supabase = await createClient()
    const games = await fetchFarmSystemToday(affiliates, tz, supabase)
    return NextResponse.json(games)
  } catch {
    return NextResponse.json([])
  }
}
