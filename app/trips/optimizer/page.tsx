'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TeamLogo from '@/components/TeamLogo'
import { formatDate } from '@/lib/utils'
import type { Stadium } from '@/types'
import Link from 'next/link'
import { ArrowLeft, MapPin, Calendar, Zap, Clock, Plus, Loader2, AlertCircle, CheckCircle2, ChevronRight, Search, Car } from 'lucide-react'
import { TEAM_PRIMARY } from '@/lib/team-colors'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DIFFICULTY_STYLES: Record<string, { color: string; bg: string; icon: typeof Zap }> = {
  'Road Warrior': { color: '#F85149', bg: 'rgba(248,81,73,0.1)', icon: Zap },
  'On the Move':  { color: '#F5A623', bg: 'rgba(245,166,35,0.1)', icon: Clock },
  'Leisure Tour': { color: '#3FB950', bg: 'rgba(63,185,80,0.1)',  icon: MapPin },
}

const ABBR_TO_NICKNAME: Record<string, string> = {
  ARI: 'D-backs',   ATL: 'Braves',    BAL: 'Orioles',   BOS: 'Red Sox',
  CHC: 'Cubs',      CWS: 'White Sox', CIN: 'Reds',      CLE: 'Guardians',
  COL: 'Rockies',   DET: 'Tigers',    HOU: 'Astros',    KC:  'Royals',
  LAA: 'Angels',    LAD: 'Dodgers',   MIA: 'Marlins',   MIL: 'Brewers',
  MIN: 'Twins',     NYM: 'Mets',      NYY: 'Yankees',   OAK: 'Athletics',
  PHI: 'Phillies',  PIT: 'Pirates',   SD:  'Padres',    SF:  'Giants',
  SEA: 'Mariners',  STL: 'Cardinals', TB:  'Rays',      TEX: 'Rangers',
  TOR: 'Blue Jays', WSH: 'Nationals',
}


interface TripStop {
  stadiumId: string
  stadiumName: string
  team: string
  abbreviation: string
  gameDate: string
  gameTime: string
  opponentName: string
  opponentTeamId: number
  dayOfTrip: number
  gapToNext: number | null
  distFromPrev: number
  driveMinFromPrev: number
}

interface TripOption {
  startDate: string
  endDate: string
  totalDays: number
  stops: TripStop[]
  avgGapDays: number
  difficulty: 'Road Warrior' | 'On the Move' | 'Leisure Tour'
  score: number
  totalDistanceMiles: number
}

function formatDriveTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function OptimizerPage() {
  const router = useRouter()
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [startingAbbr, setStartingAbbr] = useState<string | null>(null)
  const [numDays, setNumDays] = useState('7')
  const [startMonth, setStartMonth] = useState(3)   // April (0-indexed)
  const [endMonth, setEndMonth] = useState(8)        // September
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<TripOption[] | null>(null)
  const [totalFound, setTotalFound] = useState<number>(0)
  const [creating, setCreating] = useState<number | null>(null)
  const [created, setCreated] = useState<number | null>(null)

  useEffect(() => {
    createClient().from('stadiums').select('*').order('league').order('division').order('name')
      .then(({ data }) => setStadiums(data ?? []))
  }, [])

  function toggleTeam(abbr: string) {
    const isRemoving = selected.has(abbr)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(abbr) ? next.delete(abbr) : next.add(abbr)
      return next
    })
    if (isRemoving && startingAbbr === abbr) setStartingAbbr(null)
  }

  async function handleFind() {
    if (!startingAbbr) { setError('Select a starting stadium first.'); return }
    if (selected.size < 2) { setError('Select at least 2 teams (including your starting stadium).'); return }
    setLoading(true)
    setError(null)
    setResults(null)

    const pad = (n: number) => String(n).padStart(2, '0')
    const startDate = `${year}-${pad(startMonth + 1)}-01`
    const lastDay = new Date(year, endMonth + 1, 0).getDate()
    const endDate = `${year}-${pad(endMonth + 1)}-${lastDay}`

    const selectedStadiums = stadiums.filter(s => selected.has(s.abbreviation))

    try {
      const res = await fetch('/api/trip-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          abbreviations: [...selected],
          stadiums: selectedStadiums.map(s => ({
            id: s.id,
            abbreviation: s.abbreviation,
            name: s.name,
            team: s.team,
            lat: s.lat,
            lng: s.lng,
          })),
          numDays: Math.min(30, Math.max(2, parseInt(numDays) || 2)),
          startDate,
          endDate,
          startingAbbr,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to find trips.')
      } else {
        const opts = data.options ?? []
        setResults(opts)
        setTotalFound(data.total ?? opts.length)
      }
    } catch {
      setError('Network error — check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function createTrip(option: TripOption, idx: number) {
    setCreating(idx)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const firstStop = option.stops[0]
    const firstCity = stadiums.find(s => s.abbreviation === firstStop.abbreviation)?.city
      ?? firstStop.team
    const tripPayload = {
      name: firstCity,
      start_date: option.startDate,
      end_date: option.endDate,
      status: 'planned' as const,
      stadium_id: option.stops[0]?.stadiumId ?? null,
      trip_date: null,
      est_tickets: 0,
      est_travel: 0,
      est_hotel: 0,
      est_food: 0,
      est_parking: 0,
      actual_tickets: 0,
      actual_travel: 0,
      actual_hotel: 0,
      actual_food: 0,
      actual_parking: 0,
      notes: `Generated by Road Trip Optimizer · ${option.difficulty}`,
      created_by: user?.id ?? null,
    }

    const { data: trip, error: tripErr } = await supabase
      .from('trips').insert(tripPayload).select('id').single()

    if (tripErr || !trip) { setCreating(null); return }

    await supabase.from('trip_stops').insert(
      option.stops.map((stop, i) => ({
        trip_id: trip.id,
        stadium_id: stop.stadiumId,
        game_date: stop.gameDate,
        game_time: stop.gameTime || null,
        opponent: stop.opponentName || null,
        opponent_team_id: stop.opponentTeamId || null,
        sort_order: i,
        est_tickets: 0,
        est_food: 0,
        est_parking: 0,
        actual_tickets: 0,
        actual_food: 0,
        actual_parking: 0,
        notes: null,
      }))
    )

    setCreating(null)
    router.push(`/trips/${trip.id}`)
  }

  const divisions = [
    { label: 'AL East',    league: 'AL', division: 'East' },
    { label: 'AL Central', league: 'AL', division: 'Central' },
    { label: 'AL West',    league: 'AL', division: 'West' },
    { label: 'NL East',    league: 'NL', division: 'East' },
    { label: 'NL Central', league: 'NL', division: 'Central' },
    { label: 'NL West',    league: 'NL', division: 'West' },
  ]

  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear + 1]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/trips" className="p-2 rounded-lg" style={{ color: '#8B949E', backgroundColor: 'rgba(255,255,255,0.04)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: '#E6EDF3' }}>Road Trip Optimizer</h1>
          <p className="text-base mt-0.5" style={{ color: '#8B949E' }}>
            Find the perfect window to see multiple teams in one trip
          </p>
        </div>
      </div>

      {/* Team selection */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold" style={{ color: '#E6EDF3' }}>Select Teams to Visit</div>
          <div className="text-base" style={{ color: '#8B949E' }}>
            {selected.size} selected
            {selected.size > 0 && (
              <button
                onClick={() => { setSelected(new Set()); setStartingAbbr(null) }}
                className="ml-2 text-base"
                style={{ color: '#1F6FEB' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {divisions.map(({ label, league, division }) => {
            const divTeams = stadiums.filter(s => s.league === league && s.division === division)
            return (
              <div key={label}>
                <div className="text-sm font-bold uppercase tracking-widest mb-2 pb-1" style={{ color: '#8B949E', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {label}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {divTeams.map(s => {
                    const isOn = selected.has(s.abbreviation)
                    const primary = TEAM_PRIMARY[s.abbreviation] ?? '#1F6FEB'
                    return (
                      <button
                        key={s.abbreviation}
                        type="button"
                        onClick={() => toggleTeam(s.abbreviation)}
                        className="relative flex items-center gap-2.5 rounded-xl text-left transition-all"
                        style={{
                          padding: '10px 12px',
                          border: isOn ? `2px solid ${primary}` : '1px solid rgba(255,255,255,0.08)',
                          backgroundColor: isOn ? `${primary}18` : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                        }}
                      >
                        <TeamLogo abbreviation={s.abbreviation} size={36} style={{ borderRadius: 6, flexShrink: 0 }} />
                        <div className="min-w-0">
                          <div className="truncate" style={{ fontSize: 14, fontWeight: 800, color: isOn ? '#E6EDF3' : '#C9D1D9', lineHeight: 1.2 }}>
                            {ABBR_TO_NICKNAME[s.abbreviation] ?? s.abbreviation}
                          </div>
                          <div className="truncate mt-0.5" style={{ fontSize: 12, color: '#8B949E' }}>
                            {s.city}
                          </div>
                        </div>
                        {isOn && (
                          <div className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full w-4 h-4" style={{ backgroundColor: primary }}>
                            <CheckCircle2 size={10} style={{ color: '#fff' }} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Starting Stadium */}
      {selected.size > 0 && (
        <div className="card p-5 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={15} style={{ color: '#F5A623' }} />
            <div className="text-lg font-bold" style={{ color: '#E6EDF3' }}>Starting Stadium</div>
          </div>
          <div className="text-sm mb-4" style={{ color: '#8B949E' }}>
            Pick where your road trip begins — this is always Stop 1
          </div>
          <div className="flex flex-wrap gap-2">
            {[...selected].map(abbr => {
              const s = stadiums.find(st => st.abbreviation === abbr)
              if (!s) return null
              const isStart = startingAbbr === abbr
              const primary = TEAM_PRIMARY[abbr] ?? '#1F6FEB'
              return (
                <button
                  key={abbr}
                  type="button"
                  onClick={() => setStartingAbbr(isStart ? null : abbr)}
                  className="relative flex items-center gap-2 rounded-xl transition-all"
                  style={{
                    padding: '8px 12px',
                    border: isStart ? `2px solid ${primary}` : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: isStart ? `${primary}18` : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                  }}
                >
                  <TeamLogo abbreviation={abbr} size={28} style={{ borderRadius: 5, flexShrink: 0 }} />
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: 13, fontWeight: 800, color: isStart ? '#E6EDF3' : '#C9D1D9', lineHeight: 1.2 }}>
                      {ABBR_TO_NICKNAME[abbr] ?? abbr}
                    </div>
                    <div className="truncate" style={{ fontSize: 11, color: '#6E7681' }}>{s.city}</div>
                  </div>
                  {isStart && (
                    <div className="absolute top-1 right-1 flex items-center justify-center rounded-full w-4 h-4" style={{ backgroundColor: primary }}>
                      <MapPin size={9} style={{ color: '#fff' }} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Parameters */}
      <div className="card p-5 mb-5">
        <div className="text-lg font-bold mb-4" style={{ color: '#E6EDF3' }}>Trip Parameters</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Year</label>
            <select className="input" value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Max Days</label>
            <input
              type="number"
              className="input"
              min={2}
              max={30}
              value={numDays}
              onChange={e => setNumDays(e.target.value)}
              onBlur={e => {
                const n = Math.min(30, Math.max(2, parseInt(e.target.value) || 2))
                setNumDays(String(n))
              }}
            />
          </div>
          <div>
            <label className="label">From Month</label>
            <select className="input" value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To Month</label>
            <select className="input" value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Find button */}
      <button
        onClick={handleFind}
        disabled={loading || selected.size < 2 || !startingAbbr}
        className="btn-primary w-full mb-6"
        style={{ justifyContent: 'center', padding: '0.75rem', fontSize: '1rem' }}
      >
        {loading ? (
          <><Loader2 size={18} className="animate-spin" /> Finding optimal windows...</>
        ) : (
          <><Calendar size={18} /> Find Best Trip Windows</>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="card p-4 mb-5 flex items-start gap-3" style={{ borderColor: 'rgba(248,81,73,0.3)', backgroundColor: 'rgba(248,81,73,0.06)' }}>
          <AlertCircle size={18} style={{ color: '#F85149', flexShrink: 0, marginTop: 1 }} />
          <div className="text-base" style={{ color: '#F85149' }}>{error}</div>
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div>
          {results.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="flex justify-center mb-3">
                <Search size={40} color="#484F58" strokeWidth={1.5} />
              </div>
              <div className="text-lg font-semibold mb-1" style={{ color: '#8B949E' }}>No windows found</div>
              <div className="text-base" style={{ color: '#8B949E' }}>
                Try expanding your date range, increasing max days, or selecting fewer teams.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline gap-3">
                <div className="text-lg font-bold" style={{ color: '#E6EDF3' }}>
                  Trip Windows
                </div>
                <div className="text-sm" style={{ color: '#8B949E' }}>
                  Showing {results.length} of {totalFound} window{totalFound !== 1 ? 's' : ''} found
                </div>
              </div>
              {results.map((opt, idx) => {
                const diff = DIFFICULTY_STYLES[opt.difficulty]
                const DiffIcon = diff.icon
                const isDone = created === idx

                return (
                  <div
                    key={idx}
                    className="card overflow-hidden"
                    style={{ borderLeft: idx === 0 ? '3px solid #1F6FEB' : '3px solid rgba(255,255,255,0.06)' }}
                  >
                    {/* Option header */}
                    <div className="p-5 pb-3">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          {idx === 0 && (
                            <span className="badge badge-blue text-base font-bold">Soonest</span>
                          )}
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-base font-semibold"
                            style={{ backgroundColor: diff.bg, color: diff.color }}
                          >
                            <DiffIcon size={13} />
                            {opt.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold" style={{ backgroundColor: 'rgba(245,166,35,0.12)', color: '#F5A623' }}>
                            {opt.stops.length} game{opt.stops.length !== 1 ? 's' : ''} in {opt.totalDays} day{opt.totalDays !== 1 ? 's' : ''}
                          </span>
                          <span className="text-sm" style={{ color: '#6E7681' }}>
                            avg {opt.avgGapDays.toFixed(1)} days between games
                          </span>
                        </div>
                      </div>

                      <div className="text-xl font-black mb-1" style={{ color: '#E6EDF3' }}>
                        {formatDate(opt.startDate)} → {formatDate(opt.endDate)}
                      </div>
                    </div>

                    {/* Itinerary timeline */}
                    <div className="px-5 pb-4">
                      <div className="flex flex-col gap-2">
                        {opt.stops.map((stop, si) => {
                          const gapDays = stop.gapToNext

                          return (
                            <div key={si}>
                              <div
                                className="flex items-center gap-3 p-3 rounded-xl"
                                style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                              >
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{
                                    backgroundColor: si === 0 ? 'rgba(245,166,35,0.15)' : 'rgba(31,111,235,0.12)',
                                    color: si === 0 ? '#F5A623' : '#1F6FEB',
                                    fontWeight: 900,
                                    fontSize: si === 0 ? undefined : 14,
                                  }}
                                >
                                  {si === 0 ? <MapPin size={15} /> : si + 1}
                                </div>
                                <TeamLogo abbreviation={stop.abbreviation} size={32} style={{ borderRadius: 6 }} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-base font-bold truncate" style={{ color: '#E6EDF3' }}>
                                    {stop.stadiumName}
                                  </div>
                                  <div className="text-base" style={{ color: '#8B949E' }}>
                                    {stop.team}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-sm font-semibold" style={{ color: '#C9D1D9' }}>
                                    {formatDate(stop.gameDate)}
                                  </div>
                                  {stop.gameTime && (
                                    <div className="text-sm font-semibold" style={{ color: '#F5A623' }}>
                                      {stop.gameTime}
                                    </div>
                                  )}
                                  <div className="text-xs" style={{ color: '#6E7681' }}>
                                    Day {stop.dayOfTrip}
                                  </div>
                                </div>
                              </div>
                              {gapDays !== null && (() => {
                                const nextStop = opt.stops[si + 1]
                                const driveMi = nextStop?.distFromPrev ?? 0
                                const driveMin = nextStop?.driveMinFromPrev ?? 0
                                return (
                                  <div className="flex items-center gap-1.5 py-1.5 pl-11" style={{ color: '#6E7681', fontSize: 12 }}>
                                    <div className="border-l border-dashed mr-1" style={{ borderColor: 'rgba(255,255,255,0.1)', height: 16 }} />
                                    <Car size={12} style={{ flexShrink: 0 }} />
                                    <span>{driveMi.toLocaleString()} mi · ~{formatDriveTime(driveMin)}</span>
                                    <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                                    <span>{gapDays} day{gapDays !== 1 ? 's' : ''} gap</span>
                                  </div>
                                )
                              })()}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Total distance */}
                    <div className="px-5 pb-3 flex items-center gap-2" style={{ color: '#6E7681', fontSize: 13 }}>
                      <MapPin size={13} style={{ flexShrink: 0 }} />
                      <span>~{opt.totalDistanceMiles.toLocaleString()} miles total driving</span>
                    </div>

                    {/* Create button */}
                    <div className="px-5 pb-5">
                      {isDone ? (
                        <div className="flex items-center gap-2 text-base font-semibold" style={{ color: '#3FB950' }}>
                          <CheckCircle2 size={16} />
                          Trip created!{' '}
                          <Link href="/trips" style={{ color: '#1F6FEB' }}>
                            View in Trip Planner →
                          </Link>
                        </div>
                      ) : (
                        <button
                          onClick={() => createTrip(opt, idx)}
                          disabled={creating !== null}
                          className="btn-primary"
                          style={{ backgroundColor: idx === 0 ? '#1F6FEB' : 'rgba(31,111,235,0.6)' }}
                        >
                          {creating === idx ? (
                            <><Loader2 size={15} className="animate-spin" /> Creating...</>
                          ) : (
                            <><Plus size={15} /> Create This Trip</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
