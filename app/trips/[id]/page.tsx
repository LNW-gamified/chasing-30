'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import TripForm from '@/components/TripForm'
import TeamLogo from '@/components/TeamLogo'
import { getTeamLogoUrlById, getTeamAbbrById } from '@/lib/team-logos'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip, TripStop, StopChecklistItem } from '@/types'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, DollarSign, CheckCircle, X, MapPin, Calendar, Plus } from 'lucide-react'
import StopChecklist from '@/components/StopChecklist'

type TripWithStadium = Trip & { stadium: Stadium | null }

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

  const [trip,           setTrip]           = useState<TripWithStadium | null>(null)
  const [stops,          setStops]          = useState<TripStop[]>([])
  const [stadiums,       setStadiums]       = useState<Stadium[]>([])
  const [loading,        setLoading]        = useState(true)
  const [showEdit,       setShowEdit]       = useState(false)
  const [showComplete,   setShowComplete]   = useState(false)
  const [completeDate,   setCompleteDate]   = useState('')
  const [completing,     setCompleting]     = useState(false)
  const [checklistItems, setChecklistItems] = useState<StopChecklistItem[]>([])

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }, { data: st }] = await Promise.all([
      supabase.from('trips').select('*, stadium:stadiums(*)').eq('id', id).single(),
      supabase.from('stadiums').select('*').order('name'),
      supabase.from('trip_stops').select(
        'id, trip_id, stadium_id, sort_order, game_date, game_time, opponent, opponent_team_id, ' +
        'est_tickets, est_food, est_parking, actual_tickets, actual_food, actual_parking, notes, ' +
        'ticket_section, ticket_row, ticket_seats, ticket_confirmation, created_at, stadium:stadiums(*)'
      ).eq('trip_id', id).order('sort_order'),
    ])
    setTrip(t as TripWithStadium)
    setStadiums(s ?? [])
    const loadedStops = (st as unknown as TripStop[]) ?? []
    setStops(loadedStops)
    if (loadedStops.length > 0) {
      const stopIds = loadedStops.map(s => s.id)
      const { data: cl } = await supabase
        .from('stop_checklist').select('*')
        .in('stop_id', stopIds).order('created_at')
      setChecklistItems((cl as StopChecklistItem[]) ?? [])
    }
    setLoading(false)
  }

  async function reloadChecklist() {
    if (stops.length === 0) return
    const supabase = createClient()
    const { data: cl } = await supabase
      .from('stop_checklist').select('*')
      .in('stop_id', stops.map(s => s.id)).order('created_at')
    setChecklistItems((cl as StopChecklistItem[]) ?? [])
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

    // Carry ticket info into matching stadium visit records (only if seats currently empty)
    for (const stop of stops) {
      if (!stop.game_date) continue
      const hasTicket = stop.ticket_section || stop.ticket_row || (stop.ticket_seats && stop.ticket_seats.length > 0)
      if (!hasTicket) continue

      const { data: matches } = await supabase
        .from('stadium_visits')
        .select('id, seat_section, seat_row, seat_number')
        .eq('stadium_id', stop.stadium_id)
        .eq('visit_date', stop.game_date)

      for (const visit of matches ?? []) {
        if (visit.seat_section || visit.seat_row || visit.seat_number) continue

        const seats     = stop.ticket_seats ?? []
        const firstSeat = seats[0] ?? null
        const extraSeats = seats.slice(1).map(num => ({
          section: stop.ticket_section ?? '',
          row:     stop.ticket_row     ?? '',
          number:  num,
        }))

        await supabase.from('stadium_visits').update({
          seat_section: stop.ticket_section || null,
          seat_row:     stop.ticket_row     || null,
          seat_number:  firstSeat,
          ...(extraSeats.length > 0 ? { additional_seats: extraSeats } : {}),
        }).eq('id', visit.id)
      }
    }

    setCompleting(false)
    setShowComplete(false)
    await load()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>
        <Navigation />
        <main className="md:ml-64" style={{ paddingBottom: 88 }}>
          <div style={{ height: 220, backgroundColor: '#1C2430' }} />
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#8B949E', fontSize: 14 }}>
            Loading…
          </div>
        </main>
      </div>
    )
  }

  if (!trip) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>
        <Navigation />
        <main className="md:ml-64" style={{ padding: '32px 16px', paddingBottom: 88 }}>
          <div style={{ color: '#8B949E' }}>Trip not found.</div>
        </main>
      </div>
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
  const allBudgetZero = estTotal === 0 && actualTotal === 0

  function statusConfig(status: Trip['status']) {
    if (status === 'completed') return { color: '#3FB950', bg: 'rgba(63,185,80,0.18)',   label: '✓ Completed' }
    if (status === 'cancelled') return { color: '#8B949E', bg: 'rgba(139,148,158,0.18)', label: 'Cancelled'   }
    return                             { color: '#60a5fa', bg: 'rgba(96,165,250,0.18)',   label: '● Planned'   }
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

  // Hero gradient from first stop's team colors
  const heroAbbr = sortedStops[0]?.stadium?.abbreviation ?? ''
  const [h1, h2] = TEAM_COLORS[heroAbbr] ?? ['#1F3C6E', '#0B1117']
  const heroGradient = `linear-gradient(135deg, ${h1} 0%, ${h2} 100%)`

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>
      <Navigation />

      <main className="md:ml-64" style={{ minHeight: '100vh', paddingBottom: 88 }}>

        {/* ── HERO BANNER ────────────────────────────────────────── */}
        <div style={{ position: 'relative', height: 230, overflow: 'hidden', background: heroGradient }}>
          {/* Layered overlay for depth */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.6) 100%)',
          }} />

          {/* Back button */}
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
            <Link href="/trips" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
              color: '#fff', padding: '7px 14px 7px 10px', borderRadius: 20,
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
            }}>
              <ArrowLeft size={14} /> Trips
            </Link>
          </div>

          {/* Status badge — top right */}
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              backgroundColor: sc.bg, color: sc.color,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              {sc.label}
            </span>
          </div>

          {/* Trip info — bottom */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 22px', zIndex: 10 }}>
            <h1 style={{
              margin: '0 0 6px', fontSize: 28, fontWeight: 900, color: '#ffffff',
              lineHeight: 1.15, textShadow: '0 2px 14px rgba(0,0,0,0.6)',
            }}>
              {trip.name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              {dr && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500,
                }}>
                  <Calendar size={13} /> {dr}
                </span>
              )}
              {stops.length > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500,
                }}>
                  <MapPin size={13} />
                  {stops.length} stadium{stops.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── CONTENT AREA ────────────────────────────────────────── */}
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>

          {/* ── Countdown banner ──────────────────────────────────── */}
          {countdownDays !== null && countdownDays >= 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', borderRadius: 16, marginBottom: 16,
              backgroundColor: countdownDays === 0
                ? 'rgba(63,185,80,0.12)' : 'rgba(245,166,35,0.08)',
              border: `1px solid ${countdownDays === 0
                ? 'rgba(63,185,80,0.35)' : 'rgba(245,166,35,0.3)'}`,
            }}>
              <span style={{ fontSize: 32, flexShrink: 0, lineHeight: 1 }}>
                {countdownDays === 0 ? '🎉' : countdownDays === 1 ? '🌟' : '📅'}
              </span>
              <div>
                <div style={{
                  fontWeight: 800, fontSize: 17,
                  color: countdownDays === 0 ? '#3FB950' : '#F5A623',
                  marginBottom: 3,
                }}>
                  {countdownDays === 0
                    ? "It's game day — let's go!"
                    : countdownDays === 1
                      ? 'Trip starts tomorrow!'
                      : `${countdownDays} days until your trip`}
                </div>
                {trip.start_date && countdownDays > 0 && (
                  <div style={{ fontSize: 13, color: '#8B949E' }}>
                    {formatDate(trip.start_date)}
                    {trip.end_date && trip.end_date !== trip.start_date
                      && ` – ${formatDate(trip.end_date)}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, marginBottom: 20, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {trip.status === 'planned' && (
                <button
                  onClick={() => { setCompleteDate(new Date().toISOString().split('T')[0]); setShowComplete(true) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '9px 16px', borderRadius: 10,
                    border: '1px solid rgba(63,185,80,0.35)',
                    backgroundColor: 'rgba(63,185,80,0.08)', color: '#3FB950',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <CheckCircle size={15} /> Mark Complete
                </button>
              )}
              <button
                onClick={() => setShowEdit(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 10,
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
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 10,
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
              padding: 18, borderRadius: 14, marginBottom: 16,
              backgroundColor: 'rgba(63,185,80,0.08)',
              border: '1px solid rgba(63,185,80,0.25)',
              display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label className="label">Completion Date</label>
                <input
                  type="date" className="input"
                  value={completeDate}
                  onChange={e => setCompleteDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleMarkComplete} disabled={completing}
                  style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none',
                    backgroundColor: '#3FB950', color: '#0B1117',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {completing ? 'Saving…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowComplete(false)}
                  style={{
                    padding: '10px 14px', borderRadius: 10,
                    border: '1px solid #30363D', backgroundColor: '#1C2430',
                    color: '#8B949E', cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Cost summary bar ───────────────────────────────────── */}
          {!allBudgetZero && (
            <div style={{
              backgroundColor: '#161B22', borderRadius: 14,
              border: '1px solid #30363D', padding: '14px 20px',
              marginBottom: 20, display: 'flex', gap: 28,
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
            </div>
          )}

          {/* ── Itinerary ──────────────────────────────────────────── */}
          {sortedStops.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
                fontSize: 11, fontWeight: 700, color: '#8B949E',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                <MapPin size={13} style={{ color: '#1F6FEB' }} />
                Itinerary
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {sortedStops.map((stop, i) => {
                  const stadium     = stop.stadium as Stadium | undefined
                  const stopEst     = stop.est_tickets + stop.est_food + stop.est_parking
                  const stopAct     = stop.actual_tickets + stop.actual_food + stop.actual_parking
                  const accentColor = TEAM_PRIMARY[stadium?.abbreviation ?? ''] ?? '#1F6FEB'
                  const hasBudget   = stopEst > 0 || stopAct > 0
                  const seatGeekUrl = `https://seatgeek.com/mlb-tickets?q=${encodeURIComponent(stadium?.team ?? '')}`

                  // Ticket display string
                  const hasTickets  = stop.ticket_section || stop.ticket_row || (stop.ticket_seats && stop.ticket_seats.length > 0)
                  const ticketParts: string[] = []
                  if (stop.ticket_section) ticketParts.push(`Section ${stop.ticket_section}`)
                  if (stop.ticket_row)     ticketParts.push(`Row ${stop.ticket_row}`)
                  if (stop.ticket_seats && stop.ticket_seats.length > 0) {
                    ticketParts.push(`Seat${stop.ticket_seats.length > 1 ? 's' : ''} ${stop.ticket_seats.join(', ')}`)
                  }

                  return (
                    <div key={stop.id} style={{
                      backgroundColor: '#161B22', borderRadius: 16,
                      overflow: 'hidden',
                      borderTop: '1px solid #30363D',
                      borderRight: '1px solid #30363D',
                      borderBottom: '1px solid #30363D',
                      borderLeft: `4px solid ${accentColor}`,
                    }}>

                      {/* Card body */}
                      <div style={{ padding: '20px 20px 16px' }}>

                        {/* Stop # badge */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            backgroundColor: 'rgba(31,111,235,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800, color: '#1F6FEB', flexShrink: 0,
                          }}>
                            {i + 1}
                          </div>
                          {/* Get tickets link */}
                          {stop.game_date && (
                            <a
                              href={seatGeekUrl}
                              target="_blank" rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 12, fontWeight: 600, color: '#1F6FEB',
                                textDecoration: 'none',
                                padding: '5px 10px', borderRadius: 8,
                                backgroundColor: 'rgba(31,111,235,0.1)',
                                border: '1px solid rgba(31,111,235,0.2)',
                              }}
                            >
                              🎫 Buy Tickets
                            </a>
                          )}
                        </div>

                        {/* Stadium name */}
                        <div style={{
                          fontWeight: 800, fontSize: 20, color: '#E6EDF3',
                          lineHeight: 1.2, marginBottom: 2,
                        }}>
                          {stadium?.name ?? 'Unknown Stadium'}
                        </div>

                        {/* City / state */}
                        {stadium && (
                          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 14 }}>
                            {stadium.city}, {stadium.state}
                          </div>
                        )}

                        {/* Game date + time */}
                        {stop.game_date && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 17, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.2 }}>
                              {new Date(stop.game_date + 'T12:00:00').toLocaleDateString('en-US', {
                                weekday: 'long', month: 'long', day: 'numeric',
                              })}
                            </div>
                            {stop.game_time && (
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#F5A623', marginTop: 3 }}>
                                {stop.game_time}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Matchup row */}
                        {stadium && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            {/* Home team */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                              <TeamLogo
                                abbreviation={stadium.abbreviation}
                                size={52}
                                style={{ borderRadius: 12, border: '1px solid #30363D' }}
                              />
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', letterSpacing: '0.04em' }}>
                                {stadium.abbreviation}
                              </span>
                            </div>

                            <div style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                              padding: '6px 10px', borderRadius: 8,
                              backgroundColor: '#1C2430', border: '1px solid #30363D',
                            }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#484F58', letterSpacing: '0.1em', textTransform: 'uppercase' }}>vs</span>
                            </div>

                            {/* Opponent */}
                            {stop.opponent ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <div style={{
                                  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                                  backgroundColor: 'rgba(255,255,255,0.06)',
                                  border: '1px solid #30363D',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {stop.opponent_team_id ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={getTeamLogoUrlById(stop.opponent_team_id)}
                                      alt={stop.opponent}
                                      width={36} height={36}
                                      style={{ objectFit: 'contain' }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: 22 }}>⚾</span>
                                  )}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', letterSpacing: '0.04em' }}>
                                  {stop.opponent_team_id
                                    ? getTeamAbbrById(stop.opponent_team_id)
                                    : stop.opponent.replace('vs ', '')}
                                </span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: '#484F58', fontStyle: 'italic' }}>TBD</div>
                            )}
                          </div>
                        )}

                        {/* Your Tickets row */}
                        {hasTickets && (
                          <div style={{
                            padding: '12px 14px', borderRadius: 10,
                            backgroundColor: 'rgba(245,166,35,0.07)',
                            border: '1px solid rgba(245,166,35,0.2)',
                            marginBottom: 4,
                          }}>
                            <div style={{
                              fontSize: 11, fontWeight: 700, color: '#F5A623',
                              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5,
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                              🎟 Your Tickets
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#E6EDF3' }}>
                              {ticketParts.join(' · ')}
                            </div>
                            {stop.ticket_confirmation && (
                              <div style={{ fontSize: 12, color: '#8B949E', marginTop: 4 }}>
                                Conf: {stop.ticket_confirmation}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Budget strip */}
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
                          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: 13, color: '#484F58' }}>No budget added</span>
                          <button
                            type="button"
                            onClick={() => setShowEdit(true)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', borderRadius: 8,
                              border: '1px solid rgba(245,166,35,0.3)',
                              backgroundColor: 'rgba(245,166,35,0.08)', color: '#F5A623',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            <Plus size={12} /> Add Budget
                          </button>
                        </div>
                      )}

                      {/* Don't Forget checklist */}
                      <StopChecklist
                        stopId={stop.id}
                        items={checklistItems.filter(c => c.stop_id === stop.id)}
                        onReload={reloadChecklist}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Budget Breakdown ───────────────────────────────────── */}
          {allBudgetZero ? (
            <div style={{
              backgroundColor: '#161B22', borderRadius: 14,
              border: '1px solid #30363D', padding: '28px 20px',
              marginBottom: 20, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>💰</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#E6EDF3', marginBottom: 6 }}>
                No budget added yet
              </div>
              <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>
                Track estimated and actual costs for each stop
              </div>
              <button
                onClick={() => setShowEdit(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  backgroundColor: '#1F6FEB', color: '#ffffff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add Budget
              </button>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#161B22', borderRadius: 14,
              border: '1px solid #30363D', marginBottom: 20, overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 18px', borderBottom: '1px solid #30363D',
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
                      const diff = actual - est
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
          )}

          {/* ── Notes ─────────────────────────────────────────────── */}
          {(() => {
            const cleanNotes = (trip.notes ?? '')
              .split('\n')
              .filter(l => !l.startsWith('Generated by Road Trip Optimizer'))
              .join('\n')
              .trim()
            return cleanNotes ? (
              <div style={{
                backgroundColor: '#161B22', borderRadius: 14,
                border: '1px solid #30363D', padding: '16px 18px',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#8B949E',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
                }}>
                  Notes
                </div>
                <div style={{ fontSize: 14, color: '#E6EDF3', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {cleanNotes}
                </div>
              </div>
            ) : null
          })()}
        </div>
      </main>

      {showEdit && (
        <TripForm
          stadiums={stadiums}
          trip={trip}
          existingStops={stops}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </div>
  )
}
