'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'
import { TEAM_PRIMARY } from '@/lib/team-colors'

// ─── Constants ────────────────────────────────────────────────────────────────

const ABBR_LEAGUE: Record<string, 'AL' | 'NL'> = {
  HOU: 'AL', TEX: 'AL', SEA: 'AL', OAK: 'AL', LAA: 'AL',
  NYY: 'AL', BOS: 'AL', TB: 'AL', TOR: 'AL', BAL: 'AL',
  CWS: 'AL', MIN: 'AL', CLE: 'AL', DET: 'AL', KC: 'AL',
  LAD: 'NL', ARI: 'NL', SD: 'NL', SF: 'NL', COL: 'NL',
  ATL: 'NL', PHI: 'NL', MIA: 'NL', WSH: 'NL', NYM: 'NL',
  MIL: 'NL', CHC: 'NL', PIT: 'NL', STL: 'NL', CIN: 'NL',
}

const ID_TO_ABBR: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC',
  113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC',  119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'OAK',
  134: 'PIT', 135: 'SD',  136: 'SEA', 137: 'SF',  138: 'STL',
  139: 'TB',  140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI',
  144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL',
}

// Round order, display label, and games needed to win the series
const ROUND_META: Record<string, { label: string; winsNeeded: number; order: number }> = {
  F: { label: 'Wild Card Series',    winsNeeded: 2, order: 0 },
  D: { label: 'Division Series',     winsNeeded: 3, order: 1 },
  L: { label: 'Championship Series', winsNeeded: 4, order: 2 },
  W: { label: 'World Series',        winsNeeded: 4, order: 3 },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeriesTeam {
  teamId: number
  abbr: string
  wins: number
}

interface SeriesMatchup {
  id: string
  gameType: string
  teamA: SeriesTeam
  teamB: SeriesTeam
}

interface BracketData {
  rounds: { gameType: string; label: string; winsNeeded: number; matchups: SeriesMatchup[] }[]
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function loadBracket(): Promise<BracketData | null> {
  const year = 2025 // TEMP PREVIEW: force last year's completed postseason — revert to new Date().getFullYear()
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule/postseason/series?season=${year}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()
    const seriesList: any[] = data.series ?? []
    if (seriesList.length === 0) return null

    const matchups: SeriesMatchup[] = seriesList.map((s: any) => {
      const games: any[] = s.games ?? []
      const winsByTeam: Record<number, SeriesTeam> = {}
      const order: number[] = []

      for (const g of games) {
        const away = g.teams?.away, home = g.teams?.home
        for (const side of [away, home]) {
          const teamId = side?.team?.id
          if (teamId == null) continue
          if (!(teamId in winsByTeam)) {
            winsByTeam[teamId] = { teamId, abbr: ID_TO_ABBR[teamId] ?? '', wins: 0 }
            order.push(teamId)
          }
        }
        if (g.status?.abstractGameState === 'Final') {
          if (away?.isWinner && away.team?.id != null) winsByTeam[away.team.id].wins++
          if (home?.isWinner && home.team?.id != null) winsByTeam[home.team.id].wins++
        }
      }

      const [teamA, teamB] = order.map(id => winsByTeam[id])
      return { id: s.series?.id ?? '', gameType: s.series?.gameType ?? '', teamA, teamB }
    }).filter(m => m.teamA && m.teamB)

    const byRound = new Map<string, SeriesMatchup[]>()
    for (const m of matchups) {
      if (!byRound.has(m.gameType)) byRound.set(m.gameType, [])
      byRound.get(m.gameType)!.push(m)
    }

    // Within a round, fav-league-agnostic order: AL series first, then NL, then World Series (no league)
    const leagueOrder = (m: SeriesMatchup) => (ABBR_LEAGUE[m.teamA.abbr] === 'AL' ? 0 : 1)

    const rounds = Array.from(byRound.entries())
      .map(([gameType, ms]) => ({
        gameType,
        label: ROUND_META[gameType]?.label ?? gameType,
        winsNeeded: ROUND_META[gameType]?.winsNeeded ?? 4,
        matchups: [...ms].sort((a, b) => leagueOrder(a) - leagueOrder(b)),
      }))
      .sort((a, b) => (ROUND_META[a.gameType]?.order ?? 99) - (ROUND_META[b.gameType]?.order ?? 99))

    return { rounds }
  } catch {
    return null
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MatchupRow({ matchup, winsNeeded, favAbbr }: { matchup: SeriesMatchup; winsNeeded: number; favAbbr: string }) {
  const { teamA, teamB } = matchup
  const isFavRow = teamA.abbr === favAbbr || teamB.abbr === favAbbr
  const favSide = teamA.abbr === favAbbr ? teamA : teamB.abbr === favAbbr ? teamB : null
  const accent = favSide ? (TEAM_PRIMARY[favSide.abbr] ?? '#1F6FEB') : null

  const aWon = teamA.wins >= winsNeeded
  const bWon = teamB.wins >= winsNeeded

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      borderLeft: accent ? `3px solid ${accent}` : '3px solid transparent',
      background: isFavRow ? `${accent}12` : 'transparent',
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', opacity: bWon ? 0.45 : 1 }}>
        <span style={{ fontSize: 13, fontWeight: teamA.abbr === favAbbr || aWon ? 700 : 500, color: '#E6EDF3' }}>{teamA.abbr}</span>
        <TeamLogo abbreviation={teamA.abbr} size={22} />
      </div>

      <span style={{
        fontSize: 15, fontWeight: 800, color: '#F5A623', fontVariantNumeric: 'tabular-nums',
        minWidth: 36, textAlign: 'center', flexShrink: 0,
      }}>
        {teamA.wins}–{teamB.wins}
      </span>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, opacity: aWon ? 0.45 : 1 }}>
        <TeamLogo abbreviation={teamB.abbr} size={22} />
        <span style={{ fontSize: 13, fontWeight: teamB.abbr === favAbbr || bWon ? 700 : 500, color: '#E6EDF3' }}>{teamB.abbr}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlayoffBracket({ favAbbr }: { favAbbr: string }) {
  const [data, setData]               = useState<BracketData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [minsAgo, setMinsAgo]         = useState(0)

  const poll = useCallback(async () => {
    const result = await loadBracket()
    if (result) { setData(result); setLastUpdated(new Date()); setMinsAgo(0) }
  }, [])

  useEffect(() => {
    poll()
    const id = setInterval(poll, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [poll])

  useEffect(() => {
    if (!lastUpdated) return
    const id = setInterval(
      () => setMinsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 60_000)),
      30_000,
    )
    return () => clearInterval(id)
  }, [lastUpdated])

  if (!data) return null

  const updLabel = lastUpdated
    ? minsAgo === 0 ? 'Updated just now' : `Updated ${minsAgo}m ago`
    : null

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
        paddingLeft: 14, borderLeft: '3px solid #F5A623',
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
          🏆 The Playoff Bracket
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {updLabel && <span style={{ fontSize: 13, color: '#8B949E' }}>{updLabel}</span>}
          <button
            onClick={poll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', display: 'flex', padding: 2 }}
            title="Refresh"
          >
            <RefreshCw size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.rounds.map(round => (
          <div key={round.gameType} style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #30363D', background: '#1C2430' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E6EDF3' }}>{round.label}</span>
            </div>
            {round.matchups.map((m, i) => (
              <div key={m.id} style={{ borderTop: i > 0 ? '1px solid rgba(48,54,61,0.5)' : undefined }}>
                <MatchupRow matchup={m} winsNeeded={round.winsNeeded} favAbbr={favAbbr} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
