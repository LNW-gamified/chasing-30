'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient, getSignedPhotoUrls } from '@/lib/supabase'
import type { Stadium, StadiumVisit, InningScore } from '@/types'
import { X, Plus, Minus, ImagePlus, Trash2, CloudSun, Loader2 } from 'lucide-react'
import { GAME_MOMENTS } from '@/lib/moments'
import { fetchSeasonHomeGames, type SeasonGame, STADIUM_TZ, TZ_LABEL } from '@/lib/mlb-api'
import { TEAM_PRIMARY } from '@/lib/team-colors'

interface ExtraSeat { section: string; row: string; number: string }

interface Props {
  stadium: Stadium
  visit?: StadiumVisit
  onClose: () => void
  onSaved: (savedMoments: string[], newVisitId: string | null) => void
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

function formatGameOption(game: SeasonGame, tz: string, tzLabel: string): string {
  const dt = new Date(game.gameDate)
  const dateStr = dt.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
  })
  const awayLabel = game.awayTeamAbbr || game.awayTeam.split(' ').pop() || game.awayTeam
  if (game.isFinal) return `${dateStr} — vs ${awayLabel} (Final)`
  if (game.isLive)  return `${dateStr} — vs ${awayLabel} (Live)`
  const timeStr = dt.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  })
  return `${dateStr} — vs ${awayLabel} (${timeStr} ${tzLabel})`
}

export default function GameDayForm({ stadium, visit, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => defaultForm(stadium, visit))
  const [innings, setInnings] = useState<InningScore[]>(() =>
    visit?.inning_scores?.length ? visit.inning_scores : emptyInnings()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [photoPathsToKeep, setPhotoPathsToKeep] = useState<string[]>(
    visit?.photos ?? (visit?.photo_url ? [visit.photo_url] : [])
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load signed URLs for existing photos on mount
  useEffect(() => {
    if (photoPathsToKeep.length > 0) {
      getSignedPhotoUrls(photoPathsToKeep).then(urls => setPhotoPreviews(urls))
    }
  }, [])
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherNote, setWeatherNote] = useState<string | null>(null)
  const [additionalSeats, setAdditionalSeats] = useState<ExtraSeat[]>(
    () => (visit?.additional_seats as ExtraSeat[] | null) ?? []
  )
  const [selectedMoments, setSelectedMoments] = useState<string[]>(
    () => (visit?.moments as string[] | null) ?? []
  )

  // Game picker state (new games only)
  const [seasonGames, setSeasonGames] = useState<SeasonGame[]>([])
  const [gamesLoading, setGamesLoading] = useState(!visit)
  const [selectedGame, setSelectedGame] = useState<SeasonGame | null>(null)
  const [enterManually, setEnterManually] = useState(!!visit)
  const [duplicateWarning, setDuplicateWarning] = useState(false)

  const tz      = STADIUM_TZ[stadium.abbreviation] ?? 'America/Los_Angeles'
  const tzLabel = TZ_LABEL[tz] ?? 'PT'

  // Load full season schedule on mount (for new games only)
  useEffect(() => {
    if (visit) return
    fetchSeasonHomeGames(stadium.abbreviation).then(games => {
      setSeasonGames(games)
      setGamesLoading(false)
      if (games.length === 0) setEnterManually(true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const pastGames = seasonGames
    .filter(g => g.isFinal)
    .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
  const upcomingGames = seasonGames
    .filter(g => !g.isFinal)
    .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())

  function handleGameSelect(gamePkStr: string) {
    if (!gamePkStr) { setSelectedGame(null); return }
    const gamePk = parseInt(gamePkStr)
    const game = seasonGames.find(g => g.gamePk === gamePk) ?? null
    setSelectedGame(game)
    if (!game) return

    const dt = new Date(game.gameDate)
    const dateStr = dt.toLocaleDateString('en-CA', { timeZone: tz })
    const timeStr = dt.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
    }) + ` ${tzLabel}`

    setForm(prev => ({
      ...prev,
      visit_date:     dateStr,
      visiting_team:  game.awayTeam,
      first_pitch_time: game.isFinal ? prev.first_pitch_time : timeStr,
    }))
  }

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
      // weather is optional — silently fail
    }
    setWeatherLoading(false)
  }

  useEffect(() => {
    if (visit) return
    if (form.visit_date) fetchWeather(form.visit_date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.visit_date])

  useEffect(() => {
    if (!form.visit_date) { setDuplicateWarning(false); return }
    const supabase = createClient()
    supabase.from('stadium_visits')
      .select('id')
      .eq('stadium_id', stadium.id)
      .eq('visit_date', form.visit_date)
      .then(({ data }) => {
        const others = (data ?? []).filter(r => r.id !== visit?.id)
        setDuplicateWarning(others.length > 0)
      })
  }, [form.visit_date, stadium.id, visit?.id])

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
    const files = Array.from(e.target.files ?? [])
    const totalCount = photoPathsToKeep.length + photoFiles.length + files.length
    if (totalCount > 5) {
      setError('Maximum 5 photos allowed')
      return
    }
    const newPreviews = files.map(f => URL.createObjectURL(f))
    setPhotoFiles(prev => [...prev, ...files])
    setPhotoPreviews(prev => [...prev, ...newPreviews])
  }

  function removePhoto(idx: number) {
    const existingCount = photoPathsToKeep.length
    if (idx < existingCount) {
      setPhotoPathsToKeep(prev => prev.filter((_, i) => i !== idx))
      setPhotoPreviews(prev => prev.filter((_, i) => i !== idx))
    } else {
      const fileIdx = idx - existingCount
      setPhotoFiles(prev => prev.filter((_, i) => i !== fileIdx))
      setPhotoPreviews(prev => prev.filter((_, i) => i !== idx))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Upload new files, store paths (not URLs)
    const newPaths: string[] = []
    for (const file of photoFiles) {
      const ext = file.name.split('.').pop()
      const path = `${stadium.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('game-photos')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadErr) {
        setError(`Photo upload failed: ${uploadErr.message}`)
        setSaving(false)
        return
      }
      newPaths.push(uploadData.path)
    }

    const allPhotoPaths = [...photoPathsToKeep, ...newPaths]
    const uploadedPhotoUrl = allPhotoPaths[0] ?? null

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
      photos: allPhotoPaths.length > 0 ? allPhotoPaths : null,
      additional_seats: additionalSeats.filter((s) => s.section || s.row || s.number),
      moments: selectedMoments,
      created_by: user?.id ?? null,
    }

    let err: any
    let newVisitId: string | null = null

    if (visit) {
      ;({ error: err } = await supabase
        .from('stadium_visits')
        .update(payload)
        .eq('id', visit.id))
    } else {
      const { data: insertData, error: insertErr } = await supabase
        .from('stadium_visits')
        .insert(payload)
        .select('id')
        .single()
      err = insertErr
      newVisitId = insertData?.id ?? null
    }

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      onSaved(selectedMoments, newVisitId)
    }
  }

  const sectionHead = (label: string) => (
    <div
      className="text-xs font-semibold uppercase tracking-wider pt-4 pb-1 mb-2"
      style={{ color: '#1F6FEB', borderBottom: '1px solid #30363D' }}
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
      <div className="card w-full max-w-3xl" style={{ backgroundColor: '#161B22' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #30363D' }}
        >
          <div>
            <div className="font-semibold" style={{ color: '#E6EDF3' }}>
              {visit ? 'Edit GameDay Record' : 'Log a Game'}
            </div>
            <div className="text-sm" style={{ color: '#8B949E' }}>
              {stadium.name}
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#8B949E' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">

          {/* ── Game picker (new games only) ─────────────────────────── */}
          {!visit && !enterManually && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#1F6FEB',
                  borderBottom: '1px solid #30363D', paddingBottom: 6, marginBottom: 10,
                }}
              >
                Select a Game
              </div>

              {gamesLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B949E', fontSize: 13, padding: '8px 0' }}>
                  <Loader2 size={14} className="animate-spin" />
                  Loading {stadium.team} schedule…
                </div>
              ) : (
                <>
                  <select
                    className="input"
                    value={selectedGame?.gamePk?.toString() ?? ''}
                    onChange={e => handleGameSelect(e.target.value)}
                    style={{ marginBottom: 8 }}
                  >
                    <option value="">— Select a home game —</option>
                    {upcomingGames.length > 0 && (
                      <optgroup label="Upcoming Games">
                        {upcomingGames.map(g => (
                          <option key={g.gamePk} value={String(g.gamePk)}>
                            {formatGameOption(g, tz, tzLabel)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {pastGames.length > 0 && (
                      <optgroup label="Past Games">
                        {pastGames.map(g => (
                          <option key={g.gamePk} value={String(g.gamePk)}>
                            {formatGameOption(g, tz, tzLabel)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {selectedGame && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, color: '#3FB950', marginBottom: 4,
                    }}>
                      ✓ Auto-filled: {form.visit_date} · vs {selectedGame.awayTeam}
                      {form.first_pitch_time ? ` · ${form.first_pitch_time}` : ''}
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setEnterManually(true)}
                style={{
                  fontSize: 12, color: '#8B949E', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, textDecoration: 'underline',
                }}
              >
                Enter date manually instead
              </button>
            </div>
          )}

          {/* Back to picker link when in manual mode (new games only) */}
          {!visit && enterManually && seasonGames.length > 0 && (
            <div style={{ marginTop: 16, marginBottom: -4 }}>
              <button
                type="button"
                onClick={() => setEnterManually(false)}
                style={{
                  fontSize: 12, color: '#1F6FEB', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, textDecoration: 'underline',
                }}
              >
                ← Pick from schedule instead
              </button>
            </div>
          )}

          {sectionHead('Game Info')}
          {duplicateWarning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, backgroundColor: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.4)', marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontSize: 13, color: '#F5A623', fontWeight: 600 }}>You already have a game logged at this stadium on this date.</span>
            </div>
          )}
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
            <div className="text-xs font-medium mb-2" style={{ color: '#8B949E' }}>Seat 1</div>
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
                <div className="text-xs font-medium" style={{ color: '#8B949E' }}>Seat {idx + 2}</div>
                <button
                  type="button"
                  onClick={() => removeExtraSeat(idx)}
                  className="p-1 rounded"
                  style={{ color: '#8B949E' }}
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

          <div className="flex items-center justify-between pt-4 pb-1 mb-2" style={{ borderBottom: '1px solid #30363D' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#1F6FEB' }}>
              Conditions
            </span>
            <button
              type="button"
              onClick={() => fetchWeather(form.visit_date, true)}
              disabled={weatherLoading || !form.visit_date}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ color: '#1F6FEB', backgroundColor: 'rgba(31,111,235,0.1)' }}
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
                color: weatherNote === 'Auto-filled' ? '#3FB950' : '#8B949E',
                backgroundColor: weatherNote === 'Auto-filled' ? 'rgba(63,185,80,0.08)' : 'rgba(255,255,255,0.04)',
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
              <div className="text-xs font-medium mb-2" style={{ color: '#8B949E' }}>
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
              <div className="text-xs font-medium mb-2" style={{ color: '#8B949E' }}>
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
                    style={{ color: '#8B949E', width: 70 }}
                  >
                    Team
                  </th>
                  {innings.map((inn) => (
                    <th
                      key={inn.inning}
                      className="text-center px-1 text-xs font-medium"
                      style={{ color: '#8B949E', minWidth: 36 }}
                    >
                      {inn.inning}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['away', 'home'] as const).map((side) => (
                  <tr key={side}>
                    <td className="py-1 pr-3 text-xs" style={{ color: '#8B949E' }}>
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
                      style={{ color: '#8B949E' }}
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
                    <td className="py-1 pr-2 text-xs" style={{ color: '#8B949E', width: 80 }}>
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
          <div style={{ marginBottom: 8 }}>
            {photoPreviews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                {photoPreviews.map((src, idx) => (
                  <div key={idx} style={{ position: 'relative', paddingBottom: '100%', borderRadius: 10, overflow: 'hidden', backgroundColor: '#1C2430' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Photo ${idx + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={11} color="#F85149" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(photoPathsToKeep.length + photoFiles.length) < 5 && (
              <label
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, borderRadius: 12, cursor: 'pointer',
                  border: '2px dashed #30363D', backgroundColor: '#1a2235',
                  padding: photoPreviews.length > 0 ? '12px' : '2rem 1rem', color: '#8B949E',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1F6FEB')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#30363D')}
              >
                <ImagePlus size={22} />
                <span style={{ fontSize: 12 }}>
                  {photoPreviews.length === 0 ? 'Add up to 5 photos' : `Add photo (${photoPreviews.length}/5)`}
                </span>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
              </label>
            )}
          </div>

          {sectionHead('Game Day Moments')}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: '#8B949E', marginBottom: 10 }}>
              Tap to mark moments from this game.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {GAME_MOMENTS.map(({ id, icon, label }) => {
                const selected = selectedMoments.includes(id)
                const accent   = TEAM_PRIMARY[stadium.abbreviation] ?? '#1F6FEB'
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setSelectedMoments(prev =>
                        prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
                      )
                    }
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '6px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.12s',
                      backgroundColor: selected ? `${accent}22` : 'transparent',
                      color: selected ? accent : '#8B949E',
                      border: `1.5px solid ${selected ? accent : '#30363D'}`,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{icon}</span> {label}
                  </button>
                )
              })}
            </div>
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
              style={{ backgroundColor: 'rgba(248,81,73,0.1)', color: '#F85149' }}
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
