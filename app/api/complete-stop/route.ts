import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { populateGameStats } from '@/lib/populate-game-stats'

// Marks ONE trip stop as done, either by:
//   action: 'log'  — create a fresh stadium_visits/destination_visits row
//                    for just this stop (same idempotent logic complete-trip
//                    already uses for every stop at once, just scoped here
//                    to one), then link it back to the stop.
//   action: 'link' — the stop was already logged some other way (e.g.
//                    straight from the stadium's own page), so just point
//                    the stop's link column at that existing row instead of
//                    creating a duplicate.
// After either path, if every stop in the trip now has a link, the trip
// itself gets marked completed automatically (same status flip
// /api/complete-trip already does, called here once conditions are met).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      stopId: string
      action: 'log' | 'link'
      stadiumVisitId?: string
      destinationVisitId?: string
    }
    const { stopId, action } = body
    if (!stopId || !action) return NextResponse.json({ error: 'stopId and action required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: stop, error: stopError } = await supabase
      .from('trip_stops')
      .select('*, stadium:stadiums(*), destination:destinations(name)')
      .eq('id', stopId)
      .single()

    if (stopError || !stop) {
      return NextResponse.json({ error: stopError?.message ?? 'Stop not found' }, { status: 404 })
    }

    if (action === 'link') {
      const update: Record<string, string | null> = {}
      if (body.stadiumVisitId)     update.stadium_visit_id     = body.stadiumVisitId
      if (body.destinationVisitId) update.destination_visit_id = body.destinationVisitId
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'stadiumVisitId or destinationVisitId required for link' }, { status: 400 })
      }
      const { error: linkError } = await supabase.from('trip_stops').update(update).eq('id', stopId)
      if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    if (action === 'log') {
      if (!stop.game_date) {
        return NextResponse.json({ error: 'This stop has no date set, so it cannot be logged yet' }, { status: 400 })
      }

      // Destination stop → create destination_visit (mirrors complete-trip)
      if (stop.destination_id) {
        // Destinations have TWO separate, older tracking paths that predate
        // this route: destination_visits (this trip flow) and
        // baseball_life_entries with category='pilgrimage' (the original,
        // manual way of logging a pilgrimage visit, still in active use
        // elsewhere in the app). There's no foreign key between them, only
        // a free-text venue field on baseball_life_entries, so the match
        // here is fuzzy (first two words of the destination's name), same
        // approach already used elsewhere in the app for this exact
        // comparison. Checking this first avoids creating a duplicate
        // destination_visits row for a place that's already logged the
        // other way, exactly what happened here with the Babe Ruth Museum
        // before this check existed.
        const destName = (stop as any).destination?.name as string | undefined
        let bleId: string | null = null
        if (destName) {
          const nameLow = destName.toLowerCase()
          const matchWords = nameLow.split(' ').slice(0, 2).join(' ')
          const { data: bleMatches } = await supabase
            .from('baseball_life_entries')
            .select('id, venue, event_type')
            .eq('category', 'pilgrimage')
            .eq('visit_date', stop.game_date)
          bleId = (bleMatches ?? []).find((b: any) =>
            b.venue?.toLowerCase().includes(matchWords) || b.event_type?.toLowerCase().includes(matchWords)
          )?.id ?? null
        }

        if (bleId) {
          await supabase.from('trip_stops').update({ baseball_life_entry_id: bleId }).eq('id', stopId)
        } else {
        // Match on destination + date, not trip_id, same reasoning as the
        // stadium_visits check below. Date stays in this match (unlike
        // stadium_visits it's not load-bearing for correctness there, but
        // here a recurring destination could genuinely have an older,
        // unrelated visit on file, and matching by destination_id alone
        // could wrongly link to that instead of the real one for this trip).
        const { data: existingDV } = await supabase
          .from('destination_visits')
          .select('id')
          .eq('destination_id', stop.destination_id)
          .eq('visit_date', stop.game_date)
          .maybeSingle()

        const dvId = existingDV?.id ?? (await supabase
          .from('destination_visits')
          .insert({
            destination_id:  stop.destination_id,
            trip_id:         stop.trip_id,
            visit_date:      stop.game_date,
            experience_type: stop.experience_type ?? null,
            created_by:      user?.id ?? null,
          })
          .select('id')
          .single()
        ).data?.id ?? null

        if (dvId) {
          await supabase.from('trip_stops').update({ destination_visit_id: dvId }).eq('id', stopId)
        }
        }

        // Non-MLB destination (no stadium_id): done, nothing else to create
        if (!stop.stadium_id) {
          return NextResponse.json({ success: true, linkedExistingPilgrimage: !!bleId })
        }
      }

      // Stadium visit: regular stadium stops, and MLB-event destination stops
      const stadium = (stop as any).stadium
      if (stadium) {
        // Match on stadium + date only, not trip_id. A game logged
        // directly from the stadium page (or any other trip, or no trip
        // at all) has no trip_id tying it to this specific trip, so
        // requiring that match here meant this check could never find a
        // real, already-logged visit for exactly the situation it exists
        // to catch, and created a duplicate instead.
        const { data: existing } = await supabase
          .from('stadium_visits')
          .select('id')
          .eq('stadium_id', stop.stadium_id)
          .eq('visit_date', stop.game_date)
          .maybeSingle()

        let visitId = existing?.id ?? null

        if (!visitId) {
          const seats      = (stop.ticket_seats ?? []) as string[]
          const firstSeat  = seats[0] ?? null
          const extraSeats = seats.slice(1).map((num: string) => ({
            section: stop.ticket_section ?? '',
            row:     stop.ticket_row     ?? '',
            number:  num,
          }))

          const { data: newVisit, error: insertError } = await supabase
            .from('stadium_visits')
            .insert({
              stadium_id:       stop.stadium_id,
              visit_date:       stop.game_date,
              home_team:        stadium.team,
              visiting_team:    stop.opponent ?? 'TBD',
              seat_section:     stop.ticket_section || null,
              seat_row:         stop.ticket_row     || null,
              seat_number:      firstSeat,
              additional_seats: extraSeats.length > 0 ? extraSeats : null,
              trip_id:          stop.trip_id,
              created_by:       user?.id ?? null,
            })
            .select('id')
            .single()

          if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
          visitId = newVisit?.id ?? null

          if (visitId) {
            await populateGameStats(visitId, stop.game_date, stadium.abbreviation)
          }
        }

        if (visitId) {
          await supabase.from('trip_stops').update({ stadium_visit_id: visitId }).eq('id', stopId)
        }
      }
    }

    // Check whether every stop in this trip is now linked, and if so,
    // hand off to the existing, already-idempotent complete-trip endpoint
    // to flip the trip's own status. Safe to call even if some stops were
    // already created earlier, it skips anything that already exists.
    const { data: allStops } = await supabase
      .from('trip_stops')
      .select('id, stadium_visit_id, destination_visit_id, baseball_life_entry_id')
      .eq('trip_id', stop.trip_id)

    const allDone = (allStops ?? []).every(s => s.stadium_visit_id || s.destination_visit_id || s.baseball_life_entry_id)
    let tripCompleted = false

    if (allDone && (allStops ?? []).length > 0) {
      const origin = req.nextUrl.origin
      const completeRes = await fetch(`${origin}/api/complete-trip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
        body: JSON.stringify({ tripId: stop.trip_id }),
      })
      tripCompleted = completeRes.ok
    }

    return NextResponse.json({ success: true, tripCompleted })
  } catch (e) {
    console.error('complete-stop error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
