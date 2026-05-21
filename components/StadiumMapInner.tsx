'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { StadiumWithVisit } from '@/types'
import { getTeamLogoUrl, LIGHT_BG_LOGO_TEAMS } from '@/lib/team-logos'
import TeamLogo from '@/components/TeamLogo'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X, Navigation, ChevronLeft, Info } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

const TEAM_PRIMARY: Record<string, string> = {
  ARI: '#A71930', ATL: '#CE1141', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#888D8D', CIN: '#C6011F', CLE: '#E31937',
  COL: '#33006F', DET: '#0C2C56', HOU: '#EB6E1F', KC:  '#004687',
  LAA: '#BA0021', LAD: '#005A9C', MIA: '#00A3E0', MIL: '#12284B',
  MIN: '#D31145', NYM: '#003087', NYY: '#003087', OAK: '#003831',
  PHI: '#E81828', PIT: '#27251F', SD:  '#2F241D', SF:  '#FD5A1E',
  SEA: '#005C5C', STL: '#C41E3A', TB:  '#092C5C', TEX: '#003278',
  TOR: '#134A8E', WSH: '#AB0003',
}

type Filter = 'all' | 'visited' | 'not-yet'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',     label: 'All'     },
  { id: 'visited', label: 'Visited' },
  { id: 'not-yet', label: 'Not Yet' },
]

// ── Leaflet child components ────────────────────────────────────────────────

function MapInitializer({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  return null
}

// ── Stadium pin icon factory ────────────────────────────────────────────────

function makeStadiumIcon(logoUrl: string, visited: boolean, abbr: string): L.DivIcon {
  const ring  = visited ? '#3FB950' : 'rgba(255,255,255,0.25)'
  const badge = visited
    ? `<div style="position:absolute;top:-3px;right:-3px;width:16px;height:16px;border-radius:50%;background:#3FB950;border:2px solid #0B1117;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:900;line-height:1;">✓</div>`
    : ''

  const lightBg = LIGHT_BG_LOGO_TEAMS.has(abbr)
  const bgStyle = lightBg
    ? 'background:rgba(255,255,255,0.90);'
    : 'background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);'

  // background-image is used instead of <img> because Leaflet's innerHTML
  // injection path can suppress img load events in certain browser/CSP contexts;
  // CSS background loading is handled by the style engine and always fires.
  return L.divIcon({
    html: `
      <div style="position:relative;width:40px;height:40px;">
        <div style="
          width:40px;height:40px;border-radius:50%;
          border:2.5px solid ${ring};
          box-shadow:0 2px 10px rgba(0,0,0,0.6);
          ${bgStyle}
          background-image:url('${logoUrl}');
          background-size:72%;
          background-position:center;
          background-repeat:no-repeat;
        "></div>
        ${badge}
      </div>`,
    className: '',
    iconSize:   [40, 40],
    iconAnchor: [20, 20],
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
    if (filter === 'not-yet') return !s.visited
    return true
  }), [stadiums, filter])

  // Pre-build icons per stadium (memoised to avoid Leaflet re-renders)
  const icons = useMemo(() => {
    const m = new Map<string, L.DivIcon>()
    for (const s of stadiums) {
      m.set(s.id, makeStadiumIcon(getTeamLogoUrl(s.abbreviation), s.visited, s.abbreviation))
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
        zoom={5}
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
            <TeamLogo abbreviation={selected.abbreviation} size={80} />

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
