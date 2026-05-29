'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TeamLogo from '@/components/TeamLogo'
import { X } from 'lucide-react'

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

interface Props {
  userId: string
  currentFavAbbr: string | null
}

export default function FavoriteTeamPicker({ userId, currentFavAbbr }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving]    = useState(false)
  const router = useRouter()

  const currentTeam = TEAMS.find(t => t.abbr === currentFavAbbr) ?? null

  async function pick(abbr: string | null) {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('user_settings')
      .upsert({ user_id: userId, favorite_team_abbr: abbr, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      {/* Trigger row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 12,
        backgroundColor: '#111827', border: '1px solid #1e2d4a',
        borderRadius: 10, padding: '10px 14px',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Favorite Team
        </span>
        {currentTeam ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TeamLogo abbreviation={currentTeam.abbr} size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3' }}>{currentTeam.abbr}</span>
            <span style={{ fontSize: 12, color: '#8B949E' }}>{currentTeam.name}</span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#484F58' }}>Not set</span>
        )}
        <button
          onClick={() => setOpen(true)}
          style={{
            marginLeft: 'auto',
            padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            border: '1px solid #30363D', background: 'transparent',
            color: '#8B949E', cursor: 'pointer',
          }}
        >
          {currentTeam ? 'Change' : 'Set'}
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#161B22', borderRadius: 14, border: '1px solid #30363D',
              width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid #30363D',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#E6EDF3' }}>Pick Your Team</span>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Team grid */}
            <div style={{ overflowY: 'auto', padding: '12px 12px 16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
              }}>
                {TEAMS.map(team => {
                  const isSelected = team.abbr === currentFavAbbr
                  return (
                    <button
                      key={team.abbr}
                      onClick={() => pick(team.abbr)}
                      disabled={saving}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 10px', borderRadius: 8, textAlign: 'left',
                        border: isSelected ? '1px solid #1F6FEB' : '1px solid #30363D',
                        background: isSelected ? 'rgba(31,111,235,0.1)' : 'transparent',
                        cursor: saving ? 'default' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      <TeamLogo abbreviation={team.abbr} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#E6EDF3' }}>{team.abbr}</div>
                        <div style={{
                          fontSize: 10, color: '#8B949E',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{team.name}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Clear option */}
              {currentFavAbbr && (
                <button
                  onClick={() => pick(null)}
                  disabled={saving}
                  style={{
                    marginTop: 10, width: '100%', padding: '9px 12px',
                    borderRadius: 8, border: '1px solid #30363D',
                    background: 'transparent', color: '#8B949E',
                    fontSize: 13, cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  Clear favorite team
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
