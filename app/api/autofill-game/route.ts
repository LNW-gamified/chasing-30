import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const MLB_TEAM_IDS: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CWS: 145,
  CIN: 113, CLE: 114, COL: 115, DET: 116, HOU: 117, KC:  118,
  LAA: 108, LAD: 119, MIA: 146, MIL: 158, MIN: 142, NYM: 121,
  NYY: 147, OAK: 133, PHI: 143, PIT: 134, SD:  135, SF:  137,
  SEA: 136, STL: 138, TB:  139, TEX: 140, TOR: 141, WSH: 120,
}

interface StarterStats {
  name: string | null
  wl: string | null
  ip: string | null
  h: number | null
  er: number | null
  bb: number | null
  k: number | null
}

function getStarterStats(teamBox: any, probableId: number | undefined): StarterStats | null {
  const pitcherId = probableId ?? teamBox?.pitchers?.[0]
  if (!pitcherId) return null
  const player = teamBox?.players?.[`ID${pitcherId}`]
  if (!player) return null
  const gp = player.stats?.pitching ?? {}
  const sp = player.seasonStats?.pitching ?? {}
  return {
    name: player.person?.fullName ?? null,
    wl: (sp.wins != null && sp.losses != null) ? `${sp.wins}-${sp.losses}` : null,
    ip: gp.inningsPitched ?? null,
    h: gp.hits ?? null,
    er: gp.earnedRuns ?? null,
    bb: gp.baseOnBalls ?? null,
    k: gp.strikeOuts ?? null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { visitId, visitDate, stadiumAbbr } = await req.json() as {
      visitId: string
      visitDate: string
      stadiumAbbr: string
    }

    const teamId = MLB_TEAM_IDS[stadiumAbbr]
    if (!teamId) return NextResponse.json({ error: 'Unknown team abbreviation' }, { status: 400 })

    // Find the gamePk from the MLB schedule
    const schedRes = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${visitDate}&teamId=${teamId}&gameType=R`,
      { headers: { Accept: 'application/json' } }
    )
    if (!schedRes.ok) return NextResponse.json({ error: 'MLB schedule fetch failed' }, { status: 502 })

    const schedData = await schedRes.json()
    const games: any[] = schedData.dates?.[0]?.games ?? []
    const game = games.find((g: any) => g.teams?.home?.team?.id === teamId)
    if (!game) return NextResponse.json({ error: 'Home game not found for this date' }, { status: 404 })
    if (game.status?.abstractGameState !== 'Final') {
      return NextResponse.json({ error: 'Game not yet final', state: game.status?.abstractGameState }, { status: 422 })
    }

    const gamePk: number = game.gamePk

    // Fetch the live feed
    const feedRes = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
      { headers: { Accept: 'application/json' } }
    )
    if (!feedRes.ok) return NextResponse.json({ error: 'MLB feed fetch failed' }, { status: 502 })

    const feed = await feedRes.json()
    const gameData = feed.gameData ?? {}
    const liveData = feed.liveData ?? {}
    const linescore = liveData.linescore ?? {}
    const boxscore = liveData.boxscore ?? {}
    const decisions = liveData.decisions ?? {}

    const homeLS = linescore.teams?.home ?? {}
    const awayLS = linescore.teams?.away ?? {}
    const homeBox = boxscore.teams?.home ?? {}
    const awayBox = boxscore.teams?.away ?? {}

    // Inning-by-inning scores
    const inningScores = (linescore.innings ?? []).map((inn: any) => ({
      inning: inn.num,
      home: inn.home?.runs ?? null,
      away: inn.away?.runs ?? null,
    }))

    // Win-loss records
    const homeRec = gameData.teams?.home?.record
    const awayRec = gameData.teams?.away?.record

    // Starting pitchers
    const probHome = gameData.probablePitchers?.home
    const probAway = gameData.probablePitchers?.away
    const homeSP = getStarterStats(homeBox, probHome?.id)
    const awaySP = getStarterStats(awayBox, probAway?.id)

    // Umpires
    const officials: any[] = boxscore.officials ?? []
    const ump = (type: string) =>
      officials.find(u => u.officialType === type)?.official?.fullName ?? null

    // First pitch local time (display in PT for simplicity)
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

    // ── Game event detection ───────────────────────────────────────────────
    const allPlays: any[] = liveData.plays?.allPlays ?? []
    const homeRunsTotal = homeLS.runs ?? 0
    const awayRunsTotal = awayLS.runs ?? 0
    const awayHitsTotal = awayLS.hits ?? 0
    const homeErrorsTotal = homeLS.errors ?? 0

    const gameEvents: string[] = []

    // Walk-off: home wins and scored in bottom of last inning
    if (homeRunsTotal > awayRunsTotal && inningScores.length > 0) {
      const lastInn = inningScores[inningScores.length - 1]
      if ((lastInn.home ?? 0) > 0) gameEvents.push('walk_off')
    }

    // Extra innings
    if (inningScores.length > 9)  gameEvents.push('extra_innings')
    if (inningScores.length >= 12) gameEvents.push('twelve_plus_innings')

    // No-hitter / perfect game / combined no-hitter
    if (awayHitsTotal === 0 && awayLS.hits != null) {
      const pitcherCount: number = homeBox.pitchers?.length ?? 0
      const awayBB  = awayBox.teamStats?.batting?.baseOnBalls ?? 0
      const awayHBP = awayBox.teamStats?.batting?.hitByPitch  ?? 0

      gameEvents.push('no_hitter')
      if (pitcherCount === 1 && awayBB === 0 && awayHBP === 0 && homeErrorsTotal === 0) {
        gameEvents.push('perfect_game')
      } else if (pitcherCount > 1) {
        gameEvents.push('combined_no_hitter')
      }
    }

    // Shutout: home team wins, away scored 0
    if (awayRunsTotal === 0 && homeRunsTotal > 0) gameEvents.push('shutout')

    // Run factory: either team scores 15+
    if (Math.max(homeRunsTotal, awayRunsTotal) >= 15) gameEvents.push('run_factory')

    // Pitcher's duel: 1-0 final
    if (homeRunsTotal + awayRunsTotal === 1) gameEvents.push('pitchers_duel')

    // Grand slam: scan play descriptions
    if (allPlays.some((p: any) => (p.result?.description ?? '').toLowerCase().includes('grand slam'))) {
      gameEvents.push('grand_slam')
    }

    // Hit for the cycle: one batter records a single, double, triple, and HR
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

    // Milestone home run: career HR milestone callouts in play descriptions
    if (allPlays.some((p: any) => {
      const desc: string = p.result?.description ?? ''
      return /\b\d{3,}(?:st|nd|rd|th)\b.*(?:home run|homer)/i.test(desc) &&
        /\b(career|all.time)\b/i.test(desc)
    })) gameEvents.push('milestone_hr')

    // ── Build update payload ───────────────────────────────────────────────
    const update: Record<string, any> = {
      mlb_game_pk: gamePk,
      stats_auto_populated: true,
      game_events: gameEvents,
      boxscore_data: boxscore,
      // Final score R/H/E
      home_runs:   homeLS.runs   ?? null,
      away_runs:   awayLS.runs   ?? null,
      home_hits:   homeLS.hits   ?? null,
      away_hits:   awayLS.hits   ?? null,
      home_errors: homeLS.errors ?? null,
      away_errors: awayLS.errors ?? null,
      // LOB from boxscore batting
      home_lob: homeBox.teamStats?.batting?.leftOnBase ?? null,
      away_lob: awayBox.teamStats?.batting?.leftOnBase ?? null,
      // Inning detail
      inning_scores: inningScores,
      // Records
      home_team_record:     homeRec ? `${homeRec.wins}-${homeRec.losses}` : null,
      visiting_team_record: awayRec ? `${awayRec.wins}-${awayRec.losses}` : null,
      // Decisions
      winning_pitcher: decisions.winner?.fullName ?? null,
      losing_pitcher:  decisions.loser?.fullName  ?? null,
      save_pitcher:    decisions.save?.fullName   ?? null,
      // Umpires
      hp_umpire:           ump('Home Plate'),
      first_base_umpire:   ump('First Base'),
      second_base_umpire:  ump('Second Base'),
      third_base_umpire:   ump('Third Base'),
      // Attendance
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

    const supabase = await createClient()
    const { error } = await supabase.from('stadium_visits').update(update).eq('id', visitId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('autofill-game error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
