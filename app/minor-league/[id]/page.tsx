import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SpecialVisitButton from '@/components/SpecialVisitButton'
import MiLBLogo from '@/components/MiLBLogo'
import type { BaseballLifeEntry } from '@/types'

export default async function MinorLeagueStadiumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: stadium }, { data: visits }] = await Promise.all([
    supabase.from('minor_league_stadiums').select('*').eq('id', id).single(),
    supabase.from('baseball_life_entries')
      .select('*')
      .eq('category', 'minor_league')
      .eq('minor_league_stadium_id', id)
      .order('visit_date', { ascending: false }),
  ])

  if (!stadium) notFound()

  const allVisits: BaseballLifeEntry[] = (visits ?? []) as BaseballLifeEntry[]

  function fmtDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const card: React.CSSProperties = {
    backgroundColor: '#161B22', borderRadius: 14, border: '1px solid #21262D',
  }

  return (
    <div style={{ color: '#E6EDF3', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* Back link */}
        <Link href="/milestones" style={{ fontSize: 13, color: '#8B949E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
          ← Records
        </Link>

        {/* Header */}
        <div style={{ ...card, padding: '24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <MiLBLogo milbTeamId={stadium.milb_team_id ?? null} fallbackAbbr={stadium.affiliate} size={72} style={{ flexShrink: 0, borderRadius: 8 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Minor League Stadium</div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#E6EDF3', margin: '0 0 4px', lineHeight: 1.2 }}>{stadium.name}</h1>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F5A623', marginBottom: 4 }}>{stadium.team}</div>
              <div style={{ fontSize: 13, color: '#8B949E' }}>
                {stadium.city}, {stadium.state} · {stadium.level}
                {stadium.affiliate && <span style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 10, backgroundColor: 'rgba(31,111,235,0.1)', border: '1px solid rgba(31,111,235,0.2)', fontSize: 11, fontWeight: 700, color: '#58A6FF' }}>MLB affiliate: {stadium.affiliate}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#3FB950', lineHeight: 1 }}>{allVisits.length}</div>
              <div style={{ fontSize: 11, color: '#8B949E', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                game{allVisits.length !== 1 ? 's' : ''} attended
              </div>
            </div>
          </div>

          {stadium.description && (
            <p style={{ fontSize: 13, color: '#8B949E', marginTop: 14, lineHeight: 1.6 }}>{stadium.description}</p>
          )}

          {/* Stadium details row */}
          {(stadium.capacity || stadium.opened || stadium.surface) && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid #21262D' }}>
              {stadium.capacity && (
                <div>
                  <div style={{ fontSize: 10, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capacity</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>{stadium.capacity.toLocaleString()}</div>
                </div>
              )}
              {stadium.opened && (
                <div>
                  <div style={{ fontSize: 10, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opened</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>{stadium.opened}</div>
                </div>
              )}
              {stadium.surface && (
                <div>
                  <div style={{ fontSize: 10, color: '#8B949E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Surface</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>{stadium.surface}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Visits list */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>Your Visits</div>
          <SpecialVisitButton label="Log Game" variant="secondary" />
        </div>

        {allVisits.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allVisits.map(v => {
              const score = v.final_score_home != null && v.final_score_away != null
                ? `${v.final_score_home}–${v.final_score_away}`
                : null
              return (
                <div key={v.id} style={{ ...card, padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 2 }}>
                        {v.event_type || (v.opponent ? `vs. ${v.opponent}` : 'Game')}
                      </div>
                      <div style={{ fontSize: 12, color: '#8B949E' }}>{fmtDate(v.visit_date)}</div>
                      {v.opponent && !v.event_type?.includes('vs') && (
                        <div style={{ fontSize: 12, color: '#8B949E', marginTop: 2 }}>vs. {v.opponent}</div>
                      )}
                    </div>
                    {score && (
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#F5A623', flexShrink: 0 }}>{score}</div>
                    )}
                  </div>

                  {/* Seat info */}
                  {(v.ticket_section || v.ticket_row) && (
                    <div style={{ fontSize: 12, color: '#8B949E', marginTop: 8 }}>
                      Section {v.ticket_section}{v.ticket_row ? ` · Row ${v.ticket_row}` : ''}
                      {v.ticket_seats && v.ticket_seats.length > 0 ? ` · Seat${v.ticket_seats.length > 1 ? 's' : ''} ${v.ticket_seats.join(', ')}` : ''}
                    </div>
                  )}

                  {/* Moments */}
                  {v.moments && v.moments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {v.moments.map(m => (
                        <span key={m} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, backgroundColor: 'rgba(31,111,235,0.1)', border: '1px solid rgba(31,111,235,0.2)', color: '#58A6FF' }}>{m}</span>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {v.notes && (
                    <div style={{ fontSize: 12, color: '#8B949E', marginTop: 8, paddingTop: 8, borderTop: '1px solid #21262D', lineHeight: 1.5 }}>{v.notes}</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#484F58', fontSize: 14 }}>
            No visits logged yet. Tap &quot;Log Game&quot; to add your first!
          </div>
        )}
      </div>
    </div>
  )
}
