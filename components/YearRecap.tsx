'use client'

import { useState, useMemo } from 'react'
import type { StadiumVisit, Stadium } from '@/types'

interface Props {
  allVisits:   StadiumVisit[]
  allStadiums: Stadium[]
}

const EVENT_EMOJI: Record<string, string> = {
  walk_off: '🏠', no_hitter: '🚫', perfect_game: '💎',
  extra_innings: '⏰', grand_slam: '💥', cycle: '🔄',
  run_factory: '💣', shutout: '🔒', milestone_hr: '📜',
}

export default function YearRecap({ allVisits, allStadiums }: Props) {
  const years = useMemo(() => {
    const yrs = [...new Set(allVisits.map(v => v.visit_date.slice(0, 4)))].sort().reverse()
    return yrs
  }, [allVisits])

  const [year, setYear] = useState(years[0] ?? String(new Date().getFullYear()))

  const recap = useMemo(() => {
    const yVisits = allVisits.filter(v => v.visit_date.startsWith(year))
    if (yVisits.length === 0) return null

    const stadiumIds = new Set(yVisits.map(v => v.stadium_id))
    const prevVisits = allVisits.filter(v => v.visit_date < year + '-01-01')
    const prevIds    = new Set(prevVisits.map(v => v.stadium_id))
    const newStadiums = allStadiums.filter(s => stadiumIds.has(s.id) && !prevIds.has(s.id))

    const scored   = yVisits.filter(v => v.home_runs != null && v.away_runs != null)
    const wins     = scored.filter(v => v.home_runs! > v.away_runs!).length
    const losses   = scored.filter(v => v.home_runs! < v.away_runs!).length

    const momentCounts: Record<string, number> = {}
    for (const v of yVisits) for (const m of v.game_events ?? []) {
      momentCounts[m] = (momentCounts[m] ?? 0) + 1
    }
    const topMoments = Object.entries(momentCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

    // Most visited stadium this year
    const stadCount: Record<string, number> = {}
    for (const v of yVisits) stadCount[v.stadium_id] = (stadCount[v.stadium_id] ?? 0) + 1
    const topId   = Object.entries(stadCount).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topStad = allStadiums.find(s => s.id === topId)

    const sorted = [...yVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))

    return { yVisits, newStadiums, wins, losses, scored, topMoments, topStad, topStadCount: topId ? stadCount[topId] : 0, firstGame: sorted[0], lastGame: sorted[sorted.length - 1] }
  }, [year, allVisits, allStadiums])

  if (years.length === 0) return null

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3', display: 'flex', alignItems: 'center', gap: 8 }}>
          🎬 Year in Review
        </div>
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #30363D', backgroundColor: '#1C2430', color: '#E6EDF3', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!recap ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#8B949E', fontSize: 14 }}>
          No games logged in {year}.
        </div>
      ) : (
        <div style={{ backgroundColor: '#0D1117', borderRadius: 16, border: '1px solid #30363D', overflow: 'hidden' }}>
          {/* Banner */}
          <div style={{ background: 'linear-gradient(135deg, #0E1B2E 0%, #1A1500 100%)', padding: '20px 24px', borderBottom: '1px solid #30363D' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
              {year} Season
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#E6EDF3', lineHeight: 1.1 }}>
              {recap.yVisits.length} game{recap.yVisits.length !== 1 ? 's' : ''} attended
            </div>
            {recap.newStadiums.length > 0 && (
              <div style={{ fontSize: 13, color: '#3FB950', marginTop: 6, fontWeight: 600 }}>
                ✓ {recap.newStadiums.length} new stadium{recap.newStadiums.length !== 1 ? 's' : ''} visited
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: '#30363D' }}>
            {[
              { label: 'Stadiums',  value: new Set(recap.yVisits.map(v => v.stadium_id)).size },
              { label: 'W–L',       value: recap.scored.length > 0 ? `${recap.wins}–${recap.losses}` : '—' },
              { label: 'New Parks', value: recap.newStadiums.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ backgroundColor: '#161B22', padding: '16px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* First / last game */}
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'First Game', v: recap.firstGame },
                { label: 'Last Game',  v: recap.lastGame  },
              ].map(({ label, v }) => {
                const s = allStadiums.find(s => s.id === v.stadium_id)
                return (
                  <div key={label} style={{ flex: 1, backgroundColor: '#1C2430', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#E6EDF3' }}>{s?.name ?? '—'}</div>
                    <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>
                      {new Date(v.visit_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Fav stadium */}
            {recap.topStad && recap.topStadCount > 1 && (
              <div style={{ backgroundColor: '#1C2430', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Most Visited</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>{recap.topStad.name}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#F5A623' }}>{recap.topStadCount}×</div>
              </div>
            )}

            {/* Moments */}
            {recap.topMoments.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Memorable Moments</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recap.topMoments.map(([event, count]) => (
                    <span key={event} style={{ fontSize: 12, fontWeight: 600, color: '#C9D1D9', backgroundColor: '#1C2430', border: '1px solid #30363D', borderRadius: 20, padding: '4px 10px' }}>
                      {EVENT_EMOJI[event] ?? '⚾'} {event.replace(/_/g, ' ')} {count > 1 ? `×${count}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* New stadiums */}
            {recap.newStadiums.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>New Stadiums Checked Off</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recap.newStadiums.map(s => (
                    <span key={s.id} style={{ fontSize: 12, fontWeight: 600, color: '#3FB950', backgroundColor: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 20, padding: '4px 10px' }}>
                      ✓ {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
