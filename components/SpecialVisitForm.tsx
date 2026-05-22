'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { SpecialVisitType } from '@/types'

// ── Visit type config ─────────────────────────────────────────────────────

const VISIT_TYPES: {
  value: SpecialVisitType
  label: string
  emoji: string
  color: string
  isMlb: boolean
  description: string
}[] = [
  { value: 'minor_league',    label: 'Minor League Game',   emoji: '⚾', color: '#1F6FEB', isMlb: false, description: 'MiLB game at any level' },
  { value: 'spring_training', label: 'Spring Training',     emoji: '🌞', color: '#F5A623', isMlb: false, description: 'Cactus or Grapefruit League' },
  { value: 'international',   label: 'International Game',  emoji: '🌍', color: '#3FB950', isMlb: false, description: 'MLB game played abroad' },
  { value: 'all_star',        label: 'All-Star Game',       emoji: '🏆', color: '#58A6FF', isMlb: true,  description: 'MLB Midsummer Classic' },
  { value: 'world_series',    label: 'World Series',        emoji: '🎯', color: '#F5A623', isMlb: true,  description: 'Fall Classic game' },
  { value: 'playoff',         label: 'Playoff Game',        emoji: '🥇', color: '#E8820C', isMlb: true,  description: 'ALDS/NLDS/ALCS/NLCS' },
  { value: 'stadium_tour',    label: 'Stadium / Tour',      emoji: '🏭', color: '#8B949E', isMlb: false, description: 'Ballpark, factory, or Hall of Fame tour' },
  { value: 'college',         label: 'College Baseball',    emoji: '🎓', color: '#A78BFA', isMlb: false, description: 'NCAA or JUCO game' },
  { value: 'independent',     label: 'Independent League',  emoji: '🏟️', color: '#FF7B72', isMlb: false, description: 'Atlantic, American Association, etc.' },
  { value: 'other',           label: 'Other Special Event', emoji: '📺', color: '#8B949E', isMlb: false, description: 'Anything else baseball-related' },
]

const GAME_MOMENTS = [
  'Walk-off win', 'Home run', 'Grand slam', 'No-hitter', 'Perfect game',
  'Extra innings', 'Comeback win', 'Historic moment', 'Bobblehead giveaway',
  'Fireworks after', 'Met a player', 'On the jumbotron',
]

// ── MLB schedule fetch for MLB events ────────────────────────────────────

interface MlbGame { gamePk: number; date: string; label: string }

async function fetchMlbGames(visitType: SpecialVisitType, year = new Date().getFullYear()): Promise<MlbGame[]> {
  const gameTypeMap: Partial<Record<SpecialVisitType, string>> = {
    all_star:    'A',
    world_series:'W',
    playoff:     'L,D,F',
  }
  const gameType = gameTypeMap[visitType]
  if (!gameType) return []

  try {
    const start = `${year}-01-01`
    const end   = `${year}-12-31`
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${start}&endDate=${end}&gameType=${gameType}`
    )
    if (!res.ok) return []
    const data = await res.json()
    const games: MlbGame[] = []
    for (const d of data.dates ?? []) {
      for (const g of d.games ?? []) {
        const away = g.teams?.away?.team?.name ?? '?'
        const home = g.teams?.home?.team?.name ?? '?'
        const dt   = new Date(g.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        games.push({ gamePk: g.gamePk, date: d.date, label: `${dt} · ${away} @ ${home}` })
      }
    }
    return games
  } catch { return [] }
}

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function SpecialVisitForm({ onClose, onSaved }: Props) {
  const [step, setStep]       = useState<'type' | 'details'>('type')
  const [visitType, setVisitType] = useState<SpecialVisitType | null>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // MLB game picker
  const [mlbGames, setMlbGames]     = useState<MlbGame[]>([])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null)

  // Form fields
  const [venue, setVenue]           = useState('')
  const [city, setCity]             = useState('')
  const [state, setState]           = useState('')
  const [visitDate, setVisitDate]   = useState('')
  const [teams, setTeams]           = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes]           = useState('')
  const [section, setSection]       = useState('')
  const [row, setRow]               = useState('')
  const [seats, setSeats]           = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [selectedMoments, setSelectedMoments] = useState<string[]>([])

  const typeConfig = VISIT_TYPES.find(t => t.value === visitType)

  useEffect(() => {
    if (!visitType || !typeConfig?.isMlb) return
    setGamesLoading(true)
    fetchMlbGames(visitType).then(g => {
      setMlbGames(g)
      setGamesLoading(false)
    })
  }, [visitType, typeConfig?.isMlb])

  function toggleMoment(m: string) {
    setSelectedMoments(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function handleSubmit() {
    if (!visitType || !venue.trim() || !visitDate) {
      setError('Venue and date are required.')
      return
    }
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload: Record<string, unknown> = {
      visit_type:          visitType,
      venue:               venue.trim(),
      city:                city.trim() || null,
      state:               state.trim() || null,
      visit_date:          visitDate,
      teams:               teams.trim() || null,
      description:         description.trim() || null,
      notes:               notes.trim() || null,
      is_mlb_event:        typeConfig?.isMlb ?? false,
      game_pk:             selectedGamePk ?? null,
      ticket_section:      section.trim() || null,
      ticket_row:          row.trim() || null,
      ticket_seats:        seats.trim() ? seats.split(',').map(s => s.trim()).filter(Boolean) : null,
      ticket_confirmation: confirmation.trim() || null,
      moments:             selectedMoments.length > 0 ? selectedMoments : null,
      created_by:          user?.id ?? null,
    }

    const { error: insertErr } = await supabase.from('special_visits').insert(payload)
    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid #30363D', fontSize: 13, color: '#E6EDF3',
    backgroundColor: '#0B1117', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 560, borderRadius: '20px 20px 0 0', backgroundColor: '#161B22', border: '1px solid #30363D', borderBottom: 'none', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + close */}
        <div style={{ position: 'sticky', top: 0, backgroundColor: '#161B22', zIndex: 1, padding: '14px 20px 10px', borderBottom: '1px solid #30363D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#30363D' }} />
          <div style={{ position: 'absolute', left: 16, fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>
            {step === 'type' ? 'Log Special Visit' : (typeConfig?.emoji + ' ' + typeConfig?.label)}
          </div>
          <button onClick={onClose} style={{ position: 'absolute', right: 16, width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(139,148,158,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} color="#8B949E" />
          </button>
        </div>

        <div style={{ padding: '20px 20px 40px' }}>

          {/* ── Step 1: Pick type ── */}
          {step === 'type' && (
            <>
              <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>What kind of visit was this?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {VISIT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => { setVisitType(t.value); setStep('details') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${visitType === t.value ? t.color : '#30363D'}`, backgroundColor: '#0B1117', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                  >
                    <span style={{ fontSize: 26, flexShrink: 0 }}>{t.emoji}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3' }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: '#8B949E' }}>{t.description}</div>
                    </div>
                    {t.isMlb && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#58A6FF', background: 'rgba(31,111,235,0.12)', padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>MLB API</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Step 2: Details ── */}
          {step === 'details' && typeConfig && (
            <>
              <button onClick={() => setStep('type')} style={{ fontSize: 13, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20 }}>
                ← Back
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* MLB game picker */}
                {typeConfig.isMlb && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Select Game</div>
                    {gamesLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B949E', fontSize: 13 }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading games…
                      </div>
                    ) : mlbGames.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#8B949E' }}>No {typeConfig.label} games found for {new Date().getFullYear()}.</div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <select
                          value={selectedGamePk ?? ''}
                          onChange={e => {
                            const pk = parseInt(e.target.value)
                            setSelectedGamePk(isNaN(pk) ? null : pk)
                            const g = mlbGames.find(x => x.gamePk === pk)
                            if (g) setVisitDate(g.date)
                          }}
                          style={{ ...inp, appearance: 'none', paddingRight: 36 }}
                        >
                          <option value="">Pick a game…</option>
                          {mlbGames.map(g => <option key={g.gamePk} value={g.gamePk}>{g.label}</option>)}
                        </select>
                        <ChevronRight size={14} color="#484F58" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none' }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Venue */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {visitType === 'stadium_tour' ? 'Location / Venue *' : 'Venue / Ballpark *'}
                  </div>
                  <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Louisville Slugger Museum, Akron RubberDucks" style={inp} />
                </div>

                {/* City + State */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>City</div>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={inp} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>State</div>
                    <input type="text" value={state} onChange={e => setState(e.target.value)} placeholder="OH" maxLength={2} style={inp} />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Date *</div>
                  <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={inp} />
                </div>

                {/* Teams (not for tours) */}
                {visitType !== 'stadium_tour' && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Teams</div>
                    <input type="text" value={teams} onChange={e => setTeams(e.target.value)} placeholder="e.g. Cleveland vs Detroit" style={inp} />
                  </div>
                )}

                {/* Description / Tour notes */}
                {visitType === 'stadium_tour' && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description</div>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What did you see or do?" style={{ ...inp, resize: 'vertical' }} />
                  </div>
                )}

                {/* Seat info (not for tours) */}
                {visitType !== 'stadium_tour' && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Seat Info (optional)</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="text" value={section} onChange={e => setSection(e.target.value)} placeholder="Section" style={{ ...inp, flex: 1 }} />
                      <input type="text" value={row} onChange={e => setRow(e.target.value)} placeholder="Row" style={{ ...inp, flex: 1 }} />
                      <input type="text" value={seats} onChange={e => setSeats(e.target.value)} placeholder="Seat(s)" style={{ ...inp, flex: 2 }} />
                    </div>
                  </div>
                )}

                {/* Confirmation number */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Confirmation # (optional)</div>
                  <input type="text" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Ticket confirmation number" style={inp} />
                </div>

                {/* Game Day Moments */}
                {visitType !== 'stadium_tour' && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Game Day Moments</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {GAME_MOMENTS.map(m => {
                        const active = selectedMoments.includes(m)
                        return (
                          <button
                            key={m}
                            onClick={() => toggleMoment(m)}
                            style={{
                              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              border: `1px solid ${active ? 'rgba(31,111,235,0.5)' : '#30363D'}`,
                              backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent',
                              color: active ? '#58A6FF' : '#8B949E',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {active && <Check size={11} />}
                            {m}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes (optional)</div>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Memories, observations, anything you want to remember…" style={{ ...inp, resize: 'vertical' }} />
                </div>

                {error && <div style={{ fontSize: 13, color: '#F85149', padding: '8px 12px', background: 'rgba(248,81,73,0.08)', borderRadius: 8 }}>{error}</div>}

                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  style={{ padding: '13px 0', borderRadius: 12, border: 'none', backgroundColor: saving ? '#30363D' : (typeConfig.color || '#1F6FEB'), color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : `${typeConfig.emoji} Log ${typeConfig.label}`}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}

// re-export for use in ChevronRight inline
function ChevronRight({ size, color, style }: { size: number; color: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
