'use client'

import { useState, useEffect } from 'react'
import type { StadiumVisit, Stadium } from '@/types'
import { GAME_MOMENTS } from '@/lib/moments'
import { Pencil, Trash2, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { fetchGameContent, fetchScoringPlays, type GameContent, type ScoringPlay } from '@/lib/mlb-api'
import { fetchHistoricalWeather, type WeatherData } from '@/lib/open-meteo'

interface BoxScoreProps {
  visit: StadiumVisit
  stadium: Stadium
  firstTimeMoments?: string[]
  fetchingStats?: boolean
  statsError?: string | null
  onEdit: () => void
  onDelete: () => void
}

interface BatterRow {
  id: number; name: string; pos: string
  ab: number|null; r: number|null; h: number|null; rbi: number|null
  bb: number|null; k: number|null; avg: string|null; ops: string|null
}

interface PitcherRow {
  id: number; name: string
  ip: string|null; h: number|null; r: number|null; er: number|null
  bb: number|null; k: number|null; hr: number|null; era: string|null
}

function extractBatters(teamBox: any): BatterRow[] {
  if (!teamBox) return []
  const ids: number[] = teamBox.batters ?? []
  const players: Record<string, any> = teamBox.players ?? {}
  return ids.flatMap(id => {
    const p = players[`ID${id}`]
    if (!p) return []
    const b = p.stats?.batting ?? {}
    const sb = p.seasonStats?.batting ?? {}
    const allPos: any[] = p.allPositions ?? []
    const pos = allPos.length > 0
      ? allPos.map((x: any) => x.abbreviation).join('-')
      : (p.position?.abbreviation ?? '')
    return [{ id, name: p.person?.fullName ?? `#${id}`, pos,
      ab: b.atBats ?? null, r: b.runs ?? null, h: b.hits ?? null,
      rbi: b.rbi ?? null, bb: b.baseOnBalls ?? null, k: b.strikeOuts ?? null,
      avg: sb.avg ?? null, ops: sb.ops ?? null }]
  })
}

function extractPitchers(teamBox: any): PitcherRow[] {
  if (!teamBox) return []
  const ids: number[] = teamBox.pitchers ?? []
  const players: Record<string, any> = teamBox.players ?? {}
  return ids.flatMap(id => {
    const p = players[`ID${id}`]
    if (!p) return []
    const pt = p.stats?.pitching ?? {}
    const sp = p.seasonStats?.pitching ?? {}
    return [{ id, name: p.person?.fullName ?? `#${id}`,
      ip: pt.inningsPitched ?? null, h: pt.hits ?? null, r: pt.runs ?? null,
      er: pt.earnedRuns ?? null, bb: pt.baseOnBalls ?? null, k: pt.strikeOuts ?? null,
      hr: pt.homeRuns ?? null, era: sp.era ?? null }]
  })
}

const numCell = (v: any, highlight?: boolean): React.CSSProperties => ({
  textAlign: 'center', padding: '5px 5px',
  color: highlight ? '#E6EDF3' : '#8B949E',
  fontSize: 12, whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: highlight ? 700 : 400,
})

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#8B949E',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
}

const TABLE_HDR: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#58A6FF',
  borderBottom: '1px solid #30363D', paddingBottom: 6, marginBottom: 0,
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

function BattersTable({ label, batters, totals }: {
  label: string; batters: BatterRow[]; totals: any
}) {
  if (batters.length === 0) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={TABLE_HDR}>{label} BATTING</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 420 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363D' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', color: '#8B949E', fontWeight: 600, fontSize: 11, minWidth: 110, position: 'sticky', left: 0, backgroundColor: '#0D1117', zIndex: 2, borderRight: '1px solid rgba(48,54,61,0.5)' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '4px 4px', color: '#8B949E', fontWeight: 600, fontSize: 11, minWidth: 28 }}>Pos</th>
              {['AB','R','H','RBI','BB','K','AVG','OPS'].map(h => (
                <th key={h} style={{ textAlign: 'center', padding: '4px 5px', color: '#8B949E', fontWeight: 600, fontSize: 11, minWidth: 30 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batters.map((b, i) => (
              <tr key={b.id} style={{
                borderBottom: i < batters.length - 1 ? '1px solid rgba(48,54,61,0.5)' : 'none',
                backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(28,36,48,0.3)',
              }}>
                <td style={{ padding: '5px 6px', color: '#E6EDF3', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, position: 'sticky', left: 0, backgroundColor: '#0D1117', zIndex: 1, borderRight: '1px solid rgba(48,54,61,0.5)' }}>{b.name}</td>
                <td style={{ padding: '5px 4px', color: '#8B949E', fontSize: 11 }}>{b.pos}</td>
                <td style={numCell(b.ab, true)}>{b.ab ?? '—'}</td>
                <td style={numCell(b.r, (b.r ?? 0) > 0)}>{b.r ?? '—'}</td>
                <td style={numCell(b.h, (b.h ?? 0) > 0)}>{b.h ?? '—'}</td>
                <td style={numCell(b.rbi, (b.rbi ?? 0) > 0)}>{b.rbi ?? '—'}</td>
                <td style={numCell(b.bb)}>{b.bb ?? '—'}</td>
                <td style={numCell(b.k)}>{b.k ?? '—'}</td>
                <td style={numCell(b.avg)}>{b.avg ?? '—'}</td>
                <td style={numCell(b.ops)}>{b.ops ?? '—'}</td>
              </tr>
            ))}
            {totals && (
              <tr style={{ borderTop: '1px solid #30363D', backgroundColor: 'rgba(28,36,48,0.6)' }}>
                <td colSpan={2} style={{ padding: '5px 6px', color: '#8B949E', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 0, backgroundColor: '#1C2430', zIndex: 1 }}>Totals</td>
                <td style={numCell(totals.atBats, true)}>{totals.atBats ?? '—'}</td>
                <td style={numCell(totals.runs, true)}>{totals.runs ?? '—'}</td>
                <td style={numCell(totals.hits, true)}>{totals.hits ?? '—'}</td>
                <td style={numCell(totals.rbi, true)}>{totals.rbi ?? '—'}</td>
                <td style={numCell(totals.baseOnBalls, true)}>{totals.baseOnBalls ?? '—'}</td>
                <td style={numCell(totals.strikeOuts, true)}>{totals.strikeOuts ?? '—'}</td>
                <td style={numCell(null)} /><td style={numCell(null)} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PitchersTable({ label, pitchers, winnerName, loserName, saveName }: {
  label: string; pitchers: PitcherRow[]
  winnerName: string|null; loserName: string|null; saveName: string|null
}) {
  if (pitchers.length === 0) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={TABLE_HDR}>{label} PITCHING</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 380 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363D' }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', color: '#8B949E', fontWeight: 600, fontSize: 11, minWidth: 110, position: 'sticky', left: 0, backgroundColor: '#0D1117', zIndex: 2, borderRight: '1px solid rgba(48,54,61,0.5)' }}>Name</th>
              {['IP','H','R','ER','BB','K','HR','ERA'].map(h => (
                <th key={h} style={{ textAlign: 'center', padding: '4px 5px', color: '#8B949E', fontWeight: 600, fontSize: 11, minWidth: 32 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pitchers.map((p, i) => {
              const isW = winnerName && p.name === winnerName
              const isL = loserName && p.name === loserName
              const isS = saveName && p.name === saveName
              const dec = isW ? 'W' : isL ? 'L' : isS ? 'S' : null
              const decColor = isW ? '#3FB950' : isL ? '#F85149' : '#F5A623'
              return (
                <tr key={p.id} style={{
                  borderBottom: i < pitchers.length - 1 ? '1px solid rgba(48,54,61,0.5)' : 'none',
                  backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(28,36,48,0.3)',
                }}>
                  <td style={{ padding: '5px 6px', color: '#E6EDF3', fontSize: 12, whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', position: 'sticky', left: 0, backgroundColor: '#0D1117', zIndex: 1, borderRight: '1px solid rgba(48,54,61,0.5)' }}>
                    {p.name}
                    {dec && <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 800, color: decColor, border: `1px solid ${decColor}`, borderRadius: 4, padding: '1px 4px' }}>{dec}</span>}
                  </td>
                  <td style={numCell(p.ip, true)}>{p.ip ?? '—'}</td>
                  <td style={numCell(p.h)}>{p.h ?? '—'}</td>
                  <td style={numCell(p.r, (p.r ?? 0) > 0)}>{p.r ?? '—'}</td>
                  <td style={numCell(p.er, (p.er ?? 0) > 0)}>{p.er ?? '—'}</td>
                  <td style={numCell(p.bb)}>{p.bb ?? '—'}</td>
                  <td style={numCell(p.k, (p.k ?? 0) > 2)}>{p.k ?? '—'}</td>
                  <td style={numCell(p.hr, (p.hr ?? 0) > 0)}>{p.hr ?? '—'}</td>
                  <td style={numCell(p.era)}>{p.era ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BoxScore({
  visit, stadium, firstTimeMoments = [], fetchingStats = false,
  statsError = null, onEdit, onDelete,
}: BoxScoreProps) {
  const [tab, setTab]           = useState<'overview' | 'box'>('overview')
  const [gameContent, setGameContent]   = useState<GameContent | null>(null)
  const [scoringPlays, setScoringPlays] = useState<ScoringPlay[]>([])
  const [weather, setWeather]           = useState<WeatherData | null>(null)

  useEffect(() => {
    if (visit.mlb_game_pk) {
      fetchGameContent(visit.mlb_game_pk).then(setGameContent)
      fetchScoringPlays(visit.mlb_game_pk).then(setScoringPlays)
    }
  }, [visit.mlb_game_pk])

  useEffect(() => {
    if (visit.temperature != null) return
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    if (visit.visit_date >= today) return
    fetchHistoricalWeather(stadium.lat, stadium.lng, visit.visit_date).then(setWeather)
  }, [visit.id, visit.temperature, visit.visit_date, stadium.lat, stadium.lng])

  const boxData = visit.boxscore_data as any
  const awayBoxTeam = boxData?.teams?.away
  const homeBoxTeam = boxData?.teams?.home
  const awayBatters = extractBatters(awayBoxTeam)
  const homeBatters = extractBatters(homeBoxTeam)
  const awayPitchers = extractPitchers(awayBoxTeam)
  const homePitchers = extractPitchers(homeBoxTeam)
  const hasFullBox = awayBatters.length > 0 || homeBatters.length > 0
  const awayTotals = awayBoxTeam?.teamStats?.batting
  const homeTotals = homeBoxTeam?.teamStats?.batting

  const homeScore = visit.home_runs
  const awayScore = visit.away_runs
  const hasScore = homeScore != null && awayScore != null
  const homeWins = hasScore && homeScore > awayScore!
  const awayWins = hasScore && awayScore! > homeScore

  const innings = visit.inning_scores ?? []
  const lastInn = innings[innings.length - 1]
  const isWalkOff = homeWins && lastInn && (lastInn.home ?? 0) > 0 && innings.length >= 9

  // Seat info string
  const seatParts: string[] = []
  if (visit.seat_section) seatParts.push(`Section ${visit.seat_section}`)
  if (visit.seat_row) seatParts.push(`Row ${visit.seat_row}`)
  const seatNums = [visit.seat_number, ...(visit.additional_seats ?? []).map(s => s.number)].filter(Boolean)
  if (seatNums.length > 0) seatParts.push(`${seatNums.length > 1 ? 'Seats' : 'Seat'} ${seatNums.join(', ')}`)
  const seatString = seatParts.join(' · ')

  return (
    <div style={{
      backgroundColor: '#0D1117', borderRadius: 14, border: '1px solid #30363D',
      overflow: 'hidden', marginBottom: 12,
    }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #30363D' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {fetchingStats ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8B949E' }}>
                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                Fetching MLB stats…
              </div>
            ) : visit.stats_auto_populated ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#3FB950', background: 'rgba(63,185,80,0.1)', borderRadius: 20, padding: '2px 8px' }}>
                ⚾ Stats from MLB
              </div>
            ) : statsError ? (
              <div style={{ fontSize: 11, color: '#F85149' }}>{statsError}</div>
            ) : null}
            <div style={{ fontSize: 12, color: '#8B949E' }}>{formatDate(visit.visit_date)}</div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={onEdit} style={{ padding: '4px', borderRadius: 7, border: '1px solid #30363D', background: '#1C2430', cursor: 'pointer' }} title="Edit">
              <Pencil size={12} color="#8B949E" />
            </button>
            <button onClick={onDelete} style={{ padding: '4px', borderRadius: 7, border: '1px solid rgba(248,81,73,0.3)', background: 'rgba(248,81,73,0.08)', cursor: 'pointer' }} title="Delete">
              <Trash2 size={12} color="#F85149" />
            </button>
          </div>
        </div>

        {/* Score */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>{visit.visiting_team}</div>
            {visit.visiting_team_record && <div style={{ fontSize: 10, color: '#8B949E' }}>({visit.visiting_team_record})</div>}
          </div>
          <div style={{ textAlign: 'center' }}>
            {hasScore ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: awayWins ? '#E6EDF3' : '#8B949E' }}>{awayScore}</span>
                <span style={{ fontSize: 16, color: '#30363D', fontWeight: 300 }}>–</span>
                <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: homeWins ? '#E6EDF3' : '#8B949E' }}>{homeScore}</span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#8B949E' }}>vs</div>
            )}
            <div style={{ fontSize: 9, fontWeight: 700, color: '#8B949E', marginTop: 1, letterSpacing: '0.08em' }}>
              {hasScore ? `FINAL${innings.length > 9 ? `/${innings.length}` : ''}${isWalkOff ? ' · WO' : ''}` : null}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>{visit.home_team}</div>
            {visit.home_team_record && <div style={{ fontSize: 10, color: '#8B949E' }}>({visit.home_team_record})</div>}
          </div>
        </div>

        {/* Seat info — always visible */}
        {seatString && (
          <div style={{ fontSize: 12, color: '#58A6FF', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>🎟️</span>
            <span>{seatString}</span>
          </div>
        )}

        {/* Decisions */}
        {(visit.winning_pitcher || visit.losing_pitcher) && (
          <div style={{ fontSize: 11, color: '#8B949E', display: 'flex', flexWrap: 'wrap', gap: '3px 10px', marginBottom: 4 }}>
            {visit.winning_pitcher && <span><span style={{ color: '#3FB950', fontWeight: 600 }}>W</span> {visit.winning_pitcher}</span>}
            {visit.losing_pitcher && <span><span style={{ color: '#F85149', fontWeight: 600 }}>L</span> {visit.losing_pitcher}</span>}
            {visit.save_pitcher && <span><span style={{ color: '#F5A623', fontWeight: 600 }}>S</span> {visit.save_pitcher}</span>}
          </div>
        )}

        {/* First pitch + attendance */}
        {(visit.first_pitch_time || visit.attendance) && (
          <div style={{ fontSize: 11, color: '#8B949E', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {visit.first_pitch_time && <span>First pitch: {visit.first_pitch_time}</span>}
            {visit.attendance && <span>{visit.attendance.toLocaleString()} fans</span>}
          </div>
        )}
      </div>

      {/* ── LINE SCORE ── */}
      {innings.length > 0 && (
        <div style={{ borderBottom: '1px solid #30363D', overflowX: 'auto', backgroundColor: '#0B1117' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #30363D' }}>
                <th style={{ textAlign: 'left', padding: '5px 10px', color: '#8B949E', fontWeight: 600, minWidth: 52, position: 'sticky', left: 0, backgroundColor: '#0B1117', zIndex: 1 }}>Team</th>
                {innings.map(inn => (
                  <th key={inn.inning} style={{ textAlign: 'center', padding: '5px 6px', color: '#8B949E', fontWeight: 600, minWidth: 22, fontSize: 11 }}>{inn.inning}</th>
                ))}
                <th style={{ textAlign: 'center', padding: '5px 6px', color: '#E6EDF3', fontWeight: 700, borderLeft: '1px solid #30363D', minWidth: 22 }}>R</th>
                <th style={{ textAlign: 'center', padding: '5px 6px', color: '#8B949E', fontWeight: 600, minWidth: 22 }}>H</th>
                <th style={{ textAlign: 'center', padding: '5px 6px', color: '#8B949E', fontWeight: 600, minWidth: 22 }}>E</th>
              </tr>
            </thead>
            <tbody>
              {(['away', 'home'] as const).map(side => {
                const teamName = side === 'away' ? visit.visiting_team : visit.home_team
                const totalR = side === 'away' ? awayScore : homeScore
                const totalH = side === 'away' ? visit.away_hits : visit.home_hits
                const totalE = side === 'away' ? visit.away_errors : visit.home_errors
                const wins = side === 'away' ? awayWins : homeWins
                return (
                  <tr key={side}>
                    <td style={{ padding: '5px 10px', fontWeight: wins ? 700 : 500, fontSize: 12, color: wins ? '#E6EDF3' : '#8B949E', position: 'sticky', left: 0, backgroundColor: '#0B1117', zIndex: 1, borderRight: '1px solid rgba(48,54,61,0.4)' }}>
                      {teamName}
                    </td>
                    {innings.map(inn => {
                      const val = inn[side]
                      return (
                        <td key={inn.inning} style={{ textAlign: 'center', padding: '5px 6px', color: (val != null && val > 0) ? '#E6EDF3' : '#8B949E', fontWeight: (val != null && val > 0) ? 700 : 400, fontSize: 12 }}>
                          {val ?? (side === 'home' && inn.inning === innings.length && homeWins ? 'x' : '—')}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'center', padding: '5px 6px', fontWeight: 800, fontSize: 13, color: wins ? '#E6EDF3' : '#8B949E', borderLeft: '1px solid #30363D' }}>{totalR ?? '—'}</td>
                    <td style={{ textAlign: 'center', padding: '5px 6px', color: '#8B949E', fontSize: 12 }}>{totalH ?? '—'}</td>
                    <td style={{ textAlign: 'center', padding: '5px 6px', color: '#8B949E', fontSize: 12 }}>{totalE ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #30363D', backgroundColor: '#0D1117' }}>
        {(['overview', 'box'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', fontSize: 11, fontWeight: 700,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t ? '#E6EDF3' : '#8B949E',
            borderBottom: tab === t ? '2px solid #1F6FEB' : '2px solid transparent',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {t === 'overview' ? 'Game Overview' : 'Box'}
          </button>
        ))}
        {visit.mlb_game_pk && (
          <a href={`https://www.mlb.com/gameday/${visit.mlb_game_pk}/final/box-score`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 11, fontWeight: 600, color: '#8B949E', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            MLB.com ↗
          </a>
        )}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ padding: '14px' }}>

        {/* BOX TAB */}
        {tab === 'box' && (
          <>
            {hasFullBox ? (
              <>
                <BattersTable label={visit.visiting_team} batters={awayBatters} totals={awayTotals} />
                <PitchersTable label={visit.visiting_team} pitchers={awayPitchers} winnerName={visit.winning_pitcher} loserName={visit.losing_pitcher} saveName={visit.save_pitcher} />
                <BattersTable label={visit.home_team} batters={homeBatters} totals={homeTotals} />
                <PitchersTable label={visit.home_team} pitchers={homePitchers} winnerName={visit.winning_pitcher} loserName={visit.losing_pitcher} saveName={visit.save_pitcher} />
              </>
            ) : (
              <>
                {(visit.home_starter_name || visit.away_starter_name) && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={LABEL}>Starting Pitchers</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        { side: 'Away', name: visit.away_starter_name, wl: visit.away_starter_wl, ip: visit.away_starter_ip, h: visit.away_starter_h, er: visit.away_starter_er, bb: visit.away_starter_bb, k: visit.away_starter_k },
                        { side: 'Home', name: visit.home_starter_name, wl: visit.home_starter_wl, ip: visit.home_starter_ip, h: visit.home_starter_h, er: visit.home_starter_er, bb: visit.home_starter_bb, k: visit.home_starter_k },
                      ].map(({ side, name, wl, ip, h, er, bb, k }) => name ? (
                        <div key={side} style={{ backgroundColor: '#1C2430', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 11, color: '#8B949E' }}>{side}</div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#E6EDF3' }}>{name}</div>
                          {wl && <div style={{ fontSize: 12, color: '#8B949E', marginTop: 1 }}>{wl}</div>}
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 12, color: '#8B949E' }}>
                            {ip && <span>IP: {ip}</span>}
                            {h != null && <span>H: {h}</span>}
                            {er != null && <span>ER: {er}</span>}
                            {bb != null && <span>BB: {bb}</span>}
                            {k != null && <span>K: {k}</span>}
                          </div>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}
                {visit.home_runs != null && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={LABEL}>Team Stats</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: '#8B949E', fontSize: 11 }}>
                            <th style={{ textAlign: 'left', paddingBottom: 5, paddingRight: 12 }}>Team</th>
                            {['R','H','E','LOB'].map(h => (
                              <th key={h} style={{ textAlign: 'center', paddingBottom: 5, paddingLeft: 10, paddingRight: 10 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { team: visit.visiting_team, r: visit.away_runs, h: visit.away_hits, e: visit.away_errors, lob: visit.away_lob },
                            { team: visit.home_team, r: visit.home_runs, h: visit.home_hits, e: visit.home_errors, lob: visit.home_lob },
                          ].map(({ team, r, h, e, lob }) => (
                            <tr key={team}>
                              <td style={{ paddingRight: 12, paddingBottom: 4, color: '#E6EDF3' }}>{team}</td>
                              <td style={{ textAlign: 'center', paddingLeft: 10, paddingRight: 10, paddingBottom: 4, fontWeight: 700, color: '#E6EDF3' }}>{r ?? '—'}</td>
                              <td style={{ textAlign: 'center', paddingLeft: 10, paddingRight: 10, paddingBottom: 4, color: '#8B949E' }}>{h ?? '—'}</td>
                              <td style={{ textAlign: 'center', paddingLeft: 10, paddingRight: 10, paddingBottom: 4, color: '#8B949E' }}>{e ?? '—'}</td>
                              <td style={{ textAlign: 'center', paddingLeft: 10, paddingRight: 10, paddingBottom: 4, color: '#8B949E' }}>{lob ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {!visit.stats_auto_populated && (
                  <div style={{ fontSize: 12, color: '#8B949E', textAlign: 'center', padding: '10px 0' }}>
                    Full batter / pitcher tables load automatically after the game is final.
                  </div>
                )}
              </>
            )}
            {visit.stats_auto_populated && (
              <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(48,54,61,0.5)', textAlign: 'center', fontSize: 11, color: '#8B949E' }}>
                ⚾ Official data via MLB Stats API
              </div>
            )}
          </>
        )}

        {/* GAME OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            {(visit.weather || visit.game_duration || visit.temperature || weather) && (
              <div style={{ marginBottom: 14 }}>
                <div style={LABEL}>Game Info</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {(visit.weather || visit.temperature || weather) && (
                    <div>
                      <div style={{ fontSize: 11, color: '#8B949E' }}>Weather</div>
                      <div style={{ fontSize: 13, color: '#E6EDF3', marginTop: 1 }}>
                        {visit.weather
                          ? `${visit.weather}${visit.temperature ? ` · ${visit.temperature}°F` : ''}`
                          : weather
                            ? `${weather.emoji} ${weather.condition} · ${weather.tempF}°F`
                            : null}
                      </div>
                    </div>
                  )}
                  {visit.game_duration && (
                    <div>
                      <div style={{ fontSize: 11, color: '#8B949E' }}>Duration</div>
                      <div style={{ fontSize: 13, color: '#E6EDF3', marginTop: 1 }}>{visit.game_duration}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {visit.moments && visit.moments.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={LABEL}>Game Day Moments</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {visit.moments.map(momentId => {
                    const m = GAME_MOMENTS.find(gm => gm.id === momentId)
                    if (!m) return null
                    const isFirst = firstTimeMoments.includes(momentId)
                    return (
                      <span key={momentId} className={isFirst ? 'achievement-earned' : ''} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        backgroundColor: 'rgba(31,111,235,0.1)', color: '#58A6FF',
                        border: '1px solid rgba(31,111,235,0.2)',
                        ...(isFirst ? { boxShadow: '0 0 12px rgba(245,166,35,0.4)', borderColor: 'rgba(245,166,35,0.5)', color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.1)' } : {}),
                      }}>
                        <span style={{ fontSize: 14 }}>{m.icon}</span>{m.label}
                        {isFirst && <span style={{ fontSize: 10, marginLeft: 2, fontWeight: 800 }}>★ First!</span>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {(visit.hp_umpire || visit.first_base_umpire) && (
              <div style={{ marginBottom: 14 }}>
                <div style={LABEL}>Umpires</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13, color: '#8B949E' }}>
                  {visit.hp_umpire && <span><span style={{ color: '#E6EDF3', fontWeight: 600 }}>HP</span> {visit.hp_umpire}</span>}
                  {visit.first_base_umpire && <span><span style={{ color: '#E6EDF3', fontWeight: 600 }}>1B</span> {visit.first_base_umpire}</span>}
                  {visit.second_base_umpire && <span><span style={{ color: '#E6EDF3', fontWeight: 600 }}>2B</span> {visit.second_base_umpire}</span>}
                  {visit.third_base_umpire && <span><span style={{ color: '#E6EDF3', fontWeight: 600 }}>3B</span> {visit.third_base_umpire}</span>}
                </div>
              </div>
            )}

            {visit.photo_url && (
              <div style={{ marginBottom: 14 }}>
                <div style={LABEL}>Photo</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={visit.photo_url} alt="Game photo" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 10 }} />
              </div>
            )}

            {visit.notes && (
              <div>
                <div style={LABEL}>Notes</div>
                <div style={{ fontSize: 13, color: '#E6EDF3', backgroundColor: '#1C2430', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap' }}>{visit.notes}</div>
              </div>
            )}

            {!visit.moments?.length && !visit.hp_umpire && !visit.photo_url && !visit.notes && !visit.weather && (
              <div style={{ fontSize: 13, color: '#8B949E', textAlign: 'center', padding: '12px 0' }}>
                Edit this game to add notes, photos, and more.
              </div>
            )}

            {/* Scoring plays */}
            {scoringPlays.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={LABEL}>Scoring Plays</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {scoringPlays.map((play, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderRadius: 8, backgroundColor: '#1C2430', border: '1px solid #30363D' }}>
                      <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#484F58', width: 44, paddingTop: 1 }}>
                        {play.halfInning === 'top' ? '▲' : '▼'}{play.inning}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: '#C9D1D9', lineHeight: 1.5 }}>{play.description}</div>
                      </div>
                      <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#8B949E', paddingTop: 1 }}>
                        {play.awayScore}–{play.homeScore}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Game recap + highlights */}
            {gameContent && (gameContent.recap || gameContent.highlights.length > 0) && (
              <div style={{ marginTop: 14 }}>
                <div style={LABEL}>Game Recap</div>
                {gameContent.recap && (
                  <div style={{ fontSize: 13, color: '#C9D1D9', lineHeight: 1.6, marginBottom: gameContent.highlights.length > 0 ? 12 : 0, fontStyle: 'italic' }}>
                    {gameContent.recap.length > 220 ? gameContent.recap.slice(0, 220) + '…' : gameContent.recap}
                  </div>
                )}
                {gameContent.highlights.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {gameContent.highlights.map((h, i) => (
                      <a
                        key={i}
                        href={h.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 8, textDecoration: 'none',
                          backgroundColor: '#1C2430', border: '1px solid #30363D',
                        }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>▶</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#58A6FF', lineHeight: 1.3 }}>{h.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
