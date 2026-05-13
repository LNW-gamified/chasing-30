'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import TeamLogo from '@/components/TeamLogo'
import { formatDate } from '@/lib/utils'
import type { Stadium } from '@/types'
import Link from 'next/link'
import { ArrowLeft, MapPin, Calendar, Zap, Clock, Plus, Loader2, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'

const HOME_CITIES = [
  { label: 'New York, NY',       lat: 40.7128, lng: -74.0060 },
  { label: 'Los Angeles, CA',    lat: 34.0522, lng: -118.2437 },
  { label: 'Chicago, IL',        lat: 41.8781, lng: -87.6298 },
  { label: 'Houston, TX',        lat: 29.7604, lng: -95.3698 },
  { label: 'Phoenix, AZ',        lat: 33.4484, lng: -112.0740 },
  { label: 'Philadelphia, PA',   lat: 39.9526, lng: -75.1652 },
  { label: 'San Antonio, TX',    lat: 29.4241, lng: -98.4936 },
  { label: 'San Diego, CA',      lat: 32.7157, lng: -117.1611 },
  { label: 'Dallas, TX',         lat: 32.7767, lng: -96.7970 },
  { label: 'San Francisco, CA',  lat: 37.7749, lng: -122.4194 },
  { label: 'Seattle, WA',        lat: 47.6062, lng: -122.3321 },
  { label: 'Denver, CO',         lat: 39.7392, lng: -104.9903 },
  { label: 'Boston, MA',         lat: 42.3601, lng: -71.0589 },
  { label: 'Atlanta, GA',        lat: 33.7490, lng: -84.3880 },
  { label: 'Miami, FL',          lat: 25.7617, lng: -80.1918 },
  { label: 'Minneapolis, MN',    lat: 44.9778, lng: -93.2650 },
  { label: 'St. Louis, MO',      lat: 38.6270, lng: -90.1994 },
  { label: 'Baltimore, MD',      lat: 39.2904, lng: -76.6122 },
  { label: 'Pittsburgh, PA',     lat: 40.4406, lng: -79.9959 },
  { label: 'Detroit, MI',        lat: 42.3314, lng: -83.0458 },
  { label: 'Kansas City, MO',    lat: 39.0997, lng: -94.5786 },
  { label: 'Milwaukee, WI',      lat: 43.0389, lng: -87.9065 },
  { label: 'Cincinnati, OH',     lat: 39.1031, lng: -84.5120 },
  { label: 'Cleveland, OH',      lat: 41.4993, lng: -81.6944 },
  { label: 'Tampa, FL',          lat: 27.9506, lng: -82.4572 },
  { label: 'Toronto, ON',        lat: 43.6532, lng: -79.3832 },
  { label: 'Arlington, TX',      lat: 32.7357, lng: -97.1081 },
  { label: 'Oakland, CA',        lat: 37.8044, lng: -122.2712 },
]

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

const TEAM_PRIMARY: Record<string, string> = {
  ARI: '#A71930', ATL: '#CE1141', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#C4CED4', CIN: '#C6011F', CLE: '#E31937',
  COL: '#33006F', DET: '#0C2C56', HOU: '#EB6E1F', KC:  '#004687',
  LAA: '#BA0021', LAD: '#005A9C', MIA: '#00A3E0', MIL: '#FFC52F',
  MIN: '#D31145', NYM: '#FF5910', NYY: '#003087', OAK: '#EFB21E',
  PHI: '#E81828', PIT: '#FDB827', SD:  '#FFC425', SF:  '#FD5A1E',
  SEA: '#005C5C', STL: '#C41E3A', TB:  '#8FBCE6', TEX: '#C0111F',
  TOR: '#134A8E', WSH: '#AB0003',
}

interface TripStop {
  stadiumId: string
  stadiumName: string
  team: string
  abbreviation: string
  gameDate: string
  dayOfTrip: number
  gapToNext: number | null
}

interface TripOption {
  startDate: string
  endDate: string
  totalDays: number
  stops: TripStop[]
  avgGapDays: number
  difficulty: 'Road Warrior' | 'On the Move' | 'Leisure Tour'
  score: number
}

export default function OptimizerPage() {
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [numDays, setNumDays] = useState('7')
  const [startMonth, setStartMonth] = useState(3)   // April (0-indexed)
  const [endMonth, setEndMonth] = useState(8)        // September
  const [year, setYear] = useState(new Date().getFullYear())
  const [homeCityIdx, setHomeCityIdx] = useState(0)
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
    setSelected(prev => {
      const next = new Set(prev)
      next.has(abbr) ? next.delete(abbr) : next.add(abbr)
      return next
    })
  }

  async function handleFind() {
    if (selected.size < 2) { setError('Select at least 2 teams.'); return }
    setLoading(true)
    setError(null)
    setResults(null)

    const pad = (n: number) => String(n).padStart(2, '0')
    const startDate = `${year}-${pad(startMonth + 1)}-01`
    const lastDay = new Date(year, endMonth + 1, 0).getDate()
    const endDate = `${year}-${pad(endMonth + 1)}-${lastDay}`

    const homeCity = HOME_CITIES[homeCityIdx]
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
          homeLat: homeCity.lat,
          homeLng: homeCity.lng,
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

    const tripPayload = {
      name: `Road Trip — ${option.stops.map(s => s.abbreviation).join(', ')}`,
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
    setCreated(idx)
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
    <AppShell>
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
          <div className="text-lg font-bold" style={{ color: '#E6EDF3' }}>Select Teams</div>
          <div className="text-base" style={{ color: '#8B949E' }}>
            {selected.size} selected
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
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
        <div className="mt-4">
          <label className="label">Home City (starting point for routing)</label>
          <select className="input" value={homeCityIdx} onChange={e => setHomeCityIdx(Number(e.target.value))}>
            {HOME_CITIES.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Find button */}
      <button
        onClick={handleFind}
        disabled={loading || selected.size < 2}
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
              <div className="text-4xl mb-3">🔍</div>
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
                            <span className="badge badge-blue text-base font-bold">Best Option</span>
                          )}
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-base font-semibold"
                            style={{ backgroundColor: diff.bg, color: diff.color }}
                          >
                            <DiffIcon size={13} />
                            {opt.difficulty}
                          </span>
                        </div>
                        <div className="text-base font-semibold" style={{ color: '#8B949E' }}>
                          {opt.totalDays} day{opt.totalDays !== 1 ? 's' : ''} ·{' '}
                          {opt.stops.length} stadium{opt.stops.length !== 1 ? 's' : ''} ·{' '}
                          avg {opt.avgGapDays.toFixed(1)} days between games
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
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base font-black"
                                  style={{ backgroundColor: 'rgba(31,111,235,0.15)', color: '#1F6FEB' }}
                                >
                                  {si + 1}
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
                                  <div className="text-base font-semibold" style={{ color: '#8B949E' }}>
                                    {formatDate(stop.gameDate)}
                                  </div>
                                  <div className="text-base" style={{ color: '#4a5568' }}>
                                    Day {stop.dayOfTrip}
                                  </div>
                                </div>
                              </div>
                              {gapDays !== null && (
                                <div className="flex items-center gap-2 py-1 pl-14">
                                  <div className="flex-1 border-l-2 border-dashed h-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                                  <div className="text-base" style={{ color: '#4a5568' }}>
                                    {gapDays} day{gapDays !== 1 ? 's' : ''} travel
                                  </div>
                                  <ChevronRight size={12} style={{ color: '#4a5568' }} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
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
    </AppShell>
  )
}
