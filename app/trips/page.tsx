'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TripForm from '@/components/TripForm'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip, TripStop } from '@/types'
import Link from 'next/link'
import { Plus, Plane, ChevronRight } from 'lucide-react'

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
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Trip Planner</h1>
          <p className="text-sm mt-1" style={{ color: '#a8b8c8' }}>
            {trips.length} total trips · {planned.length} planned
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> Plan a Trip
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Planned Trips', value: planned.length, color: '#3b82f6' },
          { label: 'Completed Trips', value: completed.length, color: '#22c55e' },
          { label: 'Total Estimated', value: formatCurrency(totalEstimated), color: '#f59e0b' },
          { label: 'Total Spent', value: formatCurrency(totalSpent), color: '#f97316' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#a8b8c8' }}>{label}</div>
            <div className="text-xl font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: '#a8b8c8' }}>Loading trips...</div>
      ) : trips.length === 0 ? (
        <div className="card p-12 text-center">
          <Plane size={40} className="mx-auto mb-3 opacity-30" style={{ color: '#a8b8c8' }} />
          <div className="font-medium mb-1" style={{ color: '#b8c8d8' }}>No trips yet</div>
          <div className="text-sm mb-4" style={{ color: '#a8b8c8' }}>Plan your first stadium trip</div>
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
              <h2 className="text-sm font-semibold mb-3" style={{ color: '#b8c8d8' }}>
                {label} ({group.length})
              </h2>
              <div className="flex flex-col gap-2">
                {group.map(trip => {
                  const est = trip.est_tickets + trip.est_travel + trip.est_hotel + trip.est_food + trip.est_parking
                  const actual = trip.actual_tickets + trip.actual_travel + trip.actual_hotel + trip.actual_food + trip.actual_parking
                  return (
                    <Link key={trip.id} href={`/trips/${trip.id}`} className="card card-hover p-4 flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ backgroundColor: `${statusColor(trip.status)}20` }}
                      >
                        ✈️
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{trip.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#a8b8c8' }}>{tripSubtitle(trip)}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                          {trip.status === 'completed' ? formatCurrency(actual) : formatCurrency(est)}
                        </div>
                        <div className="text-xs" style={{ color: '#a8b8c8' }}>
                          {trip.status === 'completed' ? 'spent' : 'estimated'}
                        </div>
                      </div>
                      <span className={`badge ${trip.status === 'completed' ? 'badge-green' : trip.status === 'cancelled' ? 'badge-gray' : 'badge-blue'}`}>
                        {trip.status}
                      </span>
                      <ChevronRight size={16} style={{ color: '#536476', flexShrink: 0 }} />
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
