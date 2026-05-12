'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { StadiumWithVisit } from '@/types'
import { getTeamLogoUrl } from '@/lib/team-logos'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, Navigation, ChevronLeft, Info } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type Filter = 'all' | 'visited' | 'not-yet' | 'bucket-list'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'visited',     label: 'Visited' },
  { id: 'not-yet',     label: 'Not Yet' },
  { id: 'bucket-list', label: 'Bucket List' },
]

// ── Leaflet child components ────────────────────────────────────────────────

function MapInitializer({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  return null
}

// ── Stadium pin icon factory ────────────────────────────────────────────────

function makeStadiumIcon(logoUrl: string, visited: boolean): L.DivIcon {
  const ring  = visited ? '#3FB950' : '#484F58'
  const badge = visited
    ? `<div style="position:absolute;top:-3px;right:-3px;width:18px;height:18px;border-radius:50%;background:#3FB950;border:2.5px solid #1C2430;display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff;font-weight:900;line-height:1;">✓</div>`
    : ''
  return L.divIcon({
    html: `<div style="position:relative;width:44px;height:44px;"><div style="width:44px;height:44px;border-radius:50%;border:2.5px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,0.45);background:#1C2430;overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${logoUrl}" width="30" height="30" style="object-fit:contain;display:block;" onerror="this.style.opacity='0'"/></div>${badge}</div>`,
    className: '',
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
  })
}

// ── Main component ──────────────────────────────────────────────────────────

interface Props {
  stadiums: StadiumWithVisit[]
}

export default function StadiumMapInner({ stadiums }: Props) {
  const router = useRouter()
  const mapRef = useRef<L.Map | null>(null)

  const [filter,      setFilter]      = useState<Filter>('all')
  const [selected,    setSelected]    = useState<StadiumWithVisit | null>(null)
  const [showLegend,  setShowLegend]  = useState(false)

  // Filtered stadium list
  const visibleStadiums = useMemo(() => stadiums.filter(s => {
    if (filter === 'visited')                          return s.visited
    if (filter === 'not-yet' || filter === 'bucket-list') return !s.visited
    return true
  }), [stadiums, filter])

  // Pre-build icons per stadium (memoised to avoid Leaflet re-renders)
  const icons = useMemo(() => {
    const m = new Map<string, L.DivIcon>()
    for (const s of stadiums) {
      m.set(s.id, makeStadiumIcon(getTeamLogoUrl(s.abbreviation), s.visited))
    }
    return m
  }, [stadiums])

  // Location button handler
  function handleLocate() {
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(
      pos => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 9),
      () => {}
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>

      {/* ── Leaflet map ──────────────────────────────────────────────── */}
      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* Light "Voyager" tile style */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <MapInitializer mapRef={mapRef} />

        {/* Stadium markers */}
        {visibleStadiums.map(s => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={icons.get(s.id)!}
            eventHandlers={{ click: () => { setSelected(s); setShowLegend(false) } }}
          />
        ))}

      </MapContainer>

      {/* ── Filter pills row (floating top) ──────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, left: 12, right: 12, zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 8,
        overflowX: 'auto', scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {/* Back arrow */}
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
            backgroundColor: '#161B22', border: '1px solid #30363D', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ChevronLeft size={18} color="#E6EDF3" strokeWidth={2.5} />
        </button>

        {/* Filter pills */}
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              flexShrink: 0,
              padding: '8px 18px', borderRadius: 20, border: filter === f.id ? '1px solid #484F58' : '1px solid #30363D', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              backgroundColor: filter === f.id ? '#E6EDF3' : '#161B22',
              color:           filter === f.id ? '#0B1117' : '#8B949E',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Legend button (top right) ─────────────────────────────────── */}
      <button
        onClick={() => { setShowLegend(l => !l); setSelected(null) }}
        aria-label="Map legend"
        style={{
          position: 'absolute', top: 60, right: 12, zIndex: 1000,
          width: 40, height: 40, borderRadius: '50%',
          backgroundColor: '#161B22', border: '1px solid #30363D', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Info size={18} color="#8B949E" />
      </button>

      {/* ── Legend panel ──────────────────────────────────────────────── */}
      {showLegend && (
        <div style={{
          position: 'absolute', top: 108, right: 12, zIndex: 1000,
          backgroundColor: '#161B22', borderRadius: 14,
          padding: '14px 16px',
          border: '1px solid #30363D',
          minWidth: 196,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#E6EDF3', marginBottom: 12 }}>
            Map Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Visited */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '3px solid #161B22',
                backgroundColor: '#1C2430',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 12, height: 12, borderRadius: '50%',
                  backgroundColor: '#3FB950', border: '2px solid #161B22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 6, color: '#0B1117', fontWeight: 900,
                }}>✓</div>
              </div>
              <span style={{ fontSize: 13, color: '#8B949E' }}>Visited stadium</span>
            </div>
            {/* Unvisited */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2.5px solid #484F58',
                backgroundColor: '#1C2430',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: '#8B949E' }}>Not yet visited</span>
            </div>
          </div>
        </div>
      )}

      {/* ── My Location button (bottom right, above mobile tab bar) ─────── */}
      <button
        onClick={handleLocate}
        aria-label="My location"
        className="absolute right-3 z-[1000] bottom-20 md:bottom-5"
        style={{
          width: 44, height: 44, borderRadius: '50%',
          backgroundColor: '#161B22', border: '1px solid #30363D', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Navigation size={20} color="#1F6FEB" strokeWidth={2} />
      </button>

      {/* ── Stadium popup card (bottom slide-up) ─────────────────────── */}
      {selected && (
        <div
          className="absolute left-3 right-3 z-[1000] bottom-20 md:bottom-5 md:left-auto md:right-4 md:w-96"
        >
          <div style={{
            backgroundColor: '#161B22',
            borderRadius: 18,
            padding: 16,
            border: '1px solid #30363D',
            display: 'flex', alignItems: 'center', gap: 14,
            position: 'relative',
            minHeight: 112,
          }}>
            {/* Close button */}
            <button
              onClick={() => setSelected(null)}
              aria-label="Close popup"
              style={{
                position: 'absolute', top: 10, right: 10,
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: '#1C2430', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <X size={14} color="#8B949E" strokeWidth={2.5} />
            </button>

            {/* Stadium photo / team logo thumbnail */}
            <div style={{
              width: 80, height: 80, borderRadius: 12, flexShrink: 0,
              backgroundColor: '#1C2430',
              border: '1px solid #30363D',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getTeamLogoUrl(selected.abbreviation)}
                alt={selected.abbreviation}
                width={56}
                height={56}
                style={{ objectFit: 'contain' }}
              />
            </div>

            {/* Info column */}
            <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selected.team}
              </div>
              <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selected.name}
              </div>
              <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 10 }}>
                {selected.city}, {selected.state} · {selected.league} {selected.division}
              </div>

              {selected.visited ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 20,
                  backgroundColor: 'rgba(63,185,80,0.12)', color: '#3FB950',
                  fontSize: 12, fontWeight: 600,
                }}>
                  ✓ Visited{selected.visits.length > 1 ? ` · ${selected.visits.length}×` : ''}
                </span>
              ) : (
                <Link
                  href="/trips"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20,
                    backgroundColor: 'rgba(31,111,235,0.12)', color: '#1F6FEB',
                    fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  Plan Trip
                </Link>
              )}
            </div>

            {/* View button (purple) */}
            <Link
              href={`/stadiums/${selected.id}`}
              style={{
                flexShrink: 0,
                padding: '8px 14px', borderRadius: 20,
                backgroundColor: '#1F6FEB', color: '#E6EDF3',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                alignSelf: 'center',
              }}
            >
              View ›
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
