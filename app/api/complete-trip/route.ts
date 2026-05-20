import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const MLB_TEAM_IDS: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CWS: 145,
  CIN: 113, CLE: 114, COL: 115, DET: 116, HOU: 117, KC:  118,
  LAA: 108, LAD: 119, MIA: 146, MIL: 158, MIN: 142, NYM: 121,
  NYY: 147, OAK: 133, PHI: 143, PIT: 134, SD:  135, SF:  137,
  SEA: 136, STL: 138, TB:  139, TEX: 140, TOR: 141, WSH: 120,
}

function getStarterStats(teamBox: any, probableId: number | undefined) {
  const pitcherId = probableId ?? teamBox?.pitchers?.[0]
  if (!pitcherId) return null
  const player = teamBox?.players?.[`ID${pitcherId}`]
  if (!player) return null
  const gp = player.stats?.pitching ?? {}
  const sp = player.seasonStats?.pitching ?? {}
  return {
    name: player.person?.fullName ?? null,
    wl:   (sp.wins != null && sp.losses != null) ? `${sp.wins}-${sp.losses}` : null,
    ip:   gp.inningsPitched ?? null,
    h:    gp.hits ?? null,
    er:   gp.earnedRuns ?? null,
    bb:   gp.baseOnBalls ?? null,
    k:    gp.strikeOuts ?? null,
  }
}

async function tryPopulateStats(
  supabase: any,
  visitId: string,
  visitDate: string,
  stadiumAbbr: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const teamId = MLB_TEAM_IDS[stadiumAbbr]
    if (!teamId) return { success: false, error: 'Unknown team abbreviation' }

    const schedRes = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${visitDate}&teamId=${teamId}&gameType=R`,
      { headers: { Accept: 'application/json' } }
    )
    if (!schedRes.ok) return { success: false, error: 'MLB schedule fetch failed' }

    const schedData = await schedRes.json()
    const games: any[] = schedData.dates?.[0]?.games ?? []
    const game = games.find((g: any) => g.teams?.home?.team?.id === teamId)
    if (!game) return { success: false, error: 'No home game found for this date' }
    if (game.status?.abstractGameState !== 'Final') {
      return { success: false, error: `Game not yet final (${game.status?.abstractGameState ?? 'unknown'})` }
    }

    const gamePk: number = game.gamePk
    const feedRes = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
      { headers: { Accept: 'application/json' } }
    )
    if (!feedRes.ok) return { success: false, error: 'MLB game feed fetch failed' }

    const feed       = await feedRes.json()
    const gameData   = feed.gameData ?? {}
    const liveData   = feed.liveData ?? {}
    const linescore  = liveData.linescore ?? {}
    const boxscore   = liveData.boxscore ?? {}
    const decisions  = liveData.decisions ?? {}
    const homeLS     = linescore.teams?.home ?? {}
    const awayLS     = linescore.teams?.away ?? {}
    const homeBox    = boxscore.teams?.home ?? {}
    const awayBox    = boxscore.teams?.away ?? {}

    const inningScores = (linescore.innings ?? []).map((inn: any) => ({
      inning: inn.num,
      home:   inn.home?.runs ?? null,
      away:   inn.away?.runs ?? null,
    }))

    const homeRec = gameData.teams?.home?.record
    const awayRec = gameData.teams?.away?.record
    const probHome = gameData.probablePitchers?.home
    const probAway = gameData.probablePitchers?.away
    const homeSP   = getStarterStats(homeBox, probHome?.id)
    const awaySP   = getStarterStats(awayBox, probAway?.id)

    const officials: any[] = boxscore.officials ?? []
    const ump = (type: string) =>
      officials.find((u: any) => u.officialType === type)?.official?.fullName ?? null

    let firstPitchTime: string | null = null
    const fpUtc = gameData.datetime?.firstPitch
    if (fpUtc) {
      try {
        firstPitchTime = new Date(fpUtc).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true,
          timeZone: 'America/Los_Angeles',
        }) + ' PT'
      } catch {}
    }

    // Game event detection
    const allPlays: any[]   = liveData.plays?.allPlays ?? []
    const homeRunsTotal     = homeLS.runs ?? 0
    const awayRunsTotal     = awayLS.runs ?? 0
    const awayHitsTotal     = awayLS.hits ?? 0
    const homeErrorsTotal   = homeLS.errors ?? 0
    const gameEvents: string[] = []

    if (homeRunsTotal > awayRunsTotal && inningScores.length > 0) {
      const lastInn = inningScores[inningScores.length - 1]
      if ((lastInn.home ?? 0) > 0) gameEvents.push('walk_off')
    }
    if (inningScores.length > 9)  gameEvents.push('extra_innings')
    if (inningScores.length >= 12) gameEvents.push('twelve_plus_innings')
    if (awayHitsTotal === 0 && awayLS.hits != null) {
      const pitcherCount = homeBox.pitchers?.length ?? 0
      const awayBB  = awayBox.teamStats?.batting?.baseOnBalls ?? 0
      const awayHBP = awayBox.teamStats?.batting?.hitByPitch  ?? 0
      gameEvents.push('no_hitter')
      if (pitcherCount === 1 && awayBB === 0 && awayHBP === 0 && homeErrorsTotal === 0) {
        gameEvents.push('perfect_game')
      } else if (pitcherCount > 1) {
        gameEvents.push('combined_no_hitter')
      }
    }
    if (awayRunsTotal === 0 && homeRunsTotal > 0) gameEvents.push('shutout')
    if (Math.max(homeRunsTotal, awayRunsTotal) >= 15) gameEvents.push('run_factory')
    if (homeRunsTotal + awayRunsTotal === 1) gameEvents.push('pitchers_duel')
    if (allPlays.some((p: any) => (p.result?.description ?? '').toLowerCase().includes('grand slam'))) {
      gameEvents.push('grand_slam')
    }
    {
      const batterHits = new Map<number, Set<string>>()
      for (const play of allPlays) {
        const et: string = play.result?.eventType ?? ''
        const bid: number | undefined = play.matchup?.batter?.id
        if (bid && ['single', 'double', 'triple', 'home_run'].includes(et)) {
          if (!batterHits.has(bid)) batterHits.set(bid, new Set())
          batterHits.get(bid)!.add(et)
        }
      }
      if ([...batterHits.values()].some(
        h => h.has('single') && h.has('double') && h.has('triple') && h.has('home_run')
      )) gameEvents.push('cycle')
    }
    if (allPlays.some((p: any) => {
      const desc: string = p.result?.description ?? ''
      return /\b\d{3,}(?:st|nd|rd|th)\b.*(?:home run|homer)/i.test(desc) &&
        /\b(career|all.time)\b/i.test(desc)
    })) gameEvents.push('milestone_hr')

    const update: Record<string, any> = {
      mlb_game_pk: gamePk,
      stats_auto_populated: true,
      game_events: gameEvents,
      home_runs:   homeLS.runs   ?? null,
      away_runs:   awayLS.runs   ?? null,
      home_hits:   homeLS.hits   ?? null,
      away_hits:   awayLS.hits   ?? null,
      home_errors: homeLS.errors ?? null,
      away_errors: awayLS.errors ?? null,
      home_lob:    homeBox.teamStats?.batting?.leftOnBase ?? null,
      away_lob:    awayBox.teamStats?.batting?.leftOnBase ?? null,
      inning_scores: inningScores,
      home_team_record:     homeRec ? `${homeRec.wins}-${homeRec.losses}` : null,
      visiting_team_record: awayRec ? `${awayRec.wins}-${awayRec.losses}` : null,
      winning_pitcher: decisions.winner?.fullName ?? null,
      losing_pitcher:  decisions.loser?.fullName  ?? null,
      save_pitcher:    decisions.save?.fullName   ?? null,
      hp_umpire:           ump('Home Plate'),
      first_base_umpire:   ump('First Base'),
      second_base_umpire:  ump('Second Base'),
      third_base_umpire:   ump('Third Base'),
      attendance: gameData.gameInfo?.attendance ?? null,
    }
    if (firstPitchTime) update.first_pitch_time = firstPitchTime
    if (homeSP?.name) {
      update.home_starter_name = homeSP.name
      update.home_starter_wl   = homeSP.wl
      update.home_starter_ip   = homeSP.ip
      update.home_starter_h    = homeSP.h
      update.home_starter_er   = homeSP.er
      update.home_starter_bb   = homeSP.bb
      update.home_starter_k    = homeSP.k
    }
    if (awaySP?.name) {
      update.away_starter_name = awaySP.name
      update.away_starter_wl   = awaySP.wl
      update.away_starter_ip   = awaySP.ip
      update.away_starter_h    = awaySP.h
      update.away_starter_er   = awaySP.er
      update.away_starter_bb   = awaySP.bb
      update.away_starter_k    = awaySP.k
    }

    const { error } = await supabase.from('stadium_visits').update(update).eq('id', visitId)
    if (error) return { success: false, error: error.message }

    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

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
    const { data: rawStops } = await supabase
      .from('trip_stops')
      .select('*, stadium:stadiums(*)')
      .eq('trip_id', tripId)
      .order('sort_order')

    const stops = (rawStops ?? []) as any[]

    // 1. Mark trip completed
    await supabase
      .from('trips')
      .update({ status: 'completed', ...(completionDate ? { trip_date: completionDate } : {}) })
      .eq('id', tripId)

    // 2. Create a visit record for every stop that has a game date
    const createdVisits: { id: string; visitDate: string; stadiumAbbr: string }[] = []

    for (const stop of stops) {
      if (!stop.game_date) continue
      const stadium = stop.stadium
      if (!stadium) continue

      // Idempotent: skip if this trip already has a visit for this stop
      const { data: existing } = await supabase
        .from('stadium_visits')
        .select('id')
        .eq('trip_id', tripId)
        .eq('stadium_id', stop.stadium_id)
        .eq('visit_date', stop.game_date)
        .maybeSingle()

      if (existing) continue

      // Carry ticket/seat info from the stop into the visit
      const seats     = (stop.ticket_seats ?? []) as string[]
      const firstSeat = seats[0] ?? null
      const extraSeats = seats.slice(1).map((num: string) => ({
        section: stop.ticket_section ?? '',
        row:     stop.ticket_row     ?? '',
        number:  num,
      }))

      const { data: newVisit } = await supabase
        .from('stadium_visits')
        .insert({
          stadium_id:   stop.stadium_id,
          visit_date:   stop.game_date,
          home_team:    stadium.team,
          visiting_team: stop.opponent ?? 'TBD',
          seat_section: stop.ticket_section || null,
          seat_row:     stop.ticket_row     || null,
          seat_number:  firstSeat,
          additional_seats: extraSeats.length > 0 ? extraSeats : null,
          trip_id:      tripId,
          created_by:   user?.id ?? null,
        })
        .select('id')
        .single()

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
      const result = await tryPopulateStats(supabase, id, visitDate, stadiumAbbr)
      statsResults.push({ stadiumAbbr, ...result })
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
