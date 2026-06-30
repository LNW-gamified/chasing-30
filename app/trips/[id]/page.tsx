'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TripForm from '@/components/TripForm'
import TeamLogo from '@/components/TeamLogo'
import { getTeamLogoUrlById, getTeamAbbrById } from '@/lib/team-logos'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip, TripStop, StopChecklistItem } from '@/types'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, DollarSign, CheckCircle, X, MapPin, Calendar, Plus, ExternalLink, MoreHorizontal, FileText, Ticket, Utensils, Car, Plane, BedDouble, Camera, Loader2 } from 'lucide-react'
import StopChecklist from '@/components/StopChecklist'
import { DESTINATION_BY_SLUG, destinationLocation, EXPERIENCE_TYPES } from '@/lib/destinations'
import { fetchForecastWeather, fetchHistoricalWeather, type WeatherData } from '@/lib/open-meteo'
import { TEAM_PRIMARY, TEAM_GRADIENTS as TEAM_COLORS } from '@/lib/team-colors'

type TripWithStadium = Trip & { stadium: Stadium | null }

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
  const [completeStep,   setCompleteStep]   = useState('')
  const [completeError,  setCompleteError]  = useState('')
  const [checklistItems, setChecklistItems] = useState<StopChecklistItem[]>([])
  const [showDeleteMenu,  setShowDeleteMenu]  = useState(false)
  const [visitedStadiumIds, setVisitedStadiumIds] = useState<Set<string>>(new Set())
  const [stopWeather, setStopWeather]             = useState<Record<string, WeatherData>>({})
  const [totalDrivingMiles, setTotalDrivingMiles] = useState<number | null>(null)
  const [segmentMiles, setSegmentMiles]           = useState<number[]>([])
  const [loadingMiles, setLoadingMiles]           = useState(false)
  const [promoUploading, setPromoUploading]       = useState<Record<string, boolean>>({})

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }, { data: st }, { data: sv }] = await Promise.all([
      supabase.from('trips').select('*, stadium:stadiums(*), destination:destinations(slug, name, city, state, country, type, description, lat, lng, is_mlb_event, website_url)').eq('id', id).single(),
      supabase.from('stadiums').select('*').order('name'),
      supabase.from('trip_stops').select(
        'id, trip_id, stop_type, stadium_id, destination_id, sort_order, game_date, game_time, opponent, opponent_team_id, ' +
        'experience_type, est_tickets, est_food, est_parking, actual_tickets, actual_food, actual_parking, notes, ' +
        'ticket_section, ticket_row, ticket_seats, ticket_confirmation, promotions, promotion_photos, created_at, ' +
        'stadium:stadiums(*), destination:destinations(*)'
      ).eq('trip_id', id).order('sort_order'),
      supabase.from('stadium_visits').select('stadium_id'),
    ])
    setTrip(t as TripWithStadium)
    setStadiums(s ?? [])
    setVisitedStadiumIds(new Set((sv ?? []).map((r: any) => r.stadium_id)))
    const loadedStops = (st as unknown as TripStop[]) ?? []
    setStops(loadedStops)
    // Assign sort_order to any stops that don't have one
    const stopsNeedingOrder = loadedStops.filter((s, i) => s.sort_order === 0 && i > 0)
    if (stopsNeedingOrder.length > 0) {
      const supabase = createClient()
      await Promise.all(loadedStops.map((s, i) =>
        supabase.from('trip_stops').update({ sort_order: i }).eq('id', s.id)
      ))
    }
    if (loadedStops.length > 0) {
      const stopIds = loadedStops.map(s => s.id)
      const { data: cl } = await supabase
        .from('stop_checklist').select('*')
        .in('stop_id', stopIds).order('created_at')
      setChecklistItems((cl as StopChecklistItem[]) ?? [])
    }
    setLoading(false)

    // Driving distance between consecutive stops — includes both stadium and destination locations
    interface GeoPoint { lat: number; lng: number }
    const withLocation: GeoPoint[] = loadedStops
      .map(s => {
        const stadium = s.stadium as Stadium | null
        const destination = s.destination as { lat: number | null; lng: number | null } | null
        if (stadium?.lat != null && stadium?.lng != null) return { lat: stadium.lat, lng: stadium.lng }
        if (destination?.lat != null && destination?.lng != null) return { lat: destination.lat, lng: destination.lng }
        return null
      })
      .filter((p): p is GeoPoint => p !== null)

    if (withLocation.length >= 2) {
      setLoadingMiles(true)
      const pairs: [GeoPoint, GeoPoint][] = []
      for (let i = 0; i < withLocation.length - 1; i++) {
        pairs.push([withLocation[i], withLocation[i + 1]])
      }
      Promise.all(
        pairs.map(([a, b]) =>
          fetch(`/api/driving-distance?fromLat=${a.lat}&fromLng=${a.lng}&toLat=${b.lat}&toLng=${b.lng}`)
            .then(r => r.json()).then(d => d.miles as number | null).catch(() => null)
        )
      ).then(results => {
        setSegmentMiles(results.map(r => r ?? 0))
        const valid = results.filter((r): r is number => r !== null)
        if (valid.length > 0) setTotalDrivingMiles(valid.reduce((s, m) => s + m, 0))
        setLoadingMiles(false)
      })
    }
  }

  async function reloadChecklist() {
    if (stops.length === 0) return
    const supabase = createClient()
    const { data: cl } = await supabase
      .from('stop_checklist').select('*')
      .in('stop_id', stops.map(s => s.id)).order('created_at')
    setChecklistItems((cl as StopChecklistItem[]) ?? [])
  }

  async function uploadPromoPhotoForStop(stopId: string, promoName: string, file: File) {
    const key = `${stopId}:${promoName}`
    setPromoUploading(prev => ({ ...prev, [key]: true }))
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('promo-photos').upload(path, file)
      if (error) return
      const { data: { publicUrl } } = supabase.storage.from('promo-photos').getPublicUrl(path)
      const stop = stops.find(s => s.id === stopId)
      const newPhotos = { ...(stop?.promotion_photos ?? {}), [promoName]: publicUrl }
      await supabase.from('trip_stops').update({ promotion_photos: newPhotos }).eq('id', stopId)
      setStops(prev => prev.map(s => s.id !== stopId ? s : { ...s, promotion_photos: newPhotos }))
    } finally {
      setPromoUploading(prev => { const n = { ...prev }; delete n[key]; return n })
    }
  }

  async function removePromoPhotoForStop(stopId: string, promoName: string) {
    const stop = stops.find(s => s.id === stopId)
    const url  = stop?.promotion_photos?.[promoName]
    if (url) {
      const match = url.match(/\/promo-photos\/(.+)$/)
      if (match?.[1]) createClient().storage.from('promo-photos').remove([match[1]])
    }
    const newPhotos = { ...(stop?.promotion_photos ?? {}) }
    delete newPhotos[promoName]
    await createClient().from('trip_stops').update({ promotion_photos: Object.keys(newPhotos).length > 0 ? newPhotos : null }).eq('id', stopId)
    setStops(prev => prev.map(s => s.id !== stopId ? s : { ...s, promotion_photos: Object.keys(newPhotos).length > 0 ? newPhotos : null }))
  }

  async function moveStop(stopId: string, direction: 'up' | 'down') {
    const idx = stops.findIndex(s => s.id === stopId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= stops.length) return

    const current  = stops[idx]
    const swapWith = stops[swapIdx]

    const supabase = createClient()
    await Promise.all([
      supabase.from('trip_stops').update({ sort_order: swapIdx }).eq('id', current.id),
      supabase.from('trip_stops').update({ sort_order: idx }).eq('id', swapWith.id),
    ])

    const newStops = [...stops]
    newStops[idx]     = { ...swapWith, sort_order: idx }
    newStops[swapIdx] = { ...current,  sort_order: swapIdx }
    setStops(newStops)
  }

  useEffect(() => { load() }, [id])


  useEffect(() => {
    if (stops.length === 0) return
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    const maxForecastDate = new Date(Date.now() + 16 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    stops.forEach(stop => {
      const date = stop.game_date
      const stadium = stop.stadium as Stadium | null
      if (!date || !stadium?.lat || !stadium?.lng) return
      const fetcher = date >= today && date <= maxForecastDate
        ? fetchForecastWeather
        : date < today
          ? fetchHistoricalWeather
          : null
      if (!fetcher) return
      fetcher(stadium.lat, stadium.lng, date).then(w => {
        if (w) setStopWeather(prev => ({ ...prev, [stop.id]: w }))
      })
    })
  }, [stops])

  async function handleDelete() {
    if (!confirm('Delete this trip?')) return
    const supabase = createClient()
    await supabase.from('trips').delete().eq('id', id)
    router.push('/trips')
  }

  async function handleMarkComplete() {
    setCompleting(true)
    setCompleteStep('Marking trip complete…')
    setCompleteError('')

    try {
      const res = await fetch('/api/complete-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: id, completionDate: completeDate || undefined }),
      })

      const result = await res.json()

      if (!res.ok) {
        setCompleteError(result.error ?? `Request failed (${res.status})`)
        setCompleting(false)
        setCompleteStep('')
        return
      }

      const statsOk    = (result.statsResults ?? []).filter((r: any) => r.success).length
      const statsTotal = result.statsResults?.length ?? 0
      if (statsTotal > 0) {
        setCompleteStep(
          `Visit${result.visitsCreated !== 1 ? 's' : ''} logged · Stats loaded for ${statsOk}/${statsTotal} game${statsTotal !== 1 ? 's' : ''}`
        )
      }
    } catch (e) {
      setCompleteError('Network error — please try again')
      setCompleting(false)
      setCompleteStep('')
      return
    }

    setCompleting(false)
    setShowComplete(false)
    await load()
    setCompleteStep('')
  }

  if (loading) {
    return (
      <div>
        {/* Hero skeleton */}
        <div style={{ height: 220, backgroundColor: '#1C2430', position: 'relative', overflow: 'hidden' }}>
          <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
        </div>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Stop cards skeleton */}
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 90, borderRadius: 14, backgroundColor: '#161B22', border: '1px solid #30363D', overflow: 'hidden', position: 'relative' }}>
              <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div style={{ padding: '32px 16px', color: '#8B949E' }}>Trip not found.</div>
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
  const countdownDays = trip.status === 'planned' ? daysUntil(trip.start_date ?? trip.trip_date) : null

  const isDestinationTrip = (trip as any).trip_type === 'destination'
  const destSlug = (trip as any).destination?.slug ?? null
  const destInfo = destSlug ? DESTINATION_BY_SLUG[destSlug] : null

  // Hero gradient: destination color or team color
  let heroGradient: string
  if (isDestinationTrip && destInfo) {
    heroGradient = `linear-gradient(135deg, ${destInfo.heroColor[0]}, ${destInfo.heroColor[1]})`
  } else {
    const heroAbbr = sortedStops[0]?.stadium?.abbreviation ?? ''
    const [h1, h2] = TEAM_COLORS[heroAbbr] ?? ['#1F3C6E', '#0B1117']
    heroGradient = `linear-gradient(135deg, ${h1} 0%, ${h2} 100%)`
  }

  return (
    <div>
      <main style={{ minHeight: '100vh' }}>

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

          {/* Ellipsis menu — top right only */}
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDeleteMenu(v => !v)}
                aria-label="More options"
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <MoreHorizontal size={16} color="#fff" strokeWidth={2} />
              </button>
              {showDeleteMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20,
                  backgroundColor: '#1C2430', borderRadius: 10,
                  border: '1px solid #30363D',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  minWidth: 160, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => { setShowDeleteMenu(false); handleDelete() }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '12px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', color: '#F85149', fontSize: 14, fontWeight: 600,
                      textAlign: 'left',
                    }}
                  >
                    <Trash2 size={14} /> Delete Trip
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Trip info — bottom */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 22px', zIndex: 10 }}>
            <h1 style={{
              margin: '0 0 8px', fontSize: 32, fontWeight: 900, color: '#ffffff',
              lineHeight: 1.15, textShadow: '0 2px 14px rgba(0,0,0,0.6)',
            }}>
              {trip.name}
            </h1>
            {/* Status badge — directly below title */}
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              backgroundColor: sc.bg, color: sc.color,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              marginBottom: 8,
            }}>
              {sc.label}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              {dr && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500,
                }}>
                  <Calendar size={13} /> {dr}
                  {countdownDays !== null && countdownDays >= 0 && (
                    <span style={{ color: countdownDays === 0 ? '#3FB950' : '#F5A623', fontWeight: 700, marginLeft: 4 }}>
                      · {countdownDays === 0 ? "Today!" : countdownDays === 1 ? '1 day away' : `${countdownDays} days away`}
                    </span>
                  )}
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

          {/* ── Destination info ───────────────────────────────────── */}
          {isDestinationTrip && destInfo && (
            <div style={{
              backgroundColor: '#161B22', borderRadius: 14,
              border: '1px solid #30363D', padding: '16px 18px',
              marginBottom: 16, display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{ fontSize: 40, flexShrink: 0, lineHeight: 1 }}>{destInfo.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#E6EDF3', marginBottom: 2 }}>{destInfo.name}</div>
                <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 8 }}>{destinationLocation(destInfo)}</div>
                {(trip as any).experience_type && (trip as any).experience_type !== 'other' && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 20, marginBottom: 6,
                    background: 'rgba(245,166,35,0.12)', color: '#F5A623',
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {EXPERIENCE_TYPES.find(e => e.value === (trip as any).experience_type)?.icon ?? '📍'}
                    {' '}{EXPERIENCE_TYPES.find(e => e.value === (trip as any).experience_type)?.label ?? (trip as any).experience_type}
                  </div>
                )}
                {destInfo.description && (
                  <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.5 }}>{destInfo.description}</div>
                )}
              </div>
            </div>
          )}

          {/* ── All stops visited prompt ───────────────────────────── */}
          {trip.status === 'planned' && stops.length > 0 && stops.every(s => s.stadium_id && visitedStadiumIds.has(s.stadium_id)) && !showComplete && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 12, marginBottom: 16,
              background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.35)',
              gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3FB950' }}>🎉 All stops visited!</div>
                <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>Ready to mark this trip complete?</div>
              </div>
              <button
                onClick={() => { setCompleteDate(new Date().toISOString().split('T')[0]); setShowComplete(true) }}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none', flexShrink: 0,
                  backgroundColor: '#3FB950', color: '#0B1117',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Mark Complete
              </button>
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap',
          }}>
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

          {/* Mark complete panel */}
          {showComplete && (
            <>
            <div style={{
              padding: 18, borderRadius: 14, marginBottom: 8,
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
                    fontSize: 14, fontWeight: 700, cursor: completing ? 'default' : 'pointer',
                    opacity: completing ? 0.75 : 1,
                  }}
                >
                  {completing ? (completeStep || 'Saving…') : 'Confirm'}
                </button>
                <button
                  onClick={() => { setShowComplete(false); setCompleteError('') }}
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
            {completeError && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                backgroundColor: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.25)',
                fontSize: 13, color: '#F85149',
              }}>
                {completeError}
              </div>
            )}
            </>
          )}

          {/* ── Cost / stats summary bar ───────────────────────────── */}
          {(!allBudgetZero || totalDrivingMiles !== null || stops.length > 1) && (
            <div style={{
              backgroundColor: '#161B22', borderRadius: 14,
              border: '1px solid #30363D', padding: '14px 20px',
              marginBottom: 28, display: 'flex', gap: 28,
              overflowX: 'auto', scrollbarWidth: 'none',
            }}>
              {!allBudgetZero && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                    Est. Total
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#F5A623' }}>
                    {formatCurrency(estTotal)}
                  </div>
                </div>
              )}
              {!allBudgetZero && actualTotal > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                    Actual
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: overBudget ? '#F85149' : '#3FB950' }}>
                    {formatCurrency(actualTotal)}
                  </div>
                </div>
              )}
              {stops.length > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                    Stadiums
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
                    {stops.length}
                  </div>
                </div>
              )}
              {trip.start_date && trip.end_date && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                    Days
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
                    {Math.ceil((new Date(trip.end_date + 'T12:00:00').getTime() - new Date(trip.start_date + 'T12:00:00').getTime()) / 86400000) + 1}
                  </div>
                </div>
              )}
              {(loadingMiles || totalDrivingMiles !== null) && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                    Drive
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
                    {loadingMiles ? '…' : `${totalDrivingMiles!.toLocaleString()}`}
                    {!loadingMiles && <span style={{ fontSize: 12, color: '#8B949E', fontWeight: 600 }}> mi</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Itinerary ──────────────────────────────────────────── */}
          {sortedStops.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
                fontSize: 13, fontWeight: 700, color: '#8B949E',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                <MapPin size={13} style={{ color: '#1F6FEB' }} />
                Itinerary
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {sortedStops.map((stop, i) => {
                  const isDestinationStop = stop.stop_type === 'destination' || (!stop.stadium_id && !!stop.destination_id)
                  const stadium     = stop.stadium as Stadium | undefined
                  const stopEst     = stop.est_tickets + stop.est_food + stop.est_parking
                  const stopAct     = stop.actual_tickets + stop.actual_food + stop.actual_parking
                  const hasBudget   = stopEst > 0 || stopAct > 0

                  // ── Destination stop card ────────────────────────────
                  if (isDestinationStop) {
                    const dest     = (stop as any).destination as { id: string; slug: string; name: string; city: string; state: string | null; is_mlb_event: boolean } | undefined
                    const destInfo = dest?.slug ? DESTINATION_BY_SLUG[dest.slug] : null
                    const expType  = EXPERIENCE_TYPES.find(e => e.value === stop.experience_type)
                    const heroColor = destInfo?.heroColor ?? ['#1A2030', '#0B1117']
                    const accentColor = heroColor[1] ?? '#1F6FEB'

                    const destCard = (
                      <div key={stop.id} style={{
                        backgroundColor: '#161B22', borderRadius: 16, overflow: 'hidden',
                        borderTop: '1px solid #30363D', borderRight: '1px solid #30363D',
                        borderBottom: '1px solid #30363D',
                        borderLeft: `4px solid ${accentColor}`,
                      }}>
                        <div style={{ padding: '20px 20px 16px' }}>
                          {/* Header row */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                backgroundColor: 'rgba(31,111,235,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 800, color: '#1F6FEB', flexShrink: 0,
                              }}>
                                {i + 1}
                              </div>
                              {/* MLB event: show hosting team logo + small star overlay */}
                              {stop.stadium_id && stadium ? (
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                  <TeamLogo abbreviation={stadium.abbreviation} size={44}
                                    style={{ borderRadius: '50%', border: '2px solid rgba(245,166,35,0.4)', display: 'block' }} />
                                  <span style={{
                                    position: 'absolute', bottom: -2, right: -4,
                                    fontSize: 14, lineHeight: 1,
                                  }}>⭐</span>
                                </div>
                              ) : (
                                <span style={{ fontSize: 36, lineHeight: 1 }}>{destInfo?.icon ?? '📍'}</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  onClick={() => moveStop(stop.id, 'up')}
                                  disabled={stops.indexOf(stop) === 0}
                                  style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: stops.indexOf(stop) === 0 ? 'default' : 'pointer', color: stops.indexOf(stop) === 0 ? '#30363D' : '#8B949E', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >↑</button>
                                <button
                                  onClick={() => moveStop(stop.id, 'down')}
                                  disabled={stops.indexOf(stop) === stops.length - 1}
                                  style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: stops.indexOf(stop) === stops.length - 1 ? 'default' : 'pointer', color: stops.indexOf(stop) === stops.length - 1 ? '#30363D' : '#8B949E', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >↓</button>
                              </div>
                              {(dest as any)?.is_mlb_event && (
                                <span style={{
                                  fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                                  color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.12)',
                                  border: '1px solid rgba(245,166,35,0.35)',
                                }}>⭐ MLB Event</span>
                              )}
                            </div>
                          </div>

                          <div style={{ fontWeight: 800, fontSize: 20, color: '#E6EDF3', lineHeight: 1.2, marginBottom: 2 }}>
                            {dest?.name ?? destInfo?.name ?? 'Destination'}
                          </div>
                          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 12 }}>
                            {stop.stadium_id && stadium
                              ? `${stadium.name} · ${stadium.city}, ${stadium.state}`
                              : destInfo
                                ? `${destInfo.city}${destInfo.state ? `, ${destInfo.state}` : ''}`
                                : null}
                          </div>

                          {stop.game_date && (
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3', marginBottom: 8 }}>
                              {new Date(stop.game_date + 'T12:00:00').toLocaleDateString('en-US', {
                                weekday: 'long', month: 'long', day: 'numeric',
                              })}
                            </div>
                          )}

                          {expType && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: 12, fontWeight: 600,
                              padding: '4px 12px', borderRadius: 20,
                              backgroundColor: 'rgba(245,166,35,0.1)',
                              color: '#F5A623', border: '1px solid rgba(245,166,35,0.25)',
                            }}>
                              {expType.icon} {expType.label}
                            </span>
                          )}
                        </div>

                        {hasBudget && (
                          <div style={{ display: 'flex', borderTop: '1px solid #30363D', backgroundColor: '#1C2430' }}>
                            {([
                              { label: 'Tickets', Icon: Ticket,   est: stop.est_tickets, actual: stop.actual_tickets },
                              { label: 'Food',    Icon: Utensils, est: stop.est_food,    actual: stop.actual_food    },
                              { label: 'Parking', Icon: Car,      est: stop.est_parking, actual: stop.actual_parking },
                            ] as const).map(({ label, Icon, est, actual }, ci) => (
                              <div key={label} style={{ flex: 1, padding: '10px 12px', borderRight: ci < 2 ? '1px solid #30363D' : 'none' }}>
                                <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Icon size={10} strokeWidth={2} /> {label}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{formatCurrency(est)}</div>
                                {actual > 0 && (
                                  <div style={{ fontSize: 13, color: actual > est ? '#F85149' : '#3FB950', marginTop: 1 }}>
                                    {formatCurrency(actual)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <StopChecklist
                          stopId={stop.id}
                          items={checklistItems.filter(c => c.stop_id === stop.id)}
                          onReload={reloadChecklist}
                        />
                      </div>
                    )

                    const nextStop = sortedStops[i + 1]
                    if (!nextStop) return destCard
                    const stopsWithStadium = sortedStops.filter(s => (s.stadium as Stadium | null)?.lat)
                    const segIdx = stopsWithStadium.findIndex(s => s.id === stop.id)
                    const miles = segIdx >= 0 ? segmentMiles[segIdx] : undefined
                    return (
                      <div key={stop.id}>
                        {destCard}
                        {miles ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', color: '#8B949E' }}>
                            <div style={{ width: 2, height: 20, backgroundColor: '#30363D', marginLeft: 14, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#F5A623' }}>🚗 {miles.toLocaleString()} mi</span>
                          </div>
                        ) : null}
                      </div>
                    )
                  }

                  // ── Stadium stop card ────────────────────────────────
                  const accentColor = TEAM_PRIMARY[stadium?.abbreviation ?? ''] ?? '#1F6FEB'
                  const seatGeekUrl = `https://seatgeek.com/mlb-tickets?q=${encodeURIComponent(stadium?.team ?? '')}`

                  // Ticket display string
                  const hasTickets  = stop.ticket_section || stop.ticket_row || (stop.ticket_seats && stop.ticket_seats.length > 0)
                  const ticketParts: string[] = []
                  if (stop.ticket_section) ticketParts.push(`Section ${stop.ticket_section}`)
                  if (stop.ticket_row)     ticketParts.push(`Row ${stop.ticket_row}`)
                  if (stop.ticket_seats && stop.ticket_seats.length > 0) {
                    ticketParts.push(`Seat${stop.ticket_seats.length > 1 ? 's' : ''} ${stop.ticket_seats.join(', ')}`)
                  }

                  const card = (
                    <div key={stop.id} style={{
                      backgroundColor: '#161B22', borderRadius: 16,
                      overflow: 'hidden',
                      borderTop: '1px solid #30363D',
                      borderRight: '1px solid #30363D',
                      borderBottom: '1px solid #30363D',
                      borderLeft: `4px solid ${accentColor}`,
                    }}>

                      {/* Card body */}
                      <div style={{ padding: '18px 20px 14px' }}>

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
                          {/* Get tickets link + reorder buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => moveStop(stop.id, 'up')}
                                disabled={stops.indexOf(stop) === 0}
                                style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: stops.indexOf(stop) === 0 ? 'default' : 'pointer', color: stops.indexOf(stop) === 0 ? '#30363D' : '#8B949E', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >↑</button>
                              <button
                                onClick={() => moveStop(stop.id, 'down')}
                                disabled={stops.indexOf(stop) === stops.length - 1}
                                style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: stops.indexOf(stop) === stops.length - 1 ? 'default' : 'pointer', color: stops.indexOf(stop) === stops.length - 1 ? '#30363D' : '#8B949E', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >↓</button>
                            </div>
                            {stop.game_date && (
                              <a
                                href={seatGeekUrl}
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontSize: 12, fontWeight: 600, color: accentColor,
                                  textDecoration: 'none',
                                  padding: '5px 10px', borderRadius: 8,
                                  backgroundColor: `${accentColor}18`,
                                  border: `1px solid ${accentColor}40`,
                                }}
                              >
                                <Ticket size={12} /> Buy Tickets
                              </a>
                            )}
                          </div>
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

                        {/* Game date + time + weather */}
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
                            {stopWeather[stop.id] && (() => {
                              const w = stopWeather[stop.id]
                              const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
                              const isFuture = stop.game_date >= today
                              return (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                  <span style={{ fontSize: 14 }}>{w.emoji}</span>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#C9D1D9' }}>
                                    {w.tempF}°F · {w.condition}
                                    {isFuture && w.rainChance != null && w.rainChance > 20
                                      ? ` · ${w.rainChance}% rain`
                                      : ''}
                                  </span>
                                </div>
                              )
                            })()}
                          </div>
                        )}

                        {/* Matchup row */}
                        {stadium && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                            {/* Home team */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                              <TeamLogo
                                abbreviation={stadium.abbreviation}
                                size={56}
                                style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.12)' }}
                              />
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', letterSpacing: '0.06em' }}>
                                {stadium.abbreviation}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{
                                fontSize: 18, fontWeight: 900, color: '#8B949E',
                                letterSpacing: '-0.02em', lineHeight: 1,
                              }}>VS</span>
                            </div>

                            {/* Opponent */}
                            {stop.opponent ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                {stop.opponent_team_id ? (
                                  <TeamLogo
                                    abbreviation={getTeamAbbrById(stop.opponent_team_id) || 'MLB'}
                                    size={56}
                                    style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.12)' }}
                                  />
                                ) : (
                                  <div style={{
                                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '2px solid rgba(255,255,255,0.12)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    <span style={{ fontSize: 24 }}>⚾</span>
                                  </div>
                                )}
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', letterSpacing: '0.06em' }}>
                                  {stop.opponent_team_id
                                    ? getTeamAbbrById(stop.opponent_team_id)
                                    : stop.opponent.replace('vs ', '')}
                                </span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: '#8B949E', fontStyle: 'italic' }}>TBD</div>
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
                              fontSize: 13, fontWeight: 700, color: '#F5A623',
                              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5,
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                              <Ticket size={12} /> Your Tickets
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

                      {/* Promotions */}
                      {stop.promotions && stop.promotions.length > 0 && (
                        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(245,166,35,0.15)', backgroundColor: 'rgba(245,166,35,0.04)' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(245,166,35,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                            Promotions
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {stop.promotions.map(promoName => {
                              const photoUrl = stop.promotion_photos?.[promoName] ?? null
                              const uploading = promoUploading[`${stop.id}:${promoName}`]
                              return (
                                <div key={promoName} style={{
                                  display: 'flex', alignItems: 'center', gap: 12,
                                  padding: '8px 0', minHeight: 48,
                                }}>
                                  <div style={{
                                    width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                                    backgroundColor: photoUrl ? 'transparent' : 'rgba(245,166,35,0.08)',
                                    border: photoUrl ? 'none' : '1px dashed rgba(245,166,35,0.3)',
                                    overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    {photoUrl ? (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img src={photoUrl} alt={promoName} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                        onClick={() => window.open(photoUrl, '_blank')} />
                                    ) : (
                                      <span style={{ fontSize: 18 }}>🎁</span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: 13, color: '#F5A623', fontWeight: 600, flex: 1, minWidth: 0 }}>{promoName}</span>
                                  {photoUrl ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                      <label style={{ cursor: 'pointer', fontSize: 13, color: '#8B949E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Camera size={11} /> Replace
                                        <input type="file" accept="image/*" style={{ display: 'none' }}
                                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadPromoPhotoForStop(stop.id, promoName, f) }} />
                                      </label>
                                      <button onClick={() => removePromoPhotoForStop(stop.id, promoName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F85149', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 600 }}>
                                        <X size={12} /> Remove
                                      </button>
                                    </div>
                                  ) : (
                                    <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#8B949E', padding: '5px 10px', borderRadius: 6, border: '1px dashed rgba(245,166,35,0.35)', backgroundColor: 'rgba(245,166,35,0.04)', flexShrink: 0 }}>
                                      {uploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                                      {uploading ? 'Uploading…' : 'Add Photo'}
                                      <input type="file" accept="image/*" style={{ display: 'none' }}
                                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPromoPhotoForStop(stop.id, promoName, f) }} />
                                    </label>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Budget strip */}
                      {hasBudget ? (
                        <div style={{ display: 'flex', borderTop: '1px solid #30363D', backgroundColor: '#1C2430' }}>
                          {([
                            { label: 'Tickets', Icon: Ticket,   est: stop.est_tickets, actual: stop.actual_tickets },
                            { label: 'Food',    Icon: Utensils, est: stop.est_food,    actual: stop.actual_food    },
                            { label: 'Parking', Icon: Car,      est: stop.est_parking, actual: stop.actual_parking },
                          ] as const).map(({ label, Icon, est, actual }, ci) => (
                            <div key={label} style={{
                              flex: 1, padding: '10px 12px',
                              borderRight: ci < 2 ? '1px solid #30363D' : 'none',
                            }}>
                              <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Icon size={10} strokeWidth={2} /> {label}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>
                                {formatCurrency(est)}
                              </div>
                              {actual > 0 && (
                                <div style={{ fontSize: 13, color: actual > est ? '#F85149' : '#3FB950', marginTop: 1 }}>
                                  {formatCurrency(actual)}
                                </div>
                              )}
                            </div>
                          ))}
                          <div style={{
                            padding: '10px 12px', borderLeft: '1px solid #30363D', flexShrink: 0,
                            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end',
                          }}>
                            <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 3 }}>Total</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#F5A623' }}>
                              {formatCurrency(stopAct > 0 ? stopAct : stopEst)}
                            </div>
                            {stopAct === 0 && stopEst > 0 && (
                              <div style={{ fontSize: 12, color: '#8B949E' }}>est</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          borderTop: '1px solid #30363D', backgroundColor: '#1C2430',
                          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: 13, color: '#8B949E' }}>No budget added</span>
                          <button
                            type="button"
                            onClick={() => setShowEdit(true)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: 'none', border: 'none', padding: 0,
                              color: '#58A6FF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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

                  // Connector to next stop
                  const nextStop = sortedStops[i + 1]
                  const nextStadium = nextStop?.stadium as Stadium | undefined
                  if (!nextStop || !stadium || !nextStadium) return card

                  const stopsWithStadium = sortedStops.filter(s => (s.stadium as Stadium | null)?.lat)
                  const segIdx = stopsWithStadium.findIndex(s => s.id === stop.id)
                  const miles = segIdx >= 0 ? segmentMiles[segIdx] : undefined

                  return (
                    <div key={stop.id}>
                      {card}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 16px',
                        color: '#8B949E',
                      }}>
                        <div style={{ width: 2, height: 20, backgroundColor: '#30363D', marginLeft: 14, flexShrink: 0 }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                          {loadingMiles ? (
                            <span style={{ color: '#8B949E' }}>Calculating drive…</span>
                          ) : miles ? (
                            <>
                              <span style={{ color: '#F5A623' }}>🚗 {miles.toLocaleString()} mi</span>
                              <span style={{ color: '#8B949E' }}>to {nextStadium.name}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
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
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                <DollarSign size={32} color="#F5A623" strokeWidth={1.5} />
              </div>
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
                      {['Category', 'Est', 'Actual', 'Variance'].map((h, hi) => (
                        <th key={h} style={{
                          textAlign: hi === 0 ? 'left' : 'right',
                          padding: '10px 16px', fontSize: 13, fontWeight: 700,
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
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: actual > 0 ? '#E6EDF3' : '#8B949E' }}>
                            {actual > 0 ? formatCurrency(actual) : '—'}
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: actual > 0 ? (diff > 0 ? '#F85149' : '#3FB950') : '#8B949E' }}>
                            {actual > 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
                          </td>
                        </tr>
                      )
                    })}

                    {trip.est_travel > 0 && (() => {
                      const diff = trip.actual_travel - trip.est_travel
                      return (
                        <tr style={{ borderTop: '1px solid #30363D' }}>
                          <td style={{ padding: '11px 16px', color: '#8B949E' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Plane size={13} strokeWidth={1.8} /> Travel
                            </span>
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: '#E6EDF3', fontWeight: 600 }}>
                            {formatCurrency(trip.est_travel)}
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: trip.actual_travel > 0 ? '#E6EDF3' : '#8B949E' }}>
                            {trip.actual_travel > 0 ? formatCurrency(trip.actual_travel) : '—'}
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: trip.actual_travel > 0 ? (diff > 0 ? '#F85149' : '#3FB950') : '#8B949E' }}>
                            {trip.actual_travel > 0 ? `${diff > 0 ? '+' : ''}${formatCurrency(diff)}` : '—'}
                          </td>
                        </tr>
                      )
                    })()}

                    {trip.est_hotel > 0 && (() => {
                      const diff = trip.actual_hotel - trip.est_hotel
                      return (
                        <tr style={{ borderTop: '1px solid #30363D' }}>
                          <td style={{ padding: '11px 16px', color: '#8B949E' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <BedDouble size={13} strokeWidth={1.8} /> Hotel
                            </span>
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: '#E6EDF3', fontWeight: 600 }}>
                            {formatCurrency(trip.est_hotel)}
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', color: trip.actual_hotel > 0 ? '#E6EDF3' : '#8B949E' }}>
                            {trip.actual_hotel > 0 ? formatCurrency(trip.actual_hotel) : '—'}
                          </td>
                          <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, color: trip.actual_hotel > 0 ? (diff > 0 ? '#F85149' : '#3FB950') : '#8B949E' }}>
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
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: actualTotal > 0 ? '#E6EDF3' : '#8B949E' }}>
                        {actualTotal > 0 ? formatCurrency(actualTotal) : '—'}
                      </td>
                      <td style={{
                        padding: '13px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14,
                        color: actualTotal > 0 ? (overBudget ? '#F85149' : '#3FB950') : '#8B949E',
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
                border: '1px solid #30363D', overflow: 'hidden',
                borderLeft: '3px solid #F5A623',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '13px 18px', borderBottom: '1px solid #30363D',
                  backgroundColor: '#1C2430',
                }}>
                  <FileText size={15} color="#8B949E" strokeWidth={2} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#E6EDF3' }}>Notes</span>
                </div>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: 14, color: '#C9D1D9', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {cleanNotes}
                  </div>
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
