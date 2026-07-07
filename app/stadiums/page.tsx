'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import PassportGrid, { type StampData } from '@/components/PassportGrid'
import Link from 'next/link'
import { Search, X, ChevronRight, CalendarDays, MapPin, ExternalLink } from 'lucide-react'
import type { Stadium } from '@/types'
import TeamLogo from '@/components/TeamLogo'
import { fetchStadiumPhoto } from '@/lib/stadium-wikipedia'
import BaseballLifeForm from '@/components/BaseballLifeForm'
import MiLBLogo from '@/components/MiLBLogo'
import type { BaseballLifeCategory } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'mlb' | 'events' | 'experiences' | 'minor_league' | 'passport'
type SortKey = 'team' | 'name' | 'state' | 'division'
interface VisitRow { stadium_id: string; visit_date: string }
interface NextGameInfo { date: string; opponentAbbr: string }

interface BaseballEvent {
  id: string; name: string; slug: string; category: string
  description: string | null; is_annual: boolean; sort_order: number
  image_url: string | null; logo_url: string | null
}
interface BaseballExperience {
  id: string; name: string; slug: string; city: string; state: string | null
  country: string; description: string | null; highlights: string[] | null
  admission: string | null; website_url: string | null; sort_order: number
  image_url: string | null; logo_url: string | null
}
interface MinorLeagueStadium {
  id: string; name: string; team: string; abbreviation: string
  city: string; state: string; level: string; affiliate: string
  affiliate_full: string; description: string | null; milb_team_id: number | null
  image_url: string | null; logo_url: string | null
}
interface BleEntry { id: string; category: string; event_type: string | null; venue: string | null; minor_league_stadium_id: string | null }

// ─── Team colors ──────────────────────────────────────────────────────────────

const TEAM_ACCENT: Record<string, string> = {
  NYY: '#003087', BOS: '#BD3039', LAD: '#005A9C', CHC: '#0E3386',
  CWS: '#27251F', STL: '#C41E3A', ATL: '#CE1141', NYM: '#002D72',
  PHI: '#E81828', WSH: '#AB0003', MIA: '#00A3E0', PIT: '#FDB827',
  CIN: '#C6011F', MIL: '#FFC52F', HOU: '#EB6E1F', TEX: '#003278',
  LAA: '#BA0021', OAK: '#003831', SEA: '#0C2C56', SD:  '#2F241D',
  COL: '#33006F', ARI: '#A71930', SF:  '#FD5A1E', MIN: '#002B5C',
  CLE: '#E31937', DET: '#0C2340', KC:  '#004687', BAL: '#DF4601',
  TB:  '#092C5C', TOR: '#134A8E',
}

const TEAM_NICKNAME: Record<string, string> = {
  ARI: 'D-backs',   ATL: 'Braves',    BAL: 'Orioles',   BOS: 'Red Sox',
  CHC: 'Cubs',      CWS: 'White Sox', CIN: 'Reds',       CLE: 'Guardians',
  COL: 'Rockies',   DET: 'Tigers',    HOU: 'Astros',     KC:  'Royals',
  LAA: 'Angels',    LAD: 'Dodgers',   MIA: 'Marlins',    MIL: 'Brewers',
  MIN: 'Twins',     NYM: 'Mets',      NYY: 'Yankees',    OAK: 'Athletics',
  PHI: 'Phillies',  PIT: 'Pirates',   SD:  'Padres',     SF:  'Giants',
  SEA: 'Mariners',  STL: 'Cardinals', TB:  'Rays',       TEX: 'Rangers',
  TOR: 'Blue Jays', WSH: 'Nationals',
}

// ─── Event category metadata ──────────────────────────────────────────────────

const EVENT_META: Record<string, { emoji: string; color: string; label: string }> = {
  all_star:       { emoji: '🌟', color: '#F5A623', label: 'All-Star'       },
  home_run_derby: { emoji: '💥', color: '#E8820C', label: 'Home Run Derby' },
  playoffs:       { emoji: '🍂', color: '#E31937', label: 'Playoffs'       },
  world_series:   { emoji: '🏆', color: '#C41E3A', label: 'World Series'   },
  field_of_dreams:{ emoji: '🌽', color: '#3FB950', label: 'Field of Dreams'},
  opening_day:    { emoji: '🌸', color: '#3FB950', label: 'Opening Day'        },
  international:  { emoji: '🌍', color: '#58A6FF', label: 'International Games' },
  spring_training:{ emoji: '🌞', color: '#1F6FEB', label: 'Spring Training'},
  amateur:        { emoji: '🎓', color: '#58A6FF', label: 'Amateur & Collegiate' },
  exhibition:     { label: 'Banana Ball & Exhibition', emoji: '🍌', color: '#F5A623' },
}

// Gradient base colors for event card backgrounds (distinct from badge accent colors)
const EVENT_GRADIENT: Record<string, string> = {
  world_series:    '#B8960C',  // gold
  all_star:        '#1A5FA8',  // blue
  home_run_derby:  '#C46A00',  // amber
  playoffs:        '#CC1122',  // red
  field_of_dreams: '#2A7A2A',  // green
  spring_training: '#1A8FE3',  // blue
}

// ─── "Attended" matching: event slug → keywords in ble.event_type ─────────────

const EVENT_MATCH: Record<string, (e: BleEntry) => boolean> = {
  'mlb-all-star-game':           e => e.category === 'mlb_special_event' && !!(e.event_type?.toLowerCase().includes('all-star') || e.event_type?.toLowerCase().includes('all star')),
  'home-run-derby':              e => e.category === 'mlb_special_event' && !!e.event_type?.toLowerCase().includes('home run derby'),
  'wild-card-game':              e => e.category === 'mlb_special_event' && !!e.event_type?.toLowerCase().includes('wild card'),
  'division-series-alds':        e => e.category === 'mlb_special_event' && !!e.event_type?.toLowerCase().includes('alds'),
  'division-series-nlds':        e => e.category === 'mlb_special_event' && !!e.event_type?.toLowerCase().includes('nlds'),
  'championship-series-alcs':    e => e.category === 'mlb_special_event' && !!e.event_type?.toLowerCase().includes('alcs'),
  'championship-series-nlcs':    e => e.category === 'mlb_special_event' && !!e.event_type?.toLowerCase().includes('nlcs'),
  'world-series':                e => e.category === 'mlb_special_event' && !!e.event_type?.toLowerCase().includes('world series'),
  'field-of-dreams-game':        e => e.category === 'mlb_special_event' && !!e.event_type?.toLowerCase().includes('field of dreams'),
  'spring-training-cactus':      e => e.category === 'spring_training',
  'spring-training-grapefruit':  e => e.category === 'spring_training',
}

function eventDefaultType(slug: string): string {
  const map: Record<string, string> = {
    'mlb-all-star-game': 'All-Star Game', 'home-run-derby': 'Home Run Derby',
    'wild-card-game': 'Wild Card Game', 'division-series-alds': 'ALDS',
    'division-series-nlds': 'NLDS', 'championship-series-alcs': 'ALCS',
    'championship-series-nlcs': 'NLCS', 'world-series': 'World Series',
    'field-of-dreams-game': 'Field of Dreams Game',
  }
  return map[slug] ?? ''
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ─── MLB Stadium card ─────────────────────────────────────────────────────────

function StadiumCard({ stadium, visited, visitDate, visitCount, nextGame, photo }: {
  stadium: Stadium; visited: boolean; visitDate?: string; visitCount?: number
  nextGame?: NextGameInfo; photo?: string
}) {
  const accent = TEAM_ACCENT[stadium.abbreviation] ?? '#1F6FEB'
  return (
    <Link href={`/stadiums/${stadium.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div className="stadium-card" style={{ backgroundColor: '#111827', border: visited ? '1px solid rgba(63,185,80,0.4)' : '1px solid #21262D', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer', opacity: visited ? 1 : 0.78, boxShadow: visited ? '0 0 14px rgba(63,185,80,0.10)' : 'none', transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s, opacity 0.15s' }}>
        <div style={{ height: 136, position: 'relative', flexShrink: 0, overflow: 'hidden', background: `linear-gradient(to bottom, ${hexToRgba(accent, 0.55)} 0%, ${hexToRgba(accent, 0.2)} 100%)`, borderTop: `3px solid ${accent}` }}>
          {photo && <img src={photo} alt={stadium.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)' }} />
          {visited && <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#3FB950', border: '2px solid rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#0B1117', fontWeight: 900 }}>✓</div>}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <TeamLogo abbreviation={stadium.abbreviation} size={80} />
          </div>
        </div>
        <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stadium.team}</div>
          <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stadium.name}</div>
          <div style={{ fontSize: 13, color: '#8B949E' }}>{stadium.city}</div>
          <div style={{ flex: 1, minHeight: 8 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              {visited ? (
                <>
                  <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#3FB950', backgroundColor: 'rgba(63,185,80,0.12)', border: '1px solid rgba(63,185,80,0.25)', padding: '2px 7px', borderRadius: 999 }}>Visited ✓</span>
                  {visitCount && visitCount > 1 && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)', padding: '2px 7px', borderRadius: 999 }}>{visitCount}×</span>}
                  {visitDate && <span style={{ fontSize: 13, color: '#8B949E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{fmtDate(visitDate)}</span>}
                </>
              ) : (
                <>
                  <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.25)', padding: '2px 8px', borderRadius: 999 }}>On the List</span>
                  {nextGame && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}><CalendarDays size={11} color="#C9D1D9" style={{ flexShrink: 0 }}/>{nextGame.date} vs {TEAM_NICKNAME[nextGame.opponentAbbr] ?? nextGame.opponentAbbr}</span>}
                </>
              )}
            </div>
            <ChevronRight size={13} color="#8B949E" style={{ flexShrink: 0 }} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event, attendedCount, onLog }: {
  event: BaseballEvent; attendedCount: number; onLog: () => void
}) {
  const meta = EVENT_META[event.category] ?? { emoji: '🏆', color: '#F5A623', label: event.category }
  const attended = attendedCount > 0
  const gradColor = EVENT_GRADIENT[event.category] ?? meta.color
  return (
    <div className="stadium-card" style={{ backgroundColor: '#111827', border: attended ? '1px solid rgba(63,185,80,0.4)' : '1px solid #21262D', borderTop: `3px solid ${meta.color}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}>
      <div style={{ height: 136, position: 'relative', overflow: 'hidden' }}>
        {event.image_url
          ? <img src={event.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${hexToRgba(gradColor, 0.35)} 0%, ${hexToRgba(gradColor, 0.12)} 100%)` }} />
        }
        {event.image_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.45) 100%)' }} />}
        {attended && <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#3FB950', border: '2px solid rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#0B1117', fontWeight: 900 }}>✓</div>}
      </div>
      <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3 }}>{event.name}</div>
        {event.description && <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.description}</div>}
        <div style={{ flex: 1, minHeight: 8 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          {attended ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#3FB950', backgroundColor: 'rgba(63,185,80,0.12)', border: '1px solid rgba(63,185,80,0.25)', padding: '2px 8px', borderRadius: 999 }}>
              Attended {attendedCount > 1 ? `${attendedCount}×` : '✓'}
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.25)', padding: '2px 8px', borderRadius: 999 }}>Not yet</span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onLog() }}
            style={{ fontSize: 13, fontWeight: 700, color: meta.color, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
          >
            + Log
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Experience card ──────────────────────────────────────────────────────────

function ExperienceCard({ exp, visited, onLog }: {
  exp: BaseballExperience; visited: boolean; onLog: () => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const loc = [exp.city, exp.state ?? exp.country].filter(Boolean).join(', ')
  const showImage = exp.image_url && !imgFailed
  return (
    <div className="stadium-card" style={{ backgroundColor: '#111827', border: visited ? '1px solid rgba(63,185,80,0.4)' : '1px solid #21262D', borderTop: '3px solid #8B949E', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}>
      <div style={{ height: 136, position: 'relative', overflow: 'hidden' }}>
        {showImage
          ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={exp.image_url!} alt="" onError={() => setImgFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.45) 100%)' }} />
            </>
          : <>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0A1628 0%, #1B2F4E 100%)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 60, height: 60, border: '2px solid rgba(255,255,255,0.15)', transform: 'rotate(45deg)', borderRadius: 2 }} />
              </div>
            </>
        }
        {visited && <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#3FB950', border: '2px solid rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#0B1117', fontWeight: 900 }}>✓</div>}
      </div>
      <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={10} color="#8B949E" />
          <span style={{ fontSize: 12, color: '#8B949E' }}>{loc}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3 }}>{exp.name}</div>
        {exp.description && <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{exp.description}</div>}
        <div style={{ flex: 1, minHeight: 8 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          {visited ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#3FB950', backgroundColor: 'rgba(63,185,80,0.12)', border: '1px solid rgba(63,185,80,0.25)', padding: '2px 8px', borderRadius: 999 }}>Visited ✓</span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', border: '1px solid rgba(139,148,158,0.25)', padding: '2px 8px', borderRadius: 999 }}>Not yet</span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onLog() }}
            style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
          >
            + Log
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Minor League card ────────────────────────────────────────────────────────

function MinorLeagueCard({ stadium, visitCount }: {
  stadium: MinorLeagueStadium; visitCount: number
}) {
  const visited = visitCount > 0
  const affiliateAccent = TEAM_ACCENT[stadium.affiliate] ?? '#1F6FEB'
  return (
    <Link href={`/minor-league/${stadium.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div className="stadium-card" style={{ backgroundColor: '#111827', border: visited ? '1px solid rgba(63,185,80,0.4)' : '1px solid #21262D', borderTop: `3px solid ${affiliateAccent}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer', opacity: visited ? 1 : 0.82, transition: 'transform 0.15s, box-shadow 0.15s' }}>
        <div style={{ height: 136, position: 'relative', overflow: 'hidden' }}>
          {stadium.image_url
            ? <img src={stadium.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />
            : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${hexToRgba(affiliateAccent, 0.2)} 0%, ${hexToRgba(affiliateAccent, 0.06)} 100%)` }} />
          }
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <MiLBLogo milbTeamId={stadium.milb_team_id} fallbackAbbr={stadium.affiliate} size={80} logoUrl={stadium.logo_url} />
          </div>
          {visited && <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#3FB950', border: '2px solid rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#0B1117', fontWeight: 900 }}>✓</div>}
        </div>
        <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', flex: 1, gap: 3 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.2 }}>{stadium.team}</div>
          <div style={{ fontSize: 13, color: '#8B949E' }}>{stadium.name}</div>
          <div style={{ fontSize: 13, color: '#8B949E' }}>{stadium.city}, {stadium.state}</div>
          <div style={{ flex: 1, minHeight: 6 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#F5A623', backgroundColor: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', padding: '2px 7px', borderRadius: 999 }}>{stadium.level}</span>
            <span style={{ fontSize: 12, color: '#8B949E' }}>aff: {stadium.affiliate}</span>
            {visited ? (
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#3FB950', backgroundColor: 'rgba(63,185,80,0.12)', border: '1px solid rgba(63,185,80,0.25)', padding: '2px 7px', borderRadius: 999 }}>{visitCount > 1 ? `${visitCount}×` : '✓'}</span>
            ) : (
              <ChevronRight size={12} color="#8B949E" style={{ marginLeft: 'auto' }} />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, marginTop: 4 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#E6EDF3' }}>{children}</h2>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', border: '1px solid #30363D', padding: '2px 10px', borderRadius: 999 }}>{count}</span>
    </div>
  )
}

// ─── Passport tab ─────────────────────────────────────────────────────────────

function PassportTabContent({ stamps, earnedCount }: { stamps: StampData[]; earnedCount: number }) {
  const [userInfo, setUserInfo] = useState<{ userName: string; passportNo: string } | null>(null)
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const meta = (user as any)?.user_metadata
      const fullName: string = meta?.full_name ?? meta?.name ?? ''
      const emailLocal = user?.email?.split('@')[0] ?? ''
      const raw = fullName || emailLocal
      const userName = raw.charAt(0).toUpperCase() + raw.slice(1)
      const uid = user?.id ?? '00000000-0000-0000-0000-000000000000'
      const passportNo = 'USR-' + uid.replace(/-/g, '').slice(0, 8).toUpperCase()
      setUserInfo({ userName, passportNo })
    })
  }, [])
  if (!userInfo) return <div style={{ textAlign: 'center', padding: '56px 16px', color: '#8B949E', fontSize: 15 }}>Loading passport…</div>
  return <PassportGrid stamps={stamps} userName={userInfo.userName} passportNo={userInfo.passportNo} earnedCount={earnedCount} />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StadiumsPage() {
  const [stadiums, setStadiums]   = useState<Stadium[]>([])
  const [visits, setVisits]       = useState<VisitRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [sortKey, setSortKey]     = useState<SortKey>('team')
  const [filterLeague, setFilterLeague] = useState<'all' | 'AL' | 'NL'>('all')
  const [activeTab, setActiveTab] = useState<TabKey>('mlb')
  const [nextGames, setNextGames] = useState<Record<string, NextGameInfo>>({})
  const [photos, setPhotos]       = useState<Record<string, string>>({})

  // New tab data
  const [baseballEvents, setBaseballEvents]     = useState<BaseballEvent[]>([])
  const [experiences, setExperiences]           = useState<BaseballExperience[]>([])
  const [minorLeagueStadiums, setMlStadiums]    = useState<MinorLeagueStadium[]>([])
  const [bleEntries, setBleEntries]             = useState<BleEntry[]>([])

  // Log form state
  const [logOpen, setLogOpen]             = useState(false)
  const [logCategory, setLogCategory]     = useState<BaseballLifeCategory | undefined>()
  const [logEventType, setLogEventType]   = useState<string | undefined>()

  function openLog(cat: BaseballLifeCategory, eventType?: string) {
    setLogCategory(cat)
    setLogEventType(eventType)
    setLogOpen(true)
  }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('stadiums').select('*').order('team'),
      supabase.from('stadium_visits').select('stadium_id, visit_date').order('visit_date', { ascending: false }),
      fetch('/api/next-games').then(r => r.ok ? r.json() : {}),
      supabase.from('baseball_events').select('*').order('sort_order'),
      supabase.from('baseball_experiences').select('*').order('sort_order'),
      supabase.from('minor_league_stadiums').select('id,name,team,abbreviation,city,state,level,affiliate,affiliate_full,description,milb_team_id,image_url,logo_url').order('sort_order'),
      supabase.from('baseball_life_entries').select('id,category,event_type,venue,minor_league_stadium_id'),
    ]).then(([{ data: s }, { data: v }, games, { data: ev }, { data: ex }, { data: mls }, { data: ble }]) => {
      setStadiums(s ?? [])
      setVisits((v as VisitRow[]) ?? [])
      setNextGames(games ?? {})
      setBaseballEvents((ev ?? []) as BaseballEvent[])
      setExperiences((ex ?? []) as BaseballExperience[])
      setMlStadiums((mls ?? []) as MinorLeagueStadium[])
      setBleEntries((ble ?? []) as BleEntry[])
      setLoading(false)
      ;(s ?? []).forEach((stadium: Stadium) => {
        fetchStadiumPhoto(stadium.abbreviation).then(url => {
          if (url) setPhotos(prev => ({ ...prev, [stadium.abbreviation]: url }))
        })
      })
    })
  }, [])

  const reloadBle = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('baseball_life_entries').select('id,category,event_type,venue,minor_league_stadium_id')
    setBleEntries((data ?? []) as BleEntry[])
  }, [])

  const visitedIds    = useMemo(() => new Set(visits.map(v => v.stadium_id)), [visits])
  const latestVisit   = useMemo(() => { const m: Record<string, string> = {}; visits.forEach(v => { if (!m[v.stadium_id]) m[v.stadium_id] = v.visit_date }); return m }, [visits])
  const visitCountMap = useMemo(() => { const m: Record<string, number> = {}; visits.forEach(v => { m[v.stadium_id] = (m[v.stadium_id] ?? 0) + 1 }); return m }, [visits])

  const passportStamps = useMemo<StampData[]>(() =>
    stadiums.map(s => ({
      stadiumId: s.id, abbr: s.abbreviation,
      visitDate: visits.filter(v => v.stadium_id === s.id).sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0]?.visit_date ?? null,
    })), [stadiums, visits])

  const visitedCount = visitedIds.size
  const pct = Math.round((visitedCount / 30) * 100)

  const filtered = useMemo(() => {
    if (activeTab !== 'mlb') return []
    const list = stadiums.filter(s => {
      const q = search.toLowerCase()
      if (q && !s.name.toLowerCase().includes(q) && !s.team.toLowerCase().includes(q) && !s.city.toLowerCase().includes(q)) return false
      if (filterLeague !== 'all' && s.league !== filterLeague) return false
      return true
    })
    list.sort((a, b) => (a[sortKey] as string).localeCompare(b[sortKey] as string))
    return list
  }, [stadiums, search, sortKey, filterLeague, activeTab])

  const visitedList   = useMemo(() => filtered.filter(s =>  visitedIds.has(s.id)), [filtered, visitedIds])
  const unvisitedList = useMemo(() => filtered.filter(s => !visitedIds.has(s.id)), [filtered, visitedIds])

  // BLE lookups
  const eventAttendedCount = useCallback((slug: string) => {
    const fn = EVENT_MATCH[slug]
    if (!fn) return 0
    return bleEntries.filter(fn).length
  }, [bleEntries])

  const experienceVisited = useCallback((exp: BaseballExperience) => {
    const nameLow = exp.name.toLowerCase()
    return bleEntries.some(e =>
      e.category === 'pilgrimage' && (
        e.venue?.toLowerCase().includes(nameLow.split(' ').slice(0, 2).join(' ')) ||
        e.event_type?.toLowerCase().includes(nameLow.split(' ').slice(0, 2).join(' '))
      )
    )
  }, [bleEntries])

  const mlVisitCount = useCallback((stadiumId: string) =>
    bleEntries.filter(e => e.category === 'minor_league' && e.minor_league_stadium_id === stadiumId).length,
    [bleEntries])

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'mlb',          label: 'MLB'          },
    { key: 'events',       label: 'Events'       },
    { key: 'experiences',  label: 'Experiences'  },
    { key: 'minor_league', label: 'Minor League' },
    { key: 'passport',     label: 'Passport'     },
  ]

  return (
    <div style={{ color: '#E6EDF3', overflowX: 'hidden' }}>
      <main style={{ minHeight: '100vh' }}>

        {/* ── Hero progress banner ──────────────────────────────── */}
        <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
            {(() => {
              const isML   = activeTab === 'minor_league'
              const isEv   = activeTab === 'events'
              const isExp  = activeTab === 'experiences'
              const mlTotal   = minorLeagueStadiums.length
              const mlVisited = minorLeagueStadiums.filter(st => mlVisitCount(st.id) > 0).length
              const mlPct     = mlTotal > 0 ? Math.round((mlVisited / mlTotal) * 100) : 0
              const evTotal    = baseballEvents.length
              const evAttended = baseballEvents.filter(ev => eventAttendedCount(ev.slug) > 0).length
              const evPct      = evTotal > 0 ? Math.round((evAttended / evTotal) * 100) : 0
              const expTotal    = experiences.length
              const expAttended = experiences.filter(exp => experienceVisited(exp)).length
              const expPct      = expTotal > 0 ? Math.round((expAttended / expTotal) * 100) : 0

              const shownCount = isML ? mlVisited : isEv ? evAttended : isExp ? expAttended : visitedCount
              const shownTotal = isML ? mlTotal   : isEv ? evTotal    : isExp ? expTotal    : 30
              const shownPct   = isML ? mlPct     : isEv ? evPct      : isExp ? expPct      : pct
              const shownRemaining = shownTotal - shownCount
              const eyebrow = isML ? 'The Farm System' : isEv ? 'The Events' : isExp ? 'The Pilgrimages' : 'The Ballparks'
              const subtitle = isML ? 'Chasing every High-A park and beyond'
                : isEv ? 'Chasing every marquee event on the calendar'
                : isExp ? 'Chasing every museum, factory, and historic park'
                : 'Chasing all 30 MLB ballparks'
              const barColor = isML ? '#F5A623' : isEv ? '#F5A623' : isExp ? '#58A6FF' : '#3FB950'
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{eyebrow}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#E6EDF3', lineHeight: 1.1, marginBottom: 4 }}>{shownCount} of {shownTotal} visited</div>
                      <div style={{ fontSize: 14, color: '#8B949E' }}>{subtitle}</div>
                    </div>
                    {activeTab === 'mlb' && (
                      <button onClick={() => { setShowSearch(v => !v); if (showSearch) setSearch('') }} aria-label="Toggle search" style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid #30363D', borderRadius: '50%', width: 36, height: 36, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                        {showSearch ? <X size={16} color="#8B949E" /> : <Search size={16} color="#8B949E" />}
                      </button>
                    )}
                  </div>
                  <div style={{ height: 8, backgroundColor: '#30363D', borderRadius: 4, marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${shownPct}%`, backgroundColor: barColor, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div><span style={{ fontSize: 20, fontWeight: 800, color: '#3FB950' }}>{shownCount}</span><span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>visited</span></div>
                    <div><span style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3' }}>{shownRemaining}</span><span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>remaining</span></div>
                    <div><span style={{ fontSize: 20, fontWeight: 800, color: '#F5A623' }}>{shownPct}%</span><span style={{ fontSize: 13, color: '#8B949E', marginLeft: 4 }}>complete</span></div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>


        {/* ── Tabs ─────────────────────────────────────────────── */}
        <div style={{ backgroundColor: '#161B22', borderBottom: '1px solid #30363D', overflowX: 'auto' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 0, minWidth: 'max-content' }}>
            {TABS.map(({ key, label }) => {
              const active = activeTab === key
              return (
                <button key={key} onClick={() => setActiveTab(key)} style={{ padding: '12px 18px', fontSize: 14, fontWeight: active ? 700 : 500, cursor: 'pointer', background: 'none', border: 'none', color: active ? '#E6EDF3' : '#8B949E', borderBottom: active ? '2px solid #1F6FEB' : '2px solid transparent', transition: 'color 0.15s, border-color 0.15s', whiteSpace: 'nowrap' }}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── MLB filters (sticky) ──────────────────────────────── */}
        {activeTab === 'mlb' && (
          <div style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#0B1117', borderBottom: '1px solid #30363D' }}>
            <div style={{ maxWidth: 960, margin: '0 auto', padding: '10px 16px' }}>
              {showSearch && (
                <input type="text" placeholder="Search team, stadium, city..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ width: '100%', padding: '8px 12px', borderRadius: 8, marginBottom: 10, border: '1.5px solid #30363D', fontSize: 14, backgroundColor: '#1C2430', color: '#E6EDF3', outline: 'none', boxSizing: 'border-box' }} />
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => scrollToSection('visited-section')} style={{ padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', backgroundColor: 'rgba(63,185,80,0.1)', color: '#3FB950', border: '1.5px solid rgba(63,185,80,0.3)' }}>
                  Visited <span style={{ fontWeight: 400, fontSize: 13 }}>({visitedCount})</span>
                </button>
                <button onClick={() => scrollToSection('not-yet-section')} style={{ padding: '8px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', backgroundColor: 'transparent', color: '#8B949E', border: '1.5px solid #30363D' }}>
                  On the List <span style={{ fontWeight: 400, fontSize: 13 }}>({30 - visitedCount})</span>
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <select value={filterLeague} onChange={e => setFilterLeague(e.target.value as 'all' | 'AL' | 'NL')} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #30363D', fontSize: 14, color: '#8B949E', backgroundColor: '#1C2430', cursor: 'pointer' }}>
                    <option value="all">All</option><option value="AL">AL</option><option value="NL">NL</option>
                  </select>
                  <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #30363D', fontSize: 14, color: '#8B949E', backgroundColor: '#1C2430', cursor: 'pointer' }}>
                    <option value="team">Team</option><option value="name">Stadium</option><option value="state">State</option><option value="division">Division</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────── */}
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '56px 16px', color: '#8B949E', fontSize: 15 }}>Loading…</div>

          ) : activeTab === 'events' ? (
            /* ── Events tab ──────────────────────────────────── */
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3', marginBottom: 4 }}>MLB Events</div>
                <div style={{ fontSize: 13, color: '#8B949E' }}>All-Star, World Series, Playoffs, and more. Track every one.</div>
              </div>

              {/* Marquee Events — All-Star, Home Run Derby, World Series */}
              {(['world_series','all_star','home_run_derby','opening_day'] as const).some(cat => baseballEvents.some(e => e.category === cat)) && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    🏆 Marquee Events
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(['world_series','all_star','home_run_derby','opening_day'] as const).flatMap(cat =>
                      baseballEvents.filter(e => e.category === cat).map(ev => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          attendedCount={eventAttendedCount(ev.slug)}
                          onLog={() => openLog('mlb_special_event', eventDefaultType(ev.slug))}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Remaining sections */}
              {(['playoffs'] as const).map(cat => {
                const PLAYOFF_ORDER = ['championship-series-alcs', 'championship-series-nlcs', 'division-series-alds', 'division-series-nlds', 'wild-card-game']
                const catEvents = baseballEvents
                  .filter(e => e.category === cat)
                  .sort((a, b) => {
                    if (cat !== 'playoffs') return 0
                    return PLAYOFF_ORDER.indexOf(a.slug) - PLAYOFF_ORDER.indexOf(b.slug)
                  })
                if (catEvents.length === 0) return null
                const meta = EVENT_META[cat]
                return (
                  <div key={cat} style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: meta.color, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {meta.emoji} {meta.label}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {catEvents.map(ev => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          attendedCount={eventAttendedCount(ev.slug)}
                          onLog={() => openLog(
                            ev.category === 'spring_training' ? 'spring_training' :
                            ev.category === 'amateur' ? 'mlb_special_event' :
                            'mlb_special_event',
                            eventDefaultType(ev.slug)
                          )}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* The Extended Season — spring training, amateur leagues, international, exhibition */}
              {(['spring_training','field_of_dreams','amateur','international','exhibition'] as const).some(cat => baseballEvents.some(e => e.category === cat)) && (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#58A6FF', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    🌎 The Extended Season
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(['spring_training','field_of_dreams','amateur','international','exhibition'] as const).flatMap(cat =>
                      baseballEvents.filter(e => e.category === cat).map(ev => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          attendedCount={eventAttendedCount(ev.slug)}
                          onLog={() => openLog(
                            ev.category === 'spring_training' ? 'spring_training' :
                            ev.category === 'amateur' ? 'mlb_special_event' :
                            'mlb_special_event',
                            eventDefaultType(ev.slug)
                          )}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </>

          ) : activeTab === 'experiences' ? (
            /* ── Experiences tab ─────────────────────────────── */
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3', marginBottom: 4 }}>Baseball Pilgrimages</div>
                <div style={{ fontSize: 13, color: '#8B949E' }}>Museums, factories, historic parks. The must-visit baseball destinations.</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {experiences.map(exp => (
                  <ExperienceCard
                    key={exp.id}
                    exp={exp}
                    visited={experienceVisited(exp)}
                    onLog={() => openLog('pilgrimage', exp.name)}
                  />
                ))}
              </div>
            </>

          ) : activeTab === 'minor_league' ? (
            /* ── Minor League tab ────────────────────────────── */
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#E6EDF3', marginBottom: 4 }}>Minor League Stadiums</div>
                <div style={{ fontSize: 13, color: '#8B949E' }}>High-A and beyond. Track every minor league game you attend.</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {minorLeagueStadiums.map(st => (
                  <MinorLeagueCard key={st.id} stadium={st} visitCount={mlVisitCount(st.id)} />
                ))}
              </div>
            </>

          ) : activeTab === 'passport' ? (
            /* ── Passport tab ────────────────────────────────── */
            <PassportTabContent stamps={passportStamps} earnedCount={visitedCount} />

          ) : (
            /* ── MLB tab ─────────────────────────────────────── */
            <>
              <div id="visited-section" style={{ marginBottom: 40, scrollMarginTop: 60 }}>
                <SectionHeader count={visitedList.length}>Visited</SectionHeader>
                {visitedList.length === 0 ? (
                  <div style={{ backgroundColor: '#111827', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>⚾</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 6 }}>{search || filterLeague !== 'all' ? 'No parks match your filters' : 'Your road trip starts here'}</div>
                    <div style={{ fontSize: 13, color: '#8B949E' }}>{search || filterLeague !== 'all' ? 'Try adjusting your search or filters.' : 'Head to a game and log your first stadium!'}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {visitedList.map(stadium => (
                      <StadiumCard key={stadium.id} stadium={stadium} visited visitDate={latestVisit[stadium.id]} visitCount={visitCountMap[stadium.id]} nextGame={nextGames[stadium.abbreviation]} photo={photos[stadium.abbreviation]} />
                    ))}
                  </div>
                )}
              </div>
              <div id="not-yet-section" style={{ scrollMarginTop: 60 }}>
                <SectionHeader count={unvisitedList.length}>On the List</SectionHeader>
                {unvisitedList.length === 0 ? (
                  <div style={{ backgroundColor: '#111827', borderRadius: 12, border: '1px solid #30363D', padding: '32px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 4 }}>{search || filterLeague !== 'all' ? 'No parks match your filters.' : 'You\'ve visited them all!'}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {unvisitedList.map(stadium => (
                      <StadiumCard key={stadium.id} stadium={stadium} visited={false} nextGame={nextGames[stadium.abbreviation]} photo={photos[stadium.abbreviation]} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Log form ─────────────────────────────────────────────── */}
      {logOpen && (
        <BaseballLifeForm
          defaultCategory={logCategory}
          defaultEventType={logEventType}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); reloadBle() }}
        />
      )}

      <style>{`
        .stadium-card:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 24px rgba(0,0,0,0.4) !important;
          border-color: #8B949E !important;
          opacity: 1 !important;
        }
        .stadium-card:active { transform: translateY(0) !important; transition: transform 0.05s !important; }
      `}</style>
    </div>
  )
}
