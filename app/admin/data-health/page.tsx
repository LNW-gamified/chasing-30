import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function DataHealthPage() {
  const supabase = await createClient()

  const [{ data: visits }, { data: bleEntries }, { data: stops }] = await Promise.all([
    supabase.from('stadium_visits').select('id, stadium_id, visit_date, photo_url, photos'),
    supabase.from('baseball_life_entries').select('id, category, visit_date, venue, notes'),
    supabase.from('trip_stops').select('id, trip_id, stadium_id, destination_id, sort_order'),
  ])

  // Find duplicate visits (same stadium + date)
  const visitKeys: Record<string, number> = {}
  for (const v of visits ?? []) {
    const key = `${v.stadium_id}-${v.visit_date}`
    visitKeys[key] = (visitKeys[key] ?? 0) + 1
  }
  const duplicateVisits = Object.entries(visitKeys).filter(([, count]) => count > 1)

  // Find visits with no photo
  const visitsNoPhoto = (visits ?? []).filter(v => !v.photo_url && (!v.photos || v.photos.length === 0))

  // Find BLE entries missing venue
  const bleNoVenue = (bleEntries ?? []).filter(e => !e.venue)

  // Find trip stops with neither stadium nor destination
  const orphanStops = (stops ?? []).filter(s => !s.stadium_id && !s.destination_id)

  return (
    <div style={{ color: '#E6EDF3', minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 80px' }}>
        <Link href="/dashboard" style={{ fontSize: 13, color: '#8B949E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          <ArrowLeft size={14} /> Home
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Data Health</h1>
        <p style={{ fontSize: 13, color: '#8B949E', marginBottom: 32 }}>A quick scan for data quality issues across your account.</p>

        {[
          { label: 'Possible duplicate visits', count: duplicateVisits.length, detail: duplicateVisits.map(([k]) => k) },
          { label: 'Visits with no photo', count: visitsNoPhoto.length, detail: visitsNoPhoto.map(v => v.visit_date) },
          { label: 'Baseball Life entries missing venue', count: bleNoVenue.length, detail: bleNoVenue.map(e => e.visit_date) },
          { label: 'Trip stops with no stadium or destination', count: orphanStops.length, detail: orphanStops.map(s => s.id) },
        ].map(check => (
          <div key={check.label} style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 12, backgroundColor: '#161B22', border: `1px solid ${check.count > 0 ? 'rgba(245,166,35,0.3)' : '#30363D'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{check.label}</span>
              <span style={{
                fontSize: 13, fontWeight: 800, padding: '2px 10px', borderRadius: 20,
                backgroundColor: check.count > 0 ? 'rgba(245,166,35,0.15)' : 'rgba(63,185,80,0.15)',
                color: check.count > 0 ? '#F5A623' : '#3FB950',
              }}>
                {check.count}
              </span>
            </div>
            {check.count > 0 && (
              <div style={{ fontSize: 12, color: '#8B949E', marginTop: 8, lineHeight: 1.6 }}>
                {check.detail.slice(0, 5).join(', ')}{check.detail.length > 5 ? ` +${check.detail.length - 5} more` : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
