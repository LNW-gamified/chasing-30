'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import TripForm from '@/components/TripForm'
import DestinationTripForm from '@/components/DestinationTripForm'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip } from '@/types'
import Link from 'next/link'
import { Plus, ChevronRight, Building2, MapPin, Map, Plane } from 'lucide-react'
import { getTeamLogoUrl } from '@/lib/team-logos'
import TeamLogo from '@/components/TeamLogo'
import { DESTINATION_BY_SLUG } from '@/lib/destinations'

// ── Types ─────────────────────────────────────────────────────────────────────

type StopMini = {
  id: string
  stadium_id: string
  stadium: { id: string; abbreviation: string; name: string } | null
}

type TripWithExtras = Trip & {
  stadium: Stadium | null
  trip_stops: StopMini[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, [string, string]> = {
  LAA: ['#003263', '#BA0021'], ARI: ['#A71930', '#1A1A1A'],
  BAL: ['#1A1A1A', '#DF4601'], BOS: ['#0C2340', '#BD3039'],
  CHC: ['#0E3386', '#CC3433'], CWS: ['#27251F', '#C4CED4'],
  CIN: ['#C6011F', '#1A1A1A'], CLE: ['#00385D', '#E31937'],
  COL: ['#33006F', '#C4CED4'], DET: ['#0C2C56', '#FA4616'],
  HOU: ['#002D62', '#EB6E1F'], KC:  ['#004687', '#BD9B60'],
  LAD: ['#005A9C', '#EF3E42'], MIA: ['#00A3E0', '#EF3340'],
  MIL: ['#12284B', '#FFC52F'], MIN: ['#002B5C', '#D31145'],
  NYM: ['#002D72', '#FF5910'], NYY: ['#003087', '#C4CED4'],
  OAK: ['#003831', '#EFB21E'], PHI: ['#002D72', '#E81828'],
  PIT: ['#27251F', '#FDB827'], SD:  ['#2F241D', '#FFC425'],
  SF:  ['#27251F', '#FD5A1E'], SEA: ['#0C2C56', '#005C5C'],
  STL: ['#0C2340', '#C41E3A'], TB:  ['#092C5C', '#8FBCE6'],
  TEX: ['#003278', '#C0111F'], TOR: ['#134A8E', '#1D2D5C'],
  WSH: ['#14225A', '#AB0003'], ATL: ['#13274F', '#CE1141'],
}

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
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  return Math.ceil(
    (new Date(dateStr + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000
  )
}

function tripAbbrs(trip: TripWithExtras): string[] {
  if (trip.trip_stops.length > 0)
    return trip.trip_stops.map(s => s.stadium?.abbreviation).filter((a): a is string => Boolean(a)).slice(0, 4)
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
  const [trips,    setTrips]    = useState<TripWithExtras[]>([])
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [formType, setFormType] = useState<FormType>('stadium')

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('trips')
        .select('*, stadium:stadiums(*), destination:destinations(slug, name, city, state, country, type, is_mlb_event), trip_stops(id, stadium_id, stadium:stadiums(id, abbreviation, name))')
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('stadiums').select('*').order('name'),
    ])
    setTrips((t as TripWithExtras[]) ?? [])
    setStadiums(s ?? [])
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
              background: 'linear-gradient(135deg, #1F6FEB 0%, #7c3aed 100%)',
              borderRadius: 16, padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: 16,
              border: '1px solid #1F6FEB',
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
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: '#ffffff', fontSize: 14, fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.3)',
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
                <Plane size={52} color="#484F58" strokeWidth={1.2} />
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
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#F5A623', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
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
                            {isDestination && destInfo ? (
                              <div style={{
                                position: 'absolute', right: 14, top: '50%',
                                transform: 'translateY(-50%)', fontSize: 48, opacity: 0.8,
                              }}>{destInfo.icon}</div>
                            ) : (
                              <div style={{
                                position: 'absolute', right: 14, top: '50%',
                                transform: 'translateY(-50%)', display: 'flex', gap: 8,
                              }}>
                                {abbrs.slice(0, 2).map(abbr => (
                                  <TeamLogo key={abbr} abbreviation={abbr} size={52} />
                                ))}
                              </div>
                            )}
                            <div style={{
                              position: 'absolute', bottom: 13, left: 16,
                              right: (isDestination || abbrs.length > 0) ? 80 : 16,
                            }}>
                              <div style={{
                                fontSize: 23, fontWeight: 800, color: '#ffffff', lineHeight: 1.2,
                                textShadow: '0 1px 6px rgba(0,0,0,0.5)',
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
                                  <div style={{ fontSize: 11, color: '#8B949E' }}>
                                    {destInfo.city !== 'Various' ? `${destInfo.city}${destInfo.state ? `, ${destInfo.state}` : ''}` : 'Location varies'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Stadium logos */}
                            {!isDestination && abbrs.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                                {abbrs.map((abbr, i) => (
                                  <div key={abbr} style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    border: '2px solid #161B22',
                                    background: 'rgba(255, 255, 255, 0.15)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                    marginLeft: i === 0 ? 0 : -10,
                                    zIndex: abbrs.length - i,
                                    position: 'relative',
                                  }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={getTeamLogoUrl(abbr)} alt={abbr} width={26} height={26}
                                      style={{ objectFit: 'contain', display: 'block' }} />
                                  </div>
                                ))}
                                <span style={{ marginLeft: 10, fontSize: 13, color: '#8B949E' }}>
                                  {stadCount} stadium{stadCount !== 1 ? 's' : ''}
                                  {days ? ` · ${days} day${days !== 1 ? 's' : ''}` : ''}
                                </span>
                              </div>
                            )}

                            {/* Undated pill */}
                            {isUndated && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 20, marginBottom: 10,
                                backgroundColor: 'rgba(139,148,158,0.1)',
                                color: '#8B949E', fontSize: 11, fontWeight: 600,
                                border: '1px solid rgba(139,148,158,0.2)',
                              }}>
                                📋 No date set
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

