import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { populateGameStats } from '@/lib/populate-game-stats'

export async function POST(req: NextRequest) {
  try {
    const { tripId, completionDate } = await req.json() as {
      tripId: string
      completionDate?: string
    }

    if (!tripId) return NextResponse.json({ error: 'tripId required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Load stops with joined stadium data
    const { data: rawStops, error: stopsError } = await supabase
      .from('trip_stops')
      .select('*, stadium:stadiums(*)')
      .eq('trip_id', tripId)
      .order('sort_order')

    if (stopsError) {
      console.error('complete-trip: failed to load stops:', stopsError)
      return NextResponse.json({ error: `Failed to load trip stops: ${stopsError.message}` }, { status: 500 })
    }

    const stops = (rawStops ?? []) as any[]

    // 1. Mark trip completed
    const { error: tripUpdateError } = await supabase
      .from('trips')
      .update({ status: 'completed', ...(completionDate ? { trip_date: completionDate } : {}) })
      .eq('id', tripId)

    if (tripUpdateError) {
      console.error('complete-trip: failed to update trip status:', tripUpdateError)
      return NextResponse.json({ error: `Failed to mark trip complete: ${tripUpdateError.message}` }, { status: 500 })
    }

    // 2. Create a visit record for every stop that has a game date
    const createdVisits: { id: string; visitDate: string; stadiumAbbr: string }[] = []

    for (const stop of stops) {
      if (!stop.game_date) continue
      const stadium = stop.stadium
      if (!stadium) continue

      // Idempotent: skip if this trip already has a visit for this stop
      const { data: existing, error: existingError } = await supabase
        .from('stadium_visits')
        .select('id')
        .eq('trip_id', tripId)
        .eq('stadium_id', stop.stadium_id)
        .eq('visit_date', stop.game_date)
        .maybeSingle()

      if (existingError) {
        console.error(`complete-trip: idempotency check failed for stop ${stop.id}:`, existingError)
        return NextResponse.json({ error: `Idempotency check failed: ${existingError.message}` }, { status: 500 })
      }

      if (existing) continue

      const seats     = (stop.ticket_seats ?? []) as string[]
      const firstSeat = seats[0] ?? null
      const extraSeats = seats.slice(1).map((num: string) => ({
        section: stop.ticket_section ?? '',
        row:     stop.ticket_row     ?? '',
        number:  num,
      }))

      const { data: newVisit, error: insertError } = await supabase
        .from('stadium_visits')
        .insert({
          stadium_id:    stop.stadium_id,
          visit_date:    stop.game_date,
          home_team:     stadium.team,
          visiting_team: stop.opponent ?? 'TBD',
          seat_section:  stop.ticket_section || null,
          seat_row:      stop.ticket_row     || null,
          seat_number:   firstSeat,
          additional_seats: extraSeats.length > 0 ? extraSeats : null,
          trip_id:       tripId,
          created_by:    user?.id ?? null,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error(`complete-trip: visit insert failed for stop ${stop.id} (${stadium.abbreviation} on ${stop.game_date}):`, insertError)
        return NextResponse.json({ error: `Failed to create visit for ${stadium.name}: ${insertError.message}` }, { status: 500 })
      }

      if (newVisit?.id) {
        createdVisits.push({
          id:          newVisit.id,
          visitDate:   stop.game_date,
          stadiumAbbr: stadium.abbreviation,
        })
      }
    }

    // 3. Auto-populate MLB stats for each new visit (best-effort, non-blocking per visit)
    const statsResults: { stadiumAbbr: string; success: boolean; error?: string }[] = []
    for (const { id, visitDate, stadiumAbbr } of createdVisits) {
      const result = await populateGameStats(id, visitDate, stadiumAbbr)
      statsResults.push({ stadiumAbbr, success: result.success, error: result.error })
    }

    return NextResponse.json({
      success:       true,
      visitsCreated: createdVisits.length,
      statsResults,
    })
  } catch (e) {
    console.error('complete-trip error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
