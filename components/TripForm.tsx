'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Stadium, Trip, TripStop } from '@/types'
import { X, Plus, Trash2 } from 'lucide-react'

interface StopDraft {
  id?: string
  stadium_id: string
  game_date: string
  est_tickets: string
  est_food: string
  est_parking: string
  actual_tickets: string
  actual_food: string
  actual_parking: string
  notes: string
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
  { key: 'food', label: 'Food' },
  { key: 'parking', label: 'Parking' },
]

function defaultStop(stadiums: Stadium[]): StopDraft {
  return {
    stadium_id: stadiums[0]?.id ?? '',
    game_date: '',
    est_tickets: '0',
    est_food: '0',
    est_parking: '0',
    actual_tickets: '0',
    actual_food: '0',
    actual_parking: '0',
    notes: '',
  }
}

function defaultForm(trip?: Trip) {
  return {
    name: trip?.name ?? '',
    start_date: trip?.start_date ?? '',
    end_date: trip?.end_date ?? '',
    status: (trip?.status ?? 'planned') as Trip['status'],
    est_travel: trip?.est_travel?.toString() ?? '0',
    est_hotel: trip?.est_hotel?.toString() ?? '0',
    actual_travel: trip?.actual_travel?.toString() ?? '0',
    actual_hotel: trip?.actual_hotel?.toString() ?? '0',
    notes: trip?.notes ?? '',
  }
}

export default function TripForm({ stadiums, trip, existingStops, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => defaultForm(trip))
  const [stops, setStops] = useState<StopDraft[]>(() => {
    if (existingStops && existingStops.length > 0) {
      return existingStops.map(s => ({
        id: s.id,
        stadium_id: s.stadium_id,
        game_date: s.game_date ?? '',
        est_tickets: s.est_tickets.toString(),
        est_food: s.est_food.toString(),
        est_parking: s.est_parking.toString(),
        actual_tickets: s.actual_tickets.toString(),
        actual_food: s.actual_food.toString(),
        actual_parking: s.actual_parking.toString(),
        notes: s.notes ?? '',
      }))
    }
    return [defaultStop(stadiums)]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setStop(i: number, field: string, value: string) {
    setStops(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function addStop() {
    setStops(prev => [...prev, defaultStop(stadiums)])
  }

  function removeStop(i: number) {
    setStops(prev => prev.filter((_, idx) => idx !== i))
  }

  const stopEst = stops.reduce((sum, s) =>
    sum + (parseFloat(s.est_tickets) || 0) + (parseFloat(s.est_food) || 0) + (parseFloat(s.est_parking) || 0), 0)
  const stopActual = stops.reduce((sum, s) =>
    sum + (parseFloat(s.actual_tickets) || 0) + (parseFloat(s.actual_food) || 0) + (parseFloat(s.actual_parking) || 0), 0)
  const tripEst = (parseFloat(form.est_travel) || 0) + (parseFloat(form.est_hotel) || 0)
  const tripActual = (parseFloat(form.actual_travel) || 0) + (parseFloat(form.actual_hotel) || 0)
  const grandEst = stopEst + tripEst
  const grandActual = stopActual + tripActual

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (stops.length === 0) { setError('Add at least one stadium stop.'); return }
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const tripPayload = {
      name: form.name,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      stadium_id: stops[0]?.stadium_id ?? null,
      trip_date: trip?.trip_date ?? null,
      est_tickets: 0,
      est_travel: parseFloat(form.est_travel) || 0,
      est_hotel: parseFloat(form.est_hotel) || 0,
      est_food: 0,
      est_parking: 0,
      actual_tickets: 0,
      actual_travel: parseFloat(form.actual_travel) || 0,
      actual_hotel: parseFloat(form.actual_hotel) || 0,
      actual_food: 0,
      actual_parking: 0,
      notes: form.notes || null,
      created_by: user?.id ?? null,
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
        trip_id: tripId,
        stadium_id: stop.stadium_id,
        game_date: stop.game_date || null,
        sort_order: i,
        est_tickets: parseFloat(stop.est_tickets) || 0,
        est_food: parseFloat(stop.est_food) || 0,
        est_parking: parseFloat(stop.est_parking) || 0,
        actual_tickets: parseFloat(stop.actual_tickets) || 0,
        actual_food: parseFloat(stop.actual_food) || 0,
        actual_parking: parseFloat(stop.actual_parking) || 0,
        notes: stop.notes || null,
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
                <input type="date" className="input" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" className="input" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
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

              <div className="flex flex-col gap-3">
                {stops.map((stop, i) => (
                  <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: '#0d1424', border: '1px solid #30363D' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold" style={{ color: '#8B949E' }}>
                        Stop {i + 1}
                      </div>
                      {stops.length > 1 && (
                        <button type="button" onClick={() => removeStop(i)} className="p-1" style={{ color: '#F85149' }}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="label">Stadium</label>
                        <select className="input" value={stop.stadium_id} onChange={e => setStop(i, 'stadium_id', e.target.value)}>
                          {stadiums.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Game Date</label>
                        <input type="date" className="input" value={stop.game_date} onChange={e => setStop(i, 'game_date', e.target.value)} />
                      </div>
                    </div>

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
                ))}
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
