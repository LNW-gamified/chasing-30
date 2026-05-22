'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import TeamLogo from '@/components/TeamLogo'

interface NextTrip {
  id: string
  name: string
  stadiumName: string
  stadiumAbbr: string
  daysAway: number
  dateStr: string
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000))
}

export default function UpNextPill({ compact = false }: { compact?: boolean }) {
  const [next, setNext] = useState<NextTrip | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toLocaleDateString('en-CA')

    supabase
      .from('trips')
      .select('id, name, start_date, trip_date, stadium:stadiums(name, abbreviation, team)')
      .eq('status', 'planned')
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        const upcoming = data.find((t: any) => {
          const d = t.start_date ?? t.trip_date
          return d && d >= today
        })
        if (!upcoming) return
        const stadium = (upcoming as any).stadium
        const date = upcoming.start_date ?? upcoming.trip_date
        setNext({
          id: upcoming.id,
          name: upcoming.name,
          stadiumName: stadium?.name ?? upcoming.name,
          stadiumAbbr: stadium?.abbreviation ?? '',
          daysAway: daysUntil(date),
          dateStr: date,
        })
      })
  }, [])

  if (!next) return null

  const label =
    next.daysAway === 0 ? 'Today!' :
    next.daysAway === 1 ? 'Tomorrow' :
    `${next.daysAway} days`

  if (compact) {
    return (
      <Link
        href={`/trips/${next.id}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(31,111,235,0.12)', border: '1px solid rgba(31,111,235,0.25)',
          borderRadius: 999, padding: '4px 10px 4px 6px',
          textDecoration: 'none', flexShrink: 0, maxWidth: 220,
        }}
      >
        {next.stadiumAbbr && <TeamLogo abbreviation={next.stadiumAbbr} size={18} />}
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#E6EDF3',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 110,
        }}>
          {next.stadiumName}
        </span>
        <span style={{ fontSize: 11, color: '#1F6FEB', fontWeight: 700, flexShrink: 0 }}>
          {label}
        </span>
      </Link>
    )
  }

  return (
    <Link
      href={`/trips/${next.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 12, marginBottom: 8,
        background: 'rgba(31,111,235,0.08)', border: '1px solid rgba(31,111,235,0.2)',
        textDecoration: 'none',
      }}
    >
      {next.stadiumAbbr && <TeamLogo abbreviation={next.stadiumAbbr} size={24} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1F6FEB', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
          Up Next
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {next.stadiumName}
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#1F6FEB', flexShrink: 0 }}>{label}</span>
    </Link>
  )
}
