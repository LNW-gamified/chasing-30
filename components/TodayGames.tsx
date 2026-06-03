'use client'

import { useState, useEffect, useCallback } from 'react'
import TeamLogo from '@/components/TeamLogo'

export interface TodayGame {
  gamePk:     number
  gameDate:   string
  awayAbbr:   string
  homeAbbr:   string
  awayScore:  number | null
  homeScore:  number | null
  isLive:     boolean
  isFinal:    boolean
  isFavorite: boolean
  inning:     string | null
}

interface Props {
  initialGames: TodayGame[]
  favAbbr:      string | null
}

const TEAM_HEX: Record<string, string> = {
  ARI:'#A71930', ATL:'#CE1141', BAL:'#DF4601', BOS:'#BD3039',
  CHC:'#0E3386', CWS:'#27251F', CIN:'#C6011F', CLE:'#00385D',
  COL:'#333366', DET:'#0C2340', HOU:'#002D62', KC: '#004687',
  LAA:'#BA0021', LAD:'#005A9C', MIA:'#00A3E0', MIL:'#12284B',
  MIN:'#002B5C', NYM:'#002D72', NYY:'#003087', OAK:'#003831',
  PHI:'#E81828', PIT:'#FDB827', SD: '#2F241D', SEA:'#005C5C',
  SF: '#FD5A1E', STL:'#C41E3A', TB: '#092C5C', TEX:'#003278',
  TOR:'#134A8E', WSH:'#AB0003',
}

// Sort: favorite first, then LIVE > FINAL > PREVIEW within each group
function sortGames(games: TodayGame[]): TodayGame[] {
  const rank = (g: TodayGame) => {
    const favOffset   = g.isFavorite ? 0 : 100
    const statusRank  = g.isLive ? 0 : g.isFinal ? 1 : 2
    return favOffset + statusRank
  }
  return [...games].sort((a, b) => rank(a) - rank(b))
}

function inPollWindow(): boolean {
  const ptDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  return ptDate.getHours() >= 9
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
      timeZone: 'America/Los_Angeles', hour12: true,
    }) + ' PT'
  } catch { return '' }
}

function StatusBadge({ isLive, isFinal }: { isLive: boolean; isFinal: boolean }) {
  if (isLive) return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: 'rgba(248,81,73,0.18)', border: '1px solid rgba(248,81,73,0.4)',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F85149' }} className="animate-pulse"/>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#F85149', letterSpacing: '0.08em' }}>LIVE</span>
    </div>
  )
  if (isFinal) return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: 'rgba(230,237,243,0.1)', border: '1px solid rgba(230,237,243,0.2)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', letterSpacing: '0.08em' }}>FINAL</span>
    </div>
  )
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: 'rgba(31,111,235,0.15)', border: '1px solid rgba(31,111,235,0.35)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#58A6FF', letterSpacing: '0.08em' }}>PREVIEW</span>
    </div>
  )
}

export default function TodayGames({ initialGames, favAbbr }: Props) {
  const [games, setGames]             = useState<TodayGame[]>(() => sortGames(initialGames))
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secsAgo, setSecsAgo]         = useState(0)

  const poll = useCallback(async () => {
    if (!inPollWindow()) return
    try {
      const res = await fetch('/api/today-games')
      if (!res.ok) return
      const raw = await res.json() as Omit<TodayGame, 'isFavorite'>[]
      const withFav = raw.map(g => ({
        ...g,
        inning:     g.inning ?? null,
        isFavorite: favAbbr !== null && (g.awayAbbr === favAbbr || g.homeAbbr === favAbbr),
      }))
      setGames(sortGames(withFav))
      setLastUpdated(new Date())
      setSecsAgo(0)
    } catch { /* keep existing data */ }
  }, [favAbbr])

  useEffect(() => {
    if (!inPollWindow()) return
    poll()                              // refresh immediately on mount
    const id = setInterval(poll, 60_000)
    return () => clearInterval(id)
  }, [poll])

  useEffect(() => {
    if (!lastUpdated) return
    const id = setInterval(() => {
      setSecsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  if (games.length === 0) return null

  const updatedLabel = lastUpdated
    ? secsAgo < 5 ? 'Updated just now' : `${secsAgo}s ago`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* ── Section header ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, paddingLeft: 14,
        borderLeft: '3px solid #F5A623', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3', letterSpacing: '-0.3px' }}>
            Today at the Ballpark
          </span>
          <div className="animate-pulse" style={{ width: 7, height: 7, backgroundColor: '#F85149', borderRadius: '50%' }}/>
          <span style={{ fontSize: 12, color: '#8B949E' }}>{games.length} games</span>
        </div>
        {updatedLabel && (
          <span style={{ fontSize: 11, color: '#484F58' }}>{updatedLabel}</span>
        )}
      </div>

      {/* ── Mobile: horizontal scroll (unchanged) ──────────────── */}
      <div
        className="flex md:hidden no-scrollbar"
        style={{
          gap: 14, flexWrap: 'nowrap',
          overflowX: 'auto', paddingBottom: 8,
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          flex: 1, alignContent: 'flex-start',
        }}
      >
        {games.map(g => {
          const homeColor = TEAM_HEX[g.homeAbbr] ?? '#161B22'
          const hasScore  = (g.isLive || g.isFinal) && g.awayScore !== null
          const awayWin   = hasScore && g.awayScore! > g.homeScore!
          const homeWin   = hasScore && g.homeScore! > g.awayScore!
          return (
            <div
              key={g.gamePk}
              style={{
                minWidth: 210, flexShrink: 0, scrollSnapAlign: 'start',
                borderRadius: 14, padding: '16px 18px 14px',
                border: g.isFavorite ? '2px solid #1F6FEB' : '1px solid #21262D',
                boxShadow: g.isFavorite ? '0 4px 20px rgba(31,111,235,0.25)' : '0 4px 16px rgba(0,0,0,0.4)',
                position: 'relative', overflow: 'hidden',
                background: `linear-gradient(135deg, ${homeColor}20 0%, #161B22 50%)`,
              }}
            >
              {g.isFavorite && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#1F6FEB' }}/>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <TeamLogo abbreviation={g.awayAbbr} size={40}/>
                  <span style={{ fontSize: 12, fontWeight: 700, color: awayWin ? '#E6EDF3' : '#8B949E' }}>{g.awayAbbr}</span>
                </div>
                <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
                  {hasScore ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: awayWin ? '#E6EDF3' : '#8B949E', letterSpacing: '-1px' }}>{g.awayScore}</span>
                      <span style={{ fontSize: 18, color: '#30363D', fontWeight: 300 }}>–</span>
                      <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: homeWin ? '#E6EDF3' : '#8B949E', letterSpacing: '-1px' }}>{g.homeScore}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtTime(g.gameDate)}</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <TeamLogo abbreviation={g.homeAbbr} size={40}/>
                  <span style={{ fontSize: 12, fontWeight: 700, color: homeWin ? '#E6EDF3' : '#8B949E' }}>{g.homeAbbr}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <StatusBadge isLive={g.isLive} isFinal={g.isFinal}/>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop: 2×5 grid (10 visible), fixed height, vertical scroll ── */}
      <div
        className="hidden md:grid md:grid-cols-2 md:gap-2 games-grid-cap"
        style={{ alignContent: 'start', flexShrink: 0, maxHeight: '472px', overflowY: 'auto' }}
      >
        {games.map(g => {
          const homeColor = TEAM_HEX[g.homeAbbr] ?? '#1C2430'
          const hasScore  = (g.isLive || g.isFinal) && g.awayScore !== null
          const awayWin   = hasScore && g.awayScore! > g.homeScore!
          const homeWin   = hasScore && g.homeScore! > g.awayScore!
          return (
            <div
              key={g.gamePk}
              style={{
                borderRadius: 10, padding: '8px 10px 7px',
                border: g.isFavorite ? '1.5px solid #1F6FEB' : '1px solid #21262D',
                position: 'relative', overflow: 'hidden',
                background: `linear-gradient(135deg, ${homeColor}22 0%, #1C2430 65%)`,
                boxShadow: g.isFavorite ? '0 2px 10px rgba(31,111,235,0.2)' : 'none',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}
            >
              {g.isFavorite && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#1F6FEB' }}/>
              )}

              {/* Teams + score row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Away */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 36 }}>
                  <TeamLogo abbreviation={g.awayAbbr} size={40}/>
                  <span style={{ fontSize: 9, fontWeight: 700, color: awayWin ? '#E6EDF3' : '#8B949E', letterSpacing: '0.03em' }}>{g.awayAbbr}</span>
                </div>

                {/* Score or time */}
                <div style={{ textAlign: 'center', flex: 1, padding: '0 6px' }}>
                  {hasScore ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: awayWin ? '#E6EDF3' : '#8B949E', letterSpacing: '-1px' }}>{g.awayScore}</span>
                      <span style={{ fontSize: 13, color: '#484F58', fontWeight: 300 }}>–</span>
                      <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: homeWin ? '#E6EDF3' : '#8B949E', letterSpacing: '-1px' }}>{g.homeScore}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#C9D1D9', whiteSpace: 'nowrap' }}>
                      {fmtTime(g.gameDate)}
                    </div>
                  )}
                </div>

                {/* Home */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 36 }}>
                  <TeamLogo abbreviation={g.homeAbbr} size={40}/>
                  <span style={{ fontSize: 9, fontWeight: 700, color: homeWin ? '#E6EDF3' : '#8B949E', letterSpacing: '0.03em' }}>{g.homeAbbr}</span>
                </div>
              </div>

              {/* Status line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginTop: 4 }}>
                <StatusBadge isLive={g.isLive} isFinal={g.isFinal} />
                {g.isLive && g.inning && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#3FB950', letterSpacing: '0.04em' }}>
                    {g.inning}
                  </span>
                )}
                {!g.isLive && !g.isFinal && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#6E7681' }}>
                    {fmtTime(g.gameDate)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>


    </div>
  )
}
