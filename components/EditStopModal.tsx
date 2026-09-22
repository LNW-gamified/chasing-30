'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { X } from 'lucide-react'
import { EXPERIENCE_TYPES } from '@/lib/destinations'
import { MLB_TEAM_IDS as ABBR_TO_MLB_ID } from '@/lib/mlb-api'
import type { TripStop, Stadium } from '@/types'

interface Props {
  stop: TripStop
  stadiums: Stadium[]
  onClose: () => void
  onSaved: () => void
}

// Covers the fields someone actually reaches for after a trip is already
// planned — the date/time, who they're playing, their seats, a note.
// Changing which stadium or destination a stop points to, or adding and
// removing stops, is a structural edit and still goes through the full
// "Edit Trip" flow, this modal doesn't try to replicate that.
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  backgroundColor: '#0D1117', border: '1px solid #30363D',
  color: '#E6EDF3', fontSize: 14,
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#8B949E',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block',
}

export default function EditStopModal({ stop, stadiums, onClose, onSaved }: Props) {
  const isStadiumStop = stop.stop_type === 'stadium'
  const [gameDate, setGameDate] = useState(stop.game_date ?? '')
  const [gameTime, setGameTime] = useState(stop.game_time ?? '')
  const [opponentTeamId, setOpponentTeamId] = useState(stop.opponent_team_id?.toString() ?? '')
  const [ticketSection, setTicketSection] = useState(stop.ticket_section ?? '')
  const [ticketRow, setTicketRow] = useState(stop.ticket_row ?? '')
  const [ticketSeats, setTicketSeats] = useState((stop.ticket_seats ?? []).join(', '))
  const [ticketConfirmation, setTicketConfirmation] = useState(stop.ticket_confirmation ?? '')
  const [experienceType, setExperienceType] = useState(stop.experience_type ?? '')
  const [notes, setNotes] = useState(stop.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const opponentOptions = stadiums
    .map(s => ({ abbr: s.abbreviation, team: s.team, mlbId: ABBR_TO_MLB_ID[s.abbreviation] }))
    .filter(o => o.mlbId != null)
    .sort((a, b) => a.team.localeCompare(b.team))

  async function handleSave() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const seats = ticketSeats.split(',').map(s => s.trim()).filter(Boolean)

    const update: Record<string, unknown> = isStadiumStop
      ? {
          game_date: gameDate || null,
          game_time: gameTime || null,
          opponent_team_id: opponentTeamId ? parseInt(opponentTeamId) : null,
          ticket_section: ticketSection || null,
          ticket_row: ticketRow || null,
          ticket_seats: seats,
          ticket_confirmation: ticketConfirmation || null,
          notes: notes || null,
        }
      : {
          game_date: gameDate || null,
          experience_type: experienceType || null,
          notes: notes || null,
        }

    const { error: updateError } = await supabase.from('trip_stops').update(update).eq('id', stop.id)
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onSaved()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#161B22', borderRadius: 16, border: '1px solid #30363D', maxWidth: 420, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #30363D' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>Edit Stop</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>{isStadiumStop ? 'Game Date' : 'Visit Date'}</label>
            <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} style={inputStyle} />
          </div>

          {isStadiumStop && (
            <>
              <div>
                <label style={labelStyle}>Game Time</label>
                <input type="text" placeholder="e.g. 7:05 PM ET" value={gameTime} onChange={e => setGameTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Opponent</label>
                <select value={opponentTeamId} onChange={e => setOpponentTeamId(e.target.value)} style={inputStyle}>
                  <option value="">TBD</option>
                  {opponentOptions.map(o => (
                    <option key={o.abbr} value={o.mlbId!.toString()}>{o.team}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Section</label>
                  <input type="text" value={ticketSection} onChange={e => setTicketSection(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Row</label>
                  <input type="text" value={ticketRow} onChange={e => setTicketRow(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Seats</label>
                <input type="text" placeholder="e.g. 12, 13, 14" value={ticketSeats} onChange={e => setTicketSeats(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirmation #</label>
                <input type="text" value={ticketConfirmation} onChange={e => setTicketConfirmation(e.target.value)} style={inputStyle} />
              </div>
            </>
          )}

          {!isStadiumStop && (
            <div>
              <label style={labelStyle}>Experience Type</label>
              <select value={experienceType} onChange={e => setExperienceType(e.target.value)} style={inputStyle}>
                <option value="">None</option>
                {EXPERIENCE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#F85149' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #30363D', backgroundColor: 'transparent', color: '#8B949E', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', backgroundColor: '#1F6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
