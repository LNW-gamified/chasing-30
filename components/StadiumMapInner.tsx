'use client'

import { Fragment, useState, useRef, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet'
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

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap()
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  return null
}

// ── Stadium pin icon factory ────────────────────────────────────────────────

function makeStadiumIcon(logoUrl: string, visited: boolean): L.DivIcon {
  const badgeBg  = visited ? '#22c55e' : '#f97316'
  const badgeGlyph = visited ? '✓' : '◈'

  return L.divIcon({
    html: `
      <div style="position:relative;width:44px;height:44px;">
        <div style="
          width:44px;height:44px;border-radius:50%;
          border:3px solid #ffffff;
          box-shadow:0 2px 10px rgba(0,0,0,0.28);
          background:#ffffff;
          overflow:hidden;
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;
        ">
          <img
            src="${logoUrl}"
            width="32" height="32"
            style="object-fit:contain;display:block;"
            onerror="this.style.opacity='0'"
          />
        </div>
        <div style="
          position:absolute;top:-2px;right:-2px;
          width:17px;height:17px;border-radius:50%;
          background:${badgeBg};
          border:2.5px solid #ffffff;
          display:flex;align-items:center;justify-content:center;
          font-size:7px;color:#ffffff;font-weight:900;line-height:1;
        ">${badgeGlyph}</div>
      </div>`,
    className: '',
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
  })
}

// ── Division groups for achievement overlays ────────────────────────────────

const DIVISIONS = [
  { label: 'AL East',    league: 'AL', div: 'East'    },
  { label: 'AL Central', league: 'AL', div: 'Central' },
  { label: 'AL West',    league: 'AL', div: 'West'    },
  { label: 'NL East',    league: 'NL', div: 'East'    },
  { label: 'NL Central', league: 'NL', div: 'Central' },
  { label: 'NL West',    league: 'NL', div: 'West'    },
]

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
  const [zoom,        setZoom]        = useState(4)

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

  // Achievement overlay data: divisions with partial progress
  const divisionOverlays = useMemo(() =>
    DIVISIONS
      .map(({ label, league, div }) => {
        const all       = stadiums.filter(s => s.league === league && s.division === div)
        const unvisited = all.filter(s => !s.visited)
        const visited   = all.filter(s => s.visited)
        return { label, unvisited, visited }
      })
      .filter(g => g.visited.length > 0 && g.unvisited.length >= 2)
  , [stadiums])

  // Achievement label icon factory
  function makeLabelIcon(text: string): L.DivIcon {
    return L.divIcon({
      html: `<div style="
        background:rgba(249,115,22,0.92);color:#ffffff;
        padding:3px 9px;border-radius:12px;
        font-size:10px;font-weight:700;white-space:nowrap;
        box-shadow:0 1px 6px rgba(0,0,0,0.25);
        pointer-events:none;
      ">${text}</div>`,
      className: '',
      iconSize:   [0, 0],
      iconAnchor: [0, 0],
    })
  }

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
        <ZoomTracker onZoom={setZoom} />

        {/* Stadium markers */}
        {visibleStadiums.map(s => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={icons.get(s.id)!}
            eventHandlers={{ click: () => { setSelected(s); setShowLegend(false) } }}
          />
        ))}

        {/* Achievement overlays — dashed orange lines + labels (zoom ≥ 5) */}
        {zoom >= 5 && divisionOverlays.map(g => {
          // Sort unvisited west-to-east for a tidy line path
          const sorted = [...g.unvisited].sort((a, b) => a.lng - b.lng)
          const pts = sorted.map(s => [s.lat, s.lng] as [number, number])
          const midLat = pts.reduce((s, p) => s + p[0], 0) / pts.length
          const midLng = pts.reduce((s, p) => s + p[1], 0) / pts.length
          const remaining = g.unvisited.length
          return (
            <Fragment key={g.label}>
              <Polyline
                positions={pts}
                pathOptions={{
                  color: '#f97316',
                  dashArray: '9 7',
                  weight: 2.5,
                  opacity: 0.65,
                }}
              />
              <Marker
                position={[midLat, midLng + 0.8]}
                icon={makeLabelIcon(`${remaining} left · ${g.label}`)}
                interactive={false}
              />
            </Fragment>
          )
        })}
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
            backgroundColor: '#ffffff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.16)',
          }}
        >
          <ChevronLeft size={18} color="#111827" strokeWidth={2.5} />
        </button>

        {/* Filter pills */}
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              flexShrink: 0,
              padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              backgroundColor: filter === f.id ? '#0f172a' : '#ffffff',
              color:           filter === f.id ? '#ffffff' : '#374151',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
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
          backgroundColor: '#ffffff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.16)',
        }}
      >
        <Info size={18} color="#374151" />
      </button>

      {/* ── Legend panel ──────────────────────────────────────────────── */}
      {showLegend && (
        <div style={{
          position: 'absolute', top: 108, right: 12, zIndex: 1000,
          backgroundColor: '#ffffff', borderRadius: 14,
          padding: '14px 16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
          minWidth: 196,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 12 }}>
            Map Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Visited */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '3px solid #ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                backgroundColor: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 12, height: 12, borderRadius: '50%',
                  backgroundColor: '#22c55e', border: '2px solid #ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 6, color: '#ffffff', fontWeight: 900,
                }}>✓</div>
              </div>
              <span style={{ fontSize: 13, color: '#374151' }}>Visited stadium</span>
            </div>
            {/* Unvisited */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '3px solid #ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                backgroundColor: '#fff7ed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 12, height: 12, borderRadius: '50%',
                  backgroundColor: '#f97316', border: '2px solid #ffffff',
                }} />
              </div>
              <span style={{ fontSize: 13, color: '#374151' }}>Not yet visited</span>
            </div>
            {/* Dashed line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 3, flexShrink: 0, borderRadius: 2,
                backgroundImage: 'repeating-linear-gradient(90deg,#f97316 0,#f97316 9px,transparent 9px,transparent 16px)',
              }} />
              <span style={{ fontSize: 13, color: '#374151' }}>Division progress</span>
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
          backgroundColor: '#ffffff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.16)',
        }}
      >
        <Navigation size={20} color="#3b82f6" strokeWidth={2} />
      </button>

      {/* ── Stadium popup card (bottom slide-up) ─────────────────────── */}
      {selected && (
        <div
          className="absolute left-3 right-3 z-[1000] bottom-20 md:bottom-5 md:left-auto md:right-4 md:w-96"
        >
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 18,
            padding: 16,
            boxShadow: '0 -2px 24px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
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
                backgroundColor: '#f3f4f6', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <X size={14} color="#6b7280" strokeWidth={2.5} />
            </button>

            {/* Stadium photo / team logo thumbnail */}
            <div style={{
              width: 80, height: 80, borderRadius: 12, flexShrink: 0,
              backgroundColor: '#f8fafc',
              border: '1px solid #e5e7eb',
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
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selected.team}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selected.name}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
                {selected.city}, {selected.state} · {selected.league} {selected.division}
              </div>

              {selected.visited ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 20,
                  backgroundColor: 'rgba(34,197,94,0.1)', color: '#16a34a',
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
                    backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6',
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
                backgroundColor: '#7c3aed', color: '#ffffff',
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
