'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { SpecialEvent, SpecialEventType } from '@/types'
import { X, ImagePlus, Trash2 } from 'lucide-react'

interface Props {
  event?: SpecialEvent
  onClose: () => void
  onSaved: () => void
}

const EVENT_TYPES: { value: SpecialEventType; label: string; icon: string }[] = [
  { value: 'world_series', label: 'World Series', icon: '🏆' },
  { value: 'all_star_game', label: 'MLB All-Star Game', icon: '⭐' },
  { value: 'postseason', label: 'MLB Postseason', icon: '🍂' },
  { value: 'spring_training', label: 'Spring Training', icon: '🌸' },
  { value: 'minor_league', label: 'Minor League Game', icon: '🌱' },
  { value: 'historic_ballpark', label: 'Historic Ballpark Visit', icon: '🏛️' },
  { value: 'international', label: 'International MLB Game', icon: '🌍' },
  { value: 'other', label: 'Other Baseball Experience', icon: '📝' },
]

const HISTORIC_VENUES = [
  'Louisville Slugger Museum & Factory',
  'National Baseball Hall of Fame',
  'Negro Leagues Baseball Museum',
  'Field of Dreams',
  'Rickwood Field',
]

const ML_LEVELS = ['AAA', 'AA', 'A', 'A+', 'Rookie']
const POSTSEASON_ROUNDS = ['ALDS', 'ALCS', 'NLDS', 'NLCS', 'Wild Card']

function defaultForm(event?: SpecialEvent) {
  return {
    event_type: event?.event_type ?? 'world_series' as SpecialEventType,
    event_date: event?.event_date ?? new Date().toISOString().split('T')[0],
    seat_section: event?.seat_section ?? '',
    seat_row: event?.seat_row ?? '',
    seat_number: event?.seat_number ?? '',
    weather: event?.weather ?? '',
    temperature: event?.temperature?.toString() ?? '',
    attendance: event?.attendance?.toString() ?? '',
    notes: event?.notes ?? '',
    home_team: event?.home_team ?? '',
    visiting_team: event?.visiting_team ?? '',
    event_year: event?.event_year?.toString() ?? new Date().getFullYear().toString(),
    game_number: event?.game_number?.toString() ?? '',
    series_round: event?.series_round ?? 'ALDS',
    stadium_name: event?.stadium_name ?? '',
    city: event?.city ?? '',
    state: event?.state ?? '',
    country: event?.country ?? '',
    ml_level: event?.ml_level ?? 'AAA',
    venue_name: event?.venue_name ?? HISTORIC_VENUES[0],
    series_name: event?.series_name ?? '',
    custom_title: event?.custom_title ?? '',
  }
}

export default function SpecialEventForm({ event, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => defaultForm(event))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(event?.photo_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const sectionHead = (label: string) => (
    <div
      className="text-xs font-semibold uppercase tracking-wider pt-4 pb-1 mb-2"
      style={{ color: '#3b82f6', borderBottom: '1px solid #1f2937' }}
    >
      {label}
    </div>
  )

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )

  const t = form.event_type

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let uploadedPhotoUrl: string | null = event?.photo_url ?? null

    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `events/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('game-photos')
        .upload(path, photoFile, { contentType: photoFile.type, upsert: false })
      if (uploadErr) {
        setError(`Photo upload failed: ${uploadErr.message}`)
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('game-photos').getPublicUrl(uploadData.path)
      uploadedPhotoUrl = urlData.publicUrl
    } else if (!photoPreview && event?.photo_url) {
      uploadedPhotoUrl = null
    }

    const payload = {
      event_type: form.event_type,
      event_date: form.event_date,
      seat_section: form.seat_section || null,
      seat_row: form.seat_row || null,
      seat_number: form.seat_number || null,
      weather: form.weather || null,
      temperature: form.temperature ? parseInt(form.temperature) : null,
      attendance: form.attendance ? parseInt(form.attendance) : null,
      notes: form.notes || null,
      photo_url: uploadedPhotoUrl,
      home_team: form.home_team || null,
      visiting_team: form.visiting_team || null,
      event_year: form.event_year ? parseInt(form.event_year) : null,
      game_number: form.game_number ? parseInt(form.game_number) : null,
      series_round: form.series_round || null,
      stadium_name: form.stadium_name || null,
      city: form.city || null,
      state: form.state || null,
      country: form.country || null,
      ml_level: t === 'minor_league' ? form.ml_level || null : null,
      venue_name: t === 'historic_ballpark' ? form.venue_name || null : null,
      series_name: t === 'international' ? form.series_name || null : null,
      custom_title: t === 'other' ? form.custom_title || null : null,
      created_by: user?.id ?? null,
    }

    let err
    if (event) {
      ;({ error: err } = await supabase.from('special_events').update(payload).eq('id', event.id))
    } else {
      ;({ error: err } = await supabase.from('special_events').insert(payload))
    }

    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  const currentType = EVENT_TYPES.find((et) => et.value === t)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div className="card w-full max-w-2xl" style={{ backgroundColor: '#111827' }}>
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #1f2937' }}
        >
          <div>
            <div className="font-semibold" style={{ color: '#f1f5f9' }}>
              {event ? 'Edit Special Event' : 'Log a Special Event'}
            </div>
            <div className="text-sm" style={{ color: '#8896ae' }}>
              {currentType?.icon} {currentType?.label}
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#8896ae' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          {sectionHead('Event Type')}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {EVENT_TYPES.map((et) => (
              <button
                key={et.value}
                type="button"
                onClick={() => set('event_type', et.value)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                style={{
                  backgroundColor: form.event_type === et.value ? 'rgba(59,130,246,0.2)' : '#1a2235',
                  border: `1.5px solid ${form.event_type === et.value ? '#3b82f6' : '#2d3748'}`,
                  color: form.event_type === et.value ? '#60a5fa' : '#94a3b8',
                }}
              >
                <span>{et.icon}</span>
                <span>{et.label}</span>
              </button>
            ))}
          </div>

          {sectionHead('Event Info')}
          <div className="grid grid-cols-2 gap-3">
            {field('Date', (
              <input type="date" className="input" value={form.event_date}
                onChange={(e) => set('event_date', e.target.value)} required />
            ))}
            {(t === 'world_series' || t === 'all_star_game' || t === 'postseason') && field('Year', (
              <input type="number" className="input" placeholder="2025"
                value={form.event_year} onChange={(e) => set('event_year', e.target.value)} />
            ))}
          </div>

          {/* World Series fields */}
          {t === 'world_series' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {field('Home Team', <input type="text" className="input" placeholder="Team name"
                value={form.home_team} onChange={(e) => set('home_team', e.target.value)} />)}
              {field('Visiting Team', <input type="text" className="input" placeholder="Team name"
                value={form.visiting_team} onChange={(e) => set('visiting_team', e.target.value)} />)}
              {field('Game Number', <input type="number" min={1} max={7} className="input" placeholder="1–7"
                value={form.game_number} onChange={(e) => set('game_number', e.target.value)} />)}
              {field('Stadium', <input type="text" className="input" placeholder="Stadium name"
                value={form.stadium_name} onChange={(e) => set('stadium_name', e.target.value)} />)}
              {field('City', <input type="text" className="input" placeholder="City"
                value={form.city} onChange={(e) => set('city', e.target.value)} />)}
              {field('State', <input type="text" className="input" placeholder="State"
                value={form.state} onChange={(e) => set('state', e.target.value)} />)}
            </div>
          )}

          {/* All-Star Game fields */}
          {t === 'all_star_game' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {field('Stadium', <input type="text" className="input" placeholder="Stadium name"
                value={form.stadium_name} onChange={(e) => set('stadium_name', e.target.value)} />)}
              {field('City', <input type="text" className="input" placeholder="City"
                value={form.city} onChange={(e) => set('city', e.target.value)} />)}
              {field('State', <input type="text" className="input" placeholder="State"
                value={form.state} onChange={(e) => set('state', e.target.value)} />)}
            </div>
          )}

          {/* Postseason fields */}
          {t === 'postseason' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {field('Round', (
                <select className="input" value={form.series_round} onChange={(e) => set('series_round', e.target.value)}>
                  {POSTSEASON_ROUNDS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ))}
              {field('Game Number', <input type="number" min={1} max={7} className="input" placeholder="1–7"
                value={form.game_number} onChange={(e) => set('game_number', e.target.value)} />)}
              {field('Home Team', <input type="text" className="input" placeholder="Team name"
                value={form.home_team} onChange={(e) => set('home_team', e.target.value)} />)}
              {field('Visiting Team', <input type="text" className="input" placeholder="Team name"
                value={form.visiting_team} onChange={(e) => set('visiting_team', e.target.value)} />)}
              {field('Stadium', <input type="text" className="input" placeholder="Stadium name"
                value={form.stadium_name} onChange={(e) => set('stadium_name', e.target.value)} />)}
              {field('City', <input type="text" className="input" placeholder="City"
                value={form.city} onChange={(e) => set('city', e.target.value)} />)}
            </div>
          )}

          {/* Spring Training fields */}
          {t === 'spring_training' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {field('Home Team', <input type="text" className="input" placeholder="Team name"
                value={form.home_team} onChange={(e) => set('home_team', e.target.value)} />)}
              {field('Visiting Team', <input type="text" className="input" placeholder="Team name"
                value={form.visiting_team} onChange={(e) => set('visiting_team', e.target.value)} />)}
              {field('Stadium', <input type="text" className="input" placeholder="Stadium name"
                value={form.stadium_name} onChange={(e) => set('stadium_name', e.target.value)} />)}
              {field('City', <input type="text" className="input" placeholder="City"
                value={form.city} onChange={(e) => set('city', e.target.value)} />)}
              {field('State', <input type="text" className="input" placeholder="State"
                value={form.state} onChange={(e) => set('state', e.target.value)} />)}
            </div>
          )}

          {/* Minor League fields */}
          {t === 'minor_league' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {field('Level', (
                <select className="input" value={form.ml_level} onChange={(e) => set('ml_level', e.target.value)}>
                  {ML_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              ))}
              {field('Home Team', <input type="text" className="input" placeholder="Team name"
                value={form.home_team} onChange={(e) => set('home_team', e.target.value)} />)}
              {field('Visiting Team', <input type="text" className="input" placeholder="Team name"
                value={form.visiting_team} onChange={(e) => set('visiting_team', e.target.value)} />)}
              {field('Stadium', <input type="text" className="input" placeholder="Stadium name"
                value={form.stadium_name} onChange={(e) => set('stadium_name', e.target.value)} />)}
              {field('City', <input type="text" className="input" placeholder="City"
                value={form.city} onChange={(e) => set('city', e.target.value)} />)}
              {field('State', <input type="text" className="input" placeholder="State"
                value={form.state} onChange={(e) => set('state', e.target.value)} />)}
            </div>
          )}

          {/* Historic Ballpark fields */}
          {t === 'historic_ballpark' && (
            <div className="grid grid-cols-1 gap-3 mt-3">
              {field('Destination', (
                <select className="input" value={form.venue_name} onChange={(e) => set('venue_name', e.target.value)}>
                  {HISTORIC_VENUES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ))}
            </div>
          )}

          {/* International fields */}
          {t === 'international' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {field('Series Name', <input type="text" className="input" placeholder="London Series, Tokyo Series…"
                value={form.series_name} onChange={(e) => set('series_name', e.target.value)} />)}
              {field('Home Team', <input type="text" className="input" placeholder="Team name"
                value={form.home_team} onChange={(e) => set('home_team', e.target.value)} />)}
              {field('Visiting Team', <input type="text" className="input" placeholder="Team name"
                value={form.visiting_team} onChange={(e) => set('visiting_team', e.target.value)} />)}
              {field('Stadium', <input type="text" className="input" placeholder="Stadium name"
                value={form.stadium_name} onChange={(e) => set('stadium_name', e.target.value)} />)}
              {field('City', <input type="text" className="input" placeholder="City"
                value={form.city} onChange={(e) => set('city', e.target.value)} />)}
              {field('Country', <input type="text" className="input" placeholder="Country"
                value={form.country} onChange={(e) => set('country', e.target.value)} />)}
            </div>
          )}

          {/* Other fields */}
          {t === 'other' && (
            <div className="mt-3">
              {field('Event Title', <input type="text" className="input" placeholder="Describe the experience"
                value={form.custom_title} onChange={(e) => set('custom_title', e.target.value)} />)}
            </div>
          )}

          {sectionHead('Seating')}
          <div className="grid grid-cols-3 gap-3">
            {field('Section', <input type="text" className="input" placeholder="114"
              value={form.seat_section} onChange={(e) => set('seat_section', e.target.value)} />)}
            {field('Row', <input type="text" className="input" placeholder="G"
              value={form.seat_row} onChange={(e) => set('seat_row', e.target.value)} />)}
            {field('Seat', <input type="text" className="input" placeholder="12"
              value={form.seat_number} onChange={(e) => set('seat_number', e.target.value)} />)}
          </div>

          {sectionHead('Conditions')}
          <div className="grid grid-cols-2 gap-3">
            {field('Temperature (°F)', <input type="number" className="input" placeholder="72"
              value={form.temperature} onChange={(e) => set('temperature', e.target.value)} />)}
            {field('Weather', <input type="text" className="input" placeholder="Clear, sunny"
              value={form.weather} onChange={(e) => set('weather', e.target.value)} />)}
            {field('Attendance', <input type="number" className="input" placeholder="45000"
              value={form.attendance} onChange={(e) => set('attendance', e.target.value)} />)}
          </div>

          {sectionHead('Photo')}
          <div className="mb-2">
            {photoPreview ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Event photo" className="rounded-lg"
                  style={{ maxHeight: 180, objectFit: 'cover', maxWidth: '100%' }} />
                <button type="button" onClick={removePhoto} className="absolute top-2 right-2 p-1 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#f87171' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-colors"
                style={{ border: '2px dashed #2d3748', backgroundColor: '#1a2235', padding: '1.5rem 1rem', color: '#8896ae' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3748')}
              >
                <ImagePlus size={24} />
                <span className="text-sm">Upload a photo</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            )}
          </div>

          {sectionHead('Notes')}
          <div>
            <label className="label">Notes / Story</label>
            <textarea className="input" rows={4}
              placeholder="Write about your experience..."
              value={form.notes} onChange={(e) => set('notes', e.target.value)}
              style={{ resize: 'vertical' }} />
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : event ? 'Update Event' : 'Save Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
