'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { StadiumWithVisit } from '@/types'
import { getTeamLogoUrl } from '@/lib/team-logos'
import Link from 'next/link'

interface Props {
  stadiums: StadiumWithVisit[]
}

const VISITED_ICON = L.divIcon({
  html: `<div class="visited-pin" style="
    width:26px;height:26px;
    background:#22c55e;
    border-radius:50%;
    border:2.5px solid #16a34a;
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:14px;font-weight:bold;line-height:1;
    cursor:pointer;
  ">✓</div>`,
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -17],
})

const UNVISITED_ICON = L.divIcon({
  html: `<div style="
    width:13px;height:13px;
    background:#4b5563;
    border-radius:50%;
    border:2px solid #536476;
    opacity:0.6;
    cursor:pointer;
  "></div>`,
  className: '',
  iconSize: [13, 13],
  iconAnchor: [6, 6],
  popupAnchor: [0, -9],
})

export default function StadiumMapInner({ stadiums }: Props) {
  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {stadiums.map((stadium) => (
        <Marker
          key={stadium.id}
          position={[stadium.lat, stadium.lng]}
          icon={stadium.visited ? VISITED_ICON : UNVISITED_ICON}
        >
          <Popup>
            <div style={{ minWidth: 210, maxWidth: 250 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getTeamLogoUrl(stadium.abbreviation)}
                    alt={stadium.abbreviation}
                    width={36}
                    height={36}
                    style={{ objectFit: 'contain', display: 'block' }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff', lineHeight: 1.2 }}>
                    {stadium.name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: 2 }}>
                    {stadium.team}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 8 }}>
                {stadium.city}, {stadium.state} · {stadium.league} {stadium.division}
              </div>

              {stadium.visited ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.88rem',
                  color: '#22c55e',
                  backgroundColor: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 6,
                  padding: '3px 10px',
                  marginBottom: 10,
                  fontWeight: 600,
                }}>
                  ✓ Visited{stadium.visits.length > 0 ? ` · ${stadium.visits.length} game${stadium.visits.length !== 1 ? 's' : ''}` : ''}
                </div>
              ) : (
                <div style={{ fontSize: '0.88rem', color: '#4a5568', marginBottom: 10 }}>
                  Not yet visited
                </div>
              )}

              <Link
                href={`/stadiums/${stadium.id}`}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'opacity 0.15s',
                }}
              >
                View Stadium →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
