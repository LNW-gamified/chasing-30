'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { StadiumWithVisit } from '@/types'
import type { CuratedDestination } from '@/lib/destinations'
import { destinationLocation } from '@/lib/destinations'
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

type TypeFilter   = 'all' | 'stadiums' | 'specials'
type StatusFilter = 'all' | 'visited'  | 'not-yet'

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all',      label: 'All'               },
  { id: 'stadiums', label: 'Stadiums'          },
  { id: 'specials', label: 'Special Locations' },
]
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
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

// ── Special location pin icon (5-pointed star) ──────────────────────────────
// Star polygon points centered at (22,22) on a 44×44 canvas,
// outer radius 19, inner radius 8, starting at top.

const STAR_POINTS = '22,3 26.7,15.5 40.6,16.1 29.6,24.5 33.2,37.4 22,30 10.8,37.4 14.4,24.5 3.4,16.1 17.3,15.5'

function makeSpecialLocationIcon(icon: string, visited: boolean): L.DivIcon {
  const stroke = visited ? '#F5A623' : 'rgba(245,166,35,0.55)'
  const fill   = visited ? 'rgba(245,166,35,0.22)' : 'rgba(20,20,30,0.88)'
  const badge  = visited
    ? `<div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#F5A623;border:2px solid #0B1117;display:flex;align-items:center;justify-content:center;font-size:9px;color:#000;font-weight:900;line-height:1;">✓</div>`
    : ''
  return L.divIcon({
    html: `
      <div style="position:relative;width:44px;height:44px;">
        <svg width="44" height="44" viewBox="0 0 44 44" style="position:absolute;top:0;left:0;" xmlns="http://www.w3.org/2000/svg">
          <polygon
            points="${STAR_POINTS}"
            fill="${fill}"
            stroke="${stroke}"
            stroke-width="2"
            stroke-linejoin="round"
            filter="drop-shadow(0 2px 6px rgba(0,0,0,0.7))"
          />
        </svg>
        <div style="position:absolute;top:0;left:0;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;">
          ${icon}
        </div>
        ${badge}
      </div>`,
    className: '',
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
  })
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
  destinations?: CuratedDestination[]
  visitedDestinationIds?: Set<string>
}

export default function StadiumMapInner({ stadiums, destinations = [], visitedDestinationIds = new Set() }: Props) {
  const router = useRouter()
  const mapRef = useRef<L.Map | null>(null)

  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected,     setSelected]     = useState<StadiumWithVisit | null>(null)
  const [selectedDest, setSelectedDest] = useState<CuratedDestination | null>(null)
  const [showLegend,   setShowLegend]   = useState(false)

  // Filtered stadium list — never show when typeFilter='specials'
  const visibleStadiums = useMemo(() => {
    if (typeFilter === 'specials') return []
    return stadiums.filter(s => {
      if (statusFilter === 'visited')  return s.visited
      if (statusFilter === 'not-yet')  return !s.visited
      return true
    })
  }, [stadiums, typeFilter, statusFilter])

  // Filtered destination list — never show historic_stadium (stadium tours overlap MLB markers)
  const visibleDests = useMemo(() => {
    if (typeFilter === 'stadiums') return []
    return destinations.filter(d => {
      if (d.type === 'historic_stadium') return false
      if (d.lat === null || d.lng === null) return false
      if (statusFilter === 'visited')  return visitedDestinationIds.has(d.slug)
      if (statusFilter === 'not-yet')  return !visitedDestinationIds.has(d.slug)
      return true
    })
  }, [destinations, typeFilter, statusFilter, visitedDestinationIds])

  // Pre-build icons per stadium (memoised to avoid Leaflet re-renders)
  const icons = useMemo(() => {
    const m = new Map<string, L.DivIcon>()
    for (const s of stadiums) {
      m.set(s.id, makeStadiumIcon(getTeamLogoUrl(s.abbreviation), s.visited, s.abbreviation))
    }
    return m
  }, [stadiums])

  // Pre-build destination icons (exclude historic_stadium tours)
  const destIcons = useMemo(() => {
    const m = new Map<string, L.DivIcon>()
    for (const d of destinations) {
      if (d.type === 'historic_stadium') continue
      if (d.lat !== null && d.lng !== null) {
        m.set(d.slug, makeSpecialLocationIcon(d.icon, visitedDestinationIds.has(d.slug)))
      }
    }
    return m
  }, [destinations, visitedDestinationIds])

  // Location button handler
  function handleLocate() {
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(
      pos => mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 9),
      () => {}
    )
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    flexShrink: 0,
    padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    backgroundColor: active ? 'rgba(230,237,243,0.93)' : 'rgba(11,17,23,0.72)',
    color:           active ? '#0B1117' : 'rgba(230,237,243,0.85)',
    border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    transition: 'background-color 0.15s, color 0.15s',
    whiteSpace: 'nowrap' as const,
  })

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
            eventHandlers={{ click: () => { setSelected(s); setSelectedDest(null); setShowLegend(false) } }}
          />
        ))}

        {/* Special location markers (no historic_stadium tours) */}
        {visibleDests.map(d => (
          <Marker
            key={d.slug}
            position={[d.lat!, d.lng!]}
            icon={destIcons.get(d.slug)!}
            eventHandlers={{ click: () => { setSelectedDest(d); setSelected(null); setShowLegend(false) } }}
          />
        ))}

      </MapContainer>

      {/* ── Two-row filter area (floating top) ───────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, left: 12, right: 12, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Row 1: Back button + Type filter */}
        <div className="no-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
              backgroundColor: 'rgba(11,17,23,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
            }}
          >
            <ChevronLeft size={18} color="#E6EDF3" strokeWidth={2.5} />
          </button>

          {TYPE_FILTERS.map(f => (
            <button key={f.id} onClick={() => setTypeFilter(f.id)} style={pillStyle(typeFilter === f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Row 2: Status filter (offset to clear back button) */}
        <div className="no-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingLeft: 46 }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)} style={pillStyle(statusFilter === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend button (top right, below two filter rows) ─────────── */}
      <button
        onClick={() => { setShowLegend(l => !l); setSelected(null) }}
        aria-label="Map legend"
        style={{
          position: 'absolute', top: 108, right: 12, zIndex: 1000,
          width: 40, height: 40, borderRadius: '50%',
          backgroundColor: 'rgba(11,17,23,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        <Info size={18} color="#8B949E" />
      </button>

      {/* ── Legend panel ──────────────────────────────────────────────── */}
      {showLegend && (
        <div style={{
          position: 'absolute', top: 156, right: 12, zIndex: 1000,
          backgroundColor: '#161B22', borderRadius: 14,
          padding: '14px 16px',
          border: '1px solid #30363D',
          minWidth: 210,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#E6EDF3', marginBottom: 12 }}>
            Map Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Visited stadium */}
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
            {/* Not yet stadium */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2.5px solid #484F58',
                backgroundColor: '#1C2430',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: '#8B949E' }}>Not yet visited</span>
            </div>
            {destinations.some(d => d.type !== 'historic_stadium' && d.lat !== null) && (
              <>
                {/* Visited special location */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
                      <polygon
                        points={STAR_POINTS}
                        fill="rgba(245,166,35,0.22)"
                        stroke="#F5A623"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, color: '#8B949E' }}>Visited special location</span>
                </div>
                {/* Not yet special location */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
                      <polygon
                        points={STAR_POINTS}
                        fill="rgba(20,20,30,0.88)"
                        stroke="rgba(245,166,35,0.55)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, color: '#8B949E' }}>Special location</span>
                </div>
              </>
            )}
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
          backgroundColor: 'rgba(11,17,23,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        <Navigation size={20} color="#1F6FEB" strokeWidth={2} />
      </button>

      {/* ── Destination popup card ───────────────────────────────────── */}
      {selectedDest && (
        <div className="absolute left-3 right-3 z-[1000] bottom-20 md:bottom-5 md:left-auto md:right-4 md:w-96">
          <div style={{
            backgroundColor: '#161B22', borderRadius: 18, padding: 16,
            border: '1px solid #30363D', display: 'flex', alignItems: 'center', gap: 14,
            position: 'relative', minHeight: 112,
          }}>
            <button
              onClick={() => setSelectedDest(null)}
              aria-label="Close"
              style={{
                position: 'absolute', top: 10, right: 10,
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: '#1C2430', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} color="#8B949E" strokeWidth={2.5} />
            </button>
            <div style={{
              width: 56, height: 56, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${selectedDest.heroColor[0]}, ${selectedDest.heroColor[1]})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>
              {selectedDest.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3', marginBottom: 2, lineHeight: 1.2 }}>
                {selectedDest.name}
              </div>
              <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 8 }}>
                {destinationLocation(selectedDest)}
              </div>
              {visitedDestinationIds.has(selectedDest.slug) ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 20,
                  backgroundColor: 'rgba(245,166,35,0.12)', color: '#F5A623',
                  fontSize: 12, fontWeight: 600,
                }}>
                  ✓ Visited
                </span>
              ) : (
                <Link href="/trips" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 20,
                  backgroundColor: 'rgba(31,111,235,0.12)', color: '#1F6FEB',
                  fontSize: 12, fontWeight: 600, textDecoration: 'none',
                }}>
                  Plan Trip
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selected.team}
              </div>
              <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selected.name}
              </div>
              <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 12 }}>
                {selected.city}, {selected.state} · {selected.league} {selected.division}
              </div>

              {selected.visited && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 20,
                  backgroundColor: 'rgba(63,185,80,0.12)', color: '#3FB950',
                  fontSize: 11, fontWeight: 600, marginBottom: 10,
                }}>
                  ✓ Visited{selected.visits.length > 1 ? ` · ${selected.visits.length}×` : ''}
                </span>
              )}

              {/* Action buttons — always both */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link
                  href={`/stadiums/${selected.id}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '7px 14px', borderRadius: 20,
                    backgroundColor: '#1F6FEB', color: '#fff',
                    fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  View Details
                </Link>
                <Link
                  href="/trips"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '7px 14px', borderRadius: 20,
                    border: '1px solid rgba(31,111,235,0.35)',
                    backgroundColor: 'rgba(31,111,235,0.08)', color: '#1F6FEB',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  Plan Trip
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
