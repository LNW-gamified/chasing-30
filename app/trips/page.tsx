'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import TripForm from '@/components/TripForm'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip } from '@/types'
import Link from 'next/link'
import { Plus, Home, MapPin, Map as MapIcon, Trophy, Plane, ChevronRight } from 'lucide-react'
import { getTeamLogoUrl } from '@/lib/team-logos'

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

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Home',  href: '/dashboard',  Icon: Home    },
  { label: 'Parks', href: '/stadiums',   Icon: MapPin  },
  { label: 'Map',   href: '/map',        Icon: MapIcon },
  { label: 'Goals', href: '/milestones', Icon: Trophy  },
  { label: 'Trips', href: '/trips',      Icon: Plane   },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function heroGradient(status: Trip['status']): string {
  if (status === 'completed') return 'linear-gradient(135deg, #3FB950 0%, #1F6FEB 100%)'
  if (status === 'cancelled') return 'linear-gradient(135deg, #30363D 0%, #161B22 100%)'
  return 'linear-gradient(135deg, #1F6FEB 0%, #7c3aed 100%)'
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

// ── Sidebar + nav constants ───────────────────────────────────────────────────

const sidebarStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, zIndex: 40,
  backgroundColor: '#161B22', borderRight: '1px solid #30363D',
  display: 'flex', flexDirection: 'column',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const [trips,    setTrips]    = useState<TripWithExtras[]>([])
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('trips')
        .select('*, stadium:stadiums(*), trip_stops(id, stadium_id, stadium:stadiums(id, abbreviation, name))')
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

  // ── Sidebar (shared) ────────────────────────────────────────────────────────
  const sidebar = (
    <aside className="hidden md:flex" style={sidebarStyle}>
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ fontWeight: 900, fontSize: 20, color: '#E6EDF3', letterSpacing: '-0.5px' }}>⚾ Chasing 30</div>
      </div>
      <nav style={{ flex: 1, padding: '4px 12px' }}>
        {NAV.map(({ label, href, Icon }) => {
          const active = href === '/trips'
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 10, marginBottom: 2,
              color: active ? '#E6EDF3' : '#8B949E',
              backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
              fontWeight: active ? 700 : 500, fontSize: 15, textDecoration: 'none',
            }}>
              <Icon size={20} color={active ? '#1F6FEB' : '#8B949E'} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid #30363D' }}>
        <div style={{ fontSize: 12, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Trips</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#E6EDF3' }}>
          {trips.length}<span style={{ fontWeight: 400, fontSize: 14, color: '#8B949E' }}> total</span>
        </div>
      </div>
    </aside>
  )

  // ── Mobile bottom bar (shared) ──────────────────────────────────────────────
  const bottomBar = (
    <div className="flex md:hidden" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      backgroundColor: '#161B22', borderTop: '1px solid #30363D',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {NAV.map(({ label, href, Icon }) => {
        const active = href === '/trips'
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textDecoration: 'none', padding: '10px 0', minHeight: 56,
            gap: 3,
          }}>
            <Icon size={22} color={active ? '#1F6FEB' : '#8B949E'} />
            {active && <span style={{ fontSize: 11, fontWeight: 700, color: '#1F6FEB' }}>{label}</span>}
          </Link>
        )
      })}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>
      {sidebar}

      <main className="md:ml-[240px]" style={{ paddingBottom: 88 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 16px 0' }}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, color: '#E6EDF3', margin: 0, lineHeight: 1.1 }}>Trips</h1>
              {!loading && (
                <p style={{ fontSize: 14, color: '#8B949E', marginTop: 6, marginBottom: 0 }}>
                  {planned.length} trip{planned.length !== 1 ? 's' : ''} planned
                  {' · '}
                  {uniqueStadiumIds.size} stadium{uniqueStadiumIds.size !== 1 ? 's' : ''} covered
                </p>
              )}
            </div>
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 20, border: 'none',
                backgroundColor: '#1F6FEB', color: '#E6EDF3',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Plus size={15} /> New Trip
            </button>
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
                fontSize: 26,
              }}>🗺️</div>
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
              <div style={{ fontSize: 52, marginBottom: 16 }}>✈️</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>No trips yet</div>
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
                      const abbrs      = tripAbbrs(trip)
                      const stadCount  = tripStadiumCount(trip)
                      const days       = tripDays(trip)
                      const dateRange  = tripDateRange(trip)
                      const difficulty = computeDifficulty(trip)
                      const sp         = statusPill(trip.status)
                      const est    = trip.est_tickets + trip.est_travel + trip.est_hotel + trip.est_food + trip.est_parking
                      const actual = trip.actual_tickets + trip.actual_travel + trip.actual_hotel + trip.actual_food + trip.actual_parking
                      const hasActual  = actual > 0
                      const pct        = est > 0 && hasActual ? Math.min((actual / est) * 100, 100) : 0
                      const overBudget = hasActual && actual > est

                      return (
                        <div key={trip.id} style={{
                          backgroundColor: '#161B22', borderRadius: 16,
                          border: '1px solid #30363D', overflow: 'hidden',
                        }}>
                          {/* Hero */}
                          <div style={{
                            position: 'relative', height: 140,
                            background: heroGradient(trip.status), overflow: 'hidden',
                          }}>
                            {/* Logo tiles */}
                            <div style={{
                              position: 'absolute', right: 16, top: '50%',
                              transform: 'translateY(-50%)', display: 'flex', gap: 8,
                            }}>
                              {abbrs.slice(0, 2).map(abbr => (
                                <div key={abbr} style={{
                                  width: 54, height: 54, borderRadius: 10,
                                  backgroundColor: 'rgba(0,0,0,0.2)',
                                  backdropFilter: 'blur(4px)',
                                  border: '1px solid rgba(230,237,243,0.15)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={getTeamLogoUrl(abbr)} alt={abbr} width={38} height={38}
                                    style={{ objectFit: 'contain' }} />
                                </div>
                              ))}
                            </div>
                            {/* Trip name */}
                            <div style={{
                              position: 'absolute', bottom: 12, left: 16,
                              right: abbrs.length > 0 ? 120 : 16,
                            }}>
                              <div style={{
                                fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.3,
                                textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                              }}>
                                {trip.name}
                              </div>
                            </div>
                            {/* Date */}
                            {dateRange && (
                              <div style={{ position: 'absolute', bottom: 14, right: 14, textAlign: 'right' }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                                  {dateRange}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Card body */}
                          <div style={{ padding: '14px 16px' }}>
                            {/* Overlapping logo circles */}
                            {abbrs.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                                {abbrs.map((abbr, i) => (
                                  <div key={abbr} style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    border: '2px solid #161B22',
                                    backgroundColor: '#1C2430',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                    marginLeft: i === 0 ? 0 : -9,
                                    zIndex: abbrs.length - i,
                                    position: 'relative',
                                  }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={getTeamLogoUrl(abbr)} alt={abbr} width={22} height={22}
                                      style={{ objectFit: 'contain' }} />
                                  </div>
                                ))}
                                <span style={{ marginLeft: 10, fontSize: 13, color: '#8B949E' }}>
                                  {stadCount} stadium{stadCount !== 1 ? 's' : ''}
                                  {days ? ` · ${days} day${days !== 1 ? 's' : ''}` : ''}
                                </span>
                              </div>
                            )}

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
                                fontSize: 13, fontWeight: 600, color: '#1F6FEB', textDecoration: 'none',
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
      </main>

      {bottomBar}

      {showForm && (
        <TripForm
          stadiums={stadiums}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}
