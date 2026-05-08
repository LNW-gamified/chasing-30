'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import GameDayForm from '@/components/GameDayForm'
import { formatDate } from '@/lib/utils'
import type { Stadium, StadiumVisit, StadiumNote } from '@/types'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Users,
  Calendar,
  NotebookPen,
  Save,
} from 'lucide-react'
import TeamLogo from '@/components/TeamLogo'

export default function StadiumDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [stadium, setStadium] = useState<Stadium | null>(null)
  const [visits, setVisits] = useState<StadiumVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingVisit, setEditingVisit] = useState<StadiumVisit | undefined>()
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)
  const [stadiumNote, setStadiumNote] = useState<string>('')
  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  async function load() {
    const supabase = createClient()
    const [{ data: s }, { data: v }, { data: n }] = await Promise.all([
      supabase.from('stadiums').select('*').eq('id', id).single(),
      supabase.from('stadium_visits').select('*').eq('stadium_id', id).order('visit_date', { ascending: false }),
      supabase.from('stadium_notes').select('notes').eq('stadium_id', id).maybeSingle(),
    ])
    setStadium(s)
    setVisits(v ?? [])
    const notes = (n as StadiumNote | null)?.notes ?? ''
    setStadiumNote(notes)
    setNoteInput(notes)
    setLoading(false)
  }

  async function saveNote() {
    setSavingNote(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('stadium_notes').upsert(
      { stadium_id: id, notes: noteInput || null, updated_by: user?.id ?? null },
      { onConflict: 'stadium_id' }
    )
    setStadiumNote(noteInput)
    setEditingNote(false)
    setSavingNote(false)
  }

  useEffect(() => { load() }, [id])

  async function deleteVisit(visitId: string) {
    if (!confirm('Delete this game record?')) return
    const supabase = createClient()
    await supabase.from('stadium_visits').delete().eq('id', visitId)
    await load()
  }

  function openAdd() {
    setEditingVisit(undefined)
    setShowForm(true)
  }

  function openEdit(visit: StadiumVisit) {
    setEditingVisit(visit)
    setShowForm(true)
  }

  if (loading) {
    return (
      <AppShell>
        <div className="text-center py-12" style={{ color: '#a8b8c8' }}>
          Loading...
        </div>
      </AppShell>
    )
  }

  if (!stadium) {
    return (
      <AppShell>
        <div className="text-center py-12" style={{ color: '#a8b8c8' }}>
          Stadium not found.
        </div>
      </AppShell>
    )
  }

  const visited = visits.length > 0

  return (
    <AppShell>
      {/* Back */}
      <Link
        href="/stadiums"
        className="inline-flex items-center gap-2 text-sm mb-6"
        style={{ color: '#a8b8c8' }}
      >
        <ArrowLeft size={16} /> Back to Stadiums
      </Link>

      {/* Stadium header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <TeamLogo
              abbreviation={stadium.abbreviation}
              size={96}
              style={{ borderRadius: 12, flexShrink: 0 }}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold mb-1" style={{ color: '#f1f5f9' }}>
                {stadium.name}
              </h1>
              <div className="text-sm mb-2" style={{ color: '#b8c8d8' }}>
                {stadium.team}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {visited ? (
                  <span className="badge badge-green">
                    ✓ Visited · {visits.length} game{visits.length !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="badge badge-gray">Not yet visited</span>
                )}
                <span className="badge badge-blue">
                  {stadium.league} {stadium.division}
                </span>
                <span className="flex items-center gap-1 text-xs" style={{ color: '#a8b8c8' }}>
                  <MapPin size={12} /> {stadium.city}, {stadium.state}
                </span>
                {stadium.capacity && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#a8b8c8' }}>
                    <Users size={12} /> {stadium.capacity.toLocaleString()} capacity
                  </span>
                )}
                {stadium.opened && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#a8b8c8' }}>
                    <Calendar size={12} /> Opened {stadium.opened}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={openAdd} className="btn-primary flex-shrink-0">
            <Plus size={16} /> Log a Game
          </button>
        </div>
      </div>

      {/* Visits */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: '#f1f5f9' }}>
          Game Records ({visits.length})
        </h2>
      </div>

      {visits.length === 0 ? (
        <div
          className="card p-12 text-center"
          style={{ borderStyle: 'dashed', borderColor: '#1f2937' }}
        >
          <div className="text-4xl mb-3">⚾</div>
          <div className="font-medium mb-1" style={{ color: '#b8c8d8' }}>
            No games logged yet
          </div>
          <div className="text-sm mb-4" style={{ color: '#a8b8c8' }}>
            Log your first game at {stadium.name}
          </div>
          <button onClick={openAdd} className="btn-primary mx-auto">
            <Plus size={16} /> Log a Game
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visits.map((visit) => {
            const expanded = expandedVisit === visit.id
            const winner =
              visit.home_runs != null && visit.away_runs != null
                ? visit.home_runs > visit.away_runs
                  ? visit.home_team
                  : visit.visiting_team
                : null

            return (
              <div key={visit.id} className="card overflow-hidden">
                {/* Visit summary row */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedVisit(expanded ? null : visit.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>
                      {visit.home_team} vs {visit.visiting_team}
                    </div>
                    <div className="text-xs mt-0.5 flex gap-3" style={{ color: '#a8b8c8' }}>
                      <span>{formatDate(visit.visit_date)}</span>
                      {visit.first_pitch_time && <span>First pitch: {visit.first_pitch_time}</span>}
                      {visit.attendance && <span>{visit.attendance.toLocaleString()} fans</span>}
                    </div>
                  </div>

                  {visit.home_runs != null && visit.away_runs != null && (
                    <div className="text-center flex-shrink-0">
                      <div className="text-lg font-bold" style={{ color: '#f1f5f9' }}>
                        {visit.away_runs} - {visit.home_runs}
                      </div>
                      {winner && (
                        <div className="text-xs" style={{ color: '#22c55e' }}>
                          {winner} W
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(visit)
                      }}
                      className="p-1.5 rounded"
                      style={{ color: '#a8b8c8' }}
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteVisit(visit.id)
                      }}
                      className="p-1.5 rounded"
                      style={{ color: '#a8b8c8' }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div style={{ borderTop: '1px solid #1f2937' }} className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      {visit.weather && (
                        <div>
                          <div className="label">Weather</div>
                          <div className="text-sm" style={{ color: '#f1f5f9' }}>{visit.weather}{visit.temperature ? ` · ${visit.temperature}°F` : ''}</div>
                        </div>
                      )}
                      {(visit.seat_section || visit.seat_row || visit.seat_number) && (
                        <div>
                          <div className="label">Seating</div>
                          <div className="text-sm" style={{ color: '#f1f5f9' }}>
                            Sec {visit.seat_section}, Row {visit.seat_row}, Seat {visit.seat_number}
                          </div>
                        </div>
                      )}
                      {visit.game_duration && (
                        <div>
                          <div className="label">Game Duration</div>
                          <div className="text-sm" style={{ color: '#f1f5f9' }}>{visit.game_duration}</div>
                        </div>
                      )}
                      {visit.home_team_record && (
                        <div>
                          <div className="label">Records</div>
                          <div className="text-sm" style={{ color: '#f1f5f9' }}>
                            {visit.home_team} ({visit.home_team_record}) vs {visit.visiting_team} ({visit.visiting_team_record})
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pitchers */}
                    {(visit.home_starter_name || visit.away_starter_name) && (
                      <div className="mb-4">
                        <div className="label mb-2">Starting Pitchers</div>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'Home', name: visit.home_starter_name, wl: visit.home_starter_wl, ip: visit.home_starter_ip, h: visit.home_starter_h, er: visit.home_starter_er, bb: visit.home_starter_bb, k: visit.home_starter_k },
                            { label: 'Away', name: visit.away_starter_name, wl: visit.away_starter_wl, ip: visit.away_starter_ip, h: visit.away_starter_h, er: visit.away_starter_er, bb: visit.away_starter_bb, k: visit.away_starter_k },
                          ].map(({ label, name, wl, ip, h, er, bb, k }) => name ? (
                            <div key={label} className="p-3 rounded-lg" style={{ backgroundColor: '#0d1424' }}>
                              <div className="text-xs" style={{ color: '#a8b8c8' }}>{label}</div>
                              <div className="font-medium text-sm" style={{ color: '#f1f5f9' }}>{name}</div>
                              {wl && <div className="text-xs mt-1" style={{ color: '#b8c8d8' }}>{wl}</div>}
                              <div className="flex gap-3 mt-1 text-xs" style={{ color: '#a8b8c8' }}>
                                {ip && <span>IP: {ip}</span>}
                                {h != null && <span>H: {h}</span>}
                                {er != null && <span>ER: {er}</span>}
                                {bb != null && <span>BB: {bb}</span>}
                                {k != null && <span>K: {k}</span>}
                              </div>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )}

                    {/* Box score */}
                    {(visit.home_runs != null || visit.away_runs != null) && (
                      <div className="mb-4">
                        <div className="label mb-2">Final Box Score</div>
                        <div className="overflow-x-auto">
                          <table className="text-sm w-full">
                            <thead>
                              <tr style={{ color: '#a8b8c8', fontSize: '0.88rem' }}>
                                <th className="text-left pb-1">Team</th>
                                <th className="text-center pb-1 px-3">R</th>
                                <th className="text-center pb-1 px-3">H</th>
                                <th className="text-center pb-1 px-3">E</th>
                                <th className="text-center pb-1 px-3">LOB</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { team: visit.visiting_team, r: visit.away_runs, h: visit.away_hits, e: visit.away_errors, lob: visit.away_lob },
                                { team: visit.home_team, r: visit.home_runs, h: visit.home_hits, e: visit.home_errors, lob: visit.home_lob },
                              ].map(({ team, r, h, e, lob }) => (
                                <tr key={team}>
                                  <td className="py-1 pr-3" style={{ color: '#b8c8d8' }}>{team}</td>
                                  <td className="text-center px-3 font-bold" style={{ color: '#f1f5f9' }}>{r ?? '-'}</td>
                                  <td className="text-center px-3" style={{ color: '#b8c8d8' }}>{h ?? '-'}</td>
                                  <td className="text-center px-3" style={{ color: '#b8c8d8' }}>{e ?? '-'}</td>
                                  <td className="text-center px-3" style={{ color: '#b8c8d8' }}>{lob ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Inning scores */}
                    {visit.inning_scores?.length > 0 && (
                      <div className="mb-4">
                        <div className="label mb-2">Inning by Inning</div>
                        <div className="overflow-x-auto">
                          <table className="text-xs">
                            <thead>
                              <tr>
                                <th className="text-left pr-3 pb-1" style={{ color: '#a8b8c8' }}>Team</th>
                                {visit.inning_scores.map((inn) => (
                                  <th key={inn.inning} className="text-center px-2 pb-1" style={{ color: '#a8b8c8' }}>
                                    {inn.inning}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(['away', 'home'] as const).map((side) => (
                                <tr key={side}>
                                  <td className="pr-3 py-1" style={{ color: '#b8c8d8' }}>
                                    {side === 'away' ? visit.visiting_team : visit.home_team}
                                  </td>
                                  {visit.inning_scores.map((inn) => (
                                    <td key={inn.inning} className="text-center px-2" style={{ color: '#f1f5f9' }}>
                                      {inn[side] ?? '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Pitchers of record */}
                    {(visit.winning_pitcher || visit.losing_pitcher || visit.save_pitcher) && (
                      <div className="flex gap-4 mb-4">
                        {visit.winning_pitcher && (
                          <div>
                            <div className="label">WP</div>
                            <div className="text-sm" style={{ color: '#22c55e' }}>{visit.winning_pitcher}</div>
                          </div>
                        )}
                        {visit.losing_pitcher && (
                          <div>
                            <div className="label">LP</div>
                            <div className="text-sm" style={{ color: '#ef4444' }}>{visit.losing_pitcher}</div>
                          </div>
                        )}
                        {visit.save_pitcher && (
                          <div>
                            <div className="label">SV</div>
                            <div className="text-sm" style={{ color: '#f59e0b' }}>{visit.save_pitcher}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Umpires */}
                    {(visit.hp_umpire || visit.first_base_umpire) && (
                      <div className="mb-4">
                        <div className="label mb-1">Umpires</div>
                        <div className="flex flex-wrap gap-3 text-xs" style={{ color: '#a8b8c8' }}>
                          {visit.hp_umpire && <span>HP: {visit.hp_umpire}</span>}
                          {visit.first_base_umpire && <span>1B: {visit.first_base_umpire}</span>}
                          {visit.second_base_umpire && <span>2B: {visit.second_base_umpire}</span>}
                          {visit.third_base_umpire && <span>3B: {visit.third_base_umpire}</span>}
                        </div>
                      </div>
                    )}

                    {/* Photo */}
                    {visit.photo_url && (
                      <div className="mb-4">
                        <div className="label mb-1">Photo</div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={visit.photo_url}
                          alt="Game photo"
                          className="rounded-lg"
                          style={{ maxHeight: 220, objectFit: 'cover', width: '100%' }}
                        />
                      </div>
                    )}

                    {/* Notes */}
                    {visit.notes && (
                      <div>
                        <div className="label mb-1">Notes</div>
                        <div className="text-sm whitespace-pre-wrap p-3 rounded-lg" style={{ color: '#b8c8d8', backgroundColor: '#0d1424' }}>
                          {visit.notes}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Stadium notes / wishlist */}
      <div className="card p-6 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold" style={{ color: '#f1f5f9' }}>
            <NotebookPen size={16} style={{ color: '#f59e0b' }} />
            Notes &amp; Wishlist
          </div>
          {!editingNote && (
            <button
              onClick={() => { setNoteInput(stadiumNote); setEditingNote(true) }}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.92rem' }}
            >
              <Pencil size={12} /> {stadiumNote ? 'Edit' : 'Add Notes'}
            </button>
          )}
        </div>

        {editingNote ? (
          <div>
            <textarea
              className="input mb-3"
              rows={4}
              placeholder={`Things to do at ${stadium.name}, food recommendations, seat wishlist...`}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              style={{ resize: 'vertical' }}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={saveNote} disabled={savingNote} className="btn-primary" style={{ fontSize: '0.96rem', padding: '6px 14px' }}>
                <Save size={13} /> {savingNote ? 'Saving...' : 'Save Notes'}
              </button>
              <button onClick={() => setEditingNote(false)} className="btn-secondary" style={{ fontSize: '0.96rem', padding: '6px 14px' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : stadiumNote ? (
          <div className="text-sm whitespace-pre-wrap p-3 rounded-lg" style={{ color: '#b8c8d8', backgroundColor: '#0d1424' }}>
            {stadiumNote}
          </div>
        ) : (
          <div className="text-sm" style={{ color: '#a8b8c8' }}>
            No notes yet. Add a wishlist, food recommendations, or anything you want to remember about this stadium.
          </div>
        )}
      </div>

      {showForm && stadium && (
        <GameDayForm
          stadium={stadium}
          visit={editingVisit}
          onClose={() => { setShowForm(false); setEditingVisit(undefined) }}
          onSaved={() => { setShowForm(false); setEditingVisit(undefined); load() }}
        />
      )}
    </AppShell>
  )
}
