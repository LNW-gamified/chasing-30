'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, LogOut, Download, ChevronRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import TeamLogo from '@/components/TeamLogo'

const TEAMS = [
  { abbr: 'ARI', name: 'Arizona Diamondbacks'  },
  { abbr: 'ATL', name: 'Atlanta Braves'         },
  { abbr: 'BAL', name: 'Baltimore Orioles'      },
  { abbr: 'BOS', name: 'Boston Red Sox'         },
  { abbr: 'CHC', name: 'Chicago Cubs'           },
  { abbr: 'CWS', name: 'Chicago White Sox'      },
  { abbr: 'CIN', name: 'Cincinnati Reds'        },
  { abbr: 'CLE', name: 'Cleveland Guardians'    },
  { abbr: 'COL', name: 'Colorado Rockies'       },
  { abbr: 'DET', name: 'Detroit Tigers'         },
  { abbr: 'HOU', name: 'Houston Astros'         },
  { abbr: 'KC',  name: 'Kansas City Royals'     },
  { abbr: 'LAA', name: 'Los Angeles Angels'     },
  { abbr: 'LAD', name: 'Los Angeles Dodgers'    },
  { abbr: 'MIA', name: 'Miami Marlins'          },
  { abbr: 'MIL', name: 'Milwaukee Brewers'      },
  { abbr: 'MIN', name: 'Minnesota Twins'        },
  { abbr: 'NYM', name: 'New York Mets'          },
  { abbr: 'NYY', name: 'New York Yankees'       },
  { abbr: 'OAK', name: 'Oakland Athletics'      },
  { abbr: 'PHI', name: 'Philadelphia Phillies'  },
  { abbr: 'PIT', name: 'Pittsburgh Pirates'     },
  { abbr: 'SD',  name: 'San Diego Padres'       },
  { abbr: 'SF',  name: 'San Francisco Giants'   },
  { abbr: 'SEA', name: 'Seattle Mariners'       },
  { abbr: 'STL', name: 'St. Louis Cardinals'    },
  { abbr: 'TB',  name: 'Tampa Bay Rays'         },
  { abbr: 'TEX', name: 'Texas Rangers'          },
  { abbr: 'TOR', name: 'Toronto Blue Jays'      },
  { abbr: 'WSH', name: 'Washington Nationals'   },
]

interface UserProfile {
  display_name: string | null
  home_city: string | null
  home_state: string | null
  notification_game_day: boolean
  notification_trip_countdown: boolean
  notification_milestones: boolean
  show_local_time: boolean
}

interface Props {
  isOpen: boolean
  onClose: () => void
  userId: string
  userEmail: string
  userInitial: string
  xp: number
  xpMin: number
  xpNext: number | null
  rankName: string
  rankIcon: string
  memberSince: string
  visitedCount: number
  gamesCount: number
}

const DEFAULT_PROFILE: UserProfile = {
  display_name: null,
  home_city: null,
  home_state: null,
  notification_game_day: true,
  notification_trip_countdown: true,
  notification_milestones: true,
  show_local_time: false,
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, flexShrink: 0,
        backgroundColor: value ? '#1F6FEB' : '#30363D',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background-color 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        backgroundColor: '#E6EDF3',
        transition: 'left 0.2s',
        display: 'block',
      }} />
    </button>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 16px', marginBottom: 6, marginTop: 20 }}>
      {title}
    </div>
  )
}

export default function ProfilePanel({
  isOpen, onClose,
  userId, userEmail, userInitial,
  xp, xpMin, xpNext,
  rankName, rankIcon, memberSince,
  visitedCount, gamesCount,
}: Props) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [favTeam, setFavTeam] = useState<string | null>(null)
  const [achievementsCount, setAchievementsCount] = useState<number>(0)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!isOpen || loaded) return
    async function load() {
      const supabase = createClient()
      const [{ data: prof }, { data: settings }, { count }] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_settings').select('favorite_team_abbr').eq('user_id', userId).maybeSingle(),
        supabase.from('achievement_claims').select('id', { count: 'exact', head: true }),
      ])
      if (prof) {
        setProfile({
          display_name: prof.display_name ?? null,
          home_city: prof.home_city ?? null,
          home_state: prof.home_state ?? null,
          notification_game_day: prof.notification_game_day ?? true,
          notification_trip_countdown: prof.notification_trip_countdown ?? true,
          notification_milestones: prof.notification_milestones ?? true,
          show_local_time: prof.show_local_time ?? false,
        })
        setNameInput(prof.display_name ?? '')
      } else {
        setNameInput('')
      }
      setFavTeam(settings?.favorite_team_abbr ?? null)
      setAchievementsCount(count ?? 0)
      setLoaded(true)
    }
    load()
  }, [isOpen, loaded, userId])

  // Reset loaded on close so it re-fetches if userId changes
  useEffect(() => {
    if (!isOpen) setLoaded(false)
  }, [isOpen])

  // Close on click outside (desktop dropdown)
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Slight delay so the open-click doesn't immediately close
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick) }
  }, [isOpen, onClose])

  async function saveProfile(patch: Partial<UserProfile>) {
    const next = { ...profile, ...patch }
    setProfile(next)
    const supabase = createClient()
    await supabase.from('user_profiles').upsert({
      user_id: userId,
      ...next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  async function saveFavTeam(abbr: string | null) {
    setFavTeam(abbr)
    setShowTeamPicker(false)
    const supabase = createClient()
    await supabase.from('user_settings').upsert(
      { user_id: userId, favorite_team_abbr: abbr, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    router.refresh()
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleExport() {
    setExporting(true)
    const supabase = createClient()
    const [{ data: visits }, { data: trips }, { data: achievements }] = await Promise.all([
      supabase.from('stadium_visits').select('*'),
      supabase.from('trips').select('*'),
      supabase.from('achievement_claims').select('*'),
    ])
    const blob = new Blob([JSON.stringify({ visits, trips, achievements }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'chasing30-data.json'
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const displayName = profile.display_name || userEmail.split('@')[0]
  const memberDate = new Date(memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const favTeamData = TEAMS.find(t => t.abbr === favTeam) ?? null

  const xpRange = xpNext != null ? xpNext - xpMin : null
  const xpProgress = xpRange != null ? Math.min(1, (xp - xpMin) / xpRange) : 1
  const xpToNext = xpNext != null ? xpNext - xp : 0

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Section 1 — Identity */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #21262D' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: 'rgba(31,111,235,0.18)', border: '1px solid rgba(31,111,235,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1F6FEB', fontWeight: 800, fontSize: '1.2rem', flexShrink: 0 }}>
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => {
                  setEditingName(false)
                  const trimmed = nameInput.trim()
                  saveProfile({ display_name: trimmed || null })
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                style={{
                  fontSize: '1rem', fontWeight: 700, color: '#E6EDF3',
                  background: 'rgba(31,111,235,0.08)', border: '1px solid #1F6FEB',
                  borderRadius: 6, padding: '3px 8px', width: '100%', outline: 'none',
                }}
              />
            ) : (
              <button
                onClick={() => { setEditingName(true); setNameInput(profile.display_name ?? '') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#E6EDF3' }}>{displayName}</div>
                <div style={{ fontSize: '0.75rem', color: '#8B949E', marginTop: 1 }}>Tap to edit name</div>
              </button>
            )}
          </div>
        </div>

        {/* Rank badge + progress */}
        <div style={{ backgroundColor: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>{rankIcon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F5A623' }}>{rankName}</span>
            </div>
            <span style={{ fontSize: 11, color: '#8B949E', fontWeight: 600 }}>{xp} XP</span>
          </div>
          <div style={{ height: 4, background: '#30363D', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
            <div style={{ width: `${Math.round(xpProgress * 100)}%`, height: '100%', background: '#F5A623', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: '#8B949E' }}>
            {xpNext != null ? `${xpToNext} XP to next rank` : 'Max rank achieved 🏆'}
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#8B949E', marginTop: 10 }}>Member since {memberDate}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Section 2 — Baseball Identity */}
        <SectionHeader title="Your Baseball Identity" />
        <div style={{ padding: '0 12px' }}>
          {/* Favorite team */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', backgroundColor: '#0D1117', border: '1px solid #21262D', borderRadius: 10, marginBottom: 8 }}>
            {favTeamData ? (
              <>
                <TeamLogo abbreviation={favTeamData.abbr} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Favorite Team</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>{favTeamData.name}</div>
                </div>
              </>
            ) : (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>Favorite Team</div>
                <div style={{ fontSize: 13, color: '#484F58' }}>Not set</div>
              </div>
            )}
            <button
              onClick={() => setShowTeamPicker(true)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #30363D', background: 'transparent', color: '#8B949E', cursor: 'pointer', flexShrink: 0 }}
            >
              {favTeamData ? 'Change' : 'Set'}
            </button>
          </div>

          {/* Home city / state */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Home City</label>
              <input
                type="text"
                placeholder="e.g. Chicago"
                defaultValue={profile.home_city ?? ''}
                key={`city-${loaded}`}
                onBlur={e => saveProfile({ home_city: e.target.value.trim() || null })}
                style={{ width: '100%', backgroundColor: '#0D1117', border: '1px solid #21262D', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#E6EDF3', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ width: 80 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>State</label>
              <input
                type="text"
                placeholder="IL"
                maxLength={2}
                defaultValue={profile.home_state ?? ''}
                key={`state-${loaded}`}
                onBlur={e => saveProfile({ home_state: e.target.value.trim().toUpperCase() || null })}
                style={{ width: '100%', backgroundColor: '#0D1117', border: '1px solid #21262D', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#E6EDF3', outline: 'none', boxSizing: 'border-box', textTransform: 'uppercase' }}
              />
            </div>
          </div>
        </div>

        {/* Section 3 — Quick Stats */}
        <SectionHeader title="Quick Stats" />
        <div style={{ padding: '0 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            {[
              { label: 'Stadiums Visited', value: `${visitedCount} / 30` },
              { label: 'Games Attended', value: gamesCount },
              { label: 'Achievements', value: achievementsCount },
            ].map(stat => (
              <div key={stat.label} style={{ backgroundColor: '#0D1117', border: '1px solid #21262D', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: '#8B949E', marginTop: 3 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <a
            href="/milestones"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'rgba(31,111,235,0.06)', border: '1px solid rgba(31,111,235,0.15)', borderRadius: 10, textDecoration: 'none', color: '#1F6FEB', fontSize: 13, fontWeight: 600, marginBottom: 4 }}
          >
            View full Baseball Life Stats
            <ChevronRight size={14} />
          </a>
        </div>

        {/* Section 4 — App Settings */}
        <SectionHeader title="App Settings" />
        <div style={{ padding: '0 12px' }}>
          {[
            { key: 'notification_game_day' as const,       label: 'Game Day Morning Briefing' },
            { key: 'notification_trip_countdown' as const, label: 'Trip countdown alerts' },
            { key: 'notification_milestones' as const,     label: 'Milestone achievement alerts' },
            { key: 'show_local_time' as const,             label: 'Show times in stadium local time' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px', backgroundColor: '#0D1117', border: '1px solid #21262D', borderRadius: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#E6EDF3' }}>{label}</span>
              <Toggle
                value={profile[key]}
                onChange={v => saveProfile({ [key]: v })}
              />
            </div>
          ))}
        </div>

        {/* Section 5 — Account */}
        <SectionHeader title="Account" />
        <div style={{ padding: '0 12px 24px' }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 12px', backgroundColor: '#0D1117', border: '1px solid #21262D', borderRadius: 10, cursor: 'pointer', color: '#8B949E', fontSize: 13, fontWeight: 600, marginBottom: 8 }}
          >
            <Download size={15} />
            {exporting ? 'Exporting…' : 'Export My Data'}
          </button>
          <button
            onClick={handleSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 12px', backgroundColor: 'rgba(218,54,51,0.08)', border: '1px solid rgba(218,54,51,0.3)', borderRadius: 10, cursor: 'pointer', color: '#F85149', fontSize: 13, fontWeight: 700 }}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )

  // Team picker modal (shared between mobile/desktop)
  const teamPickerModal = showTeamPicker && (
    <div
      onClick={() => setShowTeamPicker(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#161B22', borderRadius: 14, border: '1px solid #30363D', width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #30363D' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3' }}>Pick Your Team</span>
          <button onClick={() => setShowTeamPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {TEAMS.map(team => {
              const selected = team.abbr === favTeam
              return (
                <button
                  key={team.abbr}
                  onClick={() => saveFavTeam(team.abbr)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, textAlign: 'left', border: selected ? '1px solid #1F6FEB' : '1px solid #30363D', background: selected ? 'rgba(31,111,235,0.1)' : 'transparent', cursor: 'pointer' }}
                >
                  <TeamLogo abbreviation={team.abbr} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#E6EDF3' }}>{team.abbr}</div>
                    <div style={{ fontSize: 10, color: '#8B949E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</div>
                  </div>
                  {selected && <Check size={12} style={{ marginLeft: 'auto', color: '#1F6FEB', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
          {favTeam && (
            <button
              onClick={() => saveFavTeam(null)}
              style={{ marginTop: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #30363D', background: 'transparent', color: '#8B949E', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
            >
              Clear favorite team
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (!isOpen) return teamPickerModal ? <>{teamPickerModal}</> : null

  return (
    <>
      {teamPickerModal}

      {/* Mobile: bottom sheet */}
      <div className="flex md:hidden">
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.6)' }}
        />
        {/* Sheet */}
        <div
          ref={panelRef}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
            backgroundColor: '#161B22', borderTop: '1px solid #30363D',
            borderRadius: '16px 16px 0 0',
            maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Drag handle + close */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px 0', position: 'relative' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#30363D' }} />
            <button
              onClick={onClose}
              style={{ position: 'absolute', right: 14, top: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', display: 'flex', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>
          {content}
        </div>
      </div>

      {/* Desktop: dropdown — fixed to sidebar top-right */}
      <div className="hidden md:block">
        <div
          ref={panelRef}
          style={{
            position: 'fixed', top: 100, left: 8,
            width: 240, maxHeight: 'calc(100vh - 116px)',
            backgroundColor: '#161B22', border: '1px solid #30363D',
            borderRadius: 14, zIndex: 100, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {content}
        </div>
      </div>
    </>
  )
}
