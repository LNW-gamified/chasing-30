'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Stadium, Trip, TripStop } from '@/types'
import { X, Plus, Trash2, Loader2, MapPin, Ticket, DollarSign, FileText, CalendarDays } from 'lucide-react'

const ABBR_TO_MLB_ID: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112,
  CWS: 145, CIN: 113, CLE: 114, COL: 115, DET: 116,
  HOU: 117, KC:  118, LAA: 108, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYM: 121, NYY: 147, OAK: 133,
  PHI: 143, PIT: 134, SD:  135, SF:  137, SEA: 136,
  STL: 138, TB:  139, TEX: 140, TOR: 141, WSH: 120,
}

const ABBR_TO_TZ: Record<string, { tz: string; label: string }> = {
  ATL: { tz: 'America/New_York',    label: 'ET'  },
  BAL: { tz: 'America/New_York',    label: 'ET'  },
  BOS: { tz: 'America/New_York',    label: 'ET'  },
  CIN: { tz: 'America/New_York',    label: 'ET'  },
  CLE: { tz: 'America/New_York',    label: 'ET'  },
  DET: { tz: 'America/New_York',    label: 'ET'  },
  MIA: { tz: 'America/New_York',    label: 'ET'  },
  NYM: { tz: 'America/New_York',    label: 'ET'  },
  NYY: { tz: 'America/New_York',    label: 'ET'  },
  PHI: { tz: 'America/New_York',    label: 'ET'  },
  PIT: { tz: 'America/New_York',    label: 'ET'  },
  TB:  { tz: 'America/New_York',    label: 'ET'  },
  TOR: { tz: 'America/Toronto',     label: 'ET'  },
  WSH: { tz: 'America/New_York',    label: 'ET'  },
  CHC: { tz: 'America/Chicago',     label: 'CT'  },
  CWS: { tz: 'America/Chicago',     label: 'CT'  },
  HOU: { tz: 'America/Chicago',     label: 'CT'  },
  KC:  { tz: 'America/Chicago',     label: 'CT'  },
  MIL: { tz: 'America/Chicago',     label: 'CT'  },
  MIN: { tz: 'America/Chicago',     label: 'CT'  },
  STL: { tz: 'America/Chicago',     label: 'CT'  },
  TEX: { tz: 'America/Chicago',     label: 'CT'  },
  ARI: { tz: 'America/Phoenix',     label: 'MST' },
  COL: { tz: 'America/Denver',      label: 'MT'  },
  LAA: { tz: 'America/Los_Angeles', label: 'PT'  },
  LAD: { tz: 'America/Los_Angeles', label: 'PT'  },
  OAK: { tz: 'America/Los_Angeles', label: 'PT'  },
  SD:  { tz: 'America/Los_Angeles', label: 'PT'  },
  SF:  { tz: 'America/Los_Angeles', label: 'PT'  },
  SEA: { tz: 'America/Los_Angeles', label: 'PT'  },
}

interface StopDraft {
  id?: string
  stadium_id: string
  game_date: string
  game_time: string
  opponent: string
  opponent_team_id: string
  est_tickets: string
  est_food: string
  est_parking: string
  actual_tickets: string
  actual_food: string
  actual_parking: string
  notes: string
  ticket_section: string
  ticket_row: string
  ticket_seats: string[]
  ticket_confirmation: string
}

interface GameOption {
  gamePk: number
  gameDate: string
  displayDate: string
  opponent: string
  opponentTeamId: number
  firstPitch: string
  promotions: string
  isPast: boolean
}

interface StopSchedule {
  loading: boolean
  games: GameOption[]
  noGames: boolean
  selectedPk: string
}

interface Props {
  stadiums: Stadium[]
  trip?: Trip
  existingStops?: TripStop[]
  onClose: () => void
  onSaved: () => void
}

const STOP_CATS = [
  { key: 'tickets', label: 'Tickets', icon: '🎟' },
  { key: 'food',    label: 'Food',    icon: '🌭' },
  { key: 'parking', label: 'Parking', icon: '🚗' },
]

function defaultStop(stadiums: Stadium[]): StopDraft {
  return {
    stadium_id: stadiums[0]?.id ?? '',
    game_date: '', game_time: '', opponent: '', opponent_team_id: '',
    est_tickets: '0', est_food: '0', est_parking: '0',
    actual_tickets: '0', actual_food: '0', actual_parking: '0',
    notes: '',
    ticket_section: '', ticket_row: '', ticket_seats: [], ticket_confirmation: '',
  }
}

function emptySchedule(): StopSchedule {
  return { loading: false, games: [], noGames: false, selectedPk: '' }
}

function defaultForm(trip?: Trip) {
  return {
    name:          trip?.name          ?? '',
    start_date:    trip?.start_date    ?? '',
    end_date:      trip?.end_date      ?? '',
    status:       (trip?.status        ?? 'planned') as Trip['status'],
    est_travel:    trip?.est_travel?.toString()    ?? '0',
    est_hotel:     trip?.est_hotel?.toString()     ?? '0',
    actual_travel: trip?.actual_travel?.toString() ?? '0',
    actual_hotel:  trip?.actual_hotel?.toString()  ?? '0',
    notes:         trip?.notes         ?? '',
  }
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '28px 0 16px' }}>
      <span style={{ color: '#1F6FEB', flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#8B949E',
        textTransform: 'uppercase', letterSpacing: '0.09em', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, backgroundColor: '#30363D' }} />
    </div>
  )
}

export default function TripForm({ stadiums, trip, existingStops, onClose, onSaved }: Props) {
  const [form,          setForm]          = useState(() => defaultForm(trip))
  const [stops,         setStops]         = useState<StopDraft[]>(() => {
    if (existingStops && existingStops.length > 0) {
      return existingStops.map(s => ({
        id:               s.id,
        stadium_id:       s.stadium_id,
        game_date:        s.game_date                    ?? '',
        game_time:        s.game_time                    ?? '',
        opponent:         s.opponent                     ?? '',
        opponent_team_id: s.opponent_team_id?.toString() ?? '',
        est_tickets:      s.est_tickets.toString(),
        est_food:         s.est_food.toString(),
        est_parking:      s.est_parking.toString(),
        actual_tickets:   s.actual_tickets.toString(),
        actual_food:      s.actual_food.toString(),
        actual_parking:   s.actual_parking.toString(),
        notes:            s.notes            ?? '',
        ticket_section:      s.ticket_section      ?? '',
        ticket_row:          s.ticket_row          ?? '',
        ticket_seats:        s.ticket_seats        ?? [],
        ticket_confirmation: s.ticket_confirmation ?? '',
      }))
    }
    return [defaultStop(stadiums)]
  })
  const [stopSchedules, setStopSchedules] = useState<StopSchedule[]>(() => {
    const n = (existingStops && existingStops.length > 0) ? existingStops.length : 1
    return Array.from({ length: n }, () => emptySchedule())
  })
  const [seatInputs, setSeatInputs] = useState<string[]>(() => {
    const n = (existingStops && existingStops.length > 0) ? existingStops.length : 1
    return Array.from({ length: n }, () => '')
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function fetchGamesForStop(
    stopIdx: number,
    stadiumId: string,
    existingDate?: string,
    existingOppId?: number,
  ) {
    const stadium = stadiums.find(s => s.id === stadiumId)
    if (!stadium) return
    const teamId = ABBR_TO_MLB_ID[stadium.abbreviation]
    if (!teamId) return

    setStopSchedules(prev => prev.map((ss, i) =>
      i === stopIdx ? { ...ss, loading: true, games: [], noGames: false, selectedPk: '' } : ss
    ))

    try {
      const now   = new Date()
      const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
      const year  = now.getFullYear()
      const url   = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&gameType=R&startDate=${year}-03-01&endDate=${year}-09-30&hydrate=promotions`
      const res   = await fetch(url)
      const json  = await res.json()

      const games: GameOption[] = []
      for (const date of json.dates ?? []) {
        for (const game of date.games ?? []) {
          const homeTeamId = game.teams?.home?.team?.id as number | undefined
          if (homeTeamId !== teamId) continue

          const tzInfo      = ABBR_TO_TZ[stadium.abbreviation] ?? { tz: 'America/Chicago', label: 'CT' }
          const gameDate    = date.date as string
          const displayDate = new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })
          const awayTeamId     = game.teams?.away?.team?.id as number | undefined
          const opponentTeamId = awayTeamId ?? 0
          const opponent       = `vs ${game.teams?.away?.team?.name ?? 'Unknown'}`

          let firstPitch = 'TBD'
          if (game.gameDate) {
            firstPitch = new Date(game.gameDate).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', timeZone: tzInfo.tz, hour12: true,
            }) + ' ' + tzInfo.label
          }

          const promotions = (game.promotions ?? [])
            .map((p: { name: string }) => p.name)
            .join(', ')

          games.push({ gamePk: game.gamePk, gameDate, displayDate, opponent, opponentTeamId, firstPitch, promotions, isPast: gameDate < today })
        }
      }

      // Restore selectedPk when editing an existing stop
      let restoredPk = ''
      if (existingDate && existingOppId) {
        const match = games.find(g => g.gameDate === existingDate && g.opponentTeamId === existingOppId)
        if (match) restoredPk = match.gamePk.toString()
      }

      setStopSchedules(prev => prev.map((ss, i) =>
        i === stopIdx ? { ...ss, loading: false, games, noGames: games.length === 0, selectedPk: restoredPk } : ss
      ))
    } catch {
      setStopSchedules(prev => prev.map((ss, i) =>
        i === stopIdx ? { ...ss, loading: false, noGames: true } : ss
      ))
    }
  }

  useEffect(() => {
    stops.forEach((stop, i) => {
      if (stop.stadium_id) fetchGamesForStop(
        i,
        stop.stadium_id,
        stop.game_date     || undefined,
        parseInt(stop.opponent_team_id) || undefined,
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setStop(i: number, field: string, value: string) {
    setStops(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
    if (field === 'stadium_id') fetchGamesForStop(i, value)
  }

  function selectGame(stopIdx: number, pkStr: string) {
    const game = stopSchedules[stopIdx]?.games.find(g => g.gamePk.toString() === pkStr)
    setStopSchedules(prev => prev.map((ss, i) => i === stopIdx ? { ...ss, selectedPk: pkStr } : ss))
    setStops(prev => prev.map((s, i) => i === stopIdx ? {
      ...s,
      game_date:        game?.gameDate                   ?? '',
      game_time:        game?.firstPitch                 ?? '',
      opponent:         game?.opponent                   ?? '',
      opponent_team_id: game?.opponentTeamId?.toString() ?? '',
    } : s))
  }

  function addSeat(stopIdx: number) {
    const val = (seatInputs[stopIdx] ?? '').trim()
    if (!val) return
    setStops(prev => prev.map((s, i) =>
      i === stopIdx ? { ...s, ticket_seats: [...s.ticket_seats, val] } : s
    ))
    setSeatInputs(prev => prev.map((v, i) => i === stopIdx ? '' : v))
  }

  function removeSeat(stopIdx: number, seatIdx: number) {
    setStops(prev => prev.map((s, i) =>
      i === stopIdx ? { ...s, ticket_seats: s.ticket_seats.filter((_, si) => si !== seatIdx) } : s
    ))
  }

  function addStop() {
    const newIdx       = stops.length
    const newStadiumId = stadiums[0]?.id ?? ''
    setStops(prev => [...prev, defaultStop(stadiums)])
    setStopSchedules(prev => [...prev, emptySchedule()])
    setSeatInputs(prev => [...prev, ''])
    if (newStadiumId) setTimeout(() => fetchGamesForStop(newIdx, newStadiumId), 0)
  }

  function removeStop(i: number) {
    setStops(prev => prev.filter((_, idx) => idx !== i))
    setStopSchedules(prev => prev.filter((_, idx) => idx !== i))
    setSeatInputs(prev => prev.filter((_, idx) => idx !== i))
  }

  const stopEst     = stops.reduce((sum, s) =>
    sum + (parseFloat(s.est_tickets) || 0) + (parseFloat(s.est_food) || 0) + (parseFloat(s.est_parking) || 0), 0)
  const stopActual  = stops.reduce((sum, s) =>
    sum + (parseFloat(s.actual_tickets) || 0) + (parseFloat(s.actual_food) || 0) + (parseFloat(s.actual_parking) || 0), 0)
  const tripEst     = (parseFloat(form.est_travel) || 0) + (parseFloat(form.est_hotel) || 0)
  const tripActual  = (parseFloat(form.actual_travel) || 0) + (parseFloat(form.actual_hotel) || 0)
  const grandEst    = stopEst + tripEst
  const grandActual = stopActual + tripActual

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (stops.length === 0) { setError('Add at least one stadium stop.'); return }
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const tripPayload = {
      name:           form.name,
      start_date:     form.start_date || null,
      end_date:       form.end_date   || null,
      status:         form.status,
      stadium_id:     stops[0]?.stadium_id ?? null,
      trip_date:      trip?.trip_date ?? null,
      est_tickets:    0,
      est_travel:     parseFloat(form.est_travel)    || 0,
      est_hotel:      parseFloat(form.est_hotel)     || 0,
      est_food:       0,
      est_parking:    0,
      actual_tickets: 0,
      actual_travel:  parseFloat(form.actual_travel) || 0,
      actual_hotel:   parseFloat(form.actual_hotel)  || 0,
      actual_food:    0,
      actual_parking: 0,
      notes:          form.notes || null,
      created_by:     user?.id ?? null,
    }

    let tripId: string
    if (trip) {
      const { error: err } = await supabase.from('trips').update(tripPayload).eq('id', trip.id)
      if (err) { setSaving(false); setError(err.message); return }
      tripId = trip.id
    } else {
      const { data, error: err } = await supabase.from('trips').insert(tripPayload).select('id').single()
      if (err || !data) { setSaving(false); setError(err?.message ?? 'Failed to create trip'); return }
      tripId = data.id
    }

    // Delete only stops that were removed from the form (preserves checklist items on kept stops)
    const currentIds = new Set(stops.filter(s => s.id).map(s => s.id!))
    const removedIds = (existingStops ?? []).map(s => s.id).filter(id => !currentIds.has(id))
    if (removedIds.length > 0) {
      const { error: delErr } = await supabase.from('trip_stops').delete().in('id', removedIds)
      if (delErr) { setSaving(false); setError(delErr.message); return }
    }

    // Update existing stops in place, insert new ones
    for (const [i, stop] of stops.entries()) {
      const payload = {
        stadium_id:          stop.stadium_id,
        game_date:           stop.game_date || null,
        game_time:           stop.game_time || null,
        opponent:            stop.opponent  || null,
        opponent_team_id:    parseInt(stop.opponent_team_id) || null,
        sort_order:          i,
        est_tickets:         parseFloat(stop.est_tickets)    || 0,
        est_food:            parseFloat(stop.est_food)       || 0,
        est_parking:         parseFloat(stop.est_parking)    || 0,
        actual_tickets:      parseFloat(stop.actual_tickets) || 0,
        actual_food:         parseFloat(stop.actual_food)    || 0,
        actual_parking:      parseFloat(stop.actual_parking) || 0,
        notes:               stop.notes || null,
        ticket_section:      stop.ticket_section     || null,
        ticket_row:          stop.ticket_row         || null,
        ticket_seats:        stop.ticket_seats.length > 0 ? stop.ticket_seats : null,
        ticket_confirmation: stop.ticket_confirmation || null,
      }

      if (stop.id) {
        const { error: updErr } = await supabase.from('trip_stops').update(payload).eq('id', stop.id)
        if (updErr) { setSaving(false); setError(updErr.message); return }
      } else {
        const { data: newStop, error: insErr } = await supabase
          .from('trip_stops').insert({ trip_id: tripId, ...payload }).select('id').single()
        if (insErr || !newStop) { setSaving(false); setError(insErr?.message ?? 'Failed to insert stop'); return }

        // Auto-populate food & souvenirs checklists with suggested items
        const [
          { data: foodClassics }, { data: foodSeasonal },
          { data: souvenirClassics }, { data: souvenirSeasonal },
        ] = await Promise.all([
          supabase.from('stadium_trending_food')
            .select('item_name').eq('stadium_id', stop.stadium_id).eq('is_classic', true).limit(3),
          supabase.from('stadium_trending_food')
            .select('item_name').eq('stadium_id', stop.stadium_id).eq('is_classic', false)
            .eq('active', true).eq('season_year', 2026).limit(2),
          supabase.from('stadium_souvenirs')
            .select('item_name').eq('stadium_id', stop.stadium_id).eq('is_classic', true).limit(2),
          supabase.from('stadium_souvenirs')
            .select('item_name').eq('stadium_id', stop.stadium_id).eq('is_classic', false)
            .eq('active', true).eq('season_year', 2026).limit(2),
        ])
        const suggestions = [
          ...(foodClassics    ?? []).map(f => ({ stop_id: newStop.id, category: 'food_drinks' as const, item: f.item_name, suggested: true })),
          ...(foodSeasonal    ?? []).map(f => ({ stop_id: newStop.id, category: 'food_drinks' as const, item: f.item_name, suggested: true })),
          ...(souvenirClassics ?? []).map(s => ({ stop_id: newStop.id, category: 'souvenirs'  as const, item: s.item_name, suggested: true })),
          ...(souvenirSeasonal ?? []).map(s => ({ stop_id: newStop.id, category: 'souvenirs'  as const, item: s.item_name, suggested: true })),
        ]
        if (suggestions.length > 0) {
          await supabase.from('stop_checklist').insert(suggestions)
        }
      }
    }

    setSaving(false)
    onSaved()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid #30363D', backgroundColor: '#0d1424',
    color: '#E6EDF3', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#8B949E', marginBottom: 6, letterSpacing: '0.02em',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        backgroundColor: 'rgba(0,0,0,0.75)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#161B22',
        overflow: 'hidden',
        // Desktop: centered with margin, rounded corners
      }}
        className="md:rounded-2xl md:m-6 md:mx-auto md:max-w-2xl md:w-full"
      >

        {/* ── Sticky header ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid #30363D', flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3' }}>
            {trip ? 'Edit Trip' : 'Plan a Trip'}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#1C2430', border: '1px solid #30363D',
              cursor: 'pointer', color: '#8B949E',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable form body ───────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0 20px 120px' }}>

            {/* ═══ TRIP DETAILS ═══════════════════════════════════ */}
            <SectionHeader icon={<CalendarDays size={15} />} label="Trip Details" />

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Trip Name</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="SoCal Baseball Tour"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 4 }}>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" style={inputStyle} value={form.start_date}
                  onChange={e => setField('start_date', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input type="date" style={inputStyle} value={form.end_date}
                  onChange={e => setField('end_date', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={form.status}
                  onChange={e => setField('status', e.target.value)}>
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* ═══ STADIUMS & GAMES ════════════════════════════════ */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={15} style={{ color: '#1F6FEB' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                  Stadiums &amp; Games
                </span>
              </div>
              <button type="button" onClick={addStop} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8,
                border: '1px solid #30363D', backgroundColor: '#1C2430',
                color: '#8B949E', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                <Plus size={12} /> Add Stop
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stops.map((stop, i) => {
                const ss           = stopSchedules[i] ?? emptySchedule()
                const selectedGame = ss.games.find(g => g.gamePk.toString() === ss.selectedPk)

                return (
                  <div key={i} style={{
                    borderRadius: 14,
                    border: '1px solid #30363D',
                    backgroundColor: '#0d1117',
                    overflow: 'hidden',
                  }}>
                    {/* Stop header bar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', backgroundColor: '#161B22',
                      borderBottom: '1px solid #30363D',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>
                        Stop {i + 1}
                      </span>
                      {stops.length > 1 && (
                        <button type="button" onClick={() => removeStop(i)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#F85149', display: 'flex', alignItems: 'center', padding: 4,
                        }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div style={{ padding: '16px' }}>
                      {/* Stadium selector */}
                      <div style={{ marginBottom: 14 }}>
                        <label style={labelStyle}>Stadium</label>
                        <select style={inputStyle} value={stop.stadium_id}
                          onChange={e => setStop(i, 'stadium_id', e.target.value)}>
                          {stadiums.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Game picker */}
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                          Select a Game
                          {ss.loading && <Loader2 size={12} className="animate-spin" style={{ color: '#1F6FEB' }} />}
                        </label>

                        {ss.loading ? (
                          <div style={{ fontSize: 13, color: '#8B949E', padding: '8px 0' }}>
                            Fetching home games…
                          </div>
                        ) : ss.noGames ? (
                          <div style={{
                            fontSize: 12, color: '#8B949E', padding: '10px 14px',
                            borderRadius: 10, backgroundColor: 'rgba(139,148,158,0.06)',
                            border: '1px solid #30363D',
                          }}>
                            No home games found for this season — enter date below.
                          </div>
                        ) : (() => {
                          const upcoming = ss.games.filter(g => !g.isPast)
                          const past     = ss.games.filter(g => g.isPast).slice().reverse()
                          return (
                            <select
                              style={inputStyle}
                              value={ss.selectedPk}
                              onChange={e => selectGame(i, e.target.value)}
                            >
                              <option value="">— pick a game (optional) —</option>
                              {upcoming.length > 0 && (
                                <optgroup label="── Upcoming Games ──">
                                  {upcoming.map(g => (
                                    <option key={g.gamePk} value={g.gamePk.toString()}>
                                      {g.displayDate} · {g.opponent} · {g.firstPitch}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {past.length > 0 && (
                                <optgroup label="── Past Games ──">
                                  {past.map(g => (
                                    <option key={g.gamePk} value={g.gamePk.toString()}>
                                      {g.displayDate} · {g.opponent} · {g.firstPitch}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          )
                        })()}

                        {selectedGame && (
                          <div style={{
                            marginTop: 10, padding: '10px 14px', borderRadius: 10,
                            backgroundColor: 'rgba(31,111,235,0.07)',
                            border: '1px solid rgba(31,111,235,0.2)',
                            display: 'flex', flexDirection: 'column', gap: 5,
                          }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <span style={{
                                fontSize: 12, fontWeight: 600, color: '#E6EDF3',
                                padding: '2px 8px', borderRadius: 6,
                                backgroundColor: 'rgba(31,111,235,0.15)',
                              }}>
                                {selectedGame.opponent}
                              </span>
                              <span style={{
                                fontSize: 12, fontWeight: 600, color: '#8B949E',
                                padding: '2px 8px', borderRadius: 6,
                                backgroundColor: '#1C2430',
                              }}>
                                ⏰ {selectedGame.firstPitch}
                              </span>
                            </div>
                            {selectedGame.promotions && (
                              <div style={{ fontSize: 11, color: '#F5A623' }}>
                                🎁 {selectedGame.promotions}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Game date */}
                      <div style={{ marginBottom: 20 }}>
                        <label style={labelStyle}>Game Date</label>
                        <input type="date" style={inputStyle} value={stop.game_date}
                          onChange={e => setStop(i, 'game_date', e.target.value)} />
                      </div>

                      {/* ── Tickets & Seats subsection ────────────────── */}
                      <div style={{ borderTop: '1px solid #30363D', paddingTop: 16, marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                          <Ticket size={13} style={{ color: '#F5A623' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Tickets &amp; Seats
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          <div>
                            <label style={labelStyle}>Section</label>
                            <input type="text" style={inputStyle} placeholder="240"
                              value={stop.ticket_section}
                              onChange={e => setStop(i, 'ticket_section', e.target.value)} />
                          </div>
                          <div>
                            <label style={labelStyle}>Row</label>
                            <input type="text" style={inputStyle} placeholder="13"
                              value={stop.ticket_row}
                              onChange={e => setStop(i, 'ticket_row', e.target.value)} />
                          </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <label style={labelStyle}>Seats</label>
                          {stop.ticket_seats.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                              {stop.ticket_seats.map((seat, si) => (
                                <span key={si} style={{
                                  display: 'inline-flex', alignItems: 'center',
                                  borderRadius: 20, overflow: 'hidden',
                                  border: '1px solid rgba(31,111,235,0.3)',
                                  fontSize: 13, fontWeight: 600,
                                }}>
                                  <span style={{
                                    padding: '5px 10px',
                                    color: '#1F6FEB',
                                    backgroundColor: 'rgba(31,111,235,0.1)',
                                  }}>
                                    Seat {seat}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeSeat(i, si)}
                                    style={{
                                      padding: '5px 8px',
                                      backgroundColor: 'rgba(31,111,235,0.15)',
                                      borderLeft: '1px solid rgba(31,111,235,0.25)',
                                      border: 'none', cursor: 'pointer',
                                      color: '#8B949E',
                                      display: 'flex', alignItems: 'center',
                                    }}
                                  >
                                    <X size={11} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              style={{ ...inputStyle, flex: 1 }}
                              placeholder="Enter seat number"
                              value={seatInputs[i] ?? ''}
                              onChange={e => setSeatInputs(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSeat(i) } }}
                            />
                            <button type="button" onClick={() => addSeat(i)} style={{
                              padding: '0 16px', borderRadius: 10,
                              border: '1px solid #30363D',
                              backgroundColor: '#1C2430', color: '#8B949E',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                              fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                              <Plus size={13} /> Add
                            </button>
                          </div>
                        </div>

                        <div>
                          <label style={labelStyle}>
                            Confirmation #
                            <span style={{ fontWeight: 400, color: '#484F58', marginLeft: 4 }}>(optional)</span>
                          </label>
                          <input type="text" style={inputStyle} placeholder="ABC-123456"
                            value={stop.ticket_confirmation}
                            onChange={e => setStop(i, 'ticket_confirmation', e.target.value)} />
                        </div>
                      </div>

                      {/* ── Budget subsection ─────────────────────────── */}
                      <div style={{ borderTop: '1px solid #30363D', paddingTop: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                          <DollarSign size={13} style={{ color: '#3FB950' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Stop Budget
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {STOP_CATS.map(cat => (
                            <div key={cat.key} style={{
                              padding: '12px 14px', borderRadius: 10,
                              backgroundColor: '#161B22',
                              border: '1px solid #30363D',
                            }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#8B949E', marginBottom: 10 }}>
                                {cat.icon} {cat.label}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div>
                                  <label style={{ ...labelStyle, fontSize: 11 }}>Est ($)</label>
                                  <input type="number" min={0} step={0.01} style={inputStyle}
                                    value={stop[`est_${cat.key}` as keyof StopDraft] as string}
                                    onChange={e => setStop(i, `est_${cat.key}`, e.target.value)} />
                                </div>
                                <div>
                                  <label style={{ ...labelStyle, fontSize: 11 }}>Actual ($)</label>
                                  <input type="number" min={0} step={0.01} style={inputStyle}
                                    value={stop[`actual_${cat.key}` as keyof StopDraft] as string}
                                    onChange={e => setStop(i, `actual_${cat.key}`, e.target.value)} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ═══ TRIP COSTS ══════════════════════════════════════ */}
            <SectionHeader icon={<DollarSign size={15} />} label="Trip Costs" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { key: 'travel', label: 'Travel', icon: '✈️' },
                { key: 'hotel',  label: 'Hotel',  icon: '🏨' },
              ] as const).map(cat => (
                <div key={cat.key} style={{
                  padding: '12px 14px', borderRadius: 10,
                  backgroundColor: '#0d1117', border: '1px solid #30363D',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#8B949E', marginBottom: 10 }}>
                    {cat.icon} {cat.label}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 11 }}>Est ($)</label>
                      <input type="number" min={0} step={0.01} style={inputStyle}
                        value={form[`est_${cat.key}` as keyof typeof form]}
                        onChange={e => setField(`est_${cat.key}`, e.target.value)} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 11 }}>Actual ($)</label>
                      <input type="number" min={0} step={0.01} style={inputStyle}
                        value={form[`actual_${cat.key}` as keyof typeof form]}
                        onChange={e => setField(`actual_${cat.key}`, e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grand total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 0', marginTop: 12, borderTop: '1px solid #30363D',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3' }}>Grand Total</span>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#3FB950' }}>
                  Est ${grandEst.toFixed(0)}
                </span>
                {grandActual > 0 && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: grandActual > grandEst ? '#F85149' : '#3FB950' }}>
                    Actual ${grandActual.toFixed(0)}
                  </span>
                )}
              </div>
            </div>

            {/* ═══ NOTES ═══════════════════════════════════════════ */}
            <SectionHeader icon={<FileText size={15} />} label="Notes" />

            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 88 }}
              rows={3}
              placeholder="Hotel name, flight info, car rental…"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
            />

            {error && (
              <div style={{
                marginTop: 16, padding: '12px 14px', borderRadius: 10, fontSize: 14,
                backgroundColor: 'rgba(248,81,73,0.1)', color: '#F85149',
                border: '1px solid rgba(248,81,73,0.25)',
              }}>
                {error}
              </div>
            )}
          </div>

          {/* ── Sticky footer ─────────────────────────────────────── */}
          <div style={{
            position: 'sticky', bottom: 0,
            padding: '14px 20px',
            backgroundColor: '#161B22',
            borderTop: '1px solid #30363D',
            display: 'flex', gap: 10,
            flexShrink: 0,
          }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '13px', borderRadius: 10,
              border: '1px solid #30363D', backgroundColor: '#1C2430',
              color: '#8B949E', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Cancel
            </button>
            <button type="submit" style={{
              flex: 2, padding: '13px', borderRadius: 10, border: 'none',
              backgroundColor: '#1F6FEB', color: '#ffffff',
              fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }} disabled={saving}>
              {saving ? 'Saving…' : trip ? 'Update Trip' : 'Save Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
