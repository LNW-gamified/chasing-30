'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Check, ChevronDown, Camera, Plus, ImagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { BaseballLifeCategory } from '@/types'
import { GAME_MOMENTS } from '@/lib/moments'

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


// ── Types ─────────────────────────────────────────────────────────────────────

interface MinorLeagueStadium {
  id: string
  name: string
  team: string
  city: string
  state: string
  level: string
  affiliate: string
  milb_team_id: number | null
}

interface MiLBPastGame {
  gamePk: number
  date: string
  label: string
  opponent: string
}

async function fetchMiLBPastGames(milbTeamId: number): Promise<MiLBPastGame[]> {
  const today = new Date().toISOString().split('T')[0]
  const year  = new Date().getFullYear()
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=13&teamId=${milbTeamId}&startDate=${year}-01-01&endDate=${today}`
    )
    if (!res.ok) return []
    const data = await res.json()
    const games: MiLBPastGame[] = []
    for (const d of data.dates ?? []) {
      for (const g of d.games ?? []) {
        if (g.status?.abstractGameState !== 'Final') continue
        if (g.teams?.home?.team?.id !== milbTeamId) continue
        const opponent = g.teams?.away?.team?.name ?? 'Unknown'
        const dt = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        games.push({ gamePk: g.gamePk, date: d.date, label: `${dt} · vs ${opponent}`, opponent })
      }
    }
    return games.reverse()
  } catch { return [] }
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
  defaultCategory?: BaseballLifeCategory
  defaultEventType?: string
  defaultMinorLeagueStadiumId?: string
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
    <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      <ChevronDown size={14} color="#8B949E" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BaseballLifeForm({ onClose, onSaved, defaultCategory, defaultEventType, defaultMinorLeagueStadiumId }: Props) {
  type Step = 'category' | 'location' | 'game_details' | 'notes' | 'success'
  const [step, setStep] = useState<Step>(defaultCategory ? 'location' : 'category')
  const [category, setCategory] = useState<BaseballLifeCategory | null>(defaultCategory ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Location step state
  const [minorLeagueStadiums, setMinorLeagueStadiums] = useState<MinorLeagueStadium[]>([])
  const [mlbStadiums, setMlbStadiums] = useState<MlbStadium[]>([])
  const [selectedMlsId, setSelectedMlsId] = useState<string>(defaultMinorLeagueStadiumId ?? '')   // minor_league_stadium_id
  const [useCustomVenue, setUseCustomVenue] = useState(false)
  const [venue, setVenue] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [eventType, setEventType] = useState(defaultEventType ?? '')
  const [selectedMlbStadiumId, setSelectedMlbStadiumId] = useState<string>('')
  const [countAsChase30, setCountAsChase30] = useState(false)
  const [springTeam, setSpringTeam] = useState('')
  // Pre-fill event type from prop
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

  // Giveaway items (minor_league only)
  const [giveawayItems,   setGiveawayItems]   = useState<Array<{ name: string; photo_url: string | null }>>([])
  const [foodItems, setFoodItems] = useState<Array<{ name: string; category: string; rating: number | null; photoFile: File | null; photoPreview: string | null }>>([])
  const [companions, setCompanions] = useState<string[]>([])
  const [companionInput, setCompanionInput] = useState('')
  const [giveawayInput,   setGiveawayInput]   = useState('')
  const [uploadingIdx,    setUploadingIdx]    = useState<Record<number, boolean>>({})

  // MiLB past-game picker (minor_league only)
  const [miLBGames,        setMiLBGames]        = useState<MiLBPastGame[]>([])
  const [miLBGamesLoading, setMiLBGamesLoading] = useState(false)
  const [selectedMiLBPk,   setSelectedMiLBPk]   = useState<number | null>(null)

  const categoryConfig = CATEGORY_CARDS.find(c => c.value === category)
  const isGame = categoryConfig?.isGame ?? true

  // Load stadiums when form opens
  useEffect(() => {
    const supabase = createClient()
    supabase.from('minor_league_stadiums').select('id,name,team,city,state,level,affiliate,milb_team_id').order('name')
      .then(({ data }) => setMinorLeagueStadiums(data ?? []))
    supabase.from('stadiums').select('id,name,team,abbreviation,city,state').order('name')
      .then(({ data }) => setMlbStadiums(data ?? []))
  }, [])

  useEffect(() => {
    if (category !== 'minor_league' || !selectedMlsId || useCustomVenue) {
      setMiLBGames([])
      setSelectedMiLBPk(null)
      return
    }
    const stadium = minorLeagueStadiums.find(s => s.id === selectedMlsId)
    if (!stadium?.milb_team_id) { setMiLBGames([]); return }
    setMiLBGames([])
    setSelectedMiLBPk(null)
    setMiLBGamesLoading(true)
    fetchMiLBPastGames(stadium.milb_team_id)
      .then(setMiLBGames)
      .finally(() => setMiLBGamesLoading(false))
  }, [selectedMlsId, useCustomVenue, category, minorLeagueStadiums])

  function toggleMoment(m: string) {
    setSelectedMoments(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function addGiveawayItem() {
    const name = giveawayInput.trim()
    if (!name) return
    setGiveawayItems(prev => [...prev, { name, photo_url: null }])
    setGiveawayInput('')
  }

  function removeGiveawayItem(idx: number) {
    setGiveawayItems(prev => prev.filter((_, i) => i !== idx))
  }

  async function uploadGiveawayPhoto(idx: number, file: File) {
    setUploadingIdx(prev => ({ ...prev, [idx]: true }))
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('giveaway-photos').upload(path, file)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('giveaway-photos').getPublicUrl(path)
        setGiveawayItems(prev => prev.map((item, i) => i === idx ? { ...item, photo_url: publicUrl } : item))
      }
    } finally {
      setUploadingIdx(prev => { const n = { ...prev }; delete n[idx]; return n })
    }
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
      companions:            companions.length > 0 ? companions : null,
    }

    const { data: savedEntry, error: saveErr } = await supabase.from('baseball_life_entries').insert(payload).select('id').single()
    if (saveErr) { setError(saveErr.message); setSaving(false); return }

    if (category === 'minor_league' && resolvedMlsId && savedEntry?.id) {
      fetch('/api/autofill-milb-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: savedEntry.id, minorLeagueStadiumId: resolvedMlsId, visitDate }),
      }).catch(() => {})
    }

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

    for (const item of foodItems) {
      if (!item.name.trim()) continue
      let photoUrl: string | null = null
      if (item.photoFile) {
        const ext = item.photoFile.name.split('.').pop()
        const path = `${savedEntry.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { data: uploadData } = await supabase.storage.from('food-photos').upload(path, item.photoFile)
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('food-photos').getPublicUrl(uploadData.path)
          photoUrl = urlData.publicUrl
        }
      }
      await supabase.from('collectible_log').insert({
        user_id: user.id,
        baseball_life_entry_id: savedEntry.id,
        name: item.name.trim(),
        category: 'food',
        rating: item.rating,
        photo_url: photoUrl,
      })
    }

    for (const item of giveawayItems) {
      if (!item.name.trim()) continue
      await supabase.from('collectible_log').insert({
        user_id: user.id,
        baseball_life_entry_id: savedEntry.id,
        name: item.name.trim(),
        category: 'giveaway',
        photo_url: item.photo_url,
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
          {!defaultCategory && <button onClick={() => setStep('category')} style={{ fontSize: 13, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20 }}>← Back</button>}

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

                {/* ── Past game picker ── */}
                {!useCustomVenue && selectedMlsId && (() => {
                  const stadium = minorLeagueStadiums.find(s => s.id === selectedMlsId)
                  if (!stadium?.milb_team_id) return null
                  return (
                    <div>
                      <FieldLabel>Pick a Past Game (optional)</FieldLabel>
                      {miLBGamesLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B949E', fontSize: 13 }}>
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading games…
                        </div>
                      ) : miLBGames.length === 0 ? (
                        <div style={{ fontSize: 13, color: '#8B949E', padding: '8px 12px', borderRadius: 8, border: '1px solid #30363D' }}>
                          No completed home games found this season — enter date below.
                        </div>
                      ) : (
                        <SelectWrap>
                          <select
                            value={selectedMiLBPk ?? ''}
                            onChange={e => {
                              const pk = parseInt(e.target.value)
                              if (isNaN(pk)) {
                                setSelectedMiLBPk(null)
                              } else {
                                setSelectedMiLBPk(pk)
                                const g = miLBGames.find(x => x.gamePk === pk)
                                if (g) { setVisitDate(g.date); setOpponent(g.opponent) }
                              }
                            }}
                            style={sel}
                          >
                            <option value="">— enter date manually —</option>
                            {miLBGames.map(g => (
                              <option key={g.gamePk} value={g.gamePk}>{g.label}</option>
                            ))}
                          </select>
                        </SelectWrap>
                      )}
                    </div>
                  )
                })()}

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
                      <div style={{ fontSize: 13, color: '#8B949E' }}>Also logs this as an MLB stadium visit</div>
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
                {GAME_MOMENTS.map(({ id, icon, label }) => {
                  const active = selectedMoments.includes(id)
                  return (
                    <button
                      key={id}
                      onClick={() => toggleMoment(id)}
                      style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? 'rgba(31,111,235,0.5)' : '#30363D'}`, backgroundColor: active ? 'rgba(31,111,235,0.12)' : 'transparent', color: active ? '#58A6FF' : '#8B949E', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {icon} {label}
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

            <div>
              <FieldLabel>Who Was There</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {companions.map((name, idx) => (
                  <span key={idx} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 20,
                    backgroundColor: 'rgba(31,111,235,0.1)', border: '1px solid rgba(31,111,235,0.3)',
                    fontSize: 13, color: '#58A6FF', fontWeight: 600,
                  }}>
                    {name}
                    <button type="button" onClick={() => setCompanions(companions.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#58A6FF', padding: 0, display: 'flex' }}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <input
                value={companionInput}
                onChange={e => setCompanionInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && companionInput.trim()) {
                    e.preventDefault()
                    if (!companions.includes(companionInput.trim())) {
                      setCompanions([...companions, companionInput.trim()])
                    }
                    setCompanionInput('')
                  }
                }}
                placeholder="Type a name and press Enter"
                style={{ ...inp }}
              />
            </div>

            {category === 'minor_league' && (
              <div>
                <FieldLabel>Giveaways &amp; Promotions (optional)</FieldLabel>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={giveawayInput}
                    onChange={e => setGiveawayInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGiveawayItem() } }}
                    placeholder="e.g. Bobblehead, T-Shirt, Hat…"
                    style={{ ...inp, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={addGiveawayItem}
                    disabled={!giveawayInput.trim()}
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #30363D', backgroundColor: giveawayInput.trim() ? '#1F6FEB' : '#1C2430', color: giveawayInput.trim() ? '#fff' : '#8B949E', cursor: giveawayInput.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, fontWeight: 600, fontSize: 13 }}
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
                {giveawayItems.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 14px', borderRadius: 10, backgroundColor: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)' }}>
                    {giveawayItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: '#F5A623', fontWeight: 600, flex: 1, minWidth: 0 }}>🎁 {item.name}</span>
                        {item.photo_url ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.photo_url} alt={item.name} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                            <label style={{ cursor: 'pointer', fontSize: 13, color: '#8B949E', fontWeight: 600 }}>
                              Replace
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadGiveawayPhoto(idx, f) }} />
                            </label>
                          </div>
                        ) : (
                          <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#8B949E', padding: '4px 8px', borderRadius: 6, border: '1px dashed #30363D', flexShrink: 0 }}>
                            {uploadingIdx[idx] ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={11} />}
                            {uploadingIdx[idx] ? 'Uploading…' : 'Photo'}
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadGiveawayPhoto(idx, f) }} />
                          </label>
                        )}
                        <button type="button" onClick={() => removeGiveawayItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', padding: 2, display: 'flex', flexShrink: 0 }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Food &amp; Drink</div>
              {foodItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px', borderRadius: 10, backgroundColor: '#1a2235', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={item.name}
                      onChange={e => { const u = [...foodItems]; u[idx] = { ...u[idx], name: e.target.value }; setFoodItems(u) }}
                      placeholder="e.g. Garlic Fries"
                      style={{ flex: 1, backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 13 }}
                    />
                    <select
                      value={item.category}
                      onChange={e => { const u = [...foodItems]; u[idx] = { ...u[idx], category: e.target.value }; setFoodItems(u) }}
                      style={{ backgroundColor: '#0D1117', border: '1px solid #30363D', borderRadius: 8, padding: '8px 10px', color: '#E6EDF3', fontSize: 13 }}
                    >
                      <option value="hot_dog">🌭 Hot Dog</option>
                      <option value="specialty">🍔 Specialty</option>
                      <option value="dessert">🍦 Dessert</option>
                      <option value="drink">🥤 Drink</option>
                      <option value="other">🍽️ Other</option>
                    </select>
                    <button type="button" onClick={() => setFoodItems(foodItems.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#F85149', cursor: 'pointer', padding: '0 6px' }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {[1,2,3,4,5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { const u = [...foodItems]; u[idx] = { ...u[idx], rating: item.rating === n ? null : n }; setFoodItems(u) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0, opacity: item.rating != null && n <= item.rating ? 1 : 0.25 }}
                      >⭐</button>
                    ))}
                    <label style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 13, color: '#8B949E', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ImagePlus size={14} /> {item.photoPreview ? 'Change' : 'Photo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return
                          const u = [...foodItems]; u[idx] = { ...u[idx], photoFile: f, photoPreview: URL.createObjectURL(f) }; setFoodItems(u)
                        }} />
                    </label>
                  </div>
                  {item.photoPreview && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.photoPreview} alt={item.name} style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFoodItems([...foodItems, { name: '', category: 'other', rating: null, photoFile: null, photoPreview: null }])}
                style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed #30363D', background: 'none', color: '#8B949E', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >+ Add Food or Drink</button>
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
