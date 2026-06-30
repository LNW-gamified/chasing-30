'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import TripForm from '@/components/TripForm'
import DestinationTripForm from '@/components/DestinationTripForm'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip } from '@/types'
import Link from 'next/link'
import { Plus, ChevronRight, Building2, MapPin, Map, Plane } from 'lucide-react'
import { getTeamLogoUrl, LIGHT_BG_LOGO_TEAMS, getTeamAbbrById } from '@/lib/team-logos'
import TeamLogo from '@/components/TeamLogo'
import { TEAM_GRADIENTS as TEAM_COLORS, TEAM_BTN_COLOR, TEAM_LOGO_BG } from '@/lib/team-colors'
import { DESTINATION_BY_SLUG } from '@/lib/destinations'

// ── Types ─────────────────────────────────────────────────────────────────────

type StopMini = {
  id: string
  stadium_id: string | null
  destination_id: string | null
  stop_type: 'stadium' | 'destination' | null
  experience_type: string | null
  opponent_team_id: number | null
  stadium: { id: string; abbreviation: string; name: string } | null
}

type TripWithExtras = Trip & {
  stadium: Stadium | null
  trip_stops: StopMini[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function heroGradient(status: Trip['status'], abbrs: string[]): string {
  if (status === 'cancelled') return 'linear-gradient(135deg, #30363D 0%, #161B22 100%)'
  if (abbrs.length === 0) {
    return status === 'completed'
      ? 'linear-gradient(135deg, #3FB950 0%, #1F6FEB 100%)'
      : 'linear-gradient(135deg, #1F6FEB 0%, #7c3aed 100%)'
  }
  const [c1, c2] = TEAM_COLORS[abbrs[0]] ?? ['#1F6FEB', '#7c3aed']
  if (abbrs.length === 1) return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`
  const [c3] = TEAM_COLORS[abbrs[1]] ?? [c2]
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return Math.ceil(
    (new Date(dateStr + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000
  )
}

function tripAbbrs(trip: TripWithExtras): string[] {
  if (trip.trip_stops.length > 0) {
    const fromStadiums = trip.trip_stops.map(s => s.stadium?.abbreviation).filter((a): a is string => Boolean(a))
    const fromEvents = trip.trip_stops
      .filter(s => s.stop_type === 'destination' && s.opponent_team_id != null)
      .map(s => getTeamAbbrById(s.opponent_team_id as number))
      .filter((a): a is string => Boolean(a))
    return [...new Set([...fromStadiums, ...fromEvents])].slice(0, 6)
  }
  if (trip.stadium) return [trip.stadium.abbreviation]
  return []
}

function tripStadiumCount(trip: TripWithExtras): number {
  return trip.trip_stops.length || (trip.stadium ? 1 : 0)
}

function tripDays(trip: TripWithExtras): number | null {
  if (!trip.start_date || !trip.end_date) return null
  return Math.ceil(
    (new Date(trip.end_date + 'T12:00:00').getTime() - new Date(trip.start_date + 'T12:00:00').getTime()) / 86400000
  ) + 1
}

function tripDateRange(trip: TripWithExtras): string | null {
  if (trip.start_date && trip.end_date) return `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
  if (trip.start_date) return `From ${formatDate(trip.start_date)}`
  if (trip.trip_date) return formatDate(trip.trip_date)
  return null
}

function computeDifficulty(trip: TripWithExtras): string | null {
  const stops = tripStadiumCount(trip)
  if (stops < 2) return null
  const days = tripDays(trip)
  if (!days) return null
  const ratio = days / stops
  if (ratio <= 1.5) return 'Road Warrior'
  if (ratio <= 3.5) return 'On the Move'
  return 'Leisure Tour'
}

function difficultyStyle(d: string): { bg: string; color: string } {
  if (d === 'Road Warrior') return { bg: 'rgba(248,81,73,0.12)',   color: '#F85149' }
  if (d === 'On the Move')  return { bg: 'rgba(245,166,35,0.12)',  color: '#F5A623' }
  return                          { bg: 'rgba(63,185,80,0.12)',    color: '#3FB950' }
}

function statusPill(status: Trip['status']) {
  if (status === 'completed') return { bg: 'rgba(63,185,80,0.12)',    color: '#3FB950', label: '✓ Completed' }
  if (status === 'cancelled') return { bg: 'rgba(139,148,158,0.12)', color: '#8B949E', label: 'Cancelled' }
  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FormType = 'stadium' | 'destination'

export default function TripsPage() {
  const [trips,        setTrips]        = useState<TripWithExtras[]>([])
  const [stadiums,     setStadiums]     = useState<Stadium[]>([])
  const [visitedIds,   setVisitedIds]   = useState<Set<string>>(new Set())
  const [visitedDestinationIds, setVisitedDestinationIds] = useState<Set<string>>(new Set())
  const [loading,      setLoading]      = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [formType, setFormType] = useState<FormType>('stadium')

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }, { data: v }, { data: dv }] = await Promise.all([
      supabase.from('trips')
        .select('*, stadium:stadiums(*), destination:destinations(slug, name, city, state, country, type, is_mlb_event), trip_stops(id, stadium_id, destination_id, stop_type, experience_type, opponent_team_id, stadium:stadiums(id, abbreviation, name))')
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('stadiums').select('*').order('name'),
      supabase.from('stadium_visits').select('stadium_id'),
      supabase.from('destination_visits').select('destination_id'),
    ])
    setTrips((t as TripWithExtras[]) ?? [])
    setStadiums(s ?? [])
    setVisitedIds(new Set((v ?? []).map((r: any) => r.stadium_id)))
    setVisitedDestinationIds(new Set((dv ?? []).map((r: any) => r.destination_id)))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const planned = trips.filter(t => t.status === 'planned')
  const past    = trips.filter(t => t.status !== 'planned')

  const uniqueStadiumIds = new Set<string>()
  trips.forEach(t => {
    if (t.stadium_id) uniqueStadiumIds.add(t.stadium_id)
    t.trip_stops.forEach(s => { if (s.stadium_id) uniqueStadiumIds.add(s.stadium_id) })
  })

  const sections = [
    { key: 'upcoming', label: 'Upcoming Trips', list: planned },
    { key: 'past',     label: 'Past Trips',     list: past    },
  ].filter(s => s.list.length > 0)

  return (
    <div>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 16px 0' }}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: '#E6EDF3', margin: 0, lineHeight: 1.1 }}>The Road Trip Log</h1>
              {!loading && (
                <p style={{ fontSize: 14, color: '#8B949E', marginTop: 6, marginBottom: 0 }}>
                  {planned.length} trip{planned.length !== 1 ? 's' : ''} planned
                  {' · '}
                  {uniqueStadiumIds.size} stadium{uniqueStadiumIds.size !== 1 ? 's' : ''} covered
                </p>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowTypePicker(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 20, border: 'none',
                  backgroundColor: '#1F6FEB', color: '#E6EDF3',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}
              >
                <Plus size={15} /> New Trip
              </button>
              {showTypePicker && (
                <div style={{
                  position: 'absolute', right: 0, top: '110%', zIndex: 50,
                  background: '#161B22', border: '1px solid #30363D', borderRadius: 12,
                  padding: 8, minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}>
                  <button
                    onClick={() => { setFormType('stadium'); setShowForm(true); setShowTypePicker(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px',
                      borderRadius: 8, color: '#E6EDF3', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1C2128')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Building2 size={18} style={{ color: '#1F6FEB', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Stadium Trip</div>
                      <div style={{ fontSize: 12, color: '#8B949E' }}>Multi-stop MLB ballpark road trip</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setFormType('destination'); setShowForm(true); setShowTypePicker(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px',
                      borderRadius: 8, color: '#E6EDF3', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1C2128')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <MapPin size={18} style={{ color: '#F5A623', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Baseball Destination</div>
                      <div style={{ fontSize: 12, color: '#8B949E' }}>HOF, events, historic sites & more</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Road Trip Optimizer card ────────────────────────────── */}
          <Link href="/trips/optimizer" style={{ textDecoration: 'none', display: 'block', marginBottom: 32 }}>
            <div style={{
              background: '#111827',
              borderRadius: 16, padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: 16,
              border: '1px solid #30363D',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                backgroundColor: 'rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Map size={26} color="rgba(255,255,255,0.9)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3', marginBottom: 3 }}>
                  Road Trip Optimizer
                </div>
                <div style={{ fontSize: 14, color: 'rgba(230,237,243,0.75)' }}>
                  Find the perfect multi-stadium trip
                </div>
              </div>
              <div style={{
                flexShrink: 0, padding: '9px 20px', borderRadius: 20,
                backgroundColor: '#1F6FEB',
                color: '#ffffff', fontSize: 14, fontWeight: 700,
              }}>
                Plan →
              </div>
            </div>
          </Link>

          {/* ── Body ───────────────────────────────────────────────── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B949E', fontSize: 14 }}>
              Loading trips…
            </div>
          ) : trips.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '64px 32px',
              backgroundColor: '#161B22', borderRadius: 16,
              border: '1px solid #30363D',
            }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                <Plane size={52} color="#8B949E" strokeWidth={1.2} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>Your road trip starts here</div>
              <div style={{ fontSize: 15, color: '#8B949E', marginBottom: 24 }}>
                Plan your first stadium road trip
              </div>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  padding: '11px 28px', borderRadius: 20, border: 'none',
                  backgroundColor: '#1F6FEB', color: '#E6EDF3',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Start Planning
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
              {sections.map(({ key, label, list }) => (
                <div key={key}>
                  {/* Section header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3' }}>{label}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: '#8B949E',
                      backgroundColor: 'rgba(139,148,158,0.12)', borderRadius: 12, padding: '2px 9px',
                    }}>{list.length}</span>
                  </div>

                  {/* 1-col mobile / 2-col desktop */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {list.map(trip => {
                      const isDestination = (trip as any).trip_type === 'destination'
                      const abbrs      = tripAbbrs(trip)
                      const stadCount  = tripStadiumCount(trip)
                      const days       = tripDays(trip)
                      const dateRange  = tripDateRange(trip)
                      const difficulty = isDestination ? null : computeDifficulty(trip)
                      const sp         = statusPill(trip.status)
                      const est    = trip.est_tickets + trip.est_travel + trip.est_hotel + trip.est_food + trip.est_parking
                      const actual = trip.actual_tickets + trip.actual_travel + trip.actual_hotel + trip.actual_food + trip.actual_parking
                      const hasActual  = actual > 0
                      const pct        = est > 0 && hasActual ? Math.min((actual / est) * 100, 100) : 0
                      const overBudget = hasActual && actual > est

                      const isUndated = !trip.start_date && !trip.end_date && !trip.trip_date
                      const destInfo = isDestination && (trip as any).destination?.slug
                        ? DESTINATION_BY_SLUG[(trip as any).destination.slug]
                        : null
                      const heroGrad = isDestination && destInfo
                        ? `linear-gradient(135deg, ${destInfo.heroColor[0]}, ${destInfo.heroColor[1]})`
                        : isUndated
                          ? 'linear-gradient(135deg, #1E2530 0%, #1A1F2B 100%)'
                          : heroGradient(trip.status, abbrs)

                      return (
                        <div key={trip.id} style={{
                          backgroundColor: '#161B22', borderRadius: 16,
                          border: isUndated ? '1.5px dashed rgba(139,148,158,0.35)' : '1px solid #30363D',
                          overflow: 'hidden',
                          opacity: isUndated ? 0.75 : 1,
                        }}>
                          {/* Destination type header */}
                          {isDestination && (
                            <div style={{
                              background: 'linear-gradient(90deg, rgba(245,166,35,0.18) 0%, rgba(245,166,35,0.06) 100%)',
                              borderBottom: '1px solid rgba(245,166,35,0.18)',
                              padding: '8px 16px',
                              display: 'flex', alignItems: 'center', gap: 7,
                            }}>
                              <MapPin size={12} color="#F5A623" />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                Baseball Destination
                              </span>
                            </div>
                          )}
                          {/* Hero */}
                          <div style={{
                            position: 'relative', height: 140,
                            background: heroGrad, overflow: 'hidden',
                          }}>
                            <div style={{
                              position: 'absolute', inset: 0, pointerEvents: 'none',
                              background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.52) 100%)',
                            }} />
                            {isDestination && destInfo && (
                              <div style={{
                                position: 'absolute', right: 14, top: '50%',
                                transform: 'translateY(-50%)', fontSize: 48, opacity: 0.8,
                              }}>{destInfo.icon}</div>
                            )}
                            {!isDestination && abbrs.length > 0 && (
                              <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6 }}>
                                {abbrs.slice(0, 2).map(abbr => (
                                  <div key={abbr} style={{
                                    width: 52, height: 52, borderRadius: 14,
                                    backgroundColor: LIGHT_BG_LOGO_TEAMS.has(abbr)
                                      ? 'rgba(255,255,255,0.95)'
                                      : (TEAM_LOGO_BG[abbr] ?? TEAM_BTN_COLOR[abbr] ?? '#1F3C6E'),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                  }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={getTeamLogoUrl(abbr)} alt={abbr} width={36} height={36} style={{ objectFit: 'contain' }} />
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{
                              position: 'absolute', bottom: 13, left: 16,
                              right: (isDestination || abbrs.length > 0) ? 80 : 16,
                            }}>
                              <div style={{
                                fontSize: 24, fontWeight: 800, color: '#ffffff', lineHeight: 1.2,
                                textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {trip.name}
                              </div>
                              {dateRange && (
                                <div style={{
                                  fontSize: 12, color: 'rgba(255,255,255,0.82)',
                                  fontWeight: 500, marginTop: 4,
                                  textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                                }}>
                                  {dateRange}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card body */}
                          <div style={{ padding: '14px 16px' }}>
                            {/* Destination info row */}
                            {isDestination && destInfo && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 20 }}>{destInfo.icon}</span>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{destInfo.name}</div>
                                  <div style={{ fontSize: 13, color: '#8B949E' }}>
                                    {destInfo.city !== 'Various' ? `${destInfo.city}${destInfo.state ? `, ${destInfo.state}` : ''}` : 'Location varies'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Stadium logos */}
                            {!isDestination && abbrs.length > 0 && (() => {
                              const allStopIds: string[] = trip.trip_stops
                                .map(s => s.stadium_id ?? s.destination_id)
                                .filter((id): id is string => id !== null)
                              const visitedAllIds = new Set([...visitedIds, ...visitedDestinationIds])
                              const stopsVisited = allStopIds.filter(id => visitedAllIds.has(id)).length
                              const totalStops = allStopIds.length
                              const allVisited = totalStops > 0 && stopsVisited === totalStops
                              return (
                                <div style={{ marginBottom: 10 }}>
                                  <div style={{ marginBottom: totalStops > 0 ? 8 : 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      {(() => {
                                        const stadiumStops = trip.trip_stops.filter((s: any) => s.stop_type === 'stadium')
                                        const eventStops = trip.trip_stops.filter((s: any) =>
                                          s.stop_type === 'destination' && (s.experience_type === 'game' || s.experience_type === 'festival')
                                        )
                                        const experienceStops = trip.trip_stops.filter((s: any) =>
                                          s.stop_type === 'destination' && s.experience_type !== 'game' && s.experience_type !== 'festival'
                                        )
                                        const badges = [
                                          stadiumStops.length > 0 ? { emoji: '⚾', count: stadiumStops.length } : null,
                                          experienceStops.length > 0 ? { emoji: '🏛️', count: experienceStops.length } : null,
                                          eventStops.length > 0 ? { emoji: '🎟️', count: eventStops.length } : null,
                                        ].filter(Boolean)
                                        return badges.map((b, i) => (
                                          <span key={i} style={{ fontSize: 13, color: '#8B949E', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                            {b!.emoji} {b!.count}
                                          </span>
                                        ))
                                      })()}
                                    </div>
                                  </div>
                                  {totalStops > 0 && (
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, color: allVisited ? '#3FB950' : '#8B949E', fontWeight: 600 }}>
                                          {allVisited ? '✓ All stops visited' : `${stopsVisited} of ${totalStops} stops visited`}
                                        </span>
                                        <span style={{ fontSize: 13, color: '#8B949E' }}>
                                          {Math.round((stopsVisited / totalStops) * 100)}%
                                        </span>
                                      </div>
                                      <div style={{ height: 4, backgroundColor: '#30363D', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                          height: '100%', borderRadius: 4,
                                          width: `${(stopsVisited / totalStops) * 100}%`,
                                          backgroundColor: allVisited ? '#3FB950' : '#1F6FEB',
                                          transition: 'width 0.3s ease',
                                        }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* Undated pill */}
                            {isUndated && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 20, marginBottom: 10,
                                backgroundColor: 'rgba(139,148,158,0.1)',
                                color: '#8B949E', fontSize: 12, fontWeight: 600,
                                letterSpacing: '0.08em',
                                border: '1px solid rgba(139,148,158,0.2)',
                              }}>
                                UNPLANNED
                              </div>
                            )}
                            {/* Countdown */}
                            {trip.status === 'planned' && !isUndated && (() => {
                              const d = daysUntil(trip.start_date)
                              if (d === null || d < 0) return null
                              return (
                                <div style={{
                                  fontSize: 16, fontWeight: 800, marginBottom: 10,
                                  color: d === 0 ? '#3FB950' : '#F5A623',
                                  letterSpacing: '-0.3px',
                                }}>
                                  {d === 0 ? '🎉 Today!' : `📅 ${d} day${d !== 1 ? 's' : ''} away`}
                                </div>
                              )
                            })()}

                            {/* Budget row */}
                            {est > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 5 }}>
                                  Budget:&nbsp;
                                  <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{formatCurrency(est)} est</span>
                                  {hasActual && (
                                    <>
                                      &nbsp;·&nbsp;
                                      <span style={{ color: overBudget ? '#F85149' : '#3FB950', fontWeight: 600 }}>
                                        {formatCurrency(actual)} actual
                                      </span>
                                    </>
                                  )}
                                </div>
                                {hasActual && (
                                  <div style={{ height: 4, backgroundColor: '#30363D', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%', borderRadius: 4, width: `${pct}%`,
                                      backgroundColor: overBudget ? '#F85149' : '#3FB950',
                                    }} />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Bottom row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {difficulty && (
                                  <span style={{
                                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    ...difficultyStyle(difficulty),
                                  }}>
                                    {difficulty}
                                  </span>
                                )}
                                {(trip as any).experience_type && isDestination && (
                                  <span style={{
                                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    background: 'rgba(245,166,35,0.12)', color: '#F5A623',
                                  }}>
                                    {(trip as any).experience_type.charAt(0).toUpperCase() + (trip as any).experience_type.slice(1)}
                                  </span>
                                )}
                                {sp && (
                                  <span style={{
                                    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    backgroundColor: sp.bg, color: sp.color,
                                  }}>
                                    {sp.label}
                                  </span>
                                )}
                              </div>
                              <Link href={`/trips/${trip.id}`} style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                fontSize: 13, fontWeight: 600, color: '#F5A623', textDecoration: 'none',
                                flexShrink: 0,
                              }}>
                                View Details <ChevronRight size={14} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {showForm && formType === 'stadium' && (
        <TripForm
          stadiums={stadiums}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
      {showForm && formType === 'destination' && (
        <DestinationTripForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
      {showTypePicker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setShowTypePicker(false)}
        />
      )}
    </div>
  )
}

