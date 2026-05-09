'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TripForm from '@/components/TripForm'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip, TripStop } from '@/types'
import Link from 'next/link'
import { Plus, Plane, ChevronRight, Route } from 'lucide-react'

type TripWithExtras = Trip & { stadium: Stadium | null; trip_stops: { id: string }[] }

export default function TripsPage() {
  const [trips, setTrips] = useState<TripWithExtras[]>([])
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('trips').select('*, stadium:stadiums(*), trip_stops(id)').order('created_at', { ascending: false }),
      supabase.from('stadiums').select('*').order('name'),
    ])
    setTrips((t as TripWithExtras[]) ?? [])
    setStadiums(s ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const planned = trips.filter(t => t.status === 'planned')
  const completed = trips.filter(t => t.status === 'completed')
  const cancelled = trips.filter(t => t.status === 'cancelled')

  const totalEstimated = trips.reduce(
    (sum, t) => sum + t.est_tickets + t.est_travel + t.est_hotel + t.est_food + t.est_parking, 0)
  const totalSpent = completed.reduce(
    (sum, t) => sum + t.actual_tickets + t.actual_travel + t.actual_hotel + t.actual_food + t.actual_parking, 0)

  function statusColor(status: Trip['status']) {
    if (status === 'completed') return '#22c55e'
    if (status === 'cancelled') return '#ef4444'
    return '#3b82f6'
  }

  function tripSubtitle(trip: TripWithExtras) {
    const stopCount = trip.trip_stops?.length ?? 0
    const parts: string[] = []
    if (stopCount > 0) parts.push(`${stopCount} stadium${stopCount !== 1 ? 's' : ''}`)
    else if (trip.stadium) parts.push(trip.stadium.name)
    const start = trip.start_date
    const end = trip.end_date
    if (start && end) parts.push(`${formatDate(start)} – ${formatDate(end)}`)
    else if (start) parts.push(formatDate(start))
    else if (trip.trip_date) parts.push(formatDate(trip.trip_date))
    return parts.join(' · ')
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: '#ffffff' }}>Trip Planner</h1>
          <p className="text-base mt-0.5" style={{ color: '#64748b' }}>
            {trips.length} total · {planned.length} planned
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/trips/optimizer" className="btn-secondary">
            <Route size={16} /> Road Trip Optimizer
          </Link>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} /> Plan a Trip
          </button>
        </div>
      </div>

      {/* Summary stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        {[
          { label: 'Planned', value: planned.length, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
          { label: 'Completed', value: completed.length, color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)' },
          { label: 'Total Estimated', value: formatCurrency(totalEstimated), color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
          { label: 'Total Spent', value: formatCurrency(totalSpent), color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.15)' },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className="card p-4" style={{ backgroundColor: bg, borderColor: border }}>
            <div className="text-base font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>{label}</div>
            <div className="text-3xl font-black leading-tight" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: '#a8b8c8' }}>Loading trips...</div>
      ) : trips.length === 0 ? (
        <div className="card p-16 text-center" style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.06)' }}>
          <Plane size={44} className="mx-auto mb-4 opacity-30" style={{ color: '#64748b' }} />
          <div className="text-lg font-semibold mb-1" style={{ color: '#94a3b8' }}>No trips yet</div>
          <div className="text-base mb-5" style={{ color: '#64748b' }}>Plan your first stadium trip</div>
          <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">
            <Plus size={16} /> Plan a Trip
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[
            { label: 'Planned', trips: planned },
            { label: 'Completed', trips: completed },
            { label: 'Cancelled', trips: cancelled },
          ].filter(({ trips }) => trips.length > 0).map(({ label, trips: group }) => (
            <div key={label}>
              <h2 className="text-base font-bold mb-3 uppercase tracking-wider" style={{ color: '#4a5568' }}>
                {label} ({group.length})
              </h2>
              <div className="flex flex-col gap-2.5">
                {group.map(trip => {
                  const est = trip.est_tickets + trip.est_travel + trip.est_hotel + trip.est_food + trip.est_parking
                  const actual = trip.actual_tickets + trip.actual_travel + trip.actual_hotel + trip.actual_food + trip.actual_parking
                  return (
                    <Link key={trip.id} href={`/trips/${trip.id}`} className="card card-hover p-4 flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                        style={{ backgroundColor: `${statusColor(trip.status)}15`, border: `1px solid ${statusColor(trip.status)}25` }}
                      >
                        ✈️
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base" style={{ color: '#ffffff' }}>{trip.name}</div>
                        <div className="text-base mt-0.5" style={{ color: '#64748b' }}>{tripSubtitle(trip)}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-bold" style={{ color: '#f59e0b' }}>
                          {trip.status === 'completed' ? formatCurrency(actual) : formatCurrency(est)}
                        </div>
                        <div className="text-base" style={{ color: '#4a5568' }}>
                          {trip.status === 'completed' ? 'spent' : 'est.'}
                        </div>
                      </div>
                      <span className={`badge ${trip.status === 'completed' ? 'badge-green' : trip.status === 'cancelled' ? 'badge-gray' : 'badge-blue'}`} style={{ flexShrink: 0 }}>
                        {trip.status}
                      </span>
                      <ChevronRight size={16} style={{ color: '#4a5568', flexShrink: 0 }} />
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TripForm
          stadiums={stadiums}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </AppShell>
  )
}
