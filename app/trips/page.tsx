'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TripForm from '@/components/TripForm'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip } from '@/types'
import Link from 'next/link'
import { Plus, Plane, ChevronRight } from 'lucide-react'

type TripWithStadium = Trip & { stadium: Stadium }

export default function TripsPage() {
  const [trips, setTrips] = useState<TripWithStadium[]>([])
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase
        .from('trips')
        .select('*, stadium:stadiums(*)')
        .order('trip_date', { ascending: true }),
      supabase.from('stadiums').select('*').order('name'),
    ])
    setTrips((t as TripWithStadium[]) ?? [])
    setStadiums(s ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const planned = trips.filter((t) => t.status === 'planned')
  const completed = trips.filter((t) => t.status === 'completed')
  const cancelled = trips.filter((t) => t.status === 'cancelled')

  const totalEstimated = trips.reduce(
    (sum, t) => sum + t.est_tickets + t.est_travel + t.est_hotel + t.est_food + t.est_parking,
    0
  )
  const totalSpent = completed.reduce(
    (sum, t) => sum + t.actual_tickets + t.actual_travel + t.actual_hotel + t.actual_food + t.actual_parking,
    0
  )

  function statusColor(status: Trip['status']) {
    if (status === 'completed') return '#22c55e'
    if (status === 'cancelled') return '#ef4444'
    return '#3b82f6'
  }

  function statusBadge(status: Trip['status']) {
    if (status === 'completed') return 'badge-green'
    if (status === 'cancelled') return 'badge badge-gray'
    return 'badge badge-blue'
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
            Trip Planner
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
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
            <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>
              {label}
            </div>
            <div className="text-xl font-bold" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: '#64748b' }}>Loading trips...</div>
      ) : trips.length === 0 ? (
        <div className="card p-12 text-center">
          <Plane size={40} className="mx-auto mb-3 opacity-30" style={{ color: '#64748b' }} />
          <div className="font-medium mb-1" style={{ color: '#94a3b8' }}>No trips yet</div>
          <div className="text-sm mb-4" style={{ color: '#64748b' }}>Plan your first stadium trip</div>
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
              <h2 className="text-sm font-semibold mb-3" style={{ color: '#94a3b8' }}>
                {label} ({group.length})
              </h2>
              <div className="flex flex-col gap-2">
                {group.map((trip) => {
                  const est = trip.est_tickets + trip.est_travel + trip.est_hotel + trip.est_food + trip.est_parking
                  const actual = trip.actual_tickets + trip.actual_travel + trip.actual_hotel + trip.actual_food + trip.actual_parking
                  return (
                    <Link
                      key={trip.id}
                      href={`/trips/${trip.id}`}
                      className="card card-hover p-4 flex items-center gap-4"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ backgroundColor: `${statusColor(trip.status)}20` }}
                      >
                        ✈️
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>
                          {trip.name}
                        </div>
                        <div className="text-xs" style={{ color: '#64748b' }}>
                          {trip.stadium?.name}
                          {trip.trip_date && ` · ${formatDate(trip.trip_date)}`}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                          {trip.status === 'completed' ? formatCurrency(actual) : formatCurrency(est)}
                        </div>
                        <div className="text-xs" style={{ color: '#64748b' }}>
                          {trip.status === 'completed' ? 'spent' : 'estimated'}
                        </div>
                      </div>
                      <span className={`badge ${trip.status === 'completed' ? 'badge-green' : trip.status === 'cancelled' ? 'badge-gray' : 'badge-blue'}`}>
                        {trip.status}
                      </span>
                      <ChevronRight size={16} style={{ color: '#374151', flexShrink: 0 }} />
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
