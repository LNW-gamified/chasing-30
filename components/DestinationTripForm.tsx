'use client'

import { useState, useTransition, useMemo } from 'react'
import { X, Search, MapPin, ChevronDown } from 'lucide-react'
import { DESTINATIONS, DESTINATION_GROUPS, EXPERIENCE_TYPES, destinationLocation } from '@/lib/destinations'
import type { CuratedDestination } from '@/lib/destinations'

interface Props {
  onClose: () => void
  onSaved: () => void
}

const STATUS_OPTIONS = ['planned', 'completed', 'cancelled'] as const
type Status = typeof STATUS_OPTIONS[number]

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0D1117', border: '1px solid #30363D',
  borderRadius: 8, color: '#E6EDF3', padding: '10px 12px', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#8B949E', marginBottom: 4, display: 'block' }
const sectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }

export default function DestinationTripForm({ onClose, onSaved }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CuratedDestination | null>(null)
  const [showPicker, setShowPicker] = useState(true)
  const [customMode, setCustomMode] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customCity, setCustomCity] = useState('')

  const [tripName, setTripName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<Status>('planned')
  const [experienceType, setExperienceType] = useState('other')
  const [notes, setNotes] = useState('')

  const [estTravel, setEstTravel] = useState('')
  const [estHotel, setEstHotel] = useState('')
  const [estTickets, setEstTickets] = useState('')
  const [estFood, setEstFood] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    if (!query) return DESTINATIONS
    const q = query.toLowerCase()
    return DESTINATIONS.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q) ||
      d.state?.toLowerCase().includes(q)
    )
  }, [query])

  function selectDestination(d: CuratedDestination) {
    setSelected(d)
    setShowPicker(false)
    setCustomMode(false)
    if (!tripName) setTripName(d.name)
  }

  function enableCustom() {
    setSelected(null)
    setCustomMode(true)
    setShowPicker(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const name = tripName.trim() || selected?.name || customName.trim()
    if (!name) { setError('Trip name is required'); return }
    if (!startDate) { setError('Start date is required'); return }
    if (customMode && !customName.trim()) { setError('Location name is required'); return }

    startTransition(async () => {
      try {
        const body = {
          name,
          trip_type: 'destination',
          status,
          start_date: startDate || null,
          end_date: endDate || null,
          experience_type: experienceType,
          destination_slug: selected?.slug ?? null,
          custom_name: customMode ? customName.trim() : null,
          custom_city: customMode ? customCity.trim() : null,
          notes: notes.trim() || null,
          est_travel: parseFloat(estTravel) || 0,
          est_hotel: parseFloat(estHotel) || 0,
          est_tickets: parseFloat(estTickets) || 0,
          est_food: parseFloat(estFood) || 0,
          est_parking: 0,
          actual_travel: 0, actual_hotel: 0, actual_tickets: 0,
          actual_food: 0, actual_parking: 0,
        }

        const res = await fetch('/api/trips/destination', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error ?? 'Failed to save trip')
          return
        }

        onSaved()
      } catch {
        setError('Network error — please try again')
      }
    })
  }

  const heroColors = selected?.heroColor ?? ['#0D1117', '#1C2128']

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: '#161B22', borderRadius: '16px 16px 0 0',
        width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflowY: 'auto',
        border: '1px solid #30363D',
      }}>
        {/* Hero header */}
        <div style={{
          background: `linear-gradient(135deg, ${heroColors[0]}, ${heroColors[1]})`,
          padding: '20px 20px 16px', borderRadius: '16px 16px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#8B949E', textTransform: 'uppercase', letterSpacing: 1 }}>
              Baseball Destination Trip
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#E6EDF3', marginTop: 2 }}>
              {selected ? selected.name : customMode ? (customName || 'Custom Destination') : 'Plan a Destination Trip'}
            </div>
            {(selected || customMode) && (
              <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>
                {selected ? destinationLocation(selected) : customCity || ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selected && <span style={{ fontSize: 28 }}>{selected.icon}</span>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Destination picker */}
          {showPicker && (
            <div>
              <label style={labelStyle}>Select a Destination</label>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8B949E' }} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search destinations..."
                  style={{ ...inputStyle, paddingLeft: 32 }}
                />
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {DESTINATION_GROUPS.map(group => {
                  const items = filtered.filter(d => group.types.includes(d.type))
                  if (!items.length) return null
                  return (
                    <div key={group.label}>
                      <div style={{ fontSize: 13, color: '#8B949E', padding: '6px 8px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {group.icon} {group.label}
                      </div>
                      {items.map(d => (
                        <button
                          key={d.slug}
                          type="button"
                          onClick={() => selectDestination(d)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '8px 10px', borderRadius: 6, textAlign: 'left',
                            color: '#E6EDF3',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1C2128')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ fontSize: 20, flexShrink: 0 }}>{d.icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                            <div style={{ fontSize: 13, color: '#8B949E' }}>{destinationLocation(d)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={enableCustom}
                style={{
                  marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: '1px dashed #30363D', cursor: 'pointer',
                  color: '#8B949E', padding: '8px 12px', borderRadius: 8, fontSize: 13, width: '100%',
                }}
              >
                <MapPin size={14} /> Custom / unlisted location
              </button>
            </div>
          )}

          {/* Change destination button when selected */}
          {!showPicker && (
            <button
              type="button"
              onClick={() => { setShowPicker(true); setSelected(null); setCustomMode(false) }}
              style={{
                background: 'none', border: '1px solid #30363D', cursor: 'pointer',
                color: '#8B949E', padding: '8px 12px', borderRadius: 8, fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
              }}
            >
              <ChevronDown size={14} /> Change destination
            </button>
          )}

          {/* Custom location fields */}
          {customMode && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={sectionStyle}>
                <label style={labelStyle}>Location Name *</label>
                <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Rickwood Field" style={inputStyle} />
              </div>
              <div style={sectionStyle}>
                <label style={labelStyle}>City</label>
                <input value={customCity} onChange={e => setCustomCity(e.target.value)} placeholder="Birmingham, AL" style={inputStyle} />
              </div>
            </div>
          )}

          {/* Trip name */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Trip Name *</label>
            <input value={tripName} onChange={e => setTripName(e.target.value)} placeholder="Name this trip" style={inputStyle} required />
          </div>

          {/* Dates + status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={sectionStyle}>
              <label style={labelStyle}>Start Date *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} required />
            </div>
            <div style={sectionStyle}>
              <label style={labelStyle}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={sectionStyle}>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as Status)} style={inputStyle}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Experience type */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Experience Type</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EXPERIENCE_TYPES.map(et => (
                <button
                  key={et.value}
                  type="button"
                  onClick={() => setExperienceType(et.value)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    background: experienceType === et.value ? '#1F6FEB' : '#1C2128',
                    color: experienceType === et.value ? '#fff' : '#8B949E',
                  }}
                >
                  {et.icon} {et.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label style={{ ...labelStyle, marginBottom: 8 }}>Estimated Budget</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Travel', value: estTravel, set: setEstTravel },
                { label: 'Hotel', value: estHotel, set: setEstHotel },
                { label: 'Tickets / Admission', value: estTickets, set: setEstTickets },
                { label: 'Food', value: estFood, set: setEstFood },
              ].map(({ label, value, set }) => (
                <div key={label} style={sectionStyle}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={value} onChange={e => set(e.target.value)}
                    placeholder="$0"
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Reservations, plans, links..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {error && <div style={{ color: '#F85149', fontSize: 13, padding: '8px 12px', background: 'rgba(248,81,73,0.1)', borderRadius: 6 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #30363D',
              background: 'none', color: '#8B949E', cursor: 'pointer', fontSize: 14,
            }}>
              Cancel
            </button>
            <button type="submit" disabled={isPending || (!selected && !customMode)} style={{
              flex: 2, padding: '12px', borderRadius: 8, border: 'none',
              background: isPending || (!selected && !customMode) ? '#1C2128' : '#1F6FEB',
              color: isPending || (!selected && !customMode) ? '#8B949E' : '#fff',
              cursor: isPending || (!selected && !customMode) ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 700,
            }}>
              {isPending ? 'Saving…' : 'Save Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
