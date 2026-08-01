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

// ─── Bracket geometry ─────────────────────────────────────────────────────────
//
// MLB's postseason shape never varies: each league runs 2 Wild Card series
// (seeds 3–6) while the top 2 seeds sit out with a bye, straight into 2
// Division Series slots; those 2 winners meet in 1 Championship Series; the
// two Championship Series winners meet in the World Series. That fixed 2→2→1
// shape per league lets the vertical layout be hardcoded rather than computed
// generically — row 0 and row 1 are the two Wild Card/Division Series slots,
// and every single-matchup round (Championship, World Series) centers between
// them.

const COL_W    = 148
const COL_GAP  = 36
const ROW_H    = 54
const ROW_GAP  = 20
const TOP0     = 0
const TOP1     = ROW_H + ROW_GAP
const CENTER_TOP = (TOP0 + TOP1) / 2
const BRACKET_H  = TOP1 + ROW_H
const LINE_COLOR = '#30363D'

type RoundType = 'F' | 'D' | 'L' | 'W'

// A box's row: 0 (top slot), 1 (bottom slot), or -1 (centered — single-matchup rounds)
interface BracketColumn {
  type: RoundType
  boxes: { matchup: SeriesMatchup; row: number }[]
}

function rowTop(row: number): number {
  return row === -1 ? CENTER_TOP : row === 0 ? TOP0 : TOP1
}
function rowCenterY(row: number): number {
  return rowTop(row) + ROW_H / 2
}

function buildLeagueColumns(league: 'AL' | 'NL', rounds: BracketData['rounds']): BracketColumn[] {
  const forLeague = (gt: RoundType) =>
    rounds.find(r => r.gameType === gt)?.matchups.filter(m => ABBR_LEAGUE[m.teamA.abbr] === league) ?? []

  const wc  = forLeague('F')
  const lds = forLeague('D')
  const lcs = forLeague('L')

  const cols: BracketColumn[] = []
  if (wc.length) cols.push({ type: 'F', boxes: wc.map((m, i) => ({ matchup: m, row: i })) })
  if (lds.length) {
    cols.push({
      type: 'D',
      boxes: lds.map((m, i) => {
        // Align this Division Series box with whichever Wild Card series fed
        // it (shares a team) — the other team is a bye seed with no prior line.
        const feederIdx = wc.findIndex(f =>
          [f.teamA.teamId, f.teamB.teamId].includes(m.teamA.teamId) ||
          [f.teamA.teamId, f.teamB.teamId].includes(m.teamB.teamId)
        )
        return { matchup: m, row: feederIdx >= 0 ? feederIdx : i }
      }),
    })
  }
  if (lcs.length) cols.push({ type: 'L', boxes: [{ matchup: lcs[0], row: -1 }] })
  return cols
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HLine({ top, left, width }: { top: number; left: number; width: number }) {
  return <div style={{ position: 'absolute', top: top - 1, left, width, height: 2, background: LINE_COLOR }} />
}
function VLine({ left, top, height }: { left: number; top: number; height: number }) {
  return <div style={{ position: 'absolute', left: left - 1, top, width: 2, height, background: LINE_COLOR }} />
}

// Connects the boxes of two adjacent columns. Handles both a straight
// same-row link (Wild Card → Division, Championship → World Series) and a
// 2-into-1 merge in either direction (Division → Championship, or the
// mirrored Championship → Division on the reversed NL side).
function ColumnConnector({ left, right, gapLeftX }: { left: BracketColumn; right: BracketColumn; gapLeftX: number }) {
  const midX = gapLeftX + COL_GAP / 2
  const stub = COL_GAP / 2

  if (left.boxes.length === 2 && right.boxes.length === 1) {
    const y0 = rowCenterY(0), y1 = rowCenterY(1), yc = rowCenterY(-1)
    return <>
      <HLine top={y0} left={gapLeftX} width={stub} />
      <HLine top={y1} left={gapLeftX} width={stub} />
      <VLine left={midX} top={Math.min(y0, y1)} height={Math.abs(y1 - y0)} />
      <HLine top={yc} left={midX} width={stub} />
    </>
  }
  if (left.boxes.length === 1 && right.boxes.length === 2) {
    const y0 = rowCenterY(0), y1 = rowCenterY(1), yc = rowCenterY(-1)
    return <>
      <HLine top={y0} left={midX} width={stub} />
      <HLine top={y1} left={midX} width={stub} />
      <VLine left={midX} top={Math.min(y0, y1)} height={Math.abs(y1 - y0)} />
      <HLine top={yc} left={gapLeftX} width={stub} />
    </>
  }
  // Straight link: draw a line for every row present on both sides
  return <>
    {left.boxes
      .filter(lb => right.boxes.some(rb => rb.row === lb.row))
      .map(lb => <HLine key={lb.row} top={rowCenterY(lb.row)} left={gapLeftX} width={COL_GAP} />)}
  </>
}

function TeamLine({ team, dim, bold, isFav }: { team: SeriesTeam; dim: boolean; bold: boolean; isFav: boolean }) {
  const accent = TEAM_PRIMARY[team.abbr] ?? '#1F6FEB'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
      height: (ROW_H - 1) / 2, opacity: dim ? 0.4 : 1,
      background: isFav ? `${accent}22` : 'transparent',
    }}>
      <TeamLogo abbreviation={team.abbr} size={16} />
      <span style={{
        flex: 1, fontSize: 12, fontWeight: bold ? 700 : 500, color: '#E6EDF3',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {team.abbr}
      </span>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#F5A623', fontVariantNumeric: 'tabular-nums' }}>
        {team.wins}
      </span>
    </div>
  )
}

function BracketBox({ x, y, matchup, winsNeeded, favAbbr }: {
  x: number; y: number; matchup: SeriesMatchup; winsNeeded: number; favAbbr: string
}) {
  const { teamA, teamB } = matchup
  const aWon = teamA.wins >= winsNeeded
  const bWon = teamB.wins >= winsNeeded
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: COL_W, height: ROW_H,
      background: '#161B22', border: '1px solid #30363D', borderRadius: 8, overflow: 'hidden',
    }}>
      <TeamLine team={teamA} dim={bWon} bold={aWon} isFav={teamA.abbr === favAbbr} />
      <div style={{ height: 1, background: '#30363D' }} />
      <TeamLine team={teamB} dim={aWon} bold={bWon} isFav={teamB.abbr === favAbbr} />
    </div>
  )
}

function RoundLabel({ x, label }: { x: number; label: string }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: -22, width: COL_W,
      fontSize: 10, fontWeight: 700, color: '#8B949E',
      textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
    }}>
      {label}
    </div>
  )
}

function BracketTree({ data, favAbbr }: { data: BracketData; favAbbr: string }) {
  const alCols = buildLeagueColumns('AL', data.rounds)
  const nlCols = [...buildLeagueColumns('NL', data.rounds)].reverse() // converges toward the center

  const ws = data.rounds.find(r => r.gameType === 'W')?.matchups[0] ?? null
  const winsNeededFor = (type: RoundType) => ROUND_META[type]?.winsNeeded ?? 4

  // Lay out left-to-right: AL rounds → World Series (if it exists) → NL rounds (reversed)
  let x = 0
  const alPositioned = alCols.map(col => { const p = { col, x }; x += COL_W + COL_GAP; return p })
  const wsX = ws != null ? x : null
  if (ws != null) x += COL_W + COL_GAP
  const nlPositioned = nlCols.map(col => { const p = { col, x }; x += COL_W + COL_GAP; return p })
  const totalWidth = Math.max(x - COL_GAP, COL_W)

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ position: 'relative', width: totalWidth, height: BRACKET_H + 22, margin: '22px 0 0' }}>
        {/* Connectors within the AL side */}
        {alPositioned.slice(0, -1).map((p, i) => (
          <ColumnConnector key={`al-${i}`} left={p.col} right={alPositioned[i + 1].col} gapLeftX={p.x + COL_W} />
        ))}
        {/* AL side → World Series */}
        {ws != null && alPositioned.length > 0 && (
          <ColumnConnector
            left={alPositioned[alPositioned.length - 1].col}
            right={{ type: 'W', boxes: [{ matchup: ws, row: -1 }] }}
            gapLeftX={alPositioned[alPositioned.length - 1].x + COL_W}
          />
        )}
        {/* World Series → NL side */}
        {ws != null && nlPositioned.length > 0 && wsX != null && (
          <ColumnConnector
            left={{ type: 'W', boxes: [{ matchup: ws, row: -1 }] }}
            right={nlPositioned[0].col}
            gapLeftX={wsX + COL_W}
          />
        )}
        {/* Connectors within the NL side */}
        {nlPositioned.slice(0, -1).map((p, i) => (
          <ColumnConnector key={`nl-${i}`} left={p.col} right={nlPositioned[i + 1].col} gapLeftX={p.x + COL_W} />
        ))}

        {/* Boxes */}
        {alPositioned.map(({ col, x }) => (
          <div key={`al-col-${col.type}`}>
            <RoundLabel x={x} label={ROUND_META[col.type]?.label ?? col.type} />
            {col.boxes.map(b => (
              <BracketBox key={b.matchup.id} x={x} y={rowTop(b.row)} matchup={b.matchup} winsNeeded={winsNeededFor(col.type)} favAbbr={favAbbr} />
            ))}
          </div>
        ))}
        {ws != null && wsX != null && (
          <div>
            <RoundLabel x={wsX} label="World Series" />
            <BracketBox x={wsX} y={rowTop(-1)} matchup={ws} winsNeeded={4} favAbbr={favAbbr} />
          </div>
        )}
        {nlPositioned.map(({ col, x }) => (
          <div key={`nl-col-${col.type}`}>
            <RoundLabel x={x} label={ROUND_META[col.type]?.label ?? col.type} />
            {col.boxes.map(b => (
              <BracketBox key={b.matchup.id} x={x} y={rowTop(b.row)} matchup={b.matchup} winsNeeded={winsNeededFor(col.type)} favAbbr={favAbbr} />
            ))}
          </div>
        ))}
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

      <BracketTree data={data} favAbbr={favAbbr} />
    </div>
  )
}
