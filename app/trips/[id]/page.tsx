'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TripForm from '@/components/TripForm'
import TeamLogo from '@/components/TeamLogo'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip, TripStop } from '@/types'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, DollarSign, CheckCircle, X, MapPin, Calendar } from 'lucide-react'

type TripWithStadium = Trip & { stadium: Stadium | null }

const TRIP_CATS = [
  { key: 'travel', label: 'Travel', icon: '✈️' },
  { key: 'hotel', label: 'Hotel', icon: '🏨' },
]

export default function TripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [trip, setTrip] = useState<TripWithStadium | null>(null)
  const [stops, setStops] = useState<TripStop[]>([])
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [completeDate, setCompleteDate] = useState('')
  const [completing, setCompleting] = useState(false)

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

  if (loading) return <AppShell><div className="text-center py-12" style={{ color: '#a8b8c8' }}>Loading...</div></AppShell>
  if (!trip) return <AppShell><div className="text-center py-12" style={{ color: '#a8b8c8' }}>Trip not found.</div></AppShell>

  // Sort stops by game_date, nulls last
  const sortedStops = [...stops].sort((a, b) => {
    if (!a.game_date && !b.game_date) return 0
    if (!a.game_date) return 1
    if (!b.game_date) return -1
    return a.game_date.localeCompare(b.game_date)
  })

  const stopEst = stops.reduce((sum, s) => sum + s.est_tickets + s.est_food + s.est_parking, 0)
  const stopActual = stops.reduce((sum, s) => sum + s.actual_tickets + s.actual_food + s.actual_parking, 0)
  const tripEst = trip.est_travel + trip.est_hotel
  const tripActual = trip.actual_travel + trip.actual_hotel
  const estTotal = stopEst + tripEst
  const actualTotal = stopActual + tripActual
  const overBudget = actualTotal > estTotal && actualTotal > 0

  function statusColor(status: Trip['status']) {
    if (status === 'completed') return '#22c55e'
    if (status === 'cancelled') return '#ef4444'
    return '#3b82f6'
  }

  function dateRange() {
    const start = trip!.start_date
    const end = trip!.end_date
    if (start && end) return `${formatDate(start)} – ${formatDate(end)}`
    if (start) return `From ${formatDate(start)}`
    if (trip!.trip_date) return formatDate(trip!.trip_date)
    return null
  }

  return (
    <AppShell>
      <Link href="/trips" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: '#a8b8c8' }}>
        <ArrowLeft size={16} /> Back to Trips
      </Link>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>{trip.name}</h1>
              <span className="badge" style={{ backgroundColor: `${statusColor(trip.status)}20`, color: statusColor(trip.status) }}>
                {trip.status}
              </span>
            </div>
            {dateRange() && (
              <div className="flex items-center gap-1.5 text-sm mb-1" style={{ color: '#b8c8d8' }}>
                <Calendar size={13} style={{ color: '#a8b8c8' }} />
                {dateRange()}
              </div>
            )}
            <div className="text-sm" style={{ color: '#a8b8c8' }}>
              {stops.length > 0
                ? `${stops.length} stadium${stops.length !== 1 ? 's' : ''}`
                : trip.stadium?.name}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {trip.status === 'planned' && (
              <button
                onClick={() => { setCompleteDate(new Date().toISOString().split('T')[0]); setShowComplete(true) }}
                className="btn-secondary"
                style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}
              >
                <CheckCircle size={14} /> Mark Complete
              </button>
            )}
            <button onClick={() => setShowEdit(true)} className="btn-secondary">
              <Pencil size={14} /> Edit
            </button>
            <button onClick={handleDelete} className="btn-secondary" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>

          {showComplete && (
            <div className="w-full mt-4 p-4 rounded-xl flex flex-wrap items-end gap-3"
              style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <div className="flex-1 min-w-40">
                <label className="label">Completion Date</label>
                <input type="date" className="input" value={completeDate} onChange={e => setCompleteDate(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleMarkComplete} disabled={completing} className="btn-primary" style={{ backgroundColor: '#22c55e' }}>
                  {completing ? 'Saving...' : 'Confirm'}
                </button>
                <button onClick={() => setShowComplete(false)} className="btn-secondary"><X size={14} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Itinerary */}
      {sortedStops.length > 0 && (
        <div className="card p-6 mb-6">
          <div className="font-semibold mb-5 flex items-center gap-2" style={{ color: '#f1f5f9' }}>
            <MapPin size={17} style={{ color: '#3b82f6' }} /> Itinerary
          </div>
          <div className="flex flex-col gap-5">
            {sortedStops.map((stop, i) => {
              const stadium = stop.stadium as Stadium | undefined
              const stopEst = stop.est_tickets + stop.est_food + stop.est_parking
              const stopAct = stop.actual_tickets + stop.actual_food + stop.actual_parking
              return (
                <div key={stop.id} className="flex gap-4">
                  {/* Day marker */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                    >
                      {i + 1}
                    </div>
                    {i < sortedStops.length - 1 && (
                      <div className="flex-1 w-px mt-2" style={{ backgroundColor: '#1f2937', minHeight: 24 }} />
                    )}
                  </div>

                  {/* Stop content */}
                  <div className="flex-1 pb-2">
                    {stop.game_date && (
                      <div className="text-xs font-semibold mb-1" style={{ color: '#a8b8c8' }}>
                        {new Date(stop.game_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 mb-2">
                      {stadium && <TeamLogo abbreviation={stadium.abbreviation} size={32} style={{ flexShrink: 0 }} />}
                      <div>
                        <div className="font-semibold" style={{ color: '#f1f5f9' }}>{stadium?.name ?? 'Unknown Stadium'}</div>
                        {stadium && (
                          <div className="text-xs" style={{ color: '#a8b8c8' }}>{stadium.city}, {stadium.state}</div>
                        )}
                      </div>
                    </div>

                    {/* Per-stop budget mini table */}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {[
                        { label: '🎟️ Tickets', est: stop.est_tickets, actual: stop.actual_tickets },
                        { label: '🌭 Food', est: stop.est_food, actual: stop.actual_food },
                        { label: '🚗 Parking', est: stop.est_parking, actual: stop.actual_parking },
                      ].map(({ label, est, actual }) => (
                        <div key={label} className="flex flex-col gap-0.5">
                          <div className="text-xs" style={{ color: '#a8b8c8' }}>{label}</div>
                          <div className="text-xs" style={{ color: '#f1f5f9' }}>
                            Est {formatCurrency(est)}
                            {actual > 0 && <span style={{ color: actual > est ? '#ef4444' : '#22c55e' }}> · {formatCurrency(actual)}</span>}
                          </div>
                        </div>
                      ))}
                      <div className="flex flex-col gap-0.5">
                        <div className="text-xs" style={{ color: '#a8b8c8' }}>Stop Total</div>
                        <div className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                          {stopAct > 0 ? formatCurrency(stopAct) : formatCurrency(stopEst) + ' est'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Budget breakdown */}
      <div className="card p-6 mb-6">
        <div className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#f1f5f9' }}>
          <DollarSign size={18} style={{ color: '#f59e0b' }} /> Budget Breakdown
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Category', 'Estimated', 'Actual', 'Diff'].map(h => (
                  <th key={h} className="text-left pb-3 pr-4 text-xs font-medium" style={{ color: '#a8b8c8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Per-stop rows */}
              {sortedStops.map((stop, i) => {
                const stadium = stop.stadium as Stadium | undefined
                const est = stop.est_tickets + stop.est_food + stop.est_parking
                const actual = stop.actual_tickets + stop.actual_food + stop.actual_parking
                const diff = actual - est
                return (
                  <tr key={stop.id} style={{ borderTop: '1px solid #1f2937' }}>
                    <td className="py-3 pr-4">
                      <div className="text-xs font-medium" style={{ color: '#b8c8d8' }}>
                        Stop {i + 1}{stop.game_date ? ` · ${new Date(stop.game_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                      </div>
                      <div className="text-xs" style={{ color: '#a8b8c8' }}>{stadium?.name}</div>
                    </td>
                    <td className="py-3 pr-4" style={{ color: '#f1f5f9' }}>{formatCurrency(est)}</td>
                    <td className="py-3 pr-4" style={{ color: actual > 0 ? '#f1f5f9' : '#a8b8c8' }}>{actual > 0 ? formatCurrency(actual) : '—'}</td>
                    <td className="py-3" style={{ color: actual > 0 ? (diff > 0 ? '#ef4444' : '#22c55e') : '#a8b8c8' }}>
                      {actual > 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
                    </td>
                  </tr>
                )
              })}

              {/* Trip-level costs */}
              {TRIP_CATS.map(cat => {
                const est = trip[`est_${cat.key}` as keyof Trip] as number
                const actual = trip[`actual_${cat.key}` as keyof Trip] as number
                const diff = actual - est
                return (
                  <tr key={cat.key} style={{ borderTop: '1px solid #1f2937' }}>
                    <td className="py-3 pr-4">
                      <span className="mr-1.5">{cat.icon}</span>
                      <span style={{ color: '#b8c8d8' }}>{cat.label}</span>
                    </td>
                    <td className="py-3 pr-4" style={{ color: '#f1f5f9' }}>{formatCurrency(est)}</td>
                    <td className="py-3 pr-4" style={{ color: actual > 0 ? '#f1f5f9' : '#a8b8c8' }}>{actual > 0 ? formatCurrency(actual) : '—'}</td>
                    <td className="py-3" style={{ color: actual > 0 ? (diff > 0 ? '#ef4444' : '#22c55e') : '#a8b8c8' }}>
                      {actual > 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
                    </td>
                  </tr>
                )
              })}

              {/* Grand total */}
              <tr style={{ borderTop: '2px solid #2d3748' }}>
                <td className="py-3 pr-4 font-semibold" style={{ color: '#f1f5f9' }}>Total</td>
                <td className="py-3 pr-4 font-bold text-base" style={{ color: '#f59e0b' }}>{formatCurrency(estTotal)}</td>
                <td className="py-3 pr-4 font-bold text-base" style={{ color: actualTotal > 0 ? '#f1f5f9' : '#a8b8c8' }}>
                  {actualTotal > 0 ? formatCurrency(actualTotal) : '—'}
                </td>
                <td className="py-3 font-bold text-base" style={{ color: overBudget ? '#ef4444' : '#22c55e' }}>
                  {actualTotal > 0 ? `${overBudget ? '+' : ''}${formatCurrency(actualTotal - estTotal)}` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {actualTotal > 0 && (
          <div className="mt-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: overBudget ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: overBudget ? '#f87171' : '#4ade80' }}>
            {overBudget
              ? `Over budget by ${formatCurrency(actualTotal - estTotal)}`
              : `Under budget by ${formatCurrency(estTotal - actualTotal)}`}
          </div>
        )}
      </div>

      {/* Notes */}
      {trip.notes && (
        <div className="card p-6">
          <div className="font-semibold mb-3" style={{ color: '#f1f5f9' }}>Notes</div>
          <div className="text-sm whitespace-pre-wrap" style={{ color: '#b8c8d8' }}>{trip.notes}</div>
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
