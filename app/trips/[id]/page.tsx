'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TeamLogo from '@/components/TeamLogo'
import { getTeamLogoUrlById, getTeamLogoUrl, getTeamAbbrById, LIGHT_BG_LOGO_TEAMS } from '@/lib/team-logos'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Stadium, Trip, TripStop, StopChecklistItem } from '@/types'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, DollarSign, CheckCircle, X, MapPin, Calendar, Plus, ExternalLink, MoreHorizontal, FileText, Ticket, Utensils, Car, CarTaxiFront, Plane, BedDouble, Camera, Loader2, Building2, Landmark, Gauge, Route } from 'lucide-react'
import StopChecklist from '@/components/StopChecklist'
import EditStopModal from '@/components/EditStopModal'
import { DESTINATION_BY_SLUG, destinationLocation, EXPERIENCE_TYPES } from '@/lib/destinations'
import { fetchForecastWeather, fetchHistoricalWeather, type WeatherData } from '@/lib/open-meteo'
import { TEAM_PRIMARY, TEAM_GRADIENTS as TEAM_COLORS, TEAM_BTN_COLOR, TEAM_LOGO_BG } from '@/lib/team-colors'
import { fetchRealGameTime } from '@/lib/mlb-api'

// Large form only ever shown behind a click — load it on demand instead
// of shipping its code in this route's initial bundle.
const TripForm = dynamic(() => import('@/components/TripForm'), { ssr: false })

type TripWithStadium = Trip & { stadium: Stadium | null }

const MONTH_ABBR = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
function fmtDate(d: Date): string { return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }

// Dated stops always sort by their real date — that's what the
// driving-distance calculation between consecutive stops depends on
// being accurate. An undated stop (a pilgrimage with no game date)
// inherits the date of whichever dated stop precedes it in manual
// order, so wherever you've placed it between two games, it stays
// there — it just can't be dragged to a date position that would make
// the mileage between real games meaningless.
// Standalone (not derived from component state) so it can be used both
// for display (sortedStops, from React state) and right after a fresh
// load (calculateDrivingDistance needs the same order, but state hasn't
// updated yet at that point in the function).
function sortStopsByDate(stopsToSort: TripStop[]): TripStop[] {
  const bySortOrder = [...stopsToSort].sort((a, b) => a.sort_order - b.sort_order)
  const withEffectiveDate = bySortOrder.reduce<{ stop: TripStop; effectiveDate: string; lastDate: string | null }[]>((acc, s) => {
    const prevDate = acc.length > 0 ? acc[acc.length - 1].lastDate : null
    const lastDate = s.game_date ?? prevDate
    acc.push({ stop: s, effectiveDate: s.game_date ?? prevDate ?? '9999-12-31', lastDate })
    return acc
  }, [])
  return withEffectiveDate
    .sort((a, b) => {
      const cmp = a.effectiveDate.localeCompare(b.effectiveDate)
      return cmp !== 0 ? cmp : a.stop.sort_order - b.stop.sort_order
    })
    .map(x => x.stop)
}

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
  const [editingStop, setEditingStop] = useState<TripStop | null>(null)
  const [stopWeather, setStopWeather]             = useState<Record<string, WeatherData>>({})
  const [markingStopId,   setMarkingStopId]   = useState<string | null>(null)
  const [markStopError,   setMarkStopError]   = useState<Record<string, string>>({})
  const [linkPickerStopId, setLinkPickerStopId] = useState<string | null>(null)
  const [linkCandidates,   setLinkCandidates]   = useState<{ id: string; label: string }[]>([])
  const [linkLoading,      setLinkLoading]      = useState(false)
  const [totalDrivingMiles, setTotalDrivingMiles] = useState<number | null>(null)
  const [totalDrivingMinutes, setTotalDrivingMinutes] = useState<number | null>(null)
  const [segmentMiles, setSegmentMiles]           = useState<number[]>([])
  const [loadingMiles, setLoadingMiles]           = useState(false)
  const [stopPhotos, setStopPhotos] = useState<Record<string, string>>({})
  const [promoUploading, setPromoUploading]       = useState<Record<string, boolean>>({})

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: s }, { data: st }] = await Promise.all([
      supabase.from('trips').select('*, stadium:stadiums(*), destination:destinations(slug, name, city, state, country, type, description, lat, lng, is_mlb_event, website_url)').eq('id', id).single(),
      supabase.from('stadiums').select('*').order('name'),
      supabase.from('trip_stops').select(
        'id, trip_id, stop_type, stadium_id, destination_id, sort_order, game_date, game_time, opponent, opponent_team_id, ' +
        'experience_type, est_tickets, est_food, est_parking, est_hotel, est_local_transport, actual_tickets, actual_food, actual_parking, actual_hotel, actual_local_transport, notes, ' +
        'ticket_section, ticket_row, ticket_seats, ticket_confirmation, promotions, promotion_photos, created_at, ' +
        'stadium_visit_id, destination_visit_id, baseball_life_entry_id, ' +
        'stadium:stadiums(*), destination:destinations(*)'
      ).eq('trip_id', id).order('sort_order'),
    ])
    setTrip(t as TripWithStadium)
    setStadiums(s ?? [])
    const loadedStops = (st as unknown as TripStop[]) ?? []
    setStops(loadedStops)
    if (loadedStops.length > 0) {
      const stopIds = loadedStops.map(s => s.id)
      const { data: cl } = await supabase
        .from('stop_checklist').select('*')
        .in('stop_id', stopIds).order('created_at')
      setChecklistItems((cl as StopChecklistItem[]) ?? [])
    }
    setLoading(false)

    const stopAbbrs = Array.from(new Set(
      loadedStops.map(s => (s.stadium as Stadium | null)?.abbreviation).filter((a): a is string => !!a)
    ))
    if (stopAbbrs.length > 0) {
      fetch(`/api/stadium-photo?abbrs=${encodeURIComponent(stopAbbrs.join(','))}`)
        .then(r => r.json())
        .then((photoMap: Record<string, string | null>) => {
          const clean: Record<string, string> = {}
          for (const [abbr, photo] of Object.entries(photoMap)) {
            if (photo) clean[abbr] = photo
          }
          setStopPhotos(clean)
        })
    }

    // Repair sort_order if it's drifted from array position (e.g. legacy
    // duplicate values) — skip the write round trip on the common case
    // where it's already correct, so a normal visit doesn't do N writes.
    const needsReorder = loadedStops.some((s, i) => s.sort_order !== i)
    if (needsReorder) {
      await Promise.all(loadedStops.map((s, i) =>
        supabase.from('trip_stops').update({ sort_order: i }).eq('id', s.id)
      ))
    }

    await calculateDrivingDistance(sortStopsByDate(loadedStops))
    refreshStaleGameTimes(loadedStops)

    const abbrs = Array.from(new Set(
      loadedStops.map(s => (s.stadium as Stadium | null)?.abbreviation).filter((a): a is string => !!a)
    )).join(',')
    if (abbrs) {
      fetch(`/api/stadium-photo?abbrs=${encodeURIComponent(abbrs)}`)
        .then(r => r.json())
        .then((photoMap: Record<string, string | null>) => {
          const clean: Record<string, string> = {}
          for (const [abbr, photo] of Object.entries(photoMap)) {
            if (photo) clean[abbr] = photo
          }
          setStopPhotos(clean)
        })
    }
  }

  // Lazily re-checks the real first-pitch time for any upcoming stop that
  // has one, and quietly corrects it if MLB has since locked in a
  // different time than whatever was showing when the stop was added.
  // Runs once per page load, never in the background — see
  // fetchRealGameTime's own comment for why lazy beats a scheduled job
  // here.
  async function refreshStaleGameTimes(stopsToCheck: typeof stops) {
    const todayISO = new Date().toISOString().slice(0, 10)
    const supabase = createClient()
    const upcoming = stopsToCheck.filter(s => (s.stadium as Stadium | null) && s.game_date && s.game_date >= todayISO)
    await Promise.all(upcoming.map(async s => {
      const stadium = s.stadium as Stadium
      const real = await fetchRealGameTime(stadium.abbreviation, s.game_date as string)
      if (real && real !== s.game_time) {
        await supabase.from('trip_stops').update({ game_time: real }).eq('id', s.id)
        setStops(prev => prev.map(p => p.id === s.id ? { ...p, game_time: real } : p))
      }
    }))
  }

  async function calculateDrivingDistance(stopsToCalc: typeof stops) {
    interface GeoPoint { lat: number; lng: number }
    const withLocation: GeoPoint[] = stopsToCalc
      .map(s => {
        const stadium = s.stadium as Stadium | null
        const destination = s.destination as { lat: number | null; lng: number | null } | null
        if (stadium?.lat != null && stadium?.lng != null) return { lat: stadium.lat, lng: stadium.lng }
        if (destination?.lat != null && destination?.lng != null) return { lat: destination.lat, lng: destination.lng }
        return null
      })
      .filter((p): p is GeoPoint => p !== null)

    if (withLocation.length < 2) return

    setLoadingMiles(true)
    const pairs: [GeoPoint, GeoPoint][] = []
    for (let i = 0; i < withLocation.length - 1; i++) {
      pairs.push([withLocation[i], withLocation[i + 1]])
    }
    const results = await Promise.all(
      pairs.map(([a, b]) =>
        fetch(`/api/driving-distance?fromLat=${a.lat}&fromLng=${a.lng}&toLat=${b.lat}&toLng=${b.lng}`)
          .then(r => r.json()).then(d => ({ miles: d.miles as number | null, minutes: d.minutes as number | null })).catch(() => ({ miles: null, minutes: null }))
      )
    )
    setSegmentMiles(results.map(r => r.miles ?? 0))
    const validMiles = results.filter((r): r is { miles: number; minutes: number | null } => r.miles !== null)
    if (validMiles.length > 0) setTotalDrivingMiles(validMiles.reduce((s, r) => s + r.miles, 0))
    const validMinutes = results.filter((r): r is { miles: number | null; minutes: number } => r.minutes !== null)
    if (validMinutes.length > 0) setTotalDrivingMinutes(validMinutes.reduce((s, r) => s + r.minutes, 0))
    setLoadingMiles(false)
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

  function canMoveStop(stopId: string, direction: 'up' | 'down'): boolean {
    const idx = sortedStops.findIndex(s => s.id === stopId)
    if (idx === -1) return false
    const current = sortedStops[idx]
    if (current.game_date) return false
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sortedStops.length) return false
    return !sortedStops[swapIdx].game_date
  }

  async function moveStop(stopId: string, direction: 'up' | 'down') {
    const idx = sortedStops.findIndex(s => s.id === stopId)
    if (idx === -1) return
    const current = sortedStops[idx]
    if (current.game_date) return // dated stops sort by their real date, not manually

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sortedStops.length) return
    const swapWith = sortedStops[swapIdx]
    if (swapWith.game_date) return // can't swap past a dated stop — see sortedStops above

    const supabase = createClient()
    await Promise.all([
      supabase.from('trip_stops').update({ sort_order: swapWith.sort_order }).eq('id', current.id),
      supabase.from('trip_stops').update({ sort_order: current.sort_order }).eq('id', swapWith.id),
    ])

    const newStops = stops.map(s => {
      if (s.id === current.id)  return { ...s, sort_order: swapWith.sort_order }
      if (s.id === swapWith.id) return { ...s, sort_order: current.sort_order }
      return s
    })
    setStops(newStops)

    // Recalculate driving distance with new order
    await calculateDrivingDistance(sortStopsByDate(newStops))
  }

  useEffect(() => { load() }, [id])


  // Mirrors stopWeather without being a dependency below — reading state
  // via ref keeps the effect from re-running (and re-fetching) merely
  // because a fetch it triggered resolved.
  const stopWeatherRef = useRef(stopWeather)
  useEffect(() => { stopWeatherRef.current = stopWeather }, [stopWeather])

  useEffect(() => {
    if (stops.length === 0) return
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    const maxForecastDate = new Date(Date.now() + 16 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    stops.forEach(stop => {
      // Already have weather for this stop — skip. Without this, any
      // unrelated stop mutation (promo photo upload/remove, reorder) gives
      // the `stops` array a new identity and re-fetches weather for every
      // stop in the trip, not just the one that changed.
      if (stopWeatherRef.current[stop.id]) return
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

  async function handleLogStop(stopId: string) {
    setMarkingStopId(stopId)
    setMarkStopError(prev => ({ ...prev, [stopId]: '' }))
    try {
      const res = await fetch('/api/complete-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopId, action: 'log' }),
      })
      const result = await res.json()
      if (!res.ok) {
        setMarkStopError(prev => ({ ...prev, [stopId]: result.error ?? `Request failed (${res.status})` }))
        return
      }
      await load()
    } catch {
      setMarkStopError(prev => ({ ...prev, [stopId]: 'Something went wrong, please try again' }))
    } finally {
      setMarkingStopId(null)
    }
  }

  async function openLinkPicker(stop: TripStop) {
    setLinkPickerStopId(stop.id)
    setLinkLoading(true)
    setLinkCandidates([])
    const supabase = createClient()
    try {
      if (stop.destination_id) {
        const { data } = await supabase
          .from('destination_visits')
          .select('id, visit_date')
          .eq('destination_id', stop.destination_id)
          .order('visit_date', { ascending: false })
          .limit(10)
        setLinkCandidates((data ?? []).map((d: any) => ({ id: d.id, label: d.visit_date ? formatDate(d.visit_date) : 'Undated visit' })))
      } else if (stop.stadium_id) {
        const { data } = await supabase
          .from('stadium_visits')
          .select('id, visit_date, visiting_team')
          .eq('stadium_id', stop.stadium_id)
          .order('visit_date', { ascending: false })
          .limit(10)
        setLinkCandidates((data ?? []).map((v: any) => ({ id: v.id, label: `${formatDate(v.visit_date)}${v.visiting_team ? ` vs ${v.visiting_team}` : ''}` })))
      }
    } finally {
      setLinkLoading(false)
    }
  }

  async function handleLinkStop(stop: TripStop, entryId: string) {
    setMarkingStopId(stop.id)
    setMarkStopError(prev => ({ ...prev, [stop.id]: '' }))
    try {
      const res = await fetch('/api/complete-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stopId: stop.id,
          action: 'link',
          ...(stop.destination_id ? { destinationVisitId: entryId } : { stadiumVisitId: entryId }),
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        setMarkStopError(prev => ({ ...prev, [stop.id]: result.error ?? `Request failed (${res.status})` }))
        return
      }
      setLinkPickerStopId(null)
      await load()
    } catch {
      setMarkStopError(prev => ({ ...prev, [stop.id]: 'Something went wrong, please try again' }))
    } finally {
      setMarkingStopId(null)
    }
  }

  function renderMarkDone(stop: TripStop) {
    const isDone = !!(stop.stadium_visit_id || stop.destination_visit_id || stop.baseball_life_entry_id)
    if (isDone) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 12,
          fontSize: 12, fontWeight: 700, color: '#3FB950',
        }}>
          <CheckCircle size={13} /> Logged
        </div>
      )
    }
    const isMarking = markingStopId === stop.id
    const isPicking = linkPickerStopId === stop.id
    return (
      <div style={{ marginTop: 12 }}>
        {!isPicking ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => handleLogStop(stop.id)}
              disabled={isMarking}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(63,185,80,0.35)',
                backgroundColor: 'rgba(63,185,80,0.08)', color: '#3FB950',
                fontSize: 12, fontWeight: 700, cursor: isMarking ? 'default' : 'pointer', opacity: isMarking ? 0.6 : 1,
              }}
            >
              {isMarking ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              Mark Done
            </button>
            <button
              onClick={() => openLinkPicker(stop)}
              disabled={isMarking}
              style={{
                padding: '7px 12px', borderRadius: 8, border: '1px solid #30363D',
                backgroundColor: 'transparent', color: '#8B949E',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Already logged this
            </button>
          </div>
        ) : (
          <div style={{ padding: 12, borderRadius: 10, border: '1px solid #30363D', backgroundColor: '#1C2430' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#8B949E' }}>Link an existing entry</span>
              <button onClick={() => setLinkPickerStopId(null)} style={{ background: 'none', border: 'none', color: '#8B949E', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            {linkLoading ? (
              <div style={{ fontSize: 12, color: '#8B949E' }}>Loading…</div>
            ) : linkCandidates.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8B949E' }}>No existing entries found for this one.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {linkCandidates.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleLinkStop(stop, c.id)}
                    disabled={isMarking}
                    style={{
                      textAlign: 'left', padding: '7px 10px', borderRadius: 8,
                      border: '1px solid #30363D', backgroundColor: '#161B22',
                      color: '#E6EDF3', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {markStopError[stop.id] && (
          <div style={{ fontSize: 12, color: '#F85149', marginTop: 6 }}>{markStopError[stop.id]}</div>
        )}
      </div>
    )
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

  const sortedStops = sortStopsByDate(stops)

  const stopEstTotal  = stops.reduce((sum, s) => sum + s.est_tickets + s.est_food + s.est_parking + s.est_hotel + s.est_local_transport, 0)
  const stopActTotal  = stops.reduce((sum, s) => sum + s.actual_tickets + s.actual_food + s.actual_parking + s.actual_hotel + s.actual_local_transport, 0)
  // trip.est_hotel/actual_hotel are only ever non-zero for destination-type
  // trips (single-location pilgrimage trips with no trip_stops at all, so
  // there's no "per stop" for hotel to live on, trip-level is the correct
  // and only place for it). For regular multi-stop stadium trips these are
  // always 0 now, hotel there lives on each stop instead, so including
  // them here is harmless for that case and necessary for this one.
  const tripEst       = trip.est_travel + trip.est_hotel
  const tripActual    = trip.actual_travel + trip.actual_hotel
  const estTotal      = stopEstTotal + tripEst
  const actualTotal   = stopActTotal + tripActual
  const overBudget    = estTotal > 0 && actualTotal > estTotal
  const allBudgetZero = estTotal === 0 && actualTotal === 0

  function statusConfig(status: Trip['status']) {
    if (status === 'completed') return { color: '#3FB950', bg: 'rgba(63,185,80,0.18)',   label: '✓ Completed' }
    if (status === 'cancelled') return { color: '#8B949E', bg: 'rgba(139,148,158,0.18)', label: 'Cancelled'   }
    return                             { color: '#60a5fa', bg: 'rgba(96,165,250,0.18)',   label: '● Planned'   }
  }

  function dateRange() {
    if (trip!.start_date && trip!.end_date) {
      const s = new Date(trip!.start_date + 'T12:00:00')
      const e = new Date(trip!.end_date   + 'T12:00:00')
      if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
        return `${MONTH_ABBR[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`
      return `${fmtDate(s)} – ${fmtDate(e)}`
    }
    if (trip!.start_date) return `From ${fmtDate(new Date(trip!.start_date + 'T12:00:00'))}`
    if (trip!.trip_date)  return fmtDate(new Date(trip!.trip_date + 'T12:00:00'))
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

  // Team logo tiles for hero (same logic as trip cards)
  const heroAbbrs: string[] = !isDestinationTrip
    ? [...new Set([
        ...sortedStops.map((s: any) => s.stadium?.abbreviation).filter(Boolean),
        ...sortedStops
          .filter((s: any) => s.stop_type === 'destination' && s.opponent_team_id != null)
          .map((s: any) => getTeamAbbrById(s.opponent_team_id as number))
          .filter(Boolean),
      ])].slice(0, 6) as string[]
    : []

  return (
    <div>
      <main style={{ minHeight: '100vh' }}>

        {/* ── HERO BANNER ────────────────────────────────────────── */}
        <div style={{ position: 'relative', height: 230, overflow: 'hidden', background: heroGradient }}>
          {/* Photo collage — real stop photos already fetched for this trip, blurred and dimmed as texture behind the gradient */}
          {heroAbbrs.filter(a => stopPhotos[a]).length > 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'grid', gridTemplateColumns: `repeat(${Math.min(heroAbbrs.length, 6)}, 1fr)`,
              filter: 'blur(2px) brightness(0.6) saturate(1.1)',
            }}>
              {heroAbbrs.slice(0, 6).map((abbr, idx) => (
                <div key={idx} style={{
                  backgroundImage: stopPhotos[abbr] ? `url(${stopPhotos[abbr]})` : 'none',
                  backgroundColor: stopPhotos[abbr] ? undefined : 'rgba(255,255,255,0.04)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
              ))}
            </div>
          )}

          {/* Layered overlay for depth */}
          <div style={{
            position: 'absolute', inset: 0,
            background: heroAbbrs.filter(a => stopPhotos[a]).length > 0
              ? `linear-gradient(to bottom, ${heroGradient.match(/#[0-9A-Fa-f]{6}/)?.[0] ?? '#0B1117'}66 0%, rgba(11,17,23,0.82) 100%)`
              : 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.6) 100%)',
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
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', gap: 12, marginBottom: 8 }}>
              <h1 style={{
                margin: 0, fontSize: 32, fontWeight: 900, color: '#ffffff',
                lineHeight: 1.15, textShadow: '0 2px 14px rgba(0,0,0,0.6)',
                minWidth: 0,
              }}>
                {trip.name}
              </h1>
              {heroAbbrs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: 220, justifyContent: 'flex-start', flexShrink: 0 }}>
                  {heroAbbrs.map(abbr => (
                    <div key={abbr} style={{
                      width: 42, height: 42, borderRadius: 10,
                      backgroundColor: LIGHT_BG_LOGO_TEAMS.has(abbr)
                        ? 'rgba(255,255,255,0.95)'
                        : (TEAM_LOGO_BG[abbr] ?? TEAM_BTN_COLOR[abbr] ?? '#1F3C6E'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getTeamLogoUrl(abbr)} alt={abbr} width={30} height={30} style={{ objectFit: 'contain' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  {stops.filter(s => s.stop_type === 'stadium').length} stadium{stops.filter(s => s.stop_type === 'stadium').length !== 1 ? 's' : ''}
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

          {isDestinationTrip && !destInfo && ((trip as any).custom_name || (trip as any).custom_city) && (
            <div style={{
              backgroundColor: '#161B22', borderRadius: 14,
              border: '1px solid #30363D', padding: '16px 18px',
              marginBottom: 16, display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <MapPin size={40} style={{ flexShrink: 0, color: '#8B949E' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {(trip as any).custom_name && (
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#E6EDF3', marginBottom: 2 }}>{(trip as any).custom_name}</div>
                )}
                {(trip as any).custom_city && (
                  <div style={{ fontSize: 13, color: '#8B949E' }}>{(trip as any).custom_city}</div>
                )}
              </div>
            </div>
          )}

          {/* ── All stops visited prompt ───────────────────────────── */}
          {trip.status === 'planned' && stops.length > 0 && stops.every(s => s.stadium_visit_id || s.destination_visit_id || s.baseball_life_entry_id) && !showComplete && (
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
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <DollarSign size={12} /> Est. Total
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#F5A623' }}>
                    {formatCurrency(estTotal)}
                  </div>
                </div>
              )}
              {!allBudgetZero && actualTotal > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <DollarSign size={12} /> Actual
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: overBudget ? '#F85149' : '#3FB950' }}>
                    {formatCurrency(actualTotal)}
                  </div>
                </div>
              )}
              {stops.length > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Building2 size={12} /> Stadiums
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
                    {stops.filter(s => s.stop_type === 'stadium').length}
                  </div>
                </div>
              )}
              {stops.some(s => s.stop_type === 'destination') && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Landmark size={12} /> Pilgrimages
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
                    {stops.filter(s => s.stop_type === 'destination').length}
                  </div>
                </div>
              )}
              {trip.start_date && trip.end_date && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} /> Days
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
                    {Math.ceil((new Date(trip.end_date + 'T12:00:00').getTime() - new Date(trip.start_date + 'T12:00:00').getTime()) / 86400000) + 1}
                  </div>
                </div>
              )}
              {(() => {
                const stadiumStopCount = stops.filter(s => s.stop_type === 'stadium').length
                if (stadiumStopCount < 2 || !trip.start_date || !trip.end_date) return null
                const days = Math.ceil((new Date(trip.end_date + 'T12:00:00').getTime() - new Date(trip.start_date + 'T12:00:00').getTime()) / 86400000) + 1
                const ratio = days / stadiumStopCount
                const difficulty = ratio <= 1.5 ? 'Road Warrior' : ratio <= 3.5 ? 'On the Move' : 'Leisure Tour'
                const diffColor = difficulty === 'Road Warrior' ? '#F85149' : difficulty === 'On the Move' ? '#F5A623' : '#3FB950'
                return (
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Gauge size={12} /> Pace
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: diffColor }}>
                      {difficulty}
                    </div>
                  </div>
                )
              })()}
              {(loadingMiles || totalDrivingMiles !== null) && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Route size={12} /> Drive
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E6EDF3' }}>
                    {loadingMiles ? '…' : `${totalDrivingMiles!.toLocaleString()}`}
                    {!loadingMiles && <span style={{ fontSize: 12, color: '#8B949E', fontWeight: 600 }}> mi</span>}
                  </div>
                  {!loadingMiles && totalDrivingMinutes !== null && (
                    <div style={{ fontSize: 12, color: '#8B949E', fontWeight: 600, marginTop: 1 }}>
                      {totalDrivingMinutes >= 60
                        ? `${Math.floor(totalDrivingMinutes / 60)}h ${totalDrivingMinutes % 60}m`
                        : `${totalDrivingMinutes}m`}
                    </div>
                  )}
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
                  const stopEst     = stop.est_tickets + stop.est_food + stop.est_parking + stop.est_hotel + stop.est_local_transport
                  const stopAct     = stop.actual_tickets + stop.actual_food + stop.actual_parking + stop.actual_hotel + stop.actual_local_transport
                  const hasBudget   = stopEst > 0 || stopAct > 0

                  // ── Destination stop card ────────────────────────────
                  if (isDestinationStop) {
                    const dest     = (stop as any).destination as { id: string; slug: string; name: string; city: string; state: string | null; is_mlb_event: boolean } | undefined
                    const destInfo = dest?.slug ? DESTINATION_BY_SLUG[dest.slug] : null
                    const expType  = EXPERIENCE_TYPES.find(e => e.value === stop.experience_type)
                    const heroColor = destInfo?.heroColor ?? ['#1A2030', '#0B1117']
                    const accentColor = heroColor[1] ?? '#1F6FEB'

                    const destStopPhoto = stop.stadium_id && stadium ? stopPhotos[stadium.abbreviation] : undefined

                    const destCard = (
                      <div key={stop.id} style={{
                        backgroundColor: '#161B22', borderRadius: 16, overflow: 'hidden',
                        borderTop: '1px solid #30363D', borderRight: '1px solid #30363D',
                        borderBottom: '1px solid #30363D',
                        borderLeft: `4px solid ${accentColor}`,
                      }}>
                        <div className="trip-stop-body" style={{ display: 'flex', gap: 0 }}>

                          <div className="trip-stop-photo" style={{
                            width: 130, flexShrink: 0, position: 'relative',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundImage: destStopPhoto
                              ? `linear-gradient(180deg, rgba(13,17,23,0.15) 0%, rgba(13,17,23,0.55) 100%), url(${destStopPhoto})`
                              : `linear-gradient(160deg, ${heroColor[0]} 0%, rgba(13,17,23,0.9) 100%)`,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                          }}>
                            <div style={{
                              position: 'absolute', top: 10, left: 10,
                              width: 26, height: 26, borderRadius: '50%',
                              backgroundColor: 'rgba(13,17,23,0.75)', border: '1px solid rgba(255,255,255,0.2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
                            }}>
                              {i + 1}
                            </div>
                            {stop.stadium_id && stadium ? (
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <TeamLogo abbreviation={stadium.abbreviation} size={44}
                                  style={{ borderRadius: '50%', border: '2px solid rgba(245,166,35,0.4)', display: 'block' }} />
                                <span style={{ position: 'absolute', bottom: -2, right: -4, fontSize: 14, lineHeight: 1 }}>⭐</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: 40, lineHeight: 1 }}>{destInfo?.icon ?? '📍'}</span>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0, padding: '14px 18px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 18, color: '#E6EDF3', lineHeight: 1.2 }}>
                                  {dest?.name ?? destInfo?.name ?? 'Destination'}
                                </div>
                                <div style={{ fontSize: 13, color: '#8B949E', marginTop: 1 }}>
                                  {stop.stadium_id && stadium
                                    ? `${stadium.name} · ${stadium.city}, ${stadium.state}`
                                    : destInfo
                                      ? `${destInfo.city}${destInfo.state ? `, ${destInfo.state}` : ''}`
                                      : null}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {!stop.game_date && (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() => moveStop(stop.id, 'up')}
                                      disabled={!canMoveStop(stop.id, 'up')}
                                      style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: canMoveStop(stop.id, 'up') ? 'pointer' : 'default', color: canMoveStop(stop.id, 'up') ? '#8B949E' : '#30363D', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >↑</button>
                                    <button
                                      onClick={() => moveStop(stop.id, 'down')}
                                      disabled={!canMoveStop(stop.id, 'down')}
                                      style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: canMoveStop(stop.id, 'down') ? 'pointer' : 'default', color: canMoveStop(stop.id, 'down') ? '#8B949E' : '#30363D', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >↓</button>
                                  </div>
                                )}
                                {(dest as any)?.is_mlb_event && (
                                  <span style={{
                                    fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                                    color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.12)',
                                    border: '1px solid rgba(245,166,35,0.35)', whiteSpace: 'nowrap',
                                  }}>⭐ MLB Event</span>
                                )}
                                <button
                                  onClick={() => setEditingStop(stop)}
                                  aria-label="Edit stop"
                                  style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: '#8B949E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                >
                                  <Pencil size={12} />
                                </button>
                              </div>
                            </div>

                            {stop.game_date && (
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3', marginTop: 10, marginBottom: 8 }}>
                                {new Date(stop.game_date + 'T12:00:00').toLocaleDateString('en-US', {
                                  weekday: 'long', month: 'long', day: 'numeric',
                                })}
                              </div>
                            )}

                            {expType && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontSize: 12, fontWeight: 600,
                                padding: '4px 12px', borderRadius: 20, marginTop: stop.game_date ? 0 : 10,
                                backgroundColor: 'rgba(245,166,35,0.1)',
                                color: '#F5A623', border: '1px solid rgba(245,166,35,0.25)',
                              }}>
                                {expType.icon} {expType.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {hasBudget && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid #30363D', backgroundColor: '#1C2430' }}>
                            {([
                              { label: 'Tickets', Icon: Ticket,       est: stop.est_tickets, actual: stop.actual_tickets },
                              { label: 'Food',    Icon: Utensils,     est: stop.est_food,    actual: stop.actual_food    },
                              { label: 'Parking', Icon: Car,          est: stop.est_parking, actual: stop.actual_parking },
                              { label: 'Hotel',   Icon: BedDouble,    est: stop.est_hotel,   actual: stop.actual_hotel   },
                              { label: 'Local Transport', Icon: CarTaxiFront, est: stop.est_local_transport, actual: stop.actual_local_transport },
                            ] as const).filter(c => c.est > 0 || c.actual > 0).map(({ label, Icon, est, actual }, ci, arr) => (
                              <div key={label} style={{
                                padding: '10px 12px',
                                borderRight: (ci + 1) % 3 !== 0 && ci < arr.length - 1 ? '1px solid #30363D' : 'none',
                                borderTop: ci >= 3 ? '1px solid #30363D' : 'none',
                              }}>
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

                        <div style={{ padding: '0 20px 16px' }}>
                          {renderMarkDone(stop)}
                        </div>
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

                  const stopPhoto = stopPhotos[stadium?.abbreviation ?? '']

                  const card = (
                    <div key={stop.id} style={{
                      backgroundColor: '#161B22', borderRadius: 16,
                      overflow: 'hidden',
                      borderTop: '1px solid #30363D',
                      borderRight: '1px solid #30363D',
                      borderBottom: '1px solid #30363D',
                      borderLeft: `4px solid ${accentColor}`,
                    }}>

                      {/* Card body: photo strip on the left, everything else in a column to the right */}
                      <div className="trip-stop-body" style={{ display: 'flex', gap: 0 }}>

                        <div className="trip-stop-photo" style={{
                          width: 130, flexShrink: 0, position: 'relative',
                          backgroundImage: stopPhoto
                            ? `linear-gradient(180deg, rgba(13,17,23,0.15) 0%, rgba(13,17,23,0.55) 100%), url(${stopPhoto})`
                            : `linear-gradient(160deg, ${accentColor}55 0%, rgba(13,17,23,0.9) 100%)`,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                        }}>
                          <div style={{
                            position: 'absolute', top: 10, left: 10,
                            width: 26, height: 26, borderRadius: '50%',
                            backgroundColor: 'rgba(13,17,23,0.75)', border: '1px solid rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
                          }}>
                            {i + 1}
                          </div>
                        </div>

                        <div style={{ flex: 1, minWidth: 0, padding: '14px 18px 14px' }}>

                          {/* Name + actions row */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 18, color: '#E6EDF3', lineHeight: 1.2 }}>
                                {stadium?.name ?? 'Unknown Stadium'}
                              </div>
                              {stadium && (
                                <div style={{ fontSize: 13, color: '#8B949E', marginTop: 1 }}>
                                  {stadium.city}, {stadium.state}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {!stop.game_date && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    onClick={() => moveStop(stop.id, 'up')}
                                    disabled={!canMoveStop(stop.id, 'up')}
                                    style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: canMoveStop(stop.id, 'up') ? 'pointer' : 'default', color: canMoveStop(stop.id, 'up') ? '#8B949E' : '#30363D', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >↑</button>
                                  <button
                                    onClick={() => moveStop(stop.id, 'down')}
                                    disabled={!canMoveStop(stop.id, 'down')}
                                    style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: canMoveStop(stop.id, 'down') ? 'pointer' : 'default', color: canMoveStop(stop.id, 'down') ? '#8B949E' : '#30363D', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >↓</button>
                                </div>
                              )}
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
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <Ticket size={12} /> Buy Tickets
                                </a>
                              )}
                              <button
                                onClick={() => setEditingStop(stop)}
                                aria-label="Edit stop"
                                style={{ background: 'none', border: '1px solid #30363D', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: '#8B949E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Date, time, weather */}
                          {stop.game_date && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.2 }}>
                                {new Date(stop.game_date + 'T12:00:00').toLocaleDateString('en-US', {
                                  weekday: 'long', month: 'long', day: 'numeric',
                                })}
                                {stop.game_time && <span style={{ color: '#F5A623', fontWeight: 700 }}> · {stop.game_time}</span>}
                              </div>
                              {stopWeather[stop.id] && (() => {
                                const w = stopWeather[stop.id]
                                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
                                const isFuture = stop.game_date >= today
                                return (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span style={{ fontSize: 14 }}>{w.emoji}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#C9D1D9' }}>
                                      {w.tempF}°F · {w.condition}
                                      {isFuture && w.rainChance != null && w.rainChance > 20 ? ` · ${w.rainChance}% rain` : ''}
                                    </span>
                                  </div>
                                )
                              })()}
                            </div>
                          )}

                          {/* Matchup */}
                          {stadium && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <TeamLogo abbreviation={stadium.abbreviation} size={40} style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.12)' }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#8B949E', letterSpacing: '0.06em' }}>{stadium.abbreviation}</span>
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 900, color: '#8B949E' }}>VS</span>
                              {stop.opponent ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  {stop.opponent_team_id ? (
                                    <TeamLogo abbreviation={getTeamAbbrById(stop.opponent_team_id) || 'MLB'} size={40} style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.12)' }} />
                                  ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ fontSize: 18 }}>⚾</span>
                                    </div>
                                  )}
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#8B949E', letterSpacing: '0.06em' }}>
                                    {stop.opponent_team_id ? getTeamAbbrById(stop.opponent_team_id) : stop.opponent.replace('vs ', '')}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ fontSize: 13, color: '#8B949E', fontStyle: 'italic' }}>TBD</div>
                              )}
                            </div>
                          )}

                          {/* Tickets */}
                          {hasTickets && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', marginBottom: 2 }}>🎟 Your Seats</div>
                              <div style={{ fontSize: 13, color: '#E6EDF3' }}>{ticketParts.join(' · ')}</div>
                              {stop.ticket_confirmation && (
                                <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>#{stop.ticket_confirmation}</div>
                              )}
                            </div>
                          )}

                          {/* Promotions — now part of the normal flow, no reserved empty column when there are none */}
                          {stop.promotions && stop.promotions.length > 0 && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(245,166,35,0.15)' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(245,166,35,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                Promotions
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {stop.promotions.map(promoName => {
                                  const photoUrl = stop.promotion_photos?.[promoName] ?? null
                                  const uploading = promoUploading[`${stop.id}:${promoName}`]
                                  return (
                                    <div key={promoName} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
                                      <div style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0, backgroundColor: photoUrl ? 'transparent' : 'rgba(245,166,35,0.08)', border: photoUrl ? 'none' : '1px dashed rgba(245,166,35,0.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {photoUrl ? (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img src={photoUrl} alt={promoName} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(photoUrl, '_blank')} />
                                        ) : (
                                          <span style={{ fontSize: 16 }}>🎁</span>
                                        )}
                                      </div>
                                      <span style={{ fontSize: 13, color: '#F5A623', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{promoName}</span>
                                      {photoUrl ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                          <label style={{ cursor: 'pointer', fontSize: 13, color: '#8B949E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Camera size={11} /> Replace
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPromoPhotoForStop(stop.id, promoName, f) }} />
                                          </label>
                                          <button onClick={() => removePromoPhotoForStop(stop.id, promoName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F85149', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 600 }}>
                                            <X size={12} /> Remove
                                          </button>
                                        </div>
                                      ) : (
                                        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#8B949E', padding: '4px 8px', borderRadius: 6, border: '1px dashed rgba(245,166,35,0.35)', backgroundColor: 'rgba(245,166,35,0.04)', flexShrink: 0 }}>
                                          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                                          {uploading ? 'Uploading…' : 'Add Photo'}
                                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPromoPhotoForStop(stop.id, promoName, f) }} />
                                        </label>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>

                      {/* Budget strip */}
                      {hasBudget ? (
                        <div style={{ display: 'flex', borderTop: '1px solid #30363D', backgroundColor: '#1C2430' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', flex: 1 }}>
                            {([
                              { label: 'Tickets', Icon: Ticket,       est: stop.est_tickets, actual: stop.actual_tickets },
                              { label: 'Food',    Icon: Utensils,     est: stop.est_food,    actual: stop.actual_food    },
                              { label: 'Parking', Icon: Car,          est: stop.est_parking, actual: stop.actual_parking },
                              { label: 'Hotel',   Icon: BedDouble,    est: stop.est_hotel,   actual: stop.actual_hotel   },
                              { label: 'Local Transport', Icon: CarTaxiFront, est: stop.est_local_transport, actual: stop.actual_local_transport },
                            ] as const).filter(c => c.est > 0 || c.actual > 0).map(({ label, Icon, est, actual }, ci, arr) => (
                              <div key={label} style={{
                                padding: '10px 12px',
                                borderRight: (ci + 1) % 3 !== 0 && ci < arr.length - 1 ? '1px solid #30363D' : 'none',
                                borderTop: ci >= 3 ? '1px solid #30363D' : 'none',
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
                          </div>
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

                      {renderMarkDone(stop)}
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
                    {([
                      { label: 'Tickets',         Icon: Ticket,       est: stops.reduce((s, x) => s + x.est_tickets, 0),         actual: stops.reduce((s, x) => s + x.actual_tickets, 0) },
                      { label: 'Food',            Icon: Utensils,     est: stops.reduce((s, x) => s + x.est_food, 0),            actual: stops.reduce((s, x) => s + x.actual_food, 0) },
                      { label: 'Parking',         Icon: Car,          est: stops.reduce((s, x) => s + x.est_parking, 0),         actual: stops.reduce((s, x) => s + x.actual_parking, 0) },
                      { label: 'Hotel',           Icon: BedDouble,    est: stops.reduce((s, x) => s + x.est_hotel, 0) + trip.est_hotel,           actual: stops.reduce((s, x) => s + x.actual_hotel, 0) + trip.actual_hotel },
                      { label: 'Local Transport', Icon: CarTaxiFront, est: stops.reduce((s, x) => s + x.est_local_transport, 0), actual: stops.reduce((s, x) => s + x.actual_local_transport, 0) },
                      { label: 'Travel',          Icon: Plane,        est: trip.est_travel,                                     actual: trip.actual_travel },
                    ] as const).map(({ label, Icon, est, actual }) => {
                      if (est === 0 && actual === 0) return null
                      const diff = actual - est
                      return (
                        <tr key={label} style={{ borderTop: '1px solid #30363D' }}>
                          <td style={{ padding: '11px 16px', color: '#8B949E' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Icon size={13} strokeWidth={1.8} /> {label}
                            </span>
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

      {editingStop && (
        <EditStopModal
          stop={editingStop}
          stadiums={stadiums}
          onClose={() => setEditingStop(null)}
          onSaved={() => { setEditingStop(null); load() }}
        />
      )}
    </div>
  )
}
