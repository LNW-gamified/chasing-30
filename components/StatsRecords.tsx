'use client'

import { useEffect, useState } from 'react'
import { Trophy, Sun } from 'lucide-react'
import { classifyDayNight, type DayNight } from '@/lib/sunrise-sunset'

// These two cards used to live on the achievements page as its "Personal
// Records" tab. They're stats, not achievements, so they moved here. They
// take slimmed-down rows (only the fields they read) so the full visit rows,
// which can carry large box score payloads, don't get serialized into the
// client bundle just to render a few superlatives.

export interface RecordVisit {
  id: string
  stadium_id: string
  visit_date: string
  first_pitch_time: string | null
  home_team: string | null
  visiting_team: string | null
  home_runs: number | null
  away_runs: number | null
  attendance: number | null
  temperature: number | null
  weather: string | null
  winning_pitcher: string | null
  losing_pitcher: string | null
  home_starter_name: string | null
  away_starter_name: string | null
}

export interface RecordStadium {
  id: string
  name: string
  abbreviation: string
  lat: number
  lng: number
}

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const cleanTeam = (t: string | null) => t?.replace(/^vs\.?\s+/i, '').trim() || null

const fmtMatchup = (v: RecordVisit) =>
  `${cleanTeam(v.visiting_team) ?? 'Away'} ${v.away_runs ?? '?'} · ${v.home_team ?? 'Home'} ${v.home_runs ?? '?'}`

// First visit wins ties, matching how these superlatives were picked before.
function best(visits: RecordVisit[], score: (v: RecordVisit) => number, higher = true): RecordVisit | null {
  return visits.reduce<RecordVisit | null>((top, v) => {
    if (top === null) return v
    return (higher ? score(v) > score(top) : score(v) < score(top)) ? v : top
  }, null)
}

interface Row {
  emoji: string
  label: string
  v: RecordVisit
  detail: string
  detail2: string | null
}

interface Props {
  visits: RecordVisit[]
  stadiums: RecordStadium[]
}

export function BestGamesCard({ visits, stadiums }: Props) {
  if (visits.length === 0) return null

  const stadiumFor = (v: RecordVisit) => stadiums.find(s => s.id === v.stadium_id)

  const asc = [...visits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))
  const firstGame = asc[0]
  const lastGame = asc.length > 1 ? asc[asc.length - 1] : null

  const scored = visits.filter(v => v.home_runs != null && v.away_runs != null)
  const margin = (v: RecordVisit) => Math.abs(v.home_runs! - v.away_runs!)
  const total = (v: RecordVisit) => v.home_runs! + v.away_runs!

  const biggestWin = best(scored, margin)
  const biggestLoss = best(scored.filter(v => v.home_runs! < v.away_runs!), v => v.away_runs! - v.home_runs!)
  const highestScore = best(scored, total)
  const lowestScore = best(scored.filter(v => total(v) > 0), total, false)
  const biggestCrowd = best(visits.filter(v => v.attendance != null), v => v.attendance!)
  const withTemp = visits.filter(v => v.temperature != null)
  const hottest = best(withTemp, v => v.temperature!)
  const coldest = best(withTemp, v => v.temperature!, false)

  const rows: Row[] = []
  rows.push({ emoji: '⭐', label: 'First Game', v: firstGame, detail: fmtMatchup(firstGame), detail2: null })
  if (lastGame) {
    rows.push({ emoji: '🗓️', label: 'Latest Game', v: lastGame, detail: fmtMatchup(lastGame), detail2: null })
  }
  if (biggestWin) {
    rows.push({
      emoji: '🎉', label: 'Biggest Blowout', v: biggestWin, detail: fmtMatchup(biggestWin),
      detail2: `${margin(biggestWin)}-run margin${biggestWin.winning_pitcher ? ` · W: ${biggestWin.winning_pitcher}` : ''}`,
    })
  }
  if (biggestLoss) {
    rows.push({
      emoji: '😬', label: 'Biggest Loss', v: biggestLoss, detail: fmtMatchup(biggestLoss),
      detail2: biggestLoss.losing_pitcher ? `L: ${biggestLoss.losing_pitcher}` : null,
    })
  }
  if (highestScore) {
    rows.push({
      emoji: '💣', label: 'Highest Scoring', v: highestScore, detail: fmtMatchup(highestScore),
      detail2: `${total(highestScore)} total runs`,
    })
  }
  if (lowestScore) {
    rows.push({
      emoji: '🎯', label: "Pitcher's Duel", v: lowestScore, detail: fmtMatchup(lowestScore),
      detail2: [lowestScore.home_starter_name, lowestScore.away_starter_name].filter(Boolean).join(' vs ') || null,
    })
  }
  if (biggestCrowd) {
    rows.push({
      emoji: '👥', label: 'Biggest Crowd', v: biggestCrowd, detail: fmtMatchup(biggestCrowd),
      detail2: `${biggestCrowd.attendance?.toLocaleString()} fans`,
    })
  }
  if (hottest) {
    rows.push({
      emoji: '🌡️', label: 'Hottest Game', v: hottest, detail: fmtMatchup(hottest),
      detail2: `${hottest.temperature}°F${hottest.weather ? ` · ${hottest.weather}` : ''}`,
    })
  }
  if (coldest && coldest.id !== hottest?.id) {
    rows.push({
      emoji: '🥶', label: 'Coldest Game', v: coldest, detail: fmtMatchup(coldest),
      detail2: `${coldest.temperature}°F${coldest.weather ? ` · ${coldest.weather}` : ''}`,
    })
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4" style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3' }}>
        <Trophy size={18} style={{ color: '#F5A623' }} />
        Best Games
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {rows.map(row => (
          <div key={row.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#0d1424' }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{row.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', marginBottom: 2 }}>{row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {stadiumFor(row.v)?.name ?? '-'} · {fmtDate(row.v.visit_date)}
              </div>
              <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>{row.detail}</div>
              {row.detail2 && <div style={{ fontSize: 13, color: '#8B949E', marginTop: 1 }}>{row.detail2}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DayNightCard({ visits, stadiums }: Props) {
  const [counts, setCounts] = useState<{ day: number; night: number; twilight: number } | null>(null)

  // Sunset-aware, not clock-time-only: classifyDayNight looks up the real
  // sunset for each stadium and date, so a 6:42 PM Seattle game in May reads
  // as the daylight it actually was. It's async, hence the effect.
  useEffect(() => {
    let cancelled = false
    const withTime = visits.filter(v => v.first_pitch_time)
    Promise.all(withTime.map(v => {
      const stadium = stadiums.find(s => s.id === v.stadium_id)
      if (!stadium) return Promise.resolve(null as DayNight)
      return classifyDayNight(v.first_pitch_time, v.visit_date, stadium.abbreviation, stadium.lat, stadium.lng)
    })).then(results => {
      if (cancelled) return
      const c = { day: 0, night: 0, twilight: 0 }
      for (const dn of results) {
        if (dn === 'day') c.day++
        else if (dn === 'night') c.night++
        else if (dn === 'twilight') c.twilight++
      }
      setCounts(c)
    })
    return () => { cancelled = true }
  }, [visits, stadiums])

  if (!counts || counts.day + counts.night + counts.twilight === 0) return null

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4" style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3' }}>
        <Sun size={18} style={{ color: '#F5A623' }} />
        Day vs Night
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Day Games',   value: counts.day,      emoji: '🌅', color: '#F5A623' },
          { label: 'Twilight',    value: counts.twilight, emoji: '🌇', color: '#F5A623' },
          { label: 'Night Games', value: counts.night,    emoji: '🌙', color: '#58A6FF' },
        ].map(({ label, value, emoji, color }) => (
          <div key={label} className="p-4 rounded-xl text-center" style={{ backgroundColor: '#0d1424' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 13, color: '#8B949E', marginTop: 4, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
