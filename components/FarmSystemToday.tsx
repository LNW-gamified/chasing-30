'use client'

import { useState, useEffect, useCallback } from 'react'
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
    return () => clearInterval(id)
  }, [poll])

  if (games.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {games.map((g, i) => {
        const hasScore = (g.isLive || g.isFinal) && g.teamScore !== null
        const teamWin  = hasScore && g.teamScore! > g.oppScore!
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderRadius: 10,
            backgroundColor: '#1C2430', border: '1px solid #30363D',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#F5A623',
                backgroundColor: 'rgba(245,166,35,0.12)', padding: '2px 7px', borderRadius: 8, flexShrink: 0,
              }}>
                {g.level}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.affiliateName}
                </div>
                <div style={{ fontSize: 12, color: '#8B949E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.isHome ? 'vs' : '@'} {g.opponent}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {hasScore ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 900, color: teamWin ? '#3FB950' : '#E6EDF3' }}>
                    {g.teamScore}-{g.oppScore}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: g.isLive ? '#F85149' : '#8B949E' }}>
                    {g.isLive ? (g.inning ?? 'LIVE') : 'FINAL'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 600 }}>
                  {new Date(g.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
