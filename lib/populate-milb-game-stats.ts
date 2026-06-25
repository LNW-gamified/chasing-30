import { createClient } from '@/lib/supabase-server'

function getStarterStats(teamBox: any, probableId: number | undefined) {
  const pitcherId = probableId ?? teamBox?.pitchers?.[0]
  if (!pitcherId) return null
  const player = teamBox?.players?.[`ID${pitcherId}`]
  if (!player) return null
  const gp = player.stats?.pitching ?? {}
  return {
    name: player.person?.fullName ?? null,
    ip:   gp.inningsPitched ?? null,
    h:    gp.hits           ?? null,
    er:   gp.earnedRuns     ?? null,
    bb:   gp.baseOnBalls    ?? null,
    k:    gp.strikeOuts     ?? null,
  }
}

export interface MiLBPopulateResult {
  success: boolean
  error?: string
  code?: string
  gamePk?: number
  score?: string
  attendance?: number
}

export async function populateMiLBGameStats(
  entryId: string,
  visitDate: string,
  milbTeamId: number,
): Promise<MiLBPopulateResult> {
  try {
    const schedRes = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=13&teamId=${milbTeamId}&date=${visitDate}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!schedRes.ok) return { success: false, error: 'MiLB schedule fetch failed', code: 'api_error' }

    const schedData = await schedRes.json()
    const games: any[] = schedData.dates?.[0]?.games ?? []
    const game = games.find((g: any) => g.teams?.home?.team?.id === milbTeamId)
    if (!game) return { success: false, error: 'Home game not found for this date', code: 'no_home_game' }
    if (game.status?.abstractGameState !== 'Final') {
      return { success: false, error: 'Game not yet final', code: 'not_final' }
    }

    const gamePk: number = game.gamePk

    const feedRes = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
      { headers: { Accept: 'application/json' } }
    )
    if (!feedRes.ok) return { success: false, error: 'MiLB feed fetch failed', code: 'api_error' }

    const feed = await feedRes.json()
    const gameData = feed.gameData ?? {}
    const liveData = feed.liveData ?? {}
    const linescore = liveData.linescore ?? {}
    const boxscore  = liveData.boxscore  ?? {}
    const decisions = liveData.decisions ?? {}

    const homeLS  = linescore.teams?.home ?? {}
    const awayLS  = linescore.teams?.away ?? {}
    const homeBox = boxscore.teams?.home  ?? {}
    const awayBox = boxscore.teams?.away  ?? {}

    const inningScores = (linescore.innings ?? []).map((inn: any) => ({
      inning: inn.num,
      home:   inn.home?.runs ?? null,
      away:   inn.away?.runs ?? null,
    }))

    const probHome = gameData.probablePitchers?.home
    const probAway = gameData.probablePitchers?.away
    const homeSP   = getStarterStats(homeBox, probHome?.id)
    const awaySP   = getStarterStats(awayBox, probAway?.id)

    const officials: any[] = boxscore.officials ?? []
    const hpUmpire = officials.find(u => u.officialType === 'Home Plate')?.official?.fullName ?? null

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

    const homeTeamName = gameData.teams?.home?.name ?? ''
    const awayTeamName = gameData.teams?.away?.name ?? ''
    const homeRunsTotal = homeLS.runs ?? 0
    const awayRunsTotal = awayLS.runs ?? 0

    const gameDataPayload: Record<string, unknown> = {
      gamePk,
      homeTeamName,
      awayTeamName,
      inningScores,
      homeRuns:       homeLS.runs    ?? null,
      awayRuns:       awayLS.runs    ?? null,
      homeHits:       homeLS.hits    ?? null,
      awayHits:       awayLS.hits    ?? null,
      homeErrors:     homeLS.errors  ?? null,
      awayErrors:     awayLS.errors  ?? null,
      homeLob:        homeBox.teamStats?.batting?.leftOnBase ?? null,
      awayLob:        awayBox.teamStats?.batting?.leftOnBase ?? null,
      winningPitcher: decisions.winner?.fullName ?? null,
      losingPitcher:  decisions.loser?.fullName  ?? null,
      savePitcher:    decisions.save?.fullName   ?? null,
      homeSP,
      awaySP,
      hpUmpire,
      attendance:     gameData.gameInfo?.attendance ?? null,
      firstPitchTime,
      boxscore,
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('baseball_life_entries')
      .update({
        game_pk:          gamePk,
        game_data:        gameDataPayload,
        final_score_home: homeRunsTotal,
        final_score_away: awayRunsTotal,
        home_team:        homeTeamName || null,
        away_team:        awayTeamName || null,
      })
      .eq('id', entryId)

    if (error) return { success: false, error: error.message, code: 'db_error' }

    return {
      success:    true,
      gamePk,
      score:      `${awayTeamName} ${awayRunsTotal}, ${homeTeamName} ${homeRunsTotal}`,
      attendance: gameData.gameInfo?.attendance ?? undefined,
    }
  } catch (e) {
    console.error('populateMiLBGameStats error:', e)
    return { success: false, error: String(e), code: 'exception' }
  }
}
