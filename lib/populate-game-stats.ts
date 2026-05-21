import { createClient } from '@/lib/supabase-server'
import { MLB_TEAM_IDS } from '@/lib/mlb-api'

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

export interface PopulateResult {
  success: boolean
  error?: string
  code?: string
  gamePk?: number
  score?: string
  events?: string[]
  attendance?: number
  winningPitcher?: string | null
  losingPitcher?: string | null
}

export async function populateGameStats(
  visitId: string,
  visitDate: string,
  stadiumAbbr: string,
): Promise<PopulateResult> {
  try {
    const teamId = MLB_TEAM_IDS[stadiumAbbr]
    if (!teamId) return { success: false, error: 'Unknown team abbreviation', code: 'unknown_team' }

    const schedRes = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${visitDate}&teamId=${teamId}&gameType=R`,
      { headers: { Accept: 'application/json' } }
    )
    if (!schedRes.ok) return { success: false, error: 'MLB schedule fetch failed', code: 'api_error' }

    const schedData = await schedRes.json()
    const games: any[] = schedData.dates?.[0]?.games ?? []
    const game = games.find((g: any) => g.teams?.home?.team?.id === teamId)
    if (!game) return { success: false, error: 'Home game not found for this date', code: 'no_home_game' }
    if (game.status?.abstractGameState !== 'Final') {
      return { success: false, error: 'Game not yet final', code: 'not_final' }
    }

    const gamePk: number = game.gamePk

    const feedRes = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
      { headers: { Accept: 'application/json' } }
    )
    if (!feedRes.ok) return { success: false, error: 'MLB feed fetch failed', code: 'api_error' }

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

    const inningScores = (linescore.innings ?? []).map((inn: any) => ({
      inning: inn.num,
      home: inn.home?.runs ?? null,
      away: inn.away?.runs ?? null,
    }))

    const homeRec = gameData.teams?.home?.record
    const awayRec = gameData.teams?.away?.record
    const probHome = gameData.probablePitchers?.home
    const probAway = gameData.probablePitchers?.away
    const homeSP = getStarterStats(homeBox, probHome?.id)
    const awaySP = getStarterStats(awayBox, probAway?.id)

    const officials: any[] = boxscore.officials ?? []
    const ump = (type: string) =>
      officials.find(u => u.officialType === type)?.official?.fullName ?? null

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
    const allPlays: any[] = liveData.plays?.allPlays ?? []
    const homeRunsTotal = homeLS.runs ?? 0
    const awayRunsTotal = awayLS.runs ?? 0
    const awayHitsTotal = awayLS.hits ?? 0
    const homeErrorsTotal = homeLS.errors ?? 0
    const gameEvents: string[] = []

    if (homeRunsTotal > awayRunsTotal && inningScores.length > 0) {
      const lastInn = inningScores[inningScores.length - 1]
      if ((lastInn.home ?? 0) > 0) gameEvents.push('walk_off')
    }
    if (inningScores.length > 9)  gameEvents.push('extra_innings')
    if (inningScores.length >= 12) gameEvents.push('twelve_plus_innings')
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
      boxscore_data: boxscore,
      home_runs:   homeLS.runs   ?? null,
      away_runs:   awayLS.runs   ?? null,
      home_hits:   homeLS.hits   ?? null,
      away_hits:   awayLS.hits   ?? null,
      home_errors: homeLS.errors ?? null,
      away_errors: awayLS.errors ?? null,
      home_lob: homeBox.teamStats?.batting?.leftOnBase ?? null,
      away_lob: awayBox.teamStats?.batting?.leftOnBase ?? null,
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

    const supabase = await createClient()
    const { error } = await supabase.from('stadium_visits').update(update).eq('id', visitId)
    if (error) return { success: false, error: error.message, code: 'db_error' }

    const homeTeamName = gameData.teams?.home?.name ?? stadiumAbbr
    const awayTeamName = gameData.teams?.away?.name ?? 'Visitor'
    const score = `${awayTeamName} ${awayRunsTotal}, ${homeTeamName} ${homeRunsTotal}`

    return {
      success: true,
      gamePk,
      score,
      events: gameEvents,
      attendance: gameData.gameInfo?.attendance ?? undefined,
      winningPitcher: decisions.winner?.fullName ?? null,
      losingPitcher:  decisions.loser?.fullName  ?? null,
    }
  } catch (e) {
    console.error('populateGameStats error:', e)
    return { success: false, error: String(e), code: 'exception' }
  }
}
