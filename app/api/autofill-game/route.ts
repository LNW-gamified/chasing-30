import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { populateGameStats } from '@/lib/populate-game-stats'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      visitId: string
      visitDate?: string
      stadiumAbbr?: string
    }

    const { visitId } = body
    let { visitDate, stadiumAbbr } = body

    // If caller didn't provide date/abbr, look them up from the visit record
    if (!visitDate || !stadiumAbbr) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('stadium_visits')
        .select('visit_date, stadiums(abbreviation)')
        .eq('id', visitId)
        .single()
      visitDate = visitDate ?? (data as any)?.visit_date
      stadiumAbbr = stadiumAbbr ?? (data as any)?.stadiums?.abbreviation
    }

    if (!visitDate || !stadiumAbbr) {
      return NextResponse.json(
        { error: 'Could not determine visit date or stadium' },
        { status: 400 }
      )
    }

    const result = await populateGameStats(visitId, visitDate, stadiumAbbr)

    if (!result.success) {
      const status =
        result.code === 'not_final'    ? 422 :
        result.code === 'no_home_game' ? 404 :
        result.code === 'unknown_team' ? 400 : 502
      return NextResponse.json({ error: result.error, code: result.code }, { status })
    }

    return NextResponse.json({
      success:        true,
      score:          result.score,
      events:         result.events,
      attendance:     result.attendance,
      winningPitcher: result.winningPitcher,
      losingPitcher:  result.losingPitcher,
    })
  } catch (e) {
    console.error('autofill-game error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
