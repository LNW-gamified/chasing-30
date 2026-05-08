'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TripForm from '@/components/TripForm'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip } from '@/types'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, DollarSign, CheckCircle, X } from 'lucide-react'

type TripWithStadium = Trip & { stadium: Stadium }

const CATEGORIES = [
  { key: 'tickets', label: 'Tickets', icon: '🎟️' },
  { key: 'travel', label: 'Travel', icon: '✈️' },
  { key: 'hotel', label: 'Hotel', icon: '🏨' },
  { key: 'food', label: 'Food', icon: '🌭' },
  { key: 'parking', label: 'Parking', icon: '🚗' },
]

export default function TripDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [trip, setTrip] = useState<TripWithStadium | null>(null)
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [completeDate, setCompleteDate] = useState('')
  const [completing, setCompleting] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('trips').select('*, stadium:stadiums(*)').eq('id', id).single(),
      supabase.from('stadiums').select('*').order('name'),
    ])
    setTrip(t as TripWithStadium)
    setStadiums(s ?? [])
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
    await supabase
      .from('trips')
      .update({ status: 'completed', trip_date: completeDate || null })
      .eq('id', id)
    setCompleting(false)
    setShowComplete(false)
    await load()
  }

  if (loading) {
    return <AppShell><div className="text-center py-12" style={{ color: '#8896ae' }}>Loading...</div></AppShell>
  }

  if (!trip) {
    return <AppShell><div className="text-center py-12" style={{ color: '#8896ae' }}>Trip not found.</div></AppShell>
  }

  const estTotal = CATEGORIES.reduce((sum, c) => sum + (trip[`est_${c.key}` as keyof Trip] as number), 0)
  const actualTotal = CATEGORIES.reduce((sum, c) => sum + (trip[`actual_${c.key}` as keyof Trip] as number), 0)
  const overBudget = actualTotal > estTotal

  function statusColor(status: Trip['status']) {
    if (status === 'completed') return '#22c55e'
    if (status === 'cancelled') return '#ef4444'
    return '#3b82f6'
  }

  return (
    <AppShell>
      <Link href="/trips" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: '#8896ae' }}>
        <ArrowLeft size={16} /> Back to Trips
      </Link>

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>
                {trip.name}
              </h1>
              <span
                className="badge"
                style={{
                  backgroundColor: `${statusColor(trip.status)}20`,
                  color: statusColor(trip.status),
                }}
              >
                {trip.status}
              </span>
            </div>
            <div className="text-sm" style={{ color: '#94a3b8' }}>
              {trip.stadium?.name}
              {trip.trip_date && ` · ${formatDate(trip.trip_date)}`}
            </div>
            {trip.stadium && (
              <div className="text-xs mt-1" style={{ color: '#8896ae' }}>
                {trip.stadium.league} {trip.stadium.division} · {trip.stadium.city}, {trip.stadium.state}
              </div>
            )}
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
            <button
              onClick={handleDelete}
              className="btn-secondary"
              style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>

          {/* Mark complete inline panel */}
          {showComplete && (
            <div
              className="w-full mt-4 p-4 rounded-xl flex flex-wrap items-end gap-3"
              style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <div className="flex-1 min-w-40">
                <label className="label">Completion Date</label>
                <input
                  type="date"
                  className="input"
                  value={completeDate}
                  onChange={(e) => setCompleteDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleMarkComplete} disabled={completing} className="btn-primary" style={{ backgroundColor: '#22c55e' }}>
                  {completing ? 'Saving...' : 'Confirm'}
                </button>
                <button onClick={() => setShowComplete(false)} className="btn-secondary">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Budget breakdown */}
      <div className="card p-6 mb-6">
        <div className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#f1f5f9' }}>
          <DollarSign size={18} style={{ color: '#f59e0b' }} /> Budget Breakdown
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Category', 'Estimated', 'Actual', 'Difference'].map((h) => (
                  <th key={h} className="text-left pb-3 pr-4 text-xs font-medium" style={{ color: '#8896ae' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const est = trip[`est_${cat.key}` as keyof Trip] as number
                const actual = trip[`actual_${cat.key}` as keyof Trip] as number
                const diff = actual - est
                return (
                  <tr key={cat.key} style={{ borderTop: '1px solid #1f2937' }}>
                    <td className="py-3 pr-4">
                      <span className="mr-2">{cat.icon}</span>
                      <span style={{ color: '#94a3b8' }}>{cat.label}</span>
                    </td>
                    <td className="py-3 pr-4" style={{ color: '#f1f5f9' }}>
                      {formatCurrency(est)}
                    </td>
                    <td className="py-3 pr-4" style={{ color: actual > 0 ? '#f1f5f9' : '#8896ae' }}>
                      {actual > 0 ? formatCurrency(actual) : '—'}
                    </td>
                    <td className="py-3">
                      {actual > 0 ? (
                        <span style={{ color: diff > 0 ? '#ef4444' : '#22c55e' }}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </span>
                      ) : (
                        <span style={{ color: '#8896ae' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {/* Total row */}
              <tr style={{ borderTop: '2px solid #2d3748' }}>
                <td className="py-3 pr-4 font-semibold" style={{ color: '#f1f5f9' }}>Total</td>
                <td className="py-3 pr-4 font-bold text-base" style={{ color: '#f59e0b' }}>
                  {formatCurrency(estTotal)}
                </td>
                <td className="py-3 pr-4 font-bold text-base" style={{ color: actualTotal > 0 ? '#f1f5f9' : '#8896ae' }}>
                  {actualTotal > 0 ? formatCurrency(actualTotal) : '—'}
                </td>
                <td className="py-3 font-bold text-base" style={{ color: overBudget ? '#ef4444' : '#22c55e' }}>
                  {actualTotal > 0 ? (
                    `${overBudget ? '+' : ''}${formatCurrency(actualTotal - estTotal)}`
                  ) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {actualTotal > 0 && (
          <div
            className="mt-4 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: overBudget ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              color: overBudget ? '#f87171' : '#4ade80',
            }}
          >
            {overBudget
              ? `Over budget by ${formatCurrency(actualTotal - estTotal)}`
              : `Under budget by ${formatCurrency(estTotal - actualTotal)}`}
          </div>
        )}
      </div>

      {/* Category spend chart */}
      {actualTotal > 0 && (
        <div className="card p-6 mb-6">
          <div className="font-semibold mb-4" style={{ color: '#f1f5f9' }}>
            Spending Breakdown
          </div>
          <div className="flex flex-col gap-3">
            {CATEGORIES.map((cat) => {
              const actual = trip[`actual_${cat.key}` as keyof Trip] as number
              return (
                <div key={cat.key} className="flex items-center gap-3">
                  <span className="w-6 text-center">{cat.icon}</span>
                  <span className="text-sm w-16" style={{ color: '#94a3b8' }}>
                    {cat.label}
                  </span>
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#1f2937' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: actualTotal > 0 ? `${(actual / actualTotal) * 100}%` : '0%',
                        backgroundColor: '#3b82f6',
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium w-16 text-right" style={{ color: '#f1f5f9' }}>
                    {formatCurrency(actual)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {trip.notes && (
        <div className="card p-6">
          <div className="font-semibold mb-3" style={{ color: '#f1f5f9' }}>
            Notes
          </div>
          <div className="text-sm whitespace-pre-wrap" style={{ color: '#94a3b8' }}>
            {trip.notes}
          </div>
        </div>
      )}

      {showEdit && (
        <TripForm
          stadiums={stadiums}
          trip={trip}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </AppShell>
  )
}
