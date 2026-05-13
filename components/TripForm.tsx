'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Stadium, Trip, TripStop } from '@/types'
import { X, Plus, Trash2, Loader2 } from 'lucide-react'

const ABBR_TO_MLB_ID: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112,
  CWS: 145, CIN: 113, CLE: 114, COL: 115, DET: 116,
  HOU: 117, KC:  118, LAA: 108, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYM: 121, NYY: 147, OAK: 133,
  PHI: 143, PIT: 134, SD:  135, SF:  137, SEA: 136,
  STL: 138, TB:  139, TEX: 140, TOR: 141, WSH: 120,
}

const MLB_ID_TO_ABBR: Record<number, string> = Object.fromEntries(
  Object.entries(ABBR_TO_MLB_ID).map(([abbr, id]) => [id, abbr])
)

// Local timezone for each team's home stadium
const ABBR_TO_TZ: Record<string, { tz: string; label: string }> = {
  // Eastern
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
  // Central
  CHC: { tz: 'America/Chicago',     label: 'CT'  },
  CWS: { tz: 'America/Chicago',     label: 'CT'  },
  HOU: { tz: 'America/Chicago',     label: 'CT'  },
  KC:  { tz: 'America/Chicago',     label: 'CT'  },
  MIL: { tz: 'America/Chicago',     label: 'CT'  },
  MIN: { tz: 'America/Chicago',     label: 'CT'  },
  STL: { tz: 'America/Chicago',     label: 'CT'  },
  TEX: { tz: 'America/Chicago',     label: 'CT'  },
  // Mountain
  ARI: { tz: 'America/Phoenix',     label: 'MST' }, // Arizona doesn't observe DST
  COL: { tz: 'America/Denver',      label: 'MT'  },
  // Pacific
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
  opponent_abbr: string
  est_tickets: string
  est_food: string
  est_parking: string
  actual_tickets: string
  actual_food: string
  actual_parking: string
  notes: string
}

interface GameOption {
  gamePk: number
  gameDate: string
  displayDate: string
  opponent: string      // "vs New York Yankees"
  opponentAbbr: string  // "NYY" — for logo lookup
  firstPitch: string    // "7:05 PM ET"
  promotions: string
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
  { key: 'tickets', label: 'Tickets' },
  { key: 'food',    label: 'Food'    },
  { key: 'parking', label: 'Parking' },
]

function defaultStop(stadiums: Stadium[]): StopDraft {
  return {
    stadium_id: stadiums[0]?.id ?? '',
    game_date: '', game_time: '', opponent: '', opponent_abbr: '',
    est_tickets: '0', est_food: '0', est_parking: '0',
    actual_tickets: '0', actual_food: '0', actual_parking: '0',
    notes: '',
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

export default function TripForm({ stadiums, trip, existingStops, onClose, onSaved }: Props) {
  const [form,          setForm]          = useState(() => defaultForm(trip))
  const [stops,         setStops]         = useState<StopDraft[]>(() => {
    if (existingStops && existingStops.length > 0) {
      return existingStops.map(s => ({
        id:             s.id,
        stadium_id:     s.stadium_id,
        game_date:      s.game_date     ?? '',
        game_time:      s.game_time     ?? '',
        opponent:       s.opponent      ?? '',
        opponent_abbr:  s.opponent_abbr ?? '',
        est_tickets:    s.est_tickets.toString(),
        est_food:       s.est_food.toString(),
        est_parking:    s.est_parking.toString(),
        actual_tickets: s.actual_tickets.toString(),
        actual_food:    s.actual_food.toString(),
        actual_parking: s.actual_parking.toString(),
        notes:          s.notes ?? '',
      }))
    }
    return [defaultStop(stadiums)]
  })
  const [stopSchedules, setStopSchedules] = useState<StopSchedule[]>(() => {
    const n = (existingStops && existingStops.length > 0) ? existingStops.length : 1
    return Array.from({ length: n }, () => emptySchedule())
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function fetchGamesForStop(stopIdx: number, stadiumId: string) {
    const stadium = stadiums.find(s => s.id === stadiumId)
    if (!stadium) return
    const teamId = ABBR_TO_MLB_ID[stadium.abbreviation]
    if (!teamId) return

    setStopSchedules(prev => prev.map((ss, i) =>
      i === stopIdx ? { ...ss, loading: true, games: [], noGames: false, selectedPk: '' } : ss
    ))

    try {
      const today  = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
      const endStr = '2026-09-30'
      const url    = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&gameType=R&startDate=${today}&endDate=${endStr}&hydrate=promotions`
      const res    = await fetch(url)
      const json   = await res.json()

      const games: GameOption[] = []
      for (const date of json.dates ?? []) {
        for (const game of date.games ?? []) {
          const homeTeamId = game.teams?.home?.team?.id as number | undefined
          if (homeTeamId !== teamId) continue  // skip away games

          const tzInfo      = ABBR_TO_TZ[stadium.abbreviation] ?? { tz: 'America/Chicago', label: 'CT' }
          const gameDate    = date.date as string
          const displayDate = new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })
          const awayTeamId   = game.teams?.away?.team?.id as number | undefined
          const opponentAbbr = awayTeamId ? (MLB_ID_TO_ABBR[awayTeamId] ?? '') : ''
          const opponent     = `vs ${game.teams?.away?.team?.name ?? 'Unknown'}`

          let firstPitch = 'TBD'
          if (game.gameDate) {
            firstPitch = new Date(game.gameDate).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', timeZone: tzInfo.tz, hour12: true,
            }) + ' ' + tzInfo.label
          }

          const promotions = (game.promotions ?? [])
            .map((p: { name: string }) => p.name)
            .join(', ')

          games.push({ gamePk: game.gamePk, gameDate, displayDate, opponent, opponentAbbr, firstPitch, promotions })
        }
      }

      setStopSchedules(prev => prev.map((ss, i) =>
        i === stopIdx ? { ...ss, loading: false, games, noGames: games.length === 0, selectedPk: '' } : ss
      ))
    } catch {
      setStopSchedules(prev => prev.map((ss, i) =>
        i === stopIdx ? { ...ss, loading: false, noGames: true } : ss
      ))
    }
  }

  // On mount, fetch games for all existing stops
  useEffect(() => {
    stops.forEach((stop, i) => {
      if (stop.stadium_id) fetchGamesForStop(i, stop.stadium_id)
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
      game_date:     game?.gameDate     ?? '',
      game_time:     game?.firstPitch   ?? '',
      opponent:      game?.opponent     ?? '',
      opponent_abbr: game?.opponentAbbr ?? '',
    } : s))
  }

  function addStop() {
    const newIdx       = stops.length
    const newStadiumId = stadiums[0]?.id ?? ''
    setStops(prev => [...prev, defaultStop(stadiums)])
    setStopSchedules(prev => [...prev, emptySchedule()])
    if (newStadiumId) setTimeout(() => fetchGamesForStop(newIdx, newStadiumId), 0)
  }

  function removeStop(i: number) {
    setStops(prev => prev.filter((_, idx) => idx !== i))
    setStopSchedules(prev => prev.filter((_, idx) => idx !== i))
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

    await supabase.from('trip_stops').delete().eq('trip_id', tripId)

    const { error: stopsErr } = await supabase.from('trip_stops').insert(
      stops.map((stop, i) => ({
        trip_id:        tripId,
        stadium_id:     stop.stadium_id,
        game_date:      stop.game_date     || null,
        game_time:      stop.game_time     || null,
        opponent:       stop.opponent      || null,
        opponent_abbr:  stop.opponent_abbr || null,
        sort_order:     i,
        est_tickets:    parseFloat(stop.est_tickets)    || 0,
        est_food:       parseFloat(stop.est_food)       || 0,
        est_parking:    parseFloat(stop.est_parking)    || 0,
        actual_tickets: parseFloat(stop.actual_tickets) || 0,
        actual_food:    parseFloat(stop.actual_food)    || 0,
        actual_parking: parseFloat(stop.actual_parking) || 0,
        notes:          stop.notes || null,
      }))
    )

    setSaving(false)
    if (stopsErr) { setError(stopsErr.message); return }
    onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div className="card w-full max-w-2xl" style={{ backgroundColor: '#161B22' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363D' }}>
          <div className="font-semibold" style={{ color: '#E6EDF3' }}>
            {trip ? 'Edit Trip' : 'Plan a Trip'}
          </div>
          <button onClick={onClose} style={{ color: '#8B949E' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5">
          <div className="flex flex-col gap-5">

            {/* Trip name */}
            <div>
              <label className="label">Trip Name</label>
              <input type="text" className="input" placeholder="SoCal Baseball Tour"
                value={form.name} onChange={e => setField('name', e.target.value)} required />
            </div>

            {/* Dates + status */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" value={form.start_date}
                  onChange={e => setField('start_date', e.target.value)} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" className="input" value={form.end_date}
                  onChange={e => setField('end_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status}
                  onChange={e => setField('status', e.target.value)}>
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Stops */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#1F6FEB' }}>
                  Stadiums &amp; Schedule
                </div>
                <button type="button" onClick={addStop} className="btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '4px 12px', gap: '5px' }}>
                  <Plus size={13} /> Add Stop
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {stops.map((stop, i) => {
                  const ss           = stopSchedules[i] ?? emptySchedule()
                  const selectedGame = ss.games.find(g => g.gamePk.toString() === ss.selectedPk)

                  return (
                    <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: '#0d1424', border: '1px solid #30363D' }}>
                      {/* Stop header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold" style={{ color: '#8B949E' }}>Stop {i + 1}</div>
                        {stops.length > 1 && (
                          <button type="button" onClick={() => removeStop(i)} className="p-1" style={{ color: '#F85149' }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      {/* Stadium selector */}
                      <div className="mb-3">
                        <label className="label">Stadium</label>
                        <select className="input" value={stop.stadium_id}
                          onChange={e => setStop(i, 'stadium_id', e.target.value)}>
                          {stadiums.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Game picker */}
                      <div className="mb-3">
                        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          Select a Game
                          {ss.loading && <Loader2 size={12} className="animate-spin" style={{ color: '#1F6FEB' }} />}
                        </label>

                        {ss.loading ? (
                          <div style={{ fontSize: 13, color: '#8B949E', padding: '8px 0' }}>
                            Fetching upcoming home games…
                          </div>
                        ) : ss.noGames ? (
                          <div style={{
                            fontSize: 12, color: '#8B949E',
                            padding: '8px 12px', borderRadius: 8,
                            backgroundColor: 'rgba(139,148,158,0.08)',
                            border: '1px solid #30363D',
                          }}>
                            No upcoming home games found — enter date manually below.
                          </div>
                        ) : (
                          <select
                            className="input"
                            value={ss.selectedPk}
                            onChange={e => selectGame(i, e.target.value)}
                          >
                            <option value="">— pick a game (optional) —</option>
                            {ss.games.map(g => (
                              <option key={g.gamePk} value={g.gamePk.toString()}>
                                {g.displayDate} · {g.opponent} · {g.firstPitch}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Selected game details */}
                        {selectedGame && (
                          <div style={{
                            marginTop: 8, padding: '10px 12px', borderRadius: 10,
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

                      {/* Game date (always editable, auto-filled when game selected) */}
                      <div className="mb-3">
                        <label className="label">Game Date</label>
                        <input type="date" className="input" value={stop.game_date}
                          onChange={e => setStop(i, 'game_date', e.target.value)} />
                      </div>

                      {/* Budget table */}
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="text-left pb-1.5 text-xs font-medium" style={{ color: '#8B949E' }}>Category</th>
                            <th className="text-left pb-1.5 pl-2 text-xs font-medium" style={{ color: '#8B949E' }}>Est ($)</th>
                            <th className="text-left pb-1.5 pl-2 text-xs font-medium" style={{ color: '#8B949E' }}>Actual ($)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {STOP_CATS.map(cat => (
                            <tr key={cat.key}>
                              <td className="py-1 pr-2 text-sm" style={{ color: '#8B949E' }}>{cat.label}</td>
                              <td className="py-1 pl-2">
                                <input type="number" min={0} step={0.01} className="input"
                                  style={{ padding: '3px 8px', fontSize: '0.9rem' }}
                                  value={stop[`est_${cat.key}` as keyof StopDraft]}
                                  onChange={e => setStop(i, `est_${cat.key}`, e.target.value)} />
                              </td>
                              <td className="py-1 pl-2">
                                <input type="number" min={0} step={0.01} className="input"
                                  style={{ padding: '3px 8px', fontSize: '0.9rem' }}
                                  value={stop[`actual_${cat.key}` as keyof StopDraft]}
                                  onChange={e => setStop(i, `actual_${cat.key}`, e.target.value)} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Trip-level costs */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#1F6FEB' }}>
                Trip Costs (Travel &amp; Hotel)
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left pb-2 text-xs font-medium" style={{ color: '#8B949E' }}>Category</th>
                    <th className="text-left pb-2 pl-2 text-xs font-medium" style={{ color: '#8B949E' }}>Estimated ($)</th>
                    <th className="text-left pb-2 pl-2 text-xs font-medium" style={{ color: '#8B949E' }}>Actual ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {([{ key: 'travel', label: 'Travel ✈️' }, { key: 'hotel', label: 'Hotel 🏨' }] as const).map(cat => (
                    <tr key={cat.key}>
                      <td className="py-1.5 pr-2 text-sm" style={{ color: '#8B949E' }}>{cat.label}</td>
                      <td className="py-1.5 pl-2">
                        <input type="number" min={0} step={0.01} className="input"
                          style={{ padding: '4px 8px', fontSize: '0.9rem' }}
                          value={form[`est_${cat.key}` as keyof typeof form]}
                          onChange={e => setField(`est_${cat.key}`, e.target.value)} />
                      </td>
                      <td className="py-1.5 pl-2">
                        <input type="number" min={0} step={0.01} className="input"
                          style={{ padding: '4px 8px', fontSize: '0.9rem' }}
                          value={form[`actual_${cat.key}` as keyof typeof form]}
                          onChange={e => setField(`actual_${cat.key}`, e.target.value)} />
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #30363D' }}>
                    <td className="pt-2.5 text-sm font-semibold" style={{ color: '#E6EDF3' }}>Grand Total</td>
                    <td className="pt-2.5 pl-2 font-bold" style={{ color: '#3FB950' }}>${grandEst.toFixed(0)}</td>
                    <td className="pt-2.5 pl-2 font-bold" style={{ color: grandActual > grandEst ? '#F85149' : '#3FB950' }}>${grandActual.toFixed(0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3}
                placeholder="Hotel name, flight info, car rental..."
                value={form.notes} onChange={e => setField('notes', e.target.value)}
                style={{ resize: 'vertical' }} />
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(248,81,73,0.1)', color: '#F85149' }}>
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : trip ? 'Update Trip' : 'Save Trip'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
