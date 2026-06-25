import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { populateMiLBGameStats } from '@/lib/populate-milb-game-stats'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      entryId: string
      visitDate?: string
      milbTeamId?: number
      minorLeagueStadiumId?: string
    }

    const { entryId } = body
    let { visitDate, milbTeamId } = body

    if (!visitDate || !milbTeamId) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('baseball_life_entries')
        .select('visit_date, minor_league_stadiums(milb_team_id)')
        .eq('id', entryId)
        .single()
      visitDate   = visitDate   ?? (data as any)?.visit_date
      milbTeamId  = milbTeamId  ?? (data as any)?.minor_league_stadiums?.milb_team_id
    }

    if (!visitDate || !milbTeamId) {
      return NextResponse.json(
        { error: 'Could not determine visit date or MiLB team ID' },
        { status: 400 }
      )
    }

    const result = await populateMiLBGameStats(entryId, visitDate, milbTeamId)

    if (!result.success) {
      const status =
        result.code === 'not_final'    ? 422 :
        result.code === 'no_home_game' ? 404 : 400
      return NextResponse.json({ error: result.error, code: result.code }, { status })
    }

    return NextResponse.json({ success: true, score: result.score, attendance: result.attendance })
  } catch (e) {
    console.error('autofill-milb-game error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
