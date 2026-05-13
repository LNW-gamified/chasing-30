'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TripForm from '@/components/TripForm'
import TeamLogo from '@/components/TeamLogo'
import { getTeamLogoUrlById, getTeamAbbrById } from '@/lib/team-logos'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip, TripStop } from '@/types'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, DollarSign, CheckCircle, X, MapPin, Calendar } from 'lucide-react'

type TripWithStadium = Trip & { stadium: Stadium | null }

const TEAM_PRIMARY: Record<string, string> = {
  ARI: '#A71930', ATL: '#CE1141', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#C4CED4', CIN: '#C6011F', CLE: '#E31937',
  COL: '#33006F', DET: '#0C2C56', HOU: '#EB6E1F', KC:  '#004687',
  LAA: '#BA0021', LAD: '#005A9C', MIA: '#00A3E0', MIL: '#FFC52F',
  MIN: '#D31145', NYM: '#FF5910', NYY: '#003087', OAK: '#EFB21E',
  PHI: '#E81828', PIT: '#FDB827', SD:  '#FFC425', SF:  '#FD5A1E',
  SEA: '#005C5C', STL: '#C41E3A', TB:  '#8FBCE6', TEX: '#C0111F',
  TOR: '#134A8E', WSH: '#AB0003',
}

export default function TripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [trip,        setTrip]        = useState<TripWithStadium | null>(null)
  const [stops,       setStops]       = useState<TripStop[]>([])
  const [stadiums,    setStadiums]    = useState<Stadium[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showEdit,    setShowEdit]    = useState(false)
  const [showComplete,setShowComplete]= useState(false)
  const [completeDate,setCompleteDate]= useState('')
  const [completing,  setCompleting]  = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }, { data: st }] = await Promise.all([
      supabase.from('trips').select('*, stadium:stadiums(*)').eq('id', id).single(),
      supabase.from('stadiums').select('*').order('name'),
      supabase.from('trip_stops').select('*, stadium:stadiums(*)').eq('trip_id', id).order('sort_order'),
    ])
    setTrip(t as TripWithStadium)
    setStadiums(s ?? [])
    setStops((st as TripStop[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleDelete() {
    if (!confirm('Delete this trip?')) return
    const supabase = createClient()
    await supabase.from('trips').delete().eq('id', id)
    router.push('/trips')
  }

  async function handleMarkComplete() {
    setCompleting(true)
    const supabase = createClient()
    await supabase.from('trips')
      .update({ status: 'completed', trip_date: completeDate || null })
      .eq('id', id)
    setCompleting(false)
    setShowComplete(false)
    await load()
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B949E' }}>Loading...</div>
      </AppShell>
    )
  }
  if (!trip) {
    return (
      <AppShell>
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#8B949E' }}>Trip not found.</div>
      </AppShell>
    )
  }

  const sortedStops = [...stops].sort((a, b) => {
    if (!a.game_date && !b.game_date) return 0
    if (!a.game_date) return 1
    if (!b.game_date) return -1
    return a.game_date.localeCompare(b.game_date)
  })

  const stopEstTotal  = stops.reduce((sum, s) => sum + s.est_tickets + s.est_food + s.est_parking, 0)
  const stopActTotal  = stops.reduce((sum, s) => sum + s.actual_tickets + s.actual_food + s.actual_parking, 0)
  const tripEst       = trip.est_travel + trip.est_hotel
  const tripActual    = trip.actual_travel + trip.actual_hotel
  const estTotal      = stopEstTotal + tripEst
  const actualTotal   = stopActTotal + tripActual
  const overBudget    = actualTotal > estTotal && actualTotal > 0

  function statusConfig(status: Trip['status']) {
    if (status === 'completed') return { color: '#3FB950', bg: 'rgba(63,185,80,0.12)',   label: '✓ Completed' }
    if (status === 'cancelled') return { color: '#8B949E', bg: 'rgba(139,148,158,0.12)', label: 'Cancelled'   }
    return                             { color: '#1F6FEB', bg: 'rgba(31,111,235,0.12)',   label: '● Planned'   }
  }

  function dateRange() {
    if (trip!.start_date && trip!.end_date) return `${formatDate(trip!.start_date)} – ${formatDate(trip!.end_date)}`
    if (trip!.start_date) return `From ${formatDate(trip!.start_date)}`
    if (trip!.trip_date)  return formatDate(trip!.trip_date)
    return null
  }

  function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    return Math.ceil(
      (new Date(dateStr + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000
    )
  }

  const sc = statusConfig(trip.status)
  const dr = dateRange()
  const countdownDays = trip.status === 'planned' ? daysUntil(trip.start_date) : null

  return (
    <AppShell>

      {/* Back link */}
      <Link href="/trips" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: '#8B949E', fontSize: 14, textDecoration: 'none', marginBottom: 20,
      }}>
        <ArrowLeft size={16} /> Back to Trips
      </Link>

      {/* ── Countdown banner ─────────────────────────────────────────────── */}
      {countdownDays !== null && countdownDays >= 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 16px', borderRadius: 12, marginBottom: 14,
          backgroundColor: countdownDays === 0 ? 'rgba(63,185,80,0.1)' : 'rgba(245,166,35,0.08)',
          border: `1px solid ${countdownDays === 0 ? 'rgba(63,185,80,0.3)' : 'rgba(245,166,35,0.25)'}`,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{countdownDays === 0 ? '🎉' : countdownDays === 1 ? '🌟' : '📅'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: countdownDays === 0 ? '#3FB950' : '#F5A623' }}>
              {countdownDays === 0
                ? 'Trip day is today — let\'s go!'
                : countdownDays === 1
                  ? 'Trip starts tomorrow!'
                  : `${countdownDays} days until your trip`}
            </div>
            {trip.start_date && countdownDays > 0 && (
              <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>
                {formatDate(trip.start_date)}
                {trip.end_date && trip.end_date !== trip.start_date && ` – ${formatDate(trip.end_date)}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hero header card ───────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#161B22', borderRadius: 16,
        border: '1px solid #30363D', overflow: 'hidden', marginBottom: 14,
      }}>
        {/* Gradient accent bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #1F6FEB 0%, #7c3aed 100%)' }} />

        <div style={{ padding: '20px 20px 0' }}>
          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 10px', borderRadius: 20,
            backgroundColor: sc.bg, color: sc.color,
            fontSize: 12, fontWeight: 700, marginBottom: 10,
          }}>
            {sc.label}
          </div>

          {/* Trip name */}
          <h1 style={{
            fontSize: 26, fontWeight: 900, color: '#E6EDF3',
            margin: '0 0 10px', lineHeight: 1.15,
          }}>
            {trip.name}
          </h1>

          {/* Meta */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            {dr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#8B949E', fontSize: 13 }}>
                <Calendar size={13} />
                {dr}
              </div>
            )}
            {(stops.length > 0 || trip.stadium) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#8B949E', fontSize: 13 }}>
                <MapPin size={13} />
                {stops.length > 0
                  ? `${stops.length} stadium${stops.length !== 1 ? 's' : ''}`
                  : trip.stadium?.name}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderTop: '1px solid #30363D', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {trip.status === 'planned' && (
              <button
                onClick={() => { setCompleteDate(new Date().toISOString().split('T')[0]); setShowComplete(true) }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid rgba(63,185,80,0.35)',
                  backgroundColor: 'rgba(63,185,80,0.08)', color: '#3FB950',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <CheckCircle size={14} /> Mark Complete
              </button>
            )}
            <button
              onClick={() => setShowEdit(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid #30363D',
                backgroundColor: '#1C2430', color: '#E6EDF3',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Pencil size={14} /> Edit Trip
            </button>
          </div>
          <button
            onClick={handleDelete}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid rgba(248,81,73,0.3)',
              backgroundColor: 'rgba(248,81,73,0.08)', color: '#F85149',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>

        {/* Mark complete panel */}
        {showComplete && (
          <div style={{
            margin: '0 20px 20px', padding: 16, borderRadius: 12,
            backgroundColor: 'rgba(63,185,80,0.08)',
            border: '1px solid rgba(63,185,80,0.25)',
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className="label">Completion Date</label>
              <input
                type="date"
                className="input"
                value={completeDate}
                onChange={e => setCompleteDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleMarkComplete}
                disabled={completing}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  backgroundColor: '#3FB950', color: '#0B1117',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {completing ? 'Saving…' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowComplete(false)}
                style={{
                  padding: '9px 12px', borderRadius: 8,
                  border: '1px solid #30363D', backgroundColor: '#1C2430',
                  color: '#8B949E', cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Cost summary bar ─────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#161B22', borderRadius: 12,
        border: '1px solid #30363D', padding: '14px 20px',
        marginBottom: 14, display: 'flex', gap: 28,
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Est. Total
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#F5A623' }}>
            {formatCurrency(estTotal)}
          </div>
        </div>
        {actualTotal > 0 && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Actual
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: overBudget ? '#F85149' : '#3FB950' }}>
              {formatCurrency(actualTotal)}
            </div>
          </div>
        )}
        {stops.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Stadiums
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
              {stops.length}
            </div>
          </div>
        )}
        {tripEst > 0 && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Travel + Hotel
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
              {formatCurrency(tripEst)}
            </div>
          </div>
        )}
      </div>

      {/* ── Itinerary ─────────────────────────────────────────────────────── */}
      {sortedStops.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 11, fontWeight: 700, color: '#8B949E',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: 10,
          }}>
            <MapPin size={13} style={{ color: '#1F6FEB' }} />
            Itinerary
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedStops.map((stop, i) => {
              const stadium    = stop.stadium as Stadium | undefined
              const stopEst    = stop.est_tickets + stop.est_food + stop.est_parking
              const stopAct    = stop.actual_tickets + stop.actual_food + stop.actual_parking
              const accentColor = TEAM_PRIMARY[stadium?.abbreviation ?? ''] ?? '#1F6FEB'
              const hasBudget  = stopEst > 0 || stopAct > 0
              const seatGeekUrl = `https://seatgeek.com/mlb-tickets?q=${encodeURIComponent(stadium?.team ?? '')}`

              return (
                <div key={stop.id} style={{
                  backgroundColor: '#161B22', borderRadius: 14, overflow: 'hidden',
                  borderTop: '1px solid #30363D', borderRight: '1px solid #30363D',
                  borderBottom: '1px solid #30363D', borderLeft: `4px solid ${accentColor}`,
                }}>

                  {/* ── Card body ──────────────────────────────────────────── */}
                  <div style={{ padding: '16px 16px 14px', position: 'relative' }}>

                    {/* Stop # badge — absolute top-right */}
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      width: 26, height: 26, borderRadius: '50%',
                      backgroundColor: 'rgba(31,111,235,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: '#1F6FEB',
                    }}>
                      {i + 1}
                    </div>

                    {/* Stadium name */}
                    <div style={{
                      fontWeight: 800, fontSize: 17, color: '#E6EDF3',
                      paddingRight: 36, lineHeight: 1.2, marginBottom: 2,
                    }}>
                      {stadium?.name ?? 'Unknown Stadium'}
                    </div>

                    {/* City / state */}
                    {stadium && (
                      <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 12 }}>
                        {stadium.city}, {stadium.state}
                      </div>
                    )}

                    {/* Game date + time */}
                    {stop.game_date && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.2 }}>
                          {new Date(stop.game_date + 'T12:00:00').toLocaleDateString('en-US', {
                            weekday: 'long', month: 'long', day: 'numeric',
                          })}
                        </div>
                        {stop.game_time && (
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#F5A623', marginTop: 3 }}>
                            {stop.game_time}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Logo matchup row — home vs opponent */}
                    {stadium && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>

                        {/* Home team logo + abbr */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <TeamLogo
                            abbreviation={stadium.abbreviation}
                            size={44}
                            style={{ borderRadius: 10, border: '1px solid #30363D' }}
                          />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#8B949E', letterSpacing: '0.04em' }}>
                            {stadium.abbreviation}
                          </span>
                        </div>

                        <span style={{ fontSize: 11, fontWeight: 700, color: '#484F58' }}>vs</span>

                        {/* Opponent logo + abbr (only when opponent is set) */}
                        {stop.opponent ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                              backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid #30363D',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {stop.opponent_team_id ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={getTeamLogoUrlById(stop.opponent_team_id)}
                                  alt={stop.opponent}
                                  width={30} height={30}
                                  style={{ objectFit: 'contain' }}
                                />
                              ) : (
                                <span style={{ fontSize: 20 }}>⚾</span>
                              )}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#8B949E', letterSpacing: '0.04em' }}>
                              {stop.opponent_team_id
                                ? getTeamAbbrById(stop.opponent_team_id)
                                : stop.opponent.replace('vs ', '')}
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#484F58' }}>TBD</div>
                        )}

                        {/* Get Tickets link — pushed right */}
                        {stop.game_date && (
                          <a
                            href={seatGeekUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              marginLeft: 'auto', flexShrink: 0,
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 12, fontWeight: 600, color: '#1F6FEB',
                              textDecoration: 'none',
                              padding: '5px 10px', borderRadius: 8,
                              backgroundColor: 'rgba(31,111,235,0.1)',
                              border: '1px solid rgba(31,111,235,0.2)',
                            }}
                          >
                            🎫 Tickets
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Budget section ─────────────────────────────────────── */}
                  {hasBudget ? (
                    <div style={{ display: 'flex', borderTop: '1px solid #30363D', backgroundColor: '#1C2430' }}>
                      {[
                        { label: '🎟 Tickets', est: stop.est_tickets, actual: stop.actual_tickets },
                        { label: '🌭 Food',    est: stop.est_food,    actual: stop.actual_food    },
                        { label: '🚗 Parking', est: stop.est_parking, actual: stop.actual_parking },
                      ].map(({ label, est, actual }, ci) => (
                        <div key={label} style={{
                          flex: 1, padding: '10px 12px',
                          borderRight: ci < 2 ? '1px solid #30363D' : 'none',
                        }}>
                          <div style={{ fontSize: 10, color: '#8B949E', marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>
                            {formatCurrency(est)}
                          </div>
                          {actual > 0 && (
                            <div style={{ fontSize: 11, color: actual > est ? '#F85149' : '#3FB950', marginTop: 1 }}>
                              {formatCurrency(actual)}
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{
                        padding: '10px 12px', borderLeft: '1px solid #30363D', flexShrink: 0,
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end',
                      }}>
                        <div style={{ fontSize: 10, color: '#8B949E', marginBottom: 3 }}>Total</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#F5A623' }}>
                          {formatCurrency(stopAct > 0 ? stopAct : stopEst)}
                        </div>
                        {stopAct === 0 && stopEst > 0 && (
                          <div style={{ fontSize: 10, color: '#8B949E' }}>est</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      borderTop: '1px solid #30363D', backgroundColor: '#1C2430',
                      padding: '12px 16px',
                    }}>
                      <button
                        type="button"
                        onClick={() => setShowEdit(true)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          fontSize: 13, fontWeight: 600, color: '#F5A623',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        Add budget →
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Budget breakdown ──────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#161B22', borderRadius: 14,
        border: '1px solid #30363D', marginBottom: 14, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px', borderBottom: '1px solid #30363D',
        }}>
          <DollarSign size={16} style={{ color: '#F5A623' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: '#E6EDF3' }}>Budget Breakdown</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 320 }}>
            <thead>
              <tr>
                {['Category', 'Est', 'Actual', '±'].map((h, hi) => (
                  <th key={h} style={{
                    textAlign: hi === 0 ? 'left' : 'right',
                    padding: '10px 16px', fontSize: 11, fontWeight: 700,
                    color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStops.map((stop, i) => {
                const stadium = stop.stadium as Stadium | undefined
                const est     = stop.est_tickets + stop.est_food + stop.est_parking
                const actual  = stop.actual_tickets + stop.actual_food + stop.actual_parking
                if (est === 0 && actual === 0) return null
                const diff    = actual - est
                return (
                  <tr key={stop.id} style={{ borderTop: '1px solid #30363D' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#E6EDF3' }}>
                        Stop {i + 1}
                        {stop.game_date && (
                          <span style={{ color: '#8B949E', fontWeight: 400 }}>
                            {' · '}{new Date(stop.game_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {stadium?.name && (
                        <div style={{ fontSize: 12, color: '#8B949E', marginTop: 1 }}>{stadium.name}</div>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', color: '#E6EDF3', fontWeight: 600 }}>
                      {formatCurrency(est)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', color: actual > 0 ? '#E6EDF3' : '#484F58' }}>
                      {actual > 0 ? formatCurrency(actual) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: actual > 0 ? (diff > 0 ? '#F85149' : '#3FB950') : '#484F58' }}>
                      {actual > 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
                    </td>
                  </tr>
                )
              })}

              {trip.est_travel > 0 && (() => {
                const diff = trip.actual_travel - trip.est_travel
                return (
                  <tr style={{ borderTop: '1px solid #30363D' }}>
                    <td style={{ padding: '11px 16px', color: '#8B949E' }}>✈️ Travel</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', color: '#E6EDF3', fontWeight: 600 }}>
                      {formatCurrency(trip.est_travel)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', color: trip.actual_travel > 0 ? '#E6EDF3' : '#484F58' }}>
                      {trip.actual_travel > 0 ? formatCurrency(trip.actual_travel) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: trip.actual_travel > 0 ? (diff > 0 ? '#F85149' : '#3FB950') : '#484F58' }}>
                      {trip.actual_travel > 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
                    </td>
                  </tr>
                )
              })()}

              {trip.est_hotel > 0 && (() => {
                const diff = trip.actual_hotel - trip.est_hotel
                return (
                  <tr style={{ borderTop: '1px solid #30363D' }}>
                    <td style={{ padding: '11px 16px', color: '#8B949E' }}>🏨 Hotel</td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', color: '#E6EDF3', fontWeight: 600 }}>
                      {formatCurrency(trip.est_hotel)}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', color: trip.actual_hotel > 0 ? '#E6EDF3' : '#484F58' }}>
                      {trip.actual_hotel > 0 ? formatCurrency(trip.actual_hotel) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: trip.actual_hotel > 0 ? (diff > 0 ? '#F85149' : '#3FB950') : '#484F58' }}>
                      {trip.actual_hotel > 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
                    </td>
                  </tr>
                )
              })()}

              {/* Grand total */}
              <tr style={{ borderTop: '2px solid #30363D', backgroundColor: '#1C2430' }}>
                <td style={{ padding: '13px 16px', fontWeight: 800, color: '#E6EDF3', fontSize: 14 }}>Total</td>
                <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 800, color: '#F5A623', fontSize: 14 }}>
                  {formatCurrency(estTotal)}
                </td>
                <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: actualTotal > 0 ? '#E6EDF3' : '#484F58' }}>
                  {actualTotal > 0 ? formatCurrency(actualTotal) : '—'}
                </td>
                <td style={{
                  padding: '13px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14,
                  color: actualTotal > 0 ? (overBudget ? '#F85149' : '#3FB950') : '#484F58',
                }}>
                  {actualTotal > 0 ? `${overBudget ? '+' : ''}${formatCurrency(actualTotal - estTotal)}` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {actualTotal > 0 && (
          <div style={{
            margin: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            backgroundColor: overBudget ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.1)',
            color: overBudget ? '#F85149' : '#3FB950',
          }}>
            {overBudget
              ? `Over budget by ${formatCurrency(actualTotal - estTotal)}`
              : `Under budget by ${formatCurrency(estTotal - actualTotal)}`}
          </div>
        )}
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      {trip.notes && (
        <div style={{
          backgroundColor: '#161B22', borderRadius: 14,
          border: '1px solid #30363D', padding: 16,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#8B949E',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
          }}>
            Notes
          </div>
          <div style={{ fontSize: 14, color: '#E6EDF3', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {trip.notes}
          </div>
        </div>
      )}

      {showEdit && (
        <TripForm
          stadiums={stadiums}
          trip={trip}
          existingStops={stops}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}

    </AppShell>
  )
}
