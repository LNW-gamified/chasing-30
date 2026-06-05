'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Check, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { BaseballLifeCategory } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_CARDS: {
  value: BaseballLifeCategory
  label: string
  emoji: string
  sub: string
  isGame: boolean
}[] = [
  { value: 'minor_league',      label: 'Minor League Game',   emoji: '⚾', sub: 'AquaSox, MiLB, independent league', isGame: true  },
  { value: 'mlb_special_event', label: 'MLB Special Event',   emoji: '🌟', sub: 'All-Star, World Series, Playoffs, Field of Dreams', isGame: true  },
  { value: 'spring_training',   label: 'Spring Training',     emoji: '🌞', sub: 'Cactus League or Grapefruit League game', isGame: true  },
  { value: 'pilgrimage',        label: 'Baseball Pilgrimage', emoji: '🏛️', sub: 'Hall of Fame, factory tours, stadium tours, museums', isGame: false },
]

const MLB_SPECIAL_EVENT_TYPES = [
  'All-Star Game', 'Home Run Derby', 'Wild Card Game',
  'ALDS', 'NLDS', 'ALCS', 'NLCS', 'World Series',
  'Field of Dreams Game', 'Other',
]

const PILGRIMAGE_DESTINATIONS = [
  'National Baseball Hall of Fame',
  'Louisville Slugger Museum & Factory',
  'Rawlings Baseball Factory',
  'Negro Leagues Baseball Museum',
  'Field of Dreams Site',
  'Fenway Park Tour',
  'Wrigley Field Tour',
  'Yankee Stadium Tour',
  'Dodger Stadium Tour',
  'Oracle Park Tour',
  'Other',
]

const SPRING_TRAINING_TEAMS = [
  'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
  'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
  'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
  'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
  'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
  'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
  'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
  'Toronto Blue Jays', 'Washington Nationals',
]

const MOMENTS = [
  'Walk-off win', 'Home run', 'Grand slam', 'No-hitter', 'Perfect game',
  'Extra innings', 'Comeback win', 'Historic moment', 'Bobblehead giveaway',
  'Fireworks after', 'Met a player', 'On the jumbotron', 'First pitch ceremony',
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface MinorLeagueStadium {
  id: string
  name: string
  team: string
  city: string
  state: string
  level: string
  affiliate: string
}

interface MlbStadium {
  id: string
  name: string
  team: string
  abbreviation: string
  city: string
  state: string
}

interface Props {
  onClose: () => void
  onSaved: () => void
}

// ── Input style ───────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #30363D', fontSize: 13, color: '#E6EDF3',
  backgroundColor: '#0D1117', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const sel: React.CSSProperties = { ...inp, appearance: 'none', paddingRight: 36 }

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <ChevronDown size={14} color="#484F58" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BaseballLifeForm({ onClose, onSaved }: Props) {
  type Step = 'category' | 'location' | 'game_details' | 'notes' | 'success'
  const [step, setStep] = useState<Step>('category')
  const [category, setCategory] = useState<BaseballLifeCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Location step state
  const [minorLeagueStadiums, setMinorLeagueStadiums] = useState<MinorLeagueStadium[]>([])
  const [mlbStadiums, setMlbStadiums] = useState<MlbStadium[]>([])
  const [selectedMlsId, setSelectedMlsId] = useState<string>('')   // minor_league_stadium_id
  const [useCustomVenue, setUseCustomVenue] = useState(false)
  const [venue, setVenue] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [eventType, setEventType] = useState('')
  const [selectedMlbStadiumId, setSelectedMlbStadiumId] = useState<string>('')
  const [countAsChase30, setCountAsChase30] = useState(false)
  const [springTeam, setSpringTeam] = useState('')
  const [pilgrimageVenue, setPilgrimageVenue] = useState('')
  const [customPilgrimageVenue, setCustomPilgrimageVenue] = useState('')

  // Game details step state
  const [opponent, setOpponent] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [section, setSection] = useState('')
  const [row, setRow] = useState('')
  const [seats, setSeats] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [gameTime, setGameTime] = useState('')
  const [selectedMoments, setSelectedMoments] = useState<string[]>([])

  // Notes step
  const [notes, setNotes] = useState('')

  const categoryConfig = CATEGORY_CARDS.find(c => c.value === category)
  const isGame = categoryConfig?.isGame ?? true

  // Load stadiums when form opens
  useEffect(() => {
    const supabase = createClient()
    supabase.from('minor_league_stadiums').select('id,name,team,city,state,level,affiliate').order('name')
      .then(({ data }) => setMinorLeagueStadiums(data ?? []))
    supabase.from('stadiums').select('id,name,team,abbreviation,city,state').order('name')
      .then(({ data }) => setMlbStadiums(data ?? []))
  }, [])

  function toggleMoment(m: string) {
    setSelectedMoments(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function selectCategory(c: BaseballLifeCategory) {
    setCategory(c)
    setStep('location')
  }

  function locationNext() {
    if (!visitDate) { setError('Date is required.'); return }
    if (category === 'minor_league' && !selectedMlsId && !useCustomVenue) { setError('Select a stadium or add a custom venue.'); return }
    if (category === 'minor_league' && useCustomVenue && !venue.trim()) { setError('Venue name is required.'); return }
    if (category === 'mlb_special_event' && !eventType) { setError('Event type is required.'); return }
    if (category === 'spring_training' && !springTeam) { setError('Team is required.'); return }
    if (category === 'pilgrimage' && !pilgrimageVenue) { setError('Destination is required.'); return }
    setError(null)
    if (isGame) {
      setStep('game_details')
    } else {
      setStep('notes')
    }
  }

  function gameDetailsNext() {
    setError(null)
    setStep('notes')
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in.'); setSaving(false); return }

    // Resolve venue/city/state
    let resolvedVenue = venue.trim() || null
    let resolvedCity = city.trim() || null
    let resolvedState = state.trim() || null
    let resolvedMlsId: string | null = null
    let resolvedMlbStadiumId: string | null = null
    let resolvedEventType = eventType || null

    if (category === 'minor_league') {
      if (selectedMlsId && !useCustomVenue) {
        const mls = minorLeagueStadiums.find(s => s.id === selectedMlsId)
        if (mls) {
          resolvedVenue = mls.name
          resolvedCity = mls.city
          resolvedState = mls.state
          resolvedMlsId = mls.id
          resolvedEventType = `${mls.team} game`
        }
      }
    } else if (category === 'mlb_special_event') {
      if (selectedMlbStadiumId) {
        const st = mlbStadiums.find(s => s.id === selectedMlbStadiumId)
        if (st) {
          resolvedVenue = st.name
          resolvedCity = st.city
          resolvedState = st.state
          resolvedMlbStadiumId = st.id
        }
      }
      resolvedEventType = eventType
    } else if (category === 'spring_training') {
      resolvedEventType = `${springTeam} Spring Training`
      if (!resolvedVenue) resolvedVenue = venue.trim() || null
    } else if (category === 'pilgrimage') {
      resolvedVenue = pilgrimageVenue === 'Other' ? customPilgrimageVenue.trim() : pilgrimageVenue
      resolvedEventType = resolvedVenue
    }

    const payload: Record<string, unknown> = {
      user_id:               user.id,
      category,
      is_game:               isGame,
      venue:                 resolvedVenue,
      city:                  resolvedCity,
      state:                 resolvedState,
      minor_league_stadium_id: resolvedMlsId,
      mlb_stadium_id:        resolvedMlbStadiumId,
      visit_date:            visitDate,
      event_type:            resolvedEventType,
      opponent:              opponent.trim() || null,
      home_team:             null,
      away_team:             opponent.trim() || null,
      final_score_home:      homeScore ? parseInt(homeScore) : null,
      final_score_away:      awayScore ? parseInt(awayScore) : null,
      game_time:             gameTime.trim() || null,
      ticket_section:        section.trim() || null,
      ticket_row:            row.trim() || null,
      ticket_seats:          seats.trim() ? seats.split(',').map(s => s.trim()).filter(Boolean) : null,
      ticket_confirmation:   confirmation.trim() || null,
      moments:               selectedMoments.length > 0 ? selectedMoments : null,
      notes:                 notes.trim() || null,
    }

    const { error: saveErr } = await supabase.from('baseball_life_entries').insert(payload)
    if (saveErr) { setError(saveErr.message); setSaving(false); return }

    // If MLB special event at a Chase 30 stadium and user opted in, create minimal stadium_visit
    if (category === 'mlb_special_event' && countAsChase30 && resolvedMlbStadiumId) {
      await supabase.from('stadium_visits').insert({
        stadium_id:     resolvedMlbStadiumId,
        visit_date:     visitDate,
        home_team:      mlbStadiums.find(s => s.id === resolvedMlbStadiumId)?.team ?? '',
        visiting_team:  opponent.trim() || 'Opponent',
        notes:          `Logged from Baseball Life: ${resolvedEventType}`,
        created_by:     user.id,
      })
    }

    setSaving(false)
    setStep('success')
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderStep() {
    if (step === 'category') {
      return (
        <>
          <p style={{ fontSize: 13, color: '#8B949E', marginBottom: 16 }}>What kind of baseball experience was this?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CATEGORY_CARDS.map(card => (
              <button
                key={card.value}
                onClick={() => selectCategory(card.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderRadius: 14, border: '1.5px solid #30363D', backgroundColor: '#0D1117', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{card.emoji}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3' }}>{card.label}</div>
                  <div style={{ fontSize: 12, color: '#8B949E' }}>{card.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )
    }

    if (step === 'location') {
      return (
        <>
          <button onClick={() => setStep('category')} style={{ fontSize: 13, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20 }}>← Back</button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── Minor League ── */}
            {category === 'minor_league' && (
              <>
                <div>
                  <FieldLabel>Stadium</FieldLabel>
                  {!useCustomVenue && (
                    <SelectWrap>
                      <select value={selectedMlsId} onChange={e => setSelectedMlsId(e.target.value)} style={sel}>
                        <option value="">Select a stadium…</option>
                        {minorLeagueStadiums.map(s => (
                          <option key={s.id} value={s.id}>{s.name} — {s.team} ({s.level})</option>
                        ))}
                      </select>
                    </SelectWrap>
                  )}
                  {useCustomVenue && (
                    <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Venue / ballpark name" style={inp} />
                  )}
                  <button
                    onClick={() => { setUseCustomVenue(v => !v); setSelectedMlsId('') }}
                    style={{ fontSize: 12, color: '#1F6FEB', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', textDecoration: 'underline' }}
                  >
                    {useCustomVenue ? '← Pick from list' : "Don't see your stadium? Add it"}
                  </button>
                </div>
                {useCustomVenue && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 2 }}>
                      <FieldLabel>City</FieldLabel>
                      <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={inp} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FieldLabel>State</FieldLabel>
                      <input type="text" value={state} onChange={e => setState(e.target.value)} placeholder="WA" maxLength={2} style={{ ...inp, textTransform: 'uppercase' }} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── MLB Special Event ── */}
            {category === 'mlb_special_event' && (
              <>
                <div>
                  <FieldLabel>Event Type *</FieldLabel>
                  <SelectWrap>
                    <select value={eventType} onChange={e => setEventType(e.target.value)} style={sel}>
                      <option value="">Select event type…</option>
                      {MLB_SPECIAL_EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </SelectWrap>
                </div>
                <div>
                  <FieldLabel>Stadium (optional)</FieldLabel>
                  <SelectWrap>
                    <select value={selectedMlbStadiumId} onChange={e => setSelectedMlbStadiumId(e.target.value)} style={sel}>
                      <option value="">Select stadium…</option>
                      {mlbStadiums.map(s => (
                        <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
                      ))}
                    </select>
                  </SelectWrap>
                </div>
                {selectedMlbStadiumId && (
                  <div
                    onClick={() => setCountAsChase30(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${countAsChase30 ? '#1F6FEB' : '#30363D'}`, backgroundColor: countAsChase30 ? 'rgba(31,111,235,0.08)' : '#0D1117', cursor: 'pointer' }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${countAsChase30 ? '#1F6FEB' : '#30363D'}`, backgroundColor: countAsChase30 ? '#1F6FEB' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {countAsChase30 && <Check size={11} color="#fff" />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>Count as Chase 30 visit</div>
                      <div style={{ fontSize: 11, color: '#8B949E' }}>Also logs this as an MLB stadium visit</div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Spring Training ── */}
            {category === 'spring_training' && (
              <>
                <div>
                  <FieldLabel>Team *</FieldLabel>
                  <SelectWrap>
                    <select value={springTeam} onChange={e => setSpringTeam(e.target.value)} style={sel}>
                      <option value="">Select team…</option>
                      {SPRING_TRAINING_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </SelectWrap>
                </div>
                <div>
                  <FieldLabel>Spring Training Facility</FieldLabel>
                  <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Peoria Sports Complex" style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 2 }}>
                    <FieldLabel>City</FieldLabel>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={inp} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>State</FieldLabel>
                    <input type="text" value={state} onChange={e => setState(e.target.value)} placeholder="AZ" maxLength={2} style={{ ...inp, textTransform: 'uppercase' }} />
                  </div>
                </div>
              </>
            )}

            {/* ── Pilgrimage ── */}
            {category === 'pilgrimage' && (
              <>
                <div>
                  <FieldLabel>Destination *</FieldLabel>
                  <SelectWrap>
                    <select value={pilgrimageVenue} onChange={e => setPilgrimageVenue(e.target.value)} style={sel}>
                      <option value="">Select destination…</option>
                      {PILGRIMAGE_DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </SelectWrap>
                </div>
                {pilgrimageVenue === 'Other' && (
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <input type="text" value={customPilgrimageVenue} onChange={e => setCustomPilgrimageVenue(e.target.value)} placeholder="Venue / destination name" style={inp} />
                  </div>
                )}
              </>
            )}

            {/* Date — all categories */}
            <div>
              <FieldLabel>Date *</FieldLabel>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} style={inp} />
            </div>

            {error && <div style={{ fontSize: 13, color: '#F85149', padding: '8px 12px', background: 'rgba(248,81,73,0.08)', borderRadius: 8 }}>{error}</div>}

            <button onClick={locationNext} style={{ padding: '13px 0', borderRadius: 12, border: 'none', backgroundColor: '#1F6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Continue →
            </button>
          </div>
        </>
      )
    }

    if (step === 'game_details') {
      return (
        <>
          <button onClick={() => setStep('location')} style={{ fontSize: 13, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20 }}>← Back</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FieldLabel>Opponent</FieldLabel>
              <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="e.g. Tri-City Dust Devils" style={inp} />
            </div>
            <div>
              <FieldLabel>Final Score</FieldLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="Home" min="0" style={{ ...inp, flex: 1 }} />
                <span style={{ color: '#8B949E', fontWeight: 700 }}>—</span>
                <input type="number" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="Away" min="0" style={{ ...inp, flex: 1 }} />
              </div>
            </div>
            <div>
              <FieldLabel>First Pitch</FieldLabel>
              <input type="time" value={gameTime} onChange={e => setGameTime(e.target.value)} style={inp} />
            </div>
            <div>
              <FieldLabel>Seat Info (optional)</FieldLabel>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={section} onChange={e => setSection(e.target.value)} placeholder="Section" style={{ ...inp, flex: 1 }} />
                <input type="text" value={row} onChange={e => setRow(e.target.value)} placeholder="Row" style={{ ...inp, flex: 1 }} />
                <input type="text" value={seats} onChange={e => setSeats(e.target.value)} placeholder="Seat(s)" style={{ ...inp, flex: 2 }} />
              </div>
            </div>
            <div>
              <FieldLabel>Ticket Confirmation # (optional)</FieldLabel>
              <input type="text" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Confirmation number" style={inp} />
            </div>
            <div>
              <FieldLabel>Game Day Moments</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {MOMENTS.map(m => {
                  const active = selectedMoments.includes(m)
                  return (
                    <button
                      key={m}
                      onClick={() => toggleMoment(m)}
                      style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? 'rgba(31,111,235,0.5)' : '#30363D'}`, backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent', color: active ? '#58A6FF' : '#8B949E', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {active && <Check size={11} />}{m}
                    </button>
                  )
                })}
              </div>
            </div>
            <button onClick={gameDetailsNext} style={{ padding: '13px 0', borderRadius: 12, border: 'none', backgroundColor: '#1F6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Continue →
            </button>
          </div>
        </>
      )
    }

    if (step === 'notes') {
      return (
        <>
          <button onClick={() => setStep(isGame ? 'game_details' : 'location')} style={{ fontSize: 13, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20 }}>← Back</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FieldLabel>Notes (optional)</FieldLabel>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder="Memories, observations, anything you want to remember…"
                style={{ ...inp, resize: 'vertical' }}
              />
            </div>
            {error && <div style={{ fontSize: 13, color: '#F85149', padding: '8px 12px', background: 'rgba(248,81,73,0.08)', borderRadius: 8 }}>{error}</div>}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '13px 0', borderRadius: 12, border: 'none', backgroundColor: saving ? '#30363D' : '#1F6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : `${categoryConfig?.emoji} Log ${categoryConfig?.label}`}
            </button>
          </div>
        </>
      )
    }

    if (step === 'success') {
      const cat = CATEGORY_CARDS.find(c => c.value === category)
      const displayVenue = (() => {
        if (category === 'pilgrimage') return pilgrimageVenue === 'Other' ? customPilgrimageVenue : pilgrimageVenue
        if (category === 'spring_training') return venue || springTeam
        if (category === 'minor_league' && !useCustomVenue) return minorLeagueStadiums.find(s => s.id === selectedMlsId)?.name ?? venue
        return venue
      })()
      return (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3', marginBottom: 6 }}>Logged!</div>
          <div style={{ fontSize: 14, color: '#8B949E', marginBottom: 4 }}>
            {cat?.emoji} {cat?.label}
          </div>
          {displayVenue && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', marginBottom: 4 }}>{displayVenue}</div>
          )}
          <div style={{ fontSize: 13, color: '#8B949E', marginBottom: 28 }}>
            {visitDate ? new Date(visitDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
          </div>
          <button
            onClick={() => { onSaved(); onClose() }}
            style={{ padding: '12px 32px', borderRadius: 12, border: 'none', backgroundColor: '#1F6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      )
    }
  }

  const stepTitle = () => {
    if (step === 'category') return 'Log Baseball Life Entry'
    if (step === 'location') return `${categoryConfig?.emoji} ${categoryConfig?.label}`
    if (step === 'game_details') return 'Game Details'
    if (step === 'notes') return 'Notes'
    if (step === 'success') return 'Logged!'
    return ''
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
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, backgroundColor: '#161B22', zIndex: 1, padding: '14px 20px 10px', borderBottom: '1px solid #30363D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#30363D' }} />
          <div style={{ position: 'absolute', left: 16, fontSize: 15, fontWeight: 800, color: '#E6EDF3' }}>{stepTitle()}</div>
          {step !== 'success' && (
            <button onClick={onClose} style={{ position: 'absolute', right: 16, width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(139,148,158,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color="#8B949E" />
            </button>
          )}
        </div>

        {/* Step indicator (not on category or success) */}
        {step !== 'category' && step !== 'success' && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 20px 0' }}>
            {(['location', ...(isGame ? ['game_details'] : []), 'notes'] as Step[]).map((s, i) => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: ['location', 'game_details', 'notes'].indexOf(step) >= i ? '#1F6FEB' : '#30363D' }} />
            ))}
          </div>
        )}

        <div style={{ padding: '20px 20px 40px' }}>
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
