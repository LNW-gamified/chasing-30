'use client'

import { useState, useEffect, useCallback } from 'react'
import MiLBLogo from '@/components/MiLBLogo'
import { getUserTimezone } from '@/lib/user-timezone'
import type { FarmGame } from '@/lib/mlb-api'

const userTz = getUserTimezone()

interface Props {
  initialGames: FarmGame[]
  favAbbr:      string | null
}

function inPollWindow(): boolean {
  const ptDate = new Date(new Date().toLocaleString('en-US', { timeZone: userTz }))
  return ptDate.getHours() >= 9
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
      timeZone: userTz, hour12: true,
    }) + ' PT'
  } catch {
    return ''
  }
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
      background: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.2)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', letterSpacing: '0.08em' }}>PREVIEW</span>
    </div>
  )
}

export default function FarmSystemToday({ initialGames, favAbbr }: Props) {
  const [games, setGames] = useState<FarmGame[]>(initialGames)

  const poll = useCallback(async () => {
    if (!inPollWindow() || !favAbbr) return
    try {
      const res = await fetch(`/api/farm-system-today?team=${favAbbr}`)
      if (!res.ok) return
      const fresh = await res.json() as FarmGame[]
      setGames(fresh)
    } catch { /* keep existing data */ }
  }, [favAbbr])

  useEffect(() => {
    if (!inPollWindow()) return
    const id = setInterval(poll, 60_000)
    function handleVisibility() {
      if (document.visibilityState === 'visible') poll()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [poll])

  if (games.length === 0) return null

  function Card({ g }: { g: FarmGame }) {
    const hasScore = (g.isLive || g.isFinal) && g.teamScore !== null
    const teamWin   = hasScore && g.teamScore! > g.oppScore!
    const oppWin    = hasScore && g.oppScore! > g.teamScore!
    const homeLogo  = g.isHome ? g.affiliateMilbId  : g.opponentMilbId
    const awayLogo  = g.isHome ? g.opponentMilbId   : g.affiliateMilbId
    const homeLogoUrl = g.isHome ? g.affiliateLogoUrl : g.opponentLogoUrl
    const awayLogoUrl = g.isHome ? g.opponentLogoUrl  : g.affiliateLogoUrl
    const homeName  = g.isHome ? g.affiliateName   : g.opponent
    const awayName  = g.isHome ? g.opponent        : g.affiliateName
    const homeWin   = g.isHome ? teamWin : oppWin
    const awayWin   = g.isHome ? oppWin  : teamWin

    return (
      <div style={{
        borderRadius: 12, padding: '8px 10px 14px', minHeight: 130,
        border: '1px solid #21262D',
        background: 'linear-gradient(135deg, rgba(245,166,35,0.08) 0%, #1C2430 65%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#F5A623',
          backgroundColor: 'rgba(245,166,35,0.12)', padding: '2px 7px', borderRadius: 8,
          alignSelf: 'center', marginBottom: 6,
        }}>
          {g.level}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
            <MiLBLogo milbTeamId={awayLogo} logoUrl={awayLogoUrl} fallbackAbbr="" size={36} />
            <span style={{ fontSize: 11, fontWeight: 700, color: awayWin ? '#E6EDF3' : '#8B949E', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {awayName}
            </span>
          </div>

          <div style={{ textAlign: 'center', padding: '0 6px', flexShrink: 0 }}>
            {hasScore ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: awayWin ? '#E6EDF3' : '#8B949E', letterSpacing: '-1px' }}>
                  {g.isHome ? g.oppScore : g.teamScore}
                </span>
                <span style={{ fontSize: 13, color: '#8B949E', fontWeight: 300 }}>–</span>
                <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: homeWin ? '#E6EDF3' : '#8B949E', letterSpacing: '-1px' }}>
                  {g.isHome ? g.teamScore : g.oppScore}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C9D1D9', whiteSpace: 'nowrap' }}>
                {fmtTime(g.gameDate)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
            <MiLBLogo milbTeamId={homeLogo} logoUrl={homeLogoUrl} fallbackAbbr="" size={36} />
            <span style={{ fontSize: 11, fontWeight: 700, color: homeWin ? '#E6EDF3' : '#8B949E', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {homeName}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <StatusBadge isLive={g.isLive} isFinal={g.isFinal} />
        </div>
        {g.isLive && g.inning && (
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#8B949E', marginTop: 3 }}>
            {g.inning}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Mobile: single horizontal scrolling row */}
      <div
        className="flex md:hidden no-scrollbar"
        style={{ gap: 10, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {games.map((g, i) => (
          <div key={i} style={{ minWidth: 160, flexShrink: 0, scrollSnapAlign: 'start' }}>
            <Card g={g} />
          </div>
        ))}
      </div>

      {/* Desktop: up to 4 across */}
      <div className="hidden md:grid md:grid-cols-4 md:gap-2">
        {games.map((g, i) => <Card key={i} g={g} />)}
      </div>
    </>
  )
}
