'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Stadium, StadiumVisit, InningScore } from '@/types'
import { X, Plus, Minus, ImagePlus, Trash2, CloudSun, Loader2 } from 'lucide-react'

interface ExtraSeat { section: string; row: string; number: string }

interface Props {
  stadium: Stadium
  visit?: StadiumVisit
  onClose: () => void
  onSaved: () => void
}

function emptyInnings(n = 9): InningScore[] {
  return Array.from({ length: n }, (_, i) => ({ inning: i + 1, home: null, away: null }))
}

function defaultForm(stadium: Stadium, visit?: StadiumVisit) {
  return {
    visit_date: visit?.visit_date ?? new Date().toISOString().split('T')[0],
    home_team: visit?.home_team ?? stadium.team,
    visiting_team: visit?.visiting_team ?? '',
    home_team_record: visit?.home_team_record ?? '',
    visiting_team_record: visit?.visiting_team_record ?? '',
    seat_section: visit?.seat_section ?? '',
    seat_row: visit?.seat_row ?? '',
    seat_number: visit?.seat_number ?? '',
    first_pitch_time: visit?.first_pitch_time ?? '',
    game_duration: visit?.game_duration ?? '',
    temperature: visit?.temperature?.toString() ?? '',
    weather: visit?.weather ?? '',
    attendance: visit?.attendance?.toString() ?? '',
    home_starter_name: visit?.home_starter_name ?? '',
    home_starter_wl: visit?.home_starter_wl ?? '',
    home_starter_ip: visit?.home_starter_ip ?? '',
    home_starter_h: visit?.home_starter_h?.toString() ?? '',
    home_starter_er: visit?.home_starter_er?.toString() ?? '',
    home_starter_bb: visit?.home_starter_bb?.toString() ?? '',
    home_starter_k: visit?.home_starter_k?.toString() ?? '',
    away_starter_name: visit?.away_starter_name ?? '',
    away_starter_wl: visit?.away_starter_wl ?? '',
    away_starter_ip: visit?.away_starter_ip ?? '',
    away_starter_h: visit?.away_starter_h?.toString() ?? '',
    away_starter_er: visit?.away_starter_er?.toString() ?? '',
    away_starter_bb: visit?.away_starter_bb?.toString() ?? '',
    away_starter_k: visit?.away_starter_k?.toString() ?? '',
    home_runs: visit?.home_runs?.toString() ?? '',
    home_hits: visit?.home_hits?.toString() ?? '',
    home_errors: visit?.home_errors?.toString() ?? '',
    home_lob: visit?.home_lob?.toString() ?? '',
    away_runs: visit?.away_runs?.toString() ?? '',
    away_hits: visit?.away_hits?.toString() ?? '',
    away_errors: visit?.away_errors?.toString() ?? '',
    away_lob: visit?.away_lob?.toString() ?? '',
    winning_pitcher: visit?.winning_pitcher ?? '',
    losing_pitcher: visit?.losing_pitcher ?? '',
    save_pitcher: visit?.save_pitcher ?? '',
    hp_umpire: visit?.hp_umpire ?? '',
    first_base_umpire: visit?.first_base_umpire ?? '',
    second_base_umpire: visit?.second_base_umpire ?? '',
    third_base_umpire: visit?.third_base_umpire ?? '',
    notes: visit?.notes ?? '',
  }
}

export default function GameDayForm({ stadium, visit, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => defaultForm(stadium, visit))
  const [innings, setInnings] = useState<InningScore[]>(() =>
    visit?.inning_scores?.length ? visit.inning_scores : emptyInnings()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(visit?.photo_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherNote, setWeatherNote] = useState<string | null>(null)
  const [additionalSeats, setAdditionalSeats] = useState<ExtraSeat[]>(
    () => (visit?.additional_seats as ExtraSeat[] | null) ?? []
  )

  async function fetchWeather(date: string, force = false) {
    if (!date) return
    if (!force && (form.temperature || form.weather)) return
    setWeatherLoading(true)
    setWeatherNote(null)
    try {
      const params = new URLSearchParams({
        lat: stadium.lat.toString(),
        lng: stadium.lng.toString(),
        date,
      })
      const res = await fetch(`/api/weather?${params}`)
      if (!res.ok) { setWeatherLoading(false); return }
      const data = await res.json()
      if (data.outOfRange) {
        setWeatherNote('Auto-fill works for today, yesterday, and the next 4 days.')
      } else if (data.temp != null) {
        setForm((prev) => ({
          ...prev,
          temperature: String(data.temp),
          weather: data.description ?? prev.weather,
        }))
        setWeatherNote('Auto-filled')
      }
    } catch {
      // silently fail — weather is optional
    }
    setWeatherLoading(false)
  }

  useEffect(() => {
    if (visit) return // don't auto-fill when editing an existing record
    if (form.visit_date) fetchWeather(form.visit_date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.visit_date])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addExtraSeat() {
    setAdditionalSeats((prev) => [...prev, { section: '', row: '', number: '' }])
  }
  function removeExtraSeat(idx: number) {
    setAdditionalSeats((prev) => prev.filter((_, i) => i !== idx))
  }
  function updateExtraSeat(idx: number, key: keyof ExtraSeat, value: string) {
    setAdditionalSeats((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: value }
      return next
    })
  }

  function setInning(idx: number, side: 'home' | 'away', value: string) {
    setInnings((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [side]: value === '' ? null : parseInt(value) || 0 }
      return next
    })
  }

  function addInning() {
    setInnings((prev) => [
      ...prev,
      { inning: prev.length + 1, home: null, away: null },
    ])
  }

  function removeInning() {
    if (innings.length > 9) setInnings((prev) => prev.slice(0, -1))
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let uploadedPhotoUrl: string | null = visit?.photo_url ?? null

    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
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
    } else if (!photoPreview && visit?.photo_url) {
      uploadedPhotoUrl = null
    }

    const payload = {
      stadium_id: stadium.id,
      visit_date: form.visit_date,
      home_team: form.home_team,
      visiting_team: form.visiting_team,
      home_team_record: form.home_team_record || null,
      visiting_team_record: form.visiting_team_record || null,
      seat_section: form.seat_section || null,
      seat_row: form.seat_row || null,
      seat_number: form.seat_number || null,
      first_pitch_time: form.first_pitch_time || null,
      game_duration: form.game_duration || null,
      temperature: form.temperature ? parseInt(form.temperature) : null,
      weather: form.weather || null,
      attendance: form.attendance ? parseInt(form.attendance) : null,
      home_starter_name: form.home_starter_name || null,
      home_starter_wl: form.home_starter_wl || null,
      home_starter_ip: form.home_starter_ip || null,
      home_starter_h: form.home_starter_h ? parseInt(form.home_starter_h) : null,
      home_starter_er: form.home_starter_er ? parseInt(form.home_starter_er) : null,
      home_starter_bb: form.home_starter_bb ? parseInt(form.home_starter_bb) : null,
      home_starter_k: form.home_starter_k ? parseInt(form.home_starter_k) : null,
      away_starter_name: form.away_starter_name || null,
      away_starter_wl: form.away_starter_wl || null,
      away_starter_ip: form.away_starter_ip || null,
      away_starter_h: form.away_starter_h ? parseInt(form.away_starter_h) : null,
      away_starter_er: form.away_starter_er ? parseInt(form.away_starter_er) : null,
      away_starter_bb: form.away_starter_bb ? parseInt(form.away_starter_bb) : null,
      away_starter_k: form.away_starter_k ? parseInt(form.away_starter_k) : null,
      inning_scores: innings,
      home_runs: form.home_runs ? parseInt(form.home_runs) : null,
      home_hits: form.home_hits ? parseInt(form.home_hits) : null,
      home_errors: form.home_errors ? parseInt(form.home_errors) : null,
      home_lob: form.home_lob ? parseInt(form.home_lob) : null,
      away_runs: form.away_runs ? parseInt(form.away_runs) : null,
      away_hits: form.away_hits ? parseInt(form.away_hits) : null,
      away_errors: form.away_errors ? parseInt(form.away_errors) : null,
      away_lob: form.away_lob ? parseInt(form.away_lob) : null,
      winning_pitcher: form.winning_pitcher || null,
      losing_pitcher: form.losing_pitcher || null,
      save_pitcher: form.save_pitcher || null,
      hp_umpire: form.hp_umpire || null,
      first_base_umpire: form.first_base_umpire || null,
      second_base_umpire: form.second_base_umpire || null,
      third_base_umpire: form.third_base_umpire || null,
      notes: form.notes || null,
      photo_url: uploadedPhotoUrl,
      additional_seats: additionalSeats.filter((s) => s.section || s.row || s.number),
      created_by: user?.id ?? null,
    }

    let err
    if (visit) {
      ;({ error: err } = await supabase
        .from('stadium_visits')
        .update(payload)
        .eq('id', visit.id))
    } else {
      ;({ error: err } = await supabase.from('stadium_visits').insert(payload))
    }

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      onSaved()
    }
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div className="card w-full max-w-3xl" style={{ backgroundColor: '#111827' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #1f2937' }}
        >
          <div>
            <div className="font-semibold" style={{ color: '#f1f5f9' }}>
              {visit ? 'Edit GameDay Record' : 'Log a Game'}
            </div>
            <div className="text-sm" style={{ color: '#a8b8c8' }}>
              {stadium.name}
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#a8b8c8' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          {sectionHead('Game Info')}
          <div className="grid grid-cols-2 gap-3">
            {field(
              'Date',
              <input
                type="date"
                className="input"
                value={form.visit_date}
                onChange={(e) => set('visit_date', e.target.value)}
                required
              />
            )}
            {field(
              'First Pitch',
              <input
                type="text"
                className="input"
                placeholder="7:10 PM"
                value={form.first_pitch_time}
                onChange={(e) => set('first_pitch_time', e.target.value)}
              />
            )}
            {field(
              'Home Team',
              <input
                type="text"
                className="input"
                value={form.home_team}
                onChange={(e) => set('home_team', e.target.value)}
                required
              />
            )}
            {field(
              'Visiting Team',
              <input
                type="text"
                className="input"
                placeholder="Visiting team name"
                value={form.visiting_team}
                onChange={(e) => set('visiting_team', e.target.value)}
                required
              />
            )}
            {field(
              'Home Record',
              <input
                type="text"
                className="input"
                placeholder="W-L record"
                value={form.home_team_record}
                onChange={(e) => set('home_team_record', e.target.value)}
              />
            )}
            {field(
              'Away Record',
              <input
                type="text"
                className="input"
                placeholder="W-L record"
                value={form.visiting_team_record}
                onChange={(e) => set('visiting_team_record', e.target.value)}
              />
            )}
            {field(
              'Game Duration',
              <input
                type="text"
                className="input"
                placeholder="e.g. 3h 12m"
                value={form.game_duration}
                onChange={(e) => set('game_duration', e.target.value)}
              />
            )}
            {field(
              'Attendance',
              <input
                type="number"
                className="input"
                placeholder="38500"
                value={form.attendance}
                onChange={(e) => set('attendance', e.target.value)}
              />
            )}
          </div>

          {sectionHead('Seating')}
          {/* Primary seat */}
          <div className="mb-3">
            <div className="text-xs font-medium mb-2" style={{ color: '#b8c8d8' }}>Seat 1</div>
            <div className="grid grid-cols-3 gap-3">
              {field('Section', <input type="text" className="input" placeholder="114" value={form.seat_section} onChange={(e) => set('seat_section', e.target.value)} />)}
              {field('Row', <input type="text" className="input" placeholder="G" value={form.seat_row} onChange={(e) => set('seat_row', e.target.value)} />)}
              {field('Seat', <input type="text" className="input" placeholder="12" value={form.seat_number} onChange={(e) => set('seat_number', e.target.value)} />)}
            </div>
          </div>
          {/* Additional seats */}
          {additionalSeats.map((seat, idx) => (
            <div key={idx} className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium" style={{ color: '#b8c8d8' }}>Seat {idx + 2}</div>
                <button
                  type="button"
                  onClick={() => removeExtraSeat(idx)}
                  className="p-1 rounded"
                  style={{ color: '#a8b8c8' }}
                >
                  <X size={12} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Section</label>
                  <input type="text" className="input" placeholder="114" value={seat.section} onChange={(e) => updateExtraSeat(idx, 'section', e.target.value)} />
                </div>
                <div>
                  <label className="label">Row</label>
                  <input type="text" className="input" placeholder="G" value={seat.row} onChange={(e) => updateExtraSeat(idx, 'row', e.target.value)} />
                </div>
                <div>
                  <label className="label">Seat</label>
                  <input type="text" className="input" placeholder="12" value={seat.number} onChange={(e) => updateExtraSeat(idx, 'number', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addExtraSeat}
            className="btn-secondary mb-2"
            style={{ padding: '4px 10px', fontSize: '0.92rem' }}
          >
            <Plus size={12} /> Add Another Seat
          </button>

          <div className="flex items-center justify-between pt-4 pb-1 mb-2" style={{ borderBottom: '1px solid #1f2937' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#3b82f6' }}>
              Conditions
            </span>
            <button
              type="button"
              onClick={() => fetchWeather(form.visit_date, true)}
              disabled={weatherLoading || !form.visit_date}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ color: '#60a5fa', backgroundColor: 'rgba(59,130,246,0.1)' }}
              title="Fetch weather for this date and stadium"
            >
              {weatherLoading
                ? <Loader2 size={11} className="animate-spin" />
                : <CloudSun size={11} />}
              {weatherLoading ? 'Fetching…' : 'Auto-fill weather'}
            </button>
          </div>
          {weatherNote && (
            <div
              className="text-xs mb-2 px-2 py-1 rounded"
              style={{
                color: weatherNote === 'Auto-filled' ? '#22c55e' : '#a8b8c8',
                backgroundColor: weatherNote === 'Auto-filled' ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
              }}
            >
              {weatherNote === 'Auto-filled' ? '✓ Weather auto-filled from OpenWeatherMap' : `ℹ ${weatherNote}`}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {field(
              'Temperature (°F)',
              <input
                type="number"
                className="input"
                placeholder="72"
                value={form.temperature}
                onChange={(e) => { set('temperature', e.target.value); setWeatherNote(null) }}
              />
            )}
            {field(
              'Weather',
              <input
                type="text"
                className="input"
                placeholder="Clear, sunny"
                value={form.weather}
                onChange={(e) => { set('weather', e.target.value); setWeatherNote(null) }}
              />
            )}
          </div>

          {sectionHead('Starting Pitchers')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Home starter */}
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: '#b8c8d8' }}>
                Home Starter
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  className="input"
                  placeholder="Pitcher name"
                  value={form.home_starter_name}
                  onChange={(e) => set('home_starter_name', e.target.value)}
                />
                <div className="grid grid-cols-3 gap-1">
                  {[
                    ['W-L', 'home_starter_wl', '10-5'],
                    ['IP', 'home_starter_ip', '6.0'],
                    ['H', 'home_starter_h', '4'],
                    ['ER', 'home_starter_er', '2'],
                    ['BB', 'home_starter_bb', '1'],
                    ['K', 'home_starter_k', '8'],
                  ].map(([lbl, key, ph]) => (
                    <div key={key}>
                      <label className="label">{lbl}</label>
                      <input
                        type={lbl === 'W-L' || lbl === 'IP' ? 'text' : 'number'}
                        className="input"
                        placeholder={ph}
                        value={form[key as keyof typeof form]}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Away starter */}
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: '#b8c8d8' }}>
                Away Starter
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  className="input"
                  placeholder="Pitcher name"
                  value={form.away_starter_name}
                  onChange={(e) => set('away_starter_name', e.target.value)}
                />
                <div className="grid grid-cols-3 gap-1">
                  {[
                    ['W-L', 'away_starter_wl', '10-5'],
                    ['IP', 'away_starter_ip', '6.0'],
                    ['H', 'away_starter_h', '4'],
                    ['ER', 'away_starter_er', '2'],
                    ['BB', 'away_starter_bb', '1'],
                    ['K', 'away_starter_k', '8'],
                  ].map(([lbl, key, ph]) => (
                    <div key={key}>
                      <label className="label">{lbl}</label>
                      <input
                        type={lbl === 'W-L' || lbl === 'IP' ? 'text' : 'number'}
                        className="input"
                        placeholder={ph}
                        value={form[key as keyof typeof form]}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {sectionHead('Inning-by-Inning Scores')}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th
                    className="text-left py-1 pr-3 text-xs font-medium"
                    style={{ color: '#a8b8c8', width: 70 }}
                  >
                    Team
                  </th>
                  {innings.map((inn) => (
                    <th
                      key={inn.inning}
                      className="text-center px-1 text-xs font-medium"
                      style={{ color: '#a8b8c8', minWidth: 36 }}
                    >
                      {inn.inning}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['away', 'home'] as const).map((side) => (
                  <tr key={side}>
                    <td className="py-1 pr-3 text-xs" style={{ color: '#b8c8d8' }}>
                      {side === 'away' ? form.visiting_team || 'Away' : form.home_team || 'Home'}
                    </td>
                    {innings.map((inn, idx) => (
                      <td key={inn.inning} className="px-0.5 py-1">
                        <input
                          type="number"
                          min={0}
                          className="input text-center"
                          style={{ padding: '4px 2px', fontSize: '0.92rem' }}
                          value={inn[side] ?? ''}
                          onChange={(e) => setInning(idx, side, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={addInning} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.92rem' }}>
              <Plus size={12} /> Inning
            </button>
            {innings.length > 9 && (
              <button type="button" onClick={removeInning} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.92rem' }}>
                <Minus size={12} /> Remove
              </button>
            )}
          </div>

          {sectionHead('Final Box Score')}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Team', 'R', 'H', 'E', 'LOB'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-1 pr-2 text-xs font-medium"
                      style={{ color: '#a8b8c8' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: form.visiting_team || 'Away', prefix: 'away' },
                  { label: form.home_team || 'Home', prefix: 'home' },
                ].map(({ label, prefix }) => (
                  <tr key={prefix}>
                    <td className="py-1 pr-2 text-xs" style={{ color: '#b8c8d8', width: 80 }}>
                      {label}
                    </td>
                    {['runs', 'hits', 'errors', 'lob'].map((stat) => (
                      <td key={stat} className="pr-2 py-1">
                        <input
                          type="number"
                          min={0}
                          className="input"
                          style={{ padding: '4px 6px', fontSize: '0.92rem', width: 52 }}
                          value={form[`${prefix}_${stat}` as keyof typeof form]}
                          onChange={(e) => set(`${prefix}_${stat}`, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sectionHead('Pitchers of Record')}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Winning Pitcher (WP)', 'winning_pitcher'],
              ['Losing Pitcher (LP)', 'losing_pitcher'],
              ['Save (SV)', 'save_pitcher'],
            ].map(([lbl, key]) => (
              field(lbl, (
                <input
                  key={key}
                  type="text"
                  className="input"
                  placeholder="Name (W/L record)"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => set(key, e.target.value)}
                />
              ))
            ))}
          </div>

          {sectionHead('Umpire Crew')}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Home Plate (HP)', 'hp_umpire'],
              ['1st Base (1B)', 'first_base_umpire'],
              ['2nd Base (2B)', 'second_base_umpire'],
              ['3rd Base (3B)', 'third_base_umpire'],
            ].map(([lbl, key]) => (
              field(lbl, (
                <input
                  key={key}
                  type="text"
                  className="input"
                  placeholder="Umpire name"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => set(key, e.target.value)}
                />
              ))
            ))}
          </div>

          {sectionHead('Photo')}
          <div className="mb-2">
            {photoPreview ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Game photo preview"
                  className="rounded-lg"
                  style={{ maxHeight: 180, objectFit: 'cover', maxWidth: '100%' }}
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 p-1 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#f87171' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-colors"
                style={{
                  border: '2px dashed #2d3748',
                  backgroundColor: '#1a2235',
                  padding: '2rem 1rem',
                  color: '#a8b8c8',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3748')}
              >
                <ImagePlus size={28} />
                <span className="text-sm">Click to upload a game photo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            )}
          </div>

          {sectionHead('Story & Notes')}
          <div>
            <label className="label">Notes / Game Story</label>
            <textarea
              className="input"
              rows={5}
              placeholder="Write about your experience at this game..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          {error && (
            <div
              className="mt-4 p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : visit ? 'Update Record' : 'Save GameDay Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
