'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTeamLogoUrl } from '@/lib/team-logos'

export interface TodayGame {
  gamePk:    number
  gameDate:  string
  awayAbbr:  string
  homeAbbr:  string
  awayScore: number | null
  homeScore: number | null
  isLive:    boolean
  isFinal:   boolean
  isFavorite: boolean
}

interface Props {
  initialGames: TodayGame[]
  favAbbr:      string | null
}

function favFirst(games: TodayGame[]): TodayGame[] {
  return [...games].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
}

function inPollWindow(): boolean {
  // Only poll 12pm–midnight ET
  const etDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return etDate.getHours() >= 12
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
      timeZone: 'America/New_York', hour12: true,
    }) + ' ET'
  } catch { return '' }
}

export default function TodayGames({ initialGames, favAbbr }: Props) {
  const [games, setGames]           = useState<TodayGame[]>(() => favFirst(initialGames))
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secsAgo, setSecsAgo]       = useState(0)

  const poll = useCallback(async () => {
    if (!inPollWindow()) return
    try {
      const res = await fetch('/api/today-games')
      if (!res.ok) return
      const raw = await res.json() as Omit<TodayGame, 'isFavorite'>[]
      const withFav = raw.map(g => ({
        ...g,
        isFavorite: favAbbr !== null && (g.awayAbbr === favAbbr || g.homeAbbr === favAbbr),
      }))
      setGames(favFirst(withFav))
      setLastUpdated(new Date())
      setSecsAgo(0)
    } catch { /* keep existing data */ }
  }, [favAbbr])

  // 60-second polling loop (only active in poll window)
  useEffect(() => {
    if (!inPollWindow()) return
    const id = setInterval(poll, 60_000)
    return () => clearInterval(id)
  }, [poll])

  // Seconds-ago ticker
  useEffect(() => {
    if (!lastUpdated) return
    const id = setInterval(() => {
      setSecsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [lastUpdated])

  if (games.length === 0) return null

  const updatedLabel = lastUpdated
    ? secsAgo < 5 ? 'Updated just now' : `Updated ${secsAgo}s ago`
    : null

  return (
    <div style={{ marginTop: 32, marginBottom: '1.5rem' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, marginBottom: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className="animate-pulse"
            style={{ width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: '50%', flexShrink: 0 }}
          />
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#888888',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Today&apos;s Games
          </span>
          <span style={{ fontSize: 12, color: '#BBBBBB' }}>· {games.length} games</span>
        </div>
        {updatedLabel && (
          <span style={{ fontSize: 12, color: '#BBBBBB' }}>{updatedLabel}</span>
        )}
      </div>

      {/* Horizontal scroll row */}
      <div style={{
        display: 'flex', gap: 12,
        overflowX: 'auto', paddingBottom: 8,
        scrollbarWidth: 'none',
      }}>
        {games.map(g => (
          <div
            key={g.gamePk}
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              padding: 16,
              minWidth: 160,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: g.isFavorite ? '2px solid #93C5FD' : '1px solid #F0F0F0',
            }}
          >
            {/* Team row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getTeamLogoUrl(g.awayAbbr)} alt={g.awayAbbr} width={20} height={20} style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111111' }}>{g.awayAbbr}</span>
              <span style={{ fontSize: 11, color: '#BBBBBB' }}>@</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getTeamLogoUrl(g.homeAbbr)} alt={g.homeAbbr} width={20} height={20} style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111111' }}>{g.homeAbbr}</span>
            </div>

            {/* Score or scheduled time */}
            {(g.isLive || g.isFinal) && g.awayScore !== null ? (
              <div style={{
                fontSize: 24, fontWeight: 700, color: '#111111',
                lineHeight: 1, marginBottom: 8,
              }}>
                {g.awayScore} – {g.homeScore}
              </div>
            ) : (
              <div style={{
                fontSize: 14, color: '#555555', fontWeight: 600,
                marginBottom: 8,
              }}>
                {fmtTime(g.gameDate)}
              </div>
            )}

            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {g.isLive && (
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  backgroundColor: '#EF4444', flexShrink: 0,
                }} />
              )}
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: g.isLive ? '#EF4444' : '#BBBBBB',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {g.isLive ? 'LIVE' : g.isFinal ? 'Final' : 'Preview'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
