'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Stadium, Trip } from '@/types'
import { X } from 'lucide-react'

interface Props {
  stadiums: Stadium[]
  trip?: Trip
  onClose: () => void
  onSaved: () => void
}

function defaultForm(trip?: Trip, stadiums?: Stadium[]) {
  return {
    stadium_id: trip?.stadium_id ?? stadiums?.[0]?.id ?? '',
    name: trip?.name ?? '',
    trip_date: trip?.trip_date ?? '',
    status: trip?.status ?? 'planned',
    est_tickets: trip?.est_tickets?.toString() ?? '0',
    est_travel: trip?.est_travel?.toString() ?? '0',
    est_hotel: trip?.est_hotel?.toString() ?? '0',
    est_food: trip?.est_food?.toString() ?? '0',
    est_parking: trip?.est_parking?.toString() ?? '0',
    actual_tickets: trip?.actual_tickets?.toString() ?? '0',
    actual_travel: trip?.actual_travel?.toString() ?? '0',
    actual_hotel: trip?.actual_hotel?.toString() ?? '0',
    actual_food: trip?.actual_food?.toString() ?? '0',
    actual_parking: trip?.actual_parking?.toString() ?? '0',
    notes: trip?.notes ?? '',
  }
}

const CATEGORIES = [
  { key: 'tickets', label: 'Tickets' },
  { key: 'travel', label: 'Travel' },
  { key: 'hotel', label: 'Hotel' },
  { key: 'food', label: 'Food' },
  { key: 'parking', label: 'Parking' },
]

export default function TripForm({ stadiums, trip, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => defaultForm(trip, stadiums))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const estTotal = CATEGORIES.reduce(
    (sum, c) => sum + (parseFloat(form[`est_${c.key}` as keyof typeof form]) || 0),
    0
  )
  const actualTotal = CATEGORIES.reduce(
    (sum, c) => sum + (parseFloat(form[`actual_${c.key}` as keyof typeof form]) || 0),
    0
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      stadium_id: form.stadium_id,
      name: form.name,
      trip_date: form.trip_date || null,
      status: form.status as Trip['status'],
      est_tickets: parseFloat(form.est_tickets) || 0,
      est_travel: parseFloat(form.est_travel) || 0,
      est_hotel: parseFloat(form.est_hotel) || 0,
      est_food: parseFloat(form.est_food) || 0,
      est_parking: parseFloat(form.est_parking) || 0,
      actual_tickets: parseFloat(form.actual_tickets) || 0,
      actual_travel: parseFloat(form.actual_travel) || 0,
      actual_hotel: parseFloat(form.actual_hotel) || 0,
      actual_food: parseFloat(form.actual_food) || 0,
      actual_parking: parseFloat(form.actual_parking) || 0,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    }

    let err
    if (trip) {
      ;({ error: err } = await supabase.from('trips').update(payload).eq('id', trip.id))
    } else {
      ;({ error: err } = await supabase.from('trips').insert(payload))
    }

    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div className="card w-full max-w-xl" style={{ backgroundColor: '#111827' }}>
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #1f2937' }}
        >
          <div className="font-semibold" style={{ color: '#f1f5f9' }}>
            {trip ? 'Edit Trip' : 'Plan a Trip'}
          </div>
          <button onClick={onClose} style={{ color: '#8896ae' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4">
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Trip Name</label>
              <input
                type="text"
                className="input"
                placeholder="Weekend trip to Chicago"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Stadium</label>
                <select
                  className="input"
                  value={form.stadium_id}
                  onChange={(e) => set('stadium_id', e.target.value)}
                  required
                >
                  {stadiums.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.trip_date}
                  onChange={(e) => set('trip_date', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Budget table */}
            <div>
              <div
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: '#3b82f6' }}
              >
                Budget Breakdown
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left pb-2 text-xs font-medium" style={{ color: '#8896ae' }}>
                      Category
                    </th>
                    <th className="text-left pb-2 pl-2 text-xs font-medium" style={{ color: '#8896ae' }}>
                      Estimated ($)
                    </th>
                    <th className="text-left pb-2 pl-2 text-xs font-medium" style={{ color: '#8896ae' }}>
                      Actual ($)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map((cat) => (
                    <tr key={cat.key}>
                      <td className="py-1 pr-2 text-xs" style={{ color: '#94a3b8' }}>
                        {cat.label}
                      </td>
                      <td className="py-1 pl-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="input"
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          value={form[`est_${cat.key}` as keyof typeof form]}
                          onChange={(e) => set(`est_${cat.key}`, e.target.value)}
                        />
                      </td>
                      <td className="py-1 pl-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="input"
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          value={form[`actual_${cat.key}` as keyof typeof form]}
                          onChange={(e) => set(`actual_${cat.key}`, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #1f2937' }}>
                    <td className="pt-2 text-xs font-semibold" style={{ color: '#f1f5f9' }}>
                      Total
                    </td>
                    <td className="pt-2 pl-2 text-sm font-semibold" style={{ color: '#22c55e' }}>
                      ${estTotal.toFixed(0)}
                    </td>
                    <td className="pt-2 pl-2 text-sm font-semibold" style={{ color: actualTotal > estTotal ? '#ef4444' : '#22c55e' }}>
                      ${actualTotal.toFixed(0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Trip details, hotel name, flight info..."
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}
              >
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
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
