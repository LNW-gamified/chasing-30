'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Check, X, Share2, Calendar, MapPin, Search, ChevronRight, Zap, Hand, Plus, Pencil } from 'lucide-react'
import type { SerializableMilestone, StadiumVisit, Stadium, SpecialEvent, BaseballLifeEntry } from '@/types'
import { createClient } from '@/lib/supabase'
import TeamLogo from '@/components/TeamLogo'
import MiLBLogo from '@/components/MiLBLogo'
import { STATIC_EXPERIENCES, type StaticExperience } from '@/lib/static-experiences'
import SpecialVisitButton from '@/components/SpecialVisitButton'
import { classifyDayNightHeuristic } from '@/lib/sunrise-sunset'
import { MILESTONE_POINTS } from '@/lib/ranks'
import GiveawayFoodEditor, { type EditorItem } from '@/components/GiveawayFoodEditor'
import CollectibleLightbox from '@/components/CollectibleLightbox'

// ── Constants ──────────────────────────────────────────────────────────────

// Achievements are colored by difficulty tier, derived from their point value
// (the same values already defined in MILESTONE_POINTS), so harder
// achievements read as more prestigious instead of every card looking equally
// important regardless of whether it's worth 50 or 300 points.
function getTierColor(pts: number): { name: string; color: string; glow: string } {
  if (pts >= 200) return { name: 'Diamond', color: '#B98CFF', glow: 'rgba(185,140,255,0.35)' }
  if (pts >= 150) return { name: 'Gold',    color: '#F5A623', glow: 'rgba(245,166,35,0.35)' }
  if (pts >= 100) return { name: 'Silver',  color: '#C7CCD4', glow: 'rgba(199,204,212,0.3)' }
  return               { name: 'Bronze',  color: '#D08A56', glow: 'rgba(208,138,86,0.3)' }
}

// Which experiences take a "player name" extra field
const PLAYER_NAME_EXP = new Set(['autograph', 'met_player'])

// Giveaway item types for the collection
const GIVEAWAY_TYPES = [
  { value: 'bobblehead', label: 'Bobblehead', emoji: '🪆' },
  { value: 'figurine',   label: 'Figurine',   emoji: '🏺' },
  { value: 'jersey',     label: 'Jersey',     emoji: '👕' },
  { value: 'tshirt',     label: 'T-Shirt',    emoji: '👔' },
  { value: 'hat',        label: 'Hat',        emoji: '🎩' },
  { value: 'poster',     label: 'Poster',     emoji: '📋' },
  { value: 'other',      label: 'Other',      emoji: '🎁' },
] as const

type GiveawayTypeValue = typeof GIVEAWAY_TYPES[number]['value']

// ── Types ──────────────────────────────────────────────────────────────────

interface AchievementClaim {
  id: string
  achievement_id: string
  stadium_visit_id: string | null
  claim_date: string
  notes: string | null
  extra_data: Record<string, unknown>
  giveaway_type: GiveawayTypeValue | null
  created_at: string
}


// ── Helper functions ───────────────────────────────────────────────────────

interface EarningContext { date: string; location?: string }

function getNthUniqueVisit(n: number, sorted: StadiumVisit[], stadiums: Stadium[]): EarningContext | null {
  const seen = new Set<string>()
  for (const v of sorted) {
    if (!seen.has(v.stadium_id)) {
      seen.add(v.stadium_id)
      if (seen.size === n) return { date: v.visit_date, location: stadiums.find(s => s.id === v.stadium_id)?.name }
    }
  }
  return null
}

function getCompletionContext(group: Stadium[], sorted: StadiumVisit[], stadiums: Stadium[]): EarningContext | null {
  const groupIds = new Set(group.map(s => s.id))
  const seen = new Set<string>()
  for (const v of sorted) {
    if (groupIds.has(v.stadium_id) && !seen.has(v.stadium_id)) {
      seen.add(v.stadium_id)
      if (seen.size === groupIds.size) return { date: v.visit_date, location: stadiums.find(s => s.id === v.stadium_id)?.name }
    }
  }
  return null
}

function getSerializableMilestoneContext(
  milestone: SerializableMilestone,
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[]
): EarningContext | null {
  const sv = [...allVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))
  const se = [...allEvents].sort((a, b) => a.event_date.localeCompare(b.event_date))
  const sn = (id: string) => allStadiums.find(s => s.id === id)?.name

  switch (milestone.id) {
    case 'al_east':    return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'East'),    sv, allStadiums)
    case 'al_central': return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'Central'), sv, allStadiums)
    case 'al_west':    return getCompletionContext(allStadiums.filter(s => s.league === 'AL' && s.division === 'West'),    sv, allStadiums)
    case 'nl_east':    return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'East'),    sv, allStadiums)
    case 'nl_central': return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'Central'), sv, allStadiums)
    case 'nl_west':    return getCompletionContext(allStadiums.filter(s => s.league === 'NL' && s.division === 'West'),    sv, allStadiums)
    case 'american_league': return getCompletionContext(allStadiums.filter(s => s.league === 'AL'), sv, allStadiums)
    case 'national_league': return getCompletionContext(allStadiums.filter(s => s.league === 'NL'), sv, allStadiums)
    case 'world_series_attendance':   { const e = se.find(e => e.event_type === 'world_series');   return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null }
    case 'all_star_attendance':       { const e = se.find(e => e.event_type === 'all_star_game');  return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null }
    case 'postseason_attendance':     { const e = se.find(e => e.event_type === 'postseason');     return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null }
    case 'spring_training_attendance':{ const e = se.find(e => e.event_type === 'spring_training');return e ? { date: e.event_date, location: e.stadium_name ?? undefined } : null }
    case 'hall_of_fame_visit': { const e = se.find(e => e.event_type === 'historic_ballpark' && e.venue_name === 'National Baseball Hall of Fame'); return e ? { date: e.event_date, location: 'Cooperstown, NY' } : null }
    case 'field_of_dreams_visit': { const e = se.find(e => e.event_type === 'historic_ballpark' && e.venue_name === 'Field of Dreams'); return e ? { date: e.event_date, location: 'Dyersville, IA' } : null }
    case 'louisville_slugger_visit': { const e = se.find(e => e.venue_name?.toLowerCase().includes('louisville slugger')); return e ? { date: e.event_date, location: 'Louisville, KY' } : null }
    case 'rawlings_factory_visit':   { const e = se.find(e => e.venue_name?.toLowerCase().includes('rawlings'));           return e ? { date: e.event_date, location: 'Rawlings Factory' } : null }
    case 'negro_leagues_visit':      { const e = se.find(e => e.venue_name === 'Negro Leagues Baseball Museum');          return e ? { date: e.event_date, location: 'Kansas City, MO' } : null }
    case 'doubleday_visit':          { const e = se.find(e => e.venue_name?.toLowerCase().includes('doubleday'));         return e ? { date: e.event_date, location: 'Cooperstown, NY' } : null }
    case 'international_game': { const e = se.find(e => e.event_type === 'international'); return e ? { date: e.event_date, location: e.stadium_name ?? e.city ?? undefined } : null }
    case 'historic_ballparks_all': {
      const VENUES = ['Louisville Slugger Museum & Factory', 'National Baseball Hall of Fame', 'Negro Leagues Baseball Museum', 'Field of Dreams', 'Rickwood Field']
      const historic = se.filter(e => e.event_type === 'historic_ballpark' && e.venue_name && VENUES.includes(e.venue_name))
      const seen = new Set<string>()
      for (const e of historic) { seen.add(e.venue_name!); if (seen.size === VENUES.length) return { date: e.event_date, location: e.venue_name ?? undefined } }
      return null
    }
    case 'walk_off_witness':   { const v = sv.find(v => v.game_events?.includes('walk_off'));            return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'double_walk_off':    { const v = sv.filter(v => v.game_events?.includes('walk_off'))[1];      return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'no_hit_wonder':      { const v = sv.find(v => v.game_events?.includes('no_hitter'));           return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'perfect_day':        { const v = sv.find(v => v.game_events?.includes('perfect_game'));        return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'committee_work':     { const v = sv.find(v => v.game_events?.includes('combined_no_hitter'));  return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'extra_credit':       { const v = sv.find(v => v.game_events?.includes('extra_innings'));       return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'marathon_man':       { const v = sv.find(v => v.game_events?.includes('twelve_plus_innings')); return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'lights_out':         { const v = sv.find(v => v.game_events?.includes('shutout'));             return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'grand_slam_witness': { const v = sv.find(v => v.game_events?.includes('grand_slam'));          return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'full_cycle':         { const v = sv.find(v => v.game_events?.includes('cycle'));               return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'history_maker':      { const v = sv.find(v => v.game_events?.includes('milestone_hr'));        return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'run_factory':        { const v = sv.find(v => v.game_events?.includes('run_factory'));         return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    case 'pitchers_duel':      { const v = sv.find(v => v.game_events?.includes('pitchers_duel'));       return v ? { date: v.visit_date, location: sn(v.stadium_id) } : null }
    default: return null
  }
}

function getMilestoneProgress(
  id: string,
  allVisits: StadiumVisit[],
  allStadiums: Stadium[],
  allEvents: SpecialEvent[]
): { current: number; total: number } | null {
  const visitedIds   = new Set(allVisits.map(v => v.stadium_id))
  const divCount = (lg: string, dv: string) => allStadiums.filter(s => s.league === lg && s.division === dv).length
  const divVis   = (lg: string, dv: string) => allStadiums.filter(s => s.league === lg && s.division === dv && visitedIds.has(s.id)).length
  const lgCount  = (lg: string) => allStadiums.filter(s => s.league === lg).length
  const lgVis    = (lg: string) => allStadiums.filter(s => s.league === lg && visitedIds.has(s.id)).length

  switch (id) {
    case 'al_east':    return { current: divVis('AL', 'East'),    total: divCount('AL', 'East')    }
    case 'al_central': return { current: divVis('AL', 'Central'), total: divCount('AL', 'Central') }
    case 'al_west':    return { current: divVis('AL', 'West'),    total: divCount('AL', 'West')    }
    case 'nl_east':    return { current: divVis('NL', 'East'),    total: divCount('NL', 'East')    }
    case 'nl_central': return { current: divVis('NL', 'Central'), total: divCount('NL', 'Central') }
    case 'nl_west':    return { current: divVis('NL', 'West'),    total: divCount('NL', 'West')    }
    case 'american_league': return { current: lgVis('AL'), total: lgCount('AL') }
    case 'national_league': return { current: lgVis('NL'), total: lgCount('NL') }
    case 'historic_ballparks_all': {
      const VENUES = ['Louisville Slugger Museum & Factory', 'National Baseball Hall of Fame', 'Negro Leagues Baseball Museum', 'Field of Dreams', 'Rickwood Field']
      const visited = new Set(allEvents.filter(e => e.event_type === 'historic_ballpark' && e.venue_name).map(e => e.venue_name!))
      return { current: VENUES.filter(v => visited.has(v)).length, total: VENUES.length }
    }
    case 'double_walk_off': {
      const count = allVisits.filter(v => v.game_events?.includes('walk_off')).length
      return { current: Math.min(count, 2), total: 2 }
    }
    default: return null
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function visitLabel(v: StadiumVisit, stadiums: Stadium[]): string {
  const s = stadiums.find(st => st.id === v.stadium_id)
  return `${v.visit_date} · ${s?.name ?? '?'} (${v.home_team} vs ${v.visiting_team})`
}


// ── Category definitions ───────────────────────────────────────────────────

type CategoryKey = 'all' | 'earned' | 'inprogress' | 'records'

const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: 'all',        label: 'All',              emoji: '🎯' },
  { key: 'earned',     label: 'Earned',           emoji: '✅' },
  { key: 'inprogress', label: 'In Progress',      emoji: '⏳' },
  { key: 'records',    label: 'Personal Records', emoji: '📋' },
]

const DIVISION_IDS = new Set([
  'al_east', 'al_central', 'al_west',
  'nl_east', 'nl_central', 'nl_west',
  'american_league', 'national_league',
])
const GAMEDAY_IDS = new Set([
  'walk_off_witness', 'double_walk_off', 'no_hit_wonder', 'perfect_day',
  'committee_work', 'extra_credit', 'marathon_man', 'lights_out',
  'grand_slam_witness', 'full_cycle', 'history_maker', 'run_factory', 'pitchers_duel',
])
const EXPERIENCE_MILESTONE_IDS = new Set([
  'world_series_attendance', 'all_star_attendance',
  'postseason_attendance', 'spring_training_attendance',
  'hall_of_fame_visit', 'field_of_dreams_visit',
  'louisville_slugger_visit', 'rawlings_factory_visit',
  'negro_leagues_visit', 'doubleday_visit',
  'international_game', 'historic_ballparks_all', 'full_experience',
])
const COLLECTION_IDS = new Set(['bobblehead', 'foul_ball', 'autograph', 'met_player', 'jumbotron', 'seventh_inning', 'fireworks_night', 'rivalry_game', 'enemy_territory', 'rain_delay', 'early_bird', 'jersey_day', 'night_owl'])

// Ladder milestone IDs for category routing
const LADDER_STADIUM_IDS = new Set(['stadium_explorer', 'games_attended'])
const LADDER_EXPERIENCE_IDS = new Set(['minor_league_explorer'])


// ── Confetti ───────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#F5A623', '#3FB950', '#1F6FEB', '#F85149', '#A78BFA', '#58A6FF', '#FF7B72']

function ConfettiPiece({ color, left, delay, size }: { color: string; left: number; delay: number; size: number }) {
  return (
    <div
      className="confetti-piece"
      style={{
        position: 'fixed', top: -20, left: `${left}%`, zIndex: 9999,
        width: size, height: size * 0.6,
        backgroundColor: color, borderRadius: 2,
        animationDelay: `${delay}s`,
        animationDuration: `${1.6 + Math.random() * 0.8}s`,
        pointerEvents: 'none',
      }}
    />
  )
}

// ── Component Props ────────────────────────────────────────────────────────

interface Props {
  earned: SerializableMilestone[]
  unearned: SerializableMilestone[]
  ladders: SerializableMilestone[]
  allVisits: StadiumVisit[]
  allStadiums: Stadium[]
  allEvents: SpecialEvent[]
  allBle: BaseballLifeEntry[]
  currentRankName: string
  rankTiers: Array<{ name: string; minPts: number; icon: string; description?: string }>
}

type SelectedItem =
  | { type: 'milestone'; milestone: SerializableMilestone; isEarned: boolean }
  | { type: 'static'; experience: StaticExperience }

// ── Component ──────────────────────────────────────────────────────────────

export default function MilestoneGrid({
  earned, unearned, ladders, allVisits, allStadiums, allEvents, allBle, currentRankName, rankTiers,
}: Props) {
  const [filter, setFilter]     = useState<CategoryKey>('all')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [confetti, setConfetti] = useState<{ id: number; color: string; left: number; delay: number; size: number }[]>([])
  const confettiIdRef           = useRef(0)

  // Claims
  const [claims, setClaims] = useState<AchievementClaim[]>([])

  // Claim form fields
  const [claimVisitId,        setClaimVisitId]        = useState('')
  const [claimPlayerName,     setClaimPlayerName]     = useState('')
  const [claimNotes,          setClaimNotes]          = useState('')
  const [claimSaving,         setClaimSaving]         = useState(false)

  // Edit claim state
  const [editingClaim,       setEditingClaim]      = useState<AchievementClaim | null>(null)
  const [editingExp,         setEditingExp]         = useState<StaticExperience | null>(null)
  const [editVisitId,        setEditVisitId]        = useState('')
  const [editPlayerName,     setEditPlayerName]     = useState('')
  const [editNotes,          setEditNotes]          = useState('')
  const [editClaimDate,      setEditClaimDate]      = useState('')
  const [editPhotoFile,      setEditPhotoFile]      = useState<File | null>(null)
  const [editDeletePhoto,    setEditDeletePhoto]    = useState(false)
  const [editSaving,         setEditSaving]         = useState(false)

  // Shared giveaway/food editor
  const [editingItem, setEditingItem] = useState<EditorItem | null>(null)
  const [viewingItem, setViewingItem] = useState<EditorItem | null>(null)
  const [collectionTypeFilter, setCollectionTypeFilter] = useState<string>('all')

  const [stadiumCollectibles, setStadiumCollectibles] = useState<Array<{ id: string; name: string; category: string; giveaway_type: string | null; photo_url: string | null; signed_by: string | null; acquired_from: string | null; rating: number | null; price: number | null; stadium_visit_id: string | null; baseball_life_entry_id: string | null }>>([])

  const [milbStadiums, setMilbStadiums] = useState<Array<{ id: string; milb_team_id: number | null; affiliate: string; logo_url: string | null }>>([])

  const [hasBobbleheadGiveaway, setHasBobbleheadGiveaway] = useState(false)

  // ── Data loading ──────────────────────────────────────────────────────────

  const fetchClaims = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('achievement_claims').select('*')
    if (data) setClaims(data as AchievementClaim[])
  }, [])

  const fetchCollectibles = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('collectible_log').select('id, name, category, giveaway_type, photo_url, signed_by, acquired_from, rating, price, stadium_visit_id, baseball_life_entry_id').order('created_at', { ascending: false })
    if (data) setStadiumCollectibles(data)
  }, [])

  const fetchMilbStadiums = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('minor_league_stadiums').select('id, milb_team_id, affiliate, logo_url')
    if (data) setMilbStadiums(data)
  }, [])

  useEffect(() => { fetchClaims() }, [fetchClaims])
  useEffect(() => { fetchCollectibles() }, [fetchCollectibles])
  useEffect(() => { fetchMilbStadiums() }, [fetchMilbStadiums])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('collectible_log')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'giveaway')
      .eq('giveaway_type', 'bobblehead')
      .then(({ count }) => setHasBobbleheadGiveaway((count ?? 0) > 0))
  }, [])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function closeModal() {
    setSelected(null)
    setClaimVisitId('')
    setClaimPlayerName('')
    setClaimNotes('')
  }

  async function saveClaim(exp: StaticExperience) {
    setClaimSaving(true)
    const supabase = createClient()
    const extra: Record<string, string> = {}

    if (PLAYER_NAME_EXP.has(exp.id) && claimPlayerName.trim()) {
      extra.player_name = claimPlayerName.trim()
    }

    // Bug 1 fix: use the selected game's visit_date, not today's date
    const selectedVisit = claimVisitId ? allVisits.find(v => v.id === claimVisitId) : null
    const claimDate = selectedVisit?.visit_date ?? new Date().toISOString().split('T')[0]

    await supabase
      .from('achievement_claims')
      .insert({
        achievement_id:   exp.id,
        stadium_visit_id: claimVisitId || null,
        claim_date:       claimDate,
        notes:            claimNotes.trim() || null,
        extra_data:       extra,
      })

    // Bug 2 fix: re-fetch all claims so counts update immediately
    await fetchClaims()

    setClaimVisitId('')
    setClaimPlayerName('')
    setClaimNotes('')
    setClaimSaving(false)

    if (exp.tracking_type === 'manual_once') closeModal()
  }

  async function removeClaim(claimId: string) {
    const supabase = createClient()
    await supabase.from('achievement_claims').delete().eq('id', claimId)
    setClaims(prev => prev.filter(c => c.id !== claimId))
  }

  function openEditClaim(claim: AchievementClaim, exp: StaticExperience) {
    setEditingClaim(claim)
    setEditingExp(exp)
    setEditVisitId(claim.stadium_visit_id ?? '')
    setEditPlayerName(claim.extra_data?.player_name ? String(claim.extra_data.player_name) : '')
    setEditNotes(claim.notes ?? '')
    setEditClaimDate(claim.claim_date)
    setEditPhotoFile(null)
    setEditDeletePhoto(false)
  }

  function closeEditModal() {
    setEditingClaim(null)
    setEditingExp(null)
    setEditPhotoFile(null)
    setEditDeletePhoto(false)
  }

  async function saveEditClaim() {
    if (!editingClaim || !editingExp) return
    setEditSaving(true)
    const supabase = createClient()

    // Copy existing extra_data string fields
    const extra: Record<string, string> = {}
    for (const [k, v] of Object.entries(editingClaim.extra_data)) {
      if (typeof v === 'string') extra[k] = v
    }

    // Handle photo changes
    if (editDeletePhoto) {
      delete extra.photo_url
    } else if (editPhotoFile) {
      const ext  = editPhotoFile.name.split('.').pop() ?? 'jpg'
      const path = `${editingExp.id}/${Date.now()}.${ext}`
      const { data: up } = await supabase.storage
        .from('achievement-photos')
        .upload(path, editPhotoFile, { cacheControl: '3600', upsert: false })
      if (up) {
        const { data: { publicUrl } } = supabase.storage
          .from('achievement-photos')
          .getPublicUrl(up.path)
        extra.photo_url = publicUrl
      }
    }

    // Extra-data fields per achievement type
    if (PLAYER_NAME_EXP.has(editingExp.id)) {
      if (editPlayerName.trim()) extra.player_name = editPlayerName.trim()
      else delete extra.player_name
    }

    // Derive claim_date: prefer selected visit's date, else the edited date field
    const selectedVisit = editVisitId ? allVisits.find(v => v.id === editVisitId) : null
    const claimDate = selectedVisit?.visit_date ?? editClaimDate

    await supabase
      .from('achievement_claims')
      .update({
        stadium_visit_id: editVisitId || null,
        claim_date:       claimDate,
        notes:            editNotes.trim() || null,
        extra_data:       extra,
      })
      .eq('id', editingClaim.id)

    await fetchClaims()
    setEditSaving(false)
    closeEditModal()
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const earnedIds      = new Set(earned.map(m => m.id))
  const currentRankIdx = rankTiers.findIndex(r => r.name === currentRankName)

  const earnedStaticCount = useMemo(() => {
    const claimedIds = new Set(claims.map(c => c.achievement_id))
    return STATIC_EXPERIENCES.filter(s => s.id === 'bobblehead' ? hasBobbleheadGiveaway : claimedIds.has(s.id)).length
  }, [claims, hasBobbleheadGiveaway])

  const earnedLadderCount = useMemo(
    () => ladders.filter(m => (m.currentValue ?? 0) >= (m.tiers?.[0]?.threshold ?? 1)).length,
    [ladders]
  )


  // Active challenges: top 3 by completion % across regular milestones + ladder progress
  const activeChallenges = useMemo(() => {
    const regularChallenges = unearned
      .map(m => ({ m, prog: getMilestoneProgress(m.id, allVisits, allStadiums, allEvents) }))
      .filter((x): x is { m: SerializableMilestone; prog: { current: number; total: number } } =>
        x.prog != null && x.prog.current > 0 && x.prog.current < x.prog.total
      )

    const ladderChallenges = ladders.flatMap(m => {
      const val = m.currentValue ?? 0
      if (val === 0) return []
      const nextTier = (m.tiers ?? []).find(t => t.threshold > val)
      if (!nextTier) return []
      return [{ m, prog: { current: val, total: nextTier.threshold } }]
    })

    return [...regularChallenges, ...ladderChallenges]
      .sort((a, b) => {
        const pa = a.prog.current / a.prog.total
        const pb = b.prog.current / b.prog.total
        return pb - pa
      })
      .slice(0, 3)
  }, [unearned, ladders, allVisits, allStadiums, allEvents])

  // Filtered milestones by category
  const allMilestones = [...earned, ...unearned]
  const filteredMilestones = useMemo(() => {
    return allMilestones.filter(m => {
      if (filter === 'earned')      return earnedIds.has(m.id)
      if (filter === 'inprogress') {
        if (earnedIds.has(m.id)) return false
        const prog = getMilestoneProgress(m.id, allVisits, allStadiums, allEvents)
        return prog != null && prog.current > 0
      }
      return true
    }).filter(m => {
      if (!search) return true
      const q = search.toLowerCase()
      return m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, earned, unearned, earnedIds])

  const filteredLadders = useMemo(() => {
    return ladders.filter(m => {
      if (filter === 'earned')      return (m.currentValue ?? 0) >= (m.tiers?.[0]?.threshold ?? 1)
      if (filter === 'inprogress')  return (m.currentValue ?? 0) > 0 && (m.currentValue ?? 0) < (m.tiers?.[m.tiers.length - 1]?.threshold ?? Infinity)
      if (filter === 'records')     return false
      return true
    }).filter(m => {
      if (!search) return true
      const q = search.toLowerCase()
      return m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, ladders])

  const showStatics = filter === 'all' || filter === 'earned' || filter === 'inprogress'
  const showRecords = filter === 'records'
  const filteredStatics = useMemo(() => {
    if (!showStatics) return []
    return STATIC_EXPERIENCES.filter(s => {
      if (filter === 'earned') {
        if (s.id === 'bobblehead') return hasBobbleheadGiveaway
        const claimedIds = new Set(claims.map(c => c.achievement_id))
        return claimedIds.has(s.id)
      }
      if (filter === 'inprogress') return false
      if (!search) return true
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    })
  }, [showStatics, filter, search, claims, hasBobbleheadGiveaway])

  const milestoneContext = selected?.type === 'milestone' && selected.isEarned
    ? getSerializableMilestoneContext(selected.milestone, allVisits, allStadiums, allEvents)
    : null

  const sortedVisits = [...allVisits].sort((a, b) => b.visit_date.localeCompare(a.visit_date))

  const personalRecords = useMemo(() => {
    const asc = [...allVisits].sort((a, b) => a.visit_date.localeCompare(b.visit_date))
    const withScore = allVisits.filter(v => v.home_runs != null && v.away_runs != null)
    const wins   = withScore.filter(v => v.home_runs! > v.away_runs!)
    const losses = withScore.filter(v => v.home_runs! < v.away_runs!)

    const biggestWin   = withScore.reduce<StadiumVisit | null>((best, v) => {
      const diff     = Math.abs(v.home_runs! - v.away_runs!)
      const bestDiff = best ? Math.abs(best.home_runs! - best.away_runs!) : -1
      return diff > bestDiff ? v : best
    }, null)
    const biggestLoss  = losses.reduce<StadiumVisit | null>((best, v) => !best || (v.away_runs! - v.home_runs!) > (best.away_runs! - best.home_runs!) ? v : best, null)
    const highestScore = withScore.reduce<StadiumVisit | null>((best, v) => !best || (v.home_runs! + v.away_runs!) > (best.home_runs! + best.away_runs!) ? v : best, null)
    const lowestScore  = withScore.filter(v => v.home_runs! + v.away_runs! > 0).reduce<StadiumVisit | null>((best, v) => !best || (v.home_runs! + v.away_runs!) < (best.home_runs! + best.away_runs!) ? v : best, null)

    const biggestCrowd = allVisits.filter(v => v.attendance != null)
      .reduce<StadiumVisit | null>((best, v) => !best || v.attendance! > best.attendance! ? v : best, null)

    const hottestGame = allVisits.filter(v => v.temperature != null)
      .reduce<StadiumVisit | null>((best, v) => !best || v.temperature! > best.temperature! ? v : best, null)

    const coldestGame = allVisits.filter(v => v.temperature != null)
      .reduce<StadiumVisit | null>((best, v) => !best || v.temperature! < best.temperature! ? v : best, null)

    // Most visited stadium
    const stadiumCounts: Record<string, number> = {}
    for (const v of allVisits) stadiumCounts[v.stadium_id] = (stadiumCounts[v.stadium_id] ?? 0) + 1
    const topStadiumId = Object.entries(stadiumCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topStadium   = topStadiumId ? allStadiums.find(s => s.id === topStadiumId) : null
    const topStadiumCount = topStadiumId ? stadiumCounts[topStadiumId] : 0

    // Most seen team (home + away appearances)
    const teamSeenCounts: Record<string, number> = {}
    for (const v of allVisits) {
      const away = v.visiting_team?.replace(/^vs\.?\s+/i, '').trim()
      if (v.home_team) teamSeenCounts[v.home_team] = (teamSeenCounts[v.home_team] ?? 0) + 1
      if (away) teamSeenCounts[away] = (teamSeenCounts[away] ?? 0) + 1
    }
    const topOpponent      = Object.entries(teamSeenCounts).sort((a, b) => b[1] - a[1])[0]
    const topOpponentName  = topOpponent?.[0] ?? null
    const topOpponentCount = topOpponent?.[1] ?? 0

    // Games by year
    const yearCounts: Record<string, number> = {}
    for (const v of allVisits) {
      const yr = v.visit_date.slice(0, 4)
      yearCounts[yr] = (yearCounts[yr] ?? 0) + 1
    }
    const byYear = Object.entries(yearCounts).sort((a, b) => a[0].localeCompare(b[0]))
    const maxYearCount = Math.max(...byYear.map(([, c]) => c), 1)

    // Day / night breakdown
    let dayGames = 0, nightGames = 0, twilightGames = 0
    for (const v of allVisits) {
      const dn = classifyDayNightHeuristic(v.first_pitch_time)
      if (dn === 'day') dayGames++
      else if (dn === 'night') nightGames++
      else if (dn === 'twilight') twilightGames++
    }

    const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const fmtScore = (v: StadiumVisit) => `${v.away_runs}–${v.home_runs}`
    const fmtMatchup = (v: StadiumVisit) => {
      const away = v.visiting_team?.replace(/^vs\.?\s+/i, '').trim() ?? 'Away'
      const home = v.home_team ?? 'Home'
      return `${away} ${v.away_runs ?? '?'} · ${home} ${v.home_runs ?? '?'}`
    }
    const stadiumFor = (v: StadiumVisit) => allStadiums.find(s => s.id === v.stadium_id)

    return {
      firstGame: asc[0] ?? null, lastGame: asc[asc.length - 1] ?? null,
      totalGames: allVisits.length,
      wins: wins.length, losses: losses.length, scored: withScore.length,
      biggestWin, biggestLoss, highestScore, lowestScore,
      biggestCrowd, hottestGame, coldestGame,
      topStadium, topStadiumCount, topOpponentName, topOpponentCount,
      byYear, maxYearCount,
      dayGames, nightGames, twilightGames,
      fmtDate, fmtScore, fmtMatchup, stadiumFor,
    }
  }, [allVisits, allStadiums])

  function fireConfetti() {
    const pieces = Array.from({ length: 55 }, (_, i) => ({
      id: ++confettiIdRef.current * 100 + i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      size: 7 + Math.random() * 8,
    }))
    setConfetti(pieces)
    setTimeout(() => setConfetti([]), 2800)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid #30363D', fontSize: 13, color: '#E6EDF3',
    backgroundColor: '#0B1117', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Confetti layer */}
      {confetti.map(p => (
        <ConfettiPiece key={p.id} color={p.color} left={p.left} delay={p.delay} size={p.size} />
      ))}

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* ── Personal Records compact summary ───────────────────────────── */}
        {personalRecords && personalRecords.totalGames > 0 && (
          <div
            style={{
              marginBottom: 20, padding: '14px 16px', borderRadius: 14,
              backgroundColor: '#161B22', border: '1px solid #30363D',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>📖 Your Record Book</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#E6EDF3', lineHeight: 1 }}>{personalRecords.totalGames}</div>
                  <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>Games</div>
                </div>
                {personalRecords.scored > 0 && (
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#3FB950', lineHeight: 1 }}>{personalRecords.wins}–{personalRecords.losses}</div>
                    <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>W–L Record</div>
                  </div>
                )}
                {personalRecords.topStadium && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TeamLogo abbreviation={personalRecords.topStadium.abbreviation} size={24} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', lineHeight: 1 }}>{personalRecords.topStadium.name}</div>
                      <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>Most visited · {personalRecords.topStadiumCount}x</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setFilter('records')}
              style={{ fontSize: 13, fontWeight: 700, color: '#58A6FF', background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 }}
            >
              Full Records →
            </button>
          </div>
        )}

        {/* ── Category card carousel ──────────────────────────────────────── */}
        <div className="no-scrollbar" style={{ overflowX: 'auto', display: 'flex', gap: 8, marginBottom: 20, paddingBottom: 4 }}>
          {CATEGORIES.map(cat => {
            const active = filter === cat.key
            const tabColor = cat.key === 'earned' ? '#3FB950'
              : cat.key === 'inprogress' ? '#F5A623'
              : cat.key === 'records' ? '#58A6FF'
              : '#1F6FEB'
            let count: number | null = null
            if (cat.key === 'earned') count = earned.length + earnedStaticCount + earnedLadderCount
            if (cat.key === 'inprogress') {
              const inProgressRegular = allMilestones.filter(m => {
                if (earnedIds.has(m.id)) return false
                const prog = getMilestoneProgress(m.id, allVisits, allStadiums, allEvents)
                return prog != null && prog.current > 0
              }).length
              const inProgressLadders = ladders.filter(m =>
                (m.currentValue ?? 0) > 0 && (m.currentValue ?? 0) < (m.tiers?.[m.tiers.length - 1]?.threshold ?? Infinity)
              ).length
              count = inProgressRegular + inProgressLadders
            }
            return (
              <button
                key={cat.key}
                onClick={() => setFilter(cat.key)}
                style={{
                  flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${active ? tabColor : '#30363D'}`,
                  backgroundColor: active ? tabColor : '#161B22',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 14 }}>{cat.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#ffffff' : '#8B949E', whiteSpace: 'nowrap' }}>{cat.label}</span>
                {count !== null && (
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: active ? '#ffffff' : '#8B949E',
                    backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(139,148,158,0.15)',
                    padding: '1px 7px', borderRadius: 20,
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Personal Records panel ─────────────────────────────────────── */}
        {showRecords && personalRecords && (
          <div style={{ marginBottom: 40 }}>
            {personalRecords.totalGames === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#8B949E', fontSize: 14 }}>
                Log some games to see your personal records.
              </div>
            ) : (
              <>
                {/* ── Record Book ── */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>📖 Your Record Book</div>
                  <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 10 }}>
                    {[
                      { label: 'Games Attended', value: personalRecords.totalGames, sub: null },
                      { label: 'W–L Record', value: personalRecords.scored > 0 ? `${personalRecords.wins}–${personalRecords.losses}` : '—', sub: personalRecords.scored > 0 ? `${Math.round((personalRecords.wins / personalRecords.scored) * 100)}% win rate` : 'No scores logged' },
                      { label: 'First Game', value: personalRecords.firstGame ? personalRecords.fmtDate(personalRecords.firstGame.visit_date) : '—', sub: personalRecords.firstGame ? personalRecords.stadiumFor(personalRecords.firstGame)?.name ?? null : null },
                      { label: 'Latest Game', value: personalRecords.lastGame ? personalRecords.fmtDate(personalRecords.lastGame.visit_date) : '—', sub: personalRecords.lastGame ? personalRecords.stadiumFor(personalRecords.lastGame)?.name ?? null : null },
                    ].map(({ label, value, sub }) => (
                      <div key={label} style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#E6EDF3', lineHeight: 1.2, marginBottom: sub ? 4 : 0 }}>{value}</div>
                        {sub && <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.3 }}>{sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Best Games ── */}
                {personalRecords.totalGames > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>🏆 Best Games</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                      {(() => {
                        const rows = [
                          personalRecords.firstGame ? {
                            emoji: '⭐', label: 'First Game', v: personalRecords.firstGame,
                            detail: personalRecords.fmtMatchup(personalRecords.firstGame),
                            detail2: null,
                          } : null,
                          personalRecords.biggestWin ? {
                            emoji: '🎉', label: 'Biggest Blowout', v: personalRecords.biggestWin,
                            detail: personalRecords.fmtMatchup(personalRecords.biggestWin),
                            detail2: `${Math.abs(personalRecords.biggestWin.home_runs! - personalRecords.biggestWin.away_runs!)}-run margin${personalRecords.biggestWin.winning_pitcher ? ` · W: ${personalRecords.biggestWin.winning_pitcher}` : ''}`,
                          } : null,
                          personalRecords.biggestLoss ? {
                            emoji: '😬', label: 'Biggest Loss', v: personalRecords.biggestLoss,
                            detail: personalRecords.fmtMatchup(personalRecords.biggestLoss),
                            detail2: personalRecords.biggestLoss.losing_pitcher ? `L: ${personalRecords.biggestLoss.losing_pitcher}` : null,
                          } : null,
                          personalRecords.highestScore ? {
                            emoji: '💣', label: 'Highest Scoring', v: personalRecords.highestScore,
                            detail: personalRecords.fmtMatchup(personalRecords.highestScore),
                            detail2: `${personalRecords.highestScore.home_runs! + personalRecords.highestScore.away_runs!} total runs`,
                          } : null,
                          personalRecords.lowestScore ? {
                            emoji: '🎯', label: "Pitcher's Duel", v: personalRecords.lowestScore,
                            detail: personalRecords.fmtMatchup(personalRecords.lowestScore),
                            detail2: [
                              personalRecords.lowestScore.home_starter_name,
                              personalRecords.lowestScore.away_starter_name,
                            ].filter(Boolean).join(' vs ') || null,
                          } : null,
                          personalRecords.biggestCrowd ? {
                            emoji: '👥', label: 'Biggest Crowd', v: personalRecords.biggestCrowd,
                            detail: personalRecords.fmtMatchup(personalRecords.biggestCrowd),
                            detail2: `${personalRecords.biggestCrowd.attendance?.toLocaleString()} fans`,
                          } : null,
                          personalRecords.hottestGame ? {
                            emoji: '🌡️', label: 'Hottest Game', v: personalRecords.hottestGame,
                            detail: personalRecords.fmtMatchup(personalRecords.hottestGame),
                            detail2: `${personalRecords.hottestGame.temperature}°F${personalRecords.hottestGame.weather ? ` · ${personalRecords.hottestGame.weather}` : ''}`,
                          } : null,
                          personalRecords.coldestGame && personalRecords.coldestGame.id !== personalRecords.hottestGame?.id ? {
                            emoji: '🥶', label: 'Coldest Game', v: personalRecords.coldestGame,
                            detail: personalRecords.fmtMatchup(personalRecords.coldestGame),
                            detail2: `${personalRecords.coldestGame.temperature}°F${personalRecords.coldestGame.weather ? ` · ${personalRecords.coldestGame.weather}` : ''}`,
                          } : null,
                        ].filter(Boolean)

                        return rows.map((row) => {
                          if (!row) return null
                          const stadium = personalRecords.stadiumFor(row.v)
                          return (
                            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, backgroundColor: '#161B22', border: '1px solid #30363D' }}>
                              <span style={{ fontSize: 22, flexShrink: 0 }}>{row.emoji}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', marginBottom: 2 }}>{row.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {stadium?.name ?? '—'} · {personalRecords.fmtDate(row.v.visit_date)}
                                </div>
                                <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>{row.detail}</div>
                                {row.detail2 && <div style={{ fontSize: 13, color: '#8B949E', marginTop: 1 }}>{row.detail2}</div>}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                )}

                {/* ── Favorites ── */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>⭐ Favorites</div>
                  <div className="grid grid-cols-2" style={{ gap: 10 }}>
                    {personalRecords.topStadium && (
                      <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 14, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TeamLogo abbreviation={personalRecords.topStadium.abbreviation} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Most Visited</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personalRecords.topStadium.name}</div>
                          <div style={{ fontSize: 13, color: '#F5A623', marginTop: 2 }}>{personalRecords.topStadiumCount} visit{personalRecords.topStadiumCount !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                    )}
                    {personalRecords.topOpponentName && (
                      <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 14, padding: '14px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Most Seen Team</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', marginBottom: 2 }}>{personalRecords.topOpponentName}</div>
                        <div style={{ fontSize: 13, color: '#F5A623' }}>{personalRecords.topOpponentCount} game{personalRecords.topOpponentCount !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Games by Year ── */}
                {personalRecords.byYear.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>📅 Games by Season</div>
                    <div style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 14, padding: '16px' }}>
                      {personalRecords.byYear.map(([year, count]) => (
                        <div key={year} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', width: 36, flexShrink: 0 }}>{year}</div>
                          <div style={{ flex: 1, height: 8, backgroundColor: '#1C2430', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${(count / personalRecords.maxYearCount) * 100}%`, background: 'linear-gradient(90deg, #1F6FEB, #58A6FF)', transition: 'width 0.4s ease' }} />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', width: 24, textAlign: 'right', flexShrink: 0 }}>{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Day / Night ── */}
                {(personalRecords.dayGames + personalRecords.nightGames + personalRecords.twilightGames) > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>🌙 Day vs Night</div>
                    <div className="grid grid-cols-3" style={{ gap: 10 }}>
                      {[
                        { label: 'Day Games',    value: personalRecords.dayGames,      emoji: '🌅', color: '#F5A623' },
                        { label: 'Twilight',     value: personalRecords.twilightGames, emoji: '🌇', color: '#F5A623' },
                        { label: 'Night Games',  value: personalRecords.nightGames,    emoji: '🌙', color: '#58A6FF' },
                      ].map(({ label, value, emoji, color }) => (
                        <div key={label} style={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: 14, padding: '14px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                          <div style={{ fontSize: 13, color: '#8B949E', marginTop: 4, fontWeight: 600 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Search bar ─────────────────────────────────────────────────── */}
        {!showRecords && <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8B949E', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search achievements..."
            style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 12, border: '1px solid #30363D', fontSize: 13, color: '#E6EDF3', backgroundColor: '#161B22', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
        </div>}

        {/* ── Achievement card grid ───────────────────────────────────────── */}
        {!showRecords && <div className="grid grid-cols-2 md:grid-cols-3" style={{ gap: 12, marginBottom: 40 }}>

          {/* ── Ladder milestone cards (full-width) ── */}
          {filteredLadders.map(m => {
            const tiers = m.tiers ?? []
            const val   = m.currentValue ?? 0
            const earnedTiers   = tiers.filter(t => t.threshold <= val)
            const unearnedTiers = tiers.filter(t => t.threshold > val)
            const currentTier   = earnedTiers[earnedTiers.length - 1] ?? null
            const nextTier      = unearnedTiers[0] ?? null
            const totalEarnedPts = earnedTiers.reduce((s, t) => s + t.points, 0)
            const allComplete   = earnedTiers.length === tiers.length
            const pct = nextTier && currentTier
              ? Math.round(((val - currentTier.threshold) / (nextTier.threshold - currentTier.threshold)) * 100)
              : nextTier ? Math.round((val / nextTier.threshold) * 100) : 100

            return (
              <div
                key={m.id}
                style={{
                  gridColumn: '1 / -1',
                  padding: '16px 18px 16px',
                  borderRadius: 16,
                  background: currentTier
                    ? 'linear-gradient(135deg, #1A1500 0%, #2A1E00 100%)'
                    : '#161B22',
                  border: `1.5px solid ${currentTier ? 'rgba(245,166,35,0.4)' : '#30363D'}`,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {currentTier && <div className="earned-card-shine" />}

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 28, lineHeight: 1, filter: currentTier ? 'none' : 'grayscale(60%)' }}>{m.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#E6EDF3', lineHeight: 1.2 }}>{m.name}</div>
                    <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>{m.description}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Zap size={9} color={currentTier ? '#F5A623' : '#8B949E'} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: currentTier ? '#F5A623' : '#8B949E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tracked</span>
                    </div>
                    {totalEarnedPts > 0 && (
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#F5A623', background: 'rgba(245,166,35,0.15)', padding: '2px 8px', borderRadius: 20 }}>
                        +{totalEarnedPts} XP
                      </div>
                    )}
                  </div>
                </div>

                {/* Tier dots row */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {tiers.map((tier, i) => {
                    const unlocked = tier.threshold <= val
                    const isCurrent = tier === currentTier
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          background: unlocked ? (isCurrent ? '#F5A623' : 'rgba(245,166,35,0.35)') : 'rgba(255,255,255,0.1)',
                          border: `2px solid ${unlocked ? '#F5A623' : 'rgba(255,255,255,0.2)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {unlocked && <Check size={10} color={isCurrent ? '#000' : '#F5A623'} strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: unlocked ? '#F5A623' : '#8B949E', lineHeight: 1 }}>{tier.threshold}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Progress bar toward next tier */}
                {!allComplete && (
                  <div>
                    <div style={{ height: 8, background: '#1C2430', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', borderRadius: 6, width: `${Math.max(pct, val > 0 ? 4 : 0)}%`, background: 'linear-gradient(90deg, #F5A623, #E8820C)', transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ fontSize: 13, color: '#8B949E' }}>
                      {currentTier
                        ? <><span style={{ color: '#F5A623', fontWeight: 700 }}>{currentTier.label}</span> · {val}/{nextTier?.threshold} toward <span style={{ color: '#C9D1D9' }}>{nextTier?.label}</span></>
                        : <>{val}/{nextTier?.threshold} toward <span style={{ color: '#C9D1D9' }}>{nextTier?.label}</span></>
                      }
                    </div>
                  </div>
                )}
                {allComplete && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#3FB950', fontWeight: 700 }}>
                    <Check size={12} strokeWidth={3} /> All tiers complete · {val} total
                  </div>
                )}
              </div>
            )
          })}

          {/* Auto-tracked milestone cards */}
          {filteredMilestones.map(m => {
            const isEarned = earnedIds.has(m.id)
            const pts      = MILESTONE_POINTS[m.id] ?? 25
            const tier     = getTierColor(pts)
            const progress = getMilestoneProgress(m.id, allVisits, allStadiums, allEvents)
            const pct      = progress ? Math.round((progress.current / progress.total) * 100) : 0
            const isDiv    = DIVISION_IDS.has(m.id)

            return (
              <button
                key={m.id}
                onClick={() => { setSelected({ type: 'milestone', milestone: m, isEarned }); if (isEarned) fireConfetti() }}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column',
                  padding: '16px 14px 14px', borderRadius: 16, cursor: 'pointer',
                  textAlign: 'left', overflow: 'hidden', minHeight: 150,
                  background: isEarned
                    ? `linear-gradient(135deg, ${tier.color}22 0%, #161B22 70%)`
                    : '#161B22',
                  borderWidth: isEarned ? 2 : 1.5, borderStyle: 'solid',
                  borderColor: isEarned ? tier.color : `${tier.color}55`,
                  boxShadow: isEarned ? `0 0 16px ${tier.glow}` : 'none',
                  filter: !isEarned && !progress?.current ? 'grayscale(55%)' : 'none',
                  opacity: !isEarned && !progress?.current ? 0.6 : 1,
                  transition: 'opacity 0.15s, border-color 0.15s',
                }}
              >
                {/* Earned shine overlay */}
                {isEarned && <div className="earned-card-shine" />}

                {/* Points badge */}
                <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 13, fontWeight: 800, color: isEarned ? tier.color : '#8B949E', background: isEarned ? `${tier.color}26` : 'rgba(48,54,61,0.5)', padding: '2px 7px', borderRadius: 20 }}>
                  +{pts}
                </div>

                {/* Auto-tracked badge */}
                <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Zap size={9} color={isEarned ? tier.color : '#8B949E'} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: isEarned ? tier.color : '#8B949E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tracked</span>
                </div>

                {/* Icon */}
                <div style={{ fontSize: 32, marginBottom: 10, filter: isEarned ? 'none' : 'grayscale(60%)', lineHeight: 1 }}>{m.icon}</div>

                {/* Earned check */}
                {isEarned && (
                  <div style={{ position: 'absolute', top: 10, left: 10, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#3FB950', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={10} color="#0B1117" strokeWidth={3.5} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isEarned ? '#E6EDF3' : '#C9D1D9', marginBottom: 3, lineHeight: 1.3 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.4, marginBottom: isEarned && m.earnDate ? 4 : 8 }}>{m.description}</div>
                  {isEarned && m.earnDate && (
                    <div style={{ fontSize: 13, color: `${tier.color}B3`, fontWeight: 600, marginBottom: 20 }}>
                      Earned {new Date(m.earnDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                </div>

                {/* Progress bar — always shown when not earned (even at 0) so the
                    exact requirement is visible without opening the card */}
                {progress && !isEarned && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ height: 4, background: '#1C2430', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.max(pct, progress.current > 0 ? 4 : 0)}%`, background: isDiv ? 'linear-gradient(90deg,#1F6FEB,#58A6FF)' : `linear-gradient(90deg, ${tier.color}, ${tier.color}CC)`, transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: 13, color: '#8B949E' }}>{progress.current}/{progress.total} needed</span>
                  </div>
                )}
              </button>
            )
          })}

          {/* Manual static experience cards */}
          {filteredStatics.map(s => {
            const expClaims    = claims.filter(c => c.achievement_id === s.id)
            const isRepeatable = s.tracking_type === 'manual_repeatable'
            const isBobble     = s.id === 'bobblehead'
            const count        = expClaims.length
            const hasClaims    = isBobble ? hasBobbleheadGiveaway : count > 0
            const pts          = MILESTONE_POINTS[s.id] ?? 25
            const tier         = getTierColor(pts)

            return (
              <button
                key={s.id}
                onClick={() => setSelected({ type: 'static', experience: s })}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column',
                  padding: '16px 14px 14px', borderRadius: 16, cursor: 'pointer',
                  textAlign: 'left', overflow: 'hidden', minHeight: 150,
                  background: hasClaims
                    ? `linear-gradient(135deg, ${tier.color}22 0%, #161B22 70%)`
                    : '#161B22',
                  borderWidth: hasClaims ? 2 : 1.5, borderStyle: 'solid',
                  borderColor: hasClaims ? tier.color : `${tier.color}55`,
                  boxShadow: hasClaims ? `0 0 16px ${tier.glow}` : 'none',
                  opacity: !hasClaims ? 0.75 : 1,
                  transition: 'opacity 0.15s, border-color 0.15s',
                }}
              >
                {hasClaims && <div className="earned-card-shine" />}

                {/* Earned check */}
                {hasClaims && !isRepeatable && (
                  <div style={{ position: 'absolute', top: 10, left: 10, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#3FB950', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={10} color="#0B1117" strokeWidth={3.5} />
                  </div>
                )}

                {/* Repeatable count badge */}
                {isRepeatable && hasClaims && (
                  <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 13, fontWeight: 800, color: tier.color, background: `${tier.color}2E`, padding: '2px 7px', borderRadius: 999 }}>
                    {isBobble ? `${count} collected` : `${count}×`}
                  </div>
                )}

                {/* Manual badge */}
                <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Hand size={9} color={hasClaims ? tier.color : '#8B949E'} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: hasClaims ? tier.color : '#8B949E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manual</span>
                </div>

                {/* + Log button for repeatable */}
                {isRepeatable && (
                  <div style={{ position: 'absolute', bottom: 8, right: 10, display: 'flex', alignItems: 'center', gap: 3, background: '#39FF14', borderRadius: 20, padding: '3px 9px' }}>
                    <Plus size={10} color="#0B1117" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0B1117' }}>Log</span>
                  </div>
                )}

                {/* Icon */}
                <div style={{ fontSize: 32, marginBottom: 10, filter: hasClaims ? 'none' : 'grayscale(60%)', lineHeight: 1, marginTop: hasClaims && !isRepeatable ? 14 : 0 }}>{s.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: hasClaims ? '#E6EDF3' : '#C9D1D9', marginBottom: 3, lineHeight: 1.3 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: '#8B949E', lineHeight: 1.4, marginBottom: 20 }}>{s.description}</div>
                </div>
              </button>
            )
          })}

          {filteredMilestones.length === 0 && filteredStatics.length === 0 && (
            <div className="col-span-2 md:col-span-3" style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#8B949E', marginBottom: 4 }}>No matches</div>
              <div style={{ fontSize: 14, color: '#8B949E' }}>Try a different category or search term</div>
            </div>
          )}
        </div>}

        {/* ── My Collection section ───────────────────────────────────────── */}
        {stadiumCollectibles.length > 0 && filter === 'all' && (() => {
          const renderCard = (c: typeof stadiumCollectibles[number]) => {
            const mlbVisit = c.stadium_visit_id ? allVisits.find(v => v.id === c.stadium_visit_id) : null
            const mlbStadium = mlbVisit ? allStadiums.find(s => s.id === mlbVisit.stadium_id) : null
            const bleEntry = c.baseball_life_entry_id ? allBle.find(e => e.id === c.baseball_life_entry_id) : null
            const milbStadium = bleEntry?.minor_league_stadium_id
              ? milbStadiums.find(s => s.id === bleEntry.minor_league_stadium_id)
              : null

            const stadiumName = mlbStadium?.name ?? bleEntry?.venue ?? null
            const visitDate = mlbVisit?.visit_date ?? bleEntry?.visit_date ?? null

            return (
              <div
                key={c.id}
                onClick={() => {
                  setViewingItem({
                    id: c.id, name: c.name, category: c.category, giveawayType: c.giveaway_type, photoUrl: c.photo_url,
                    signedBy: c.signed_by, acquiredFrom: c.acquired_from, rating: c.rating, price: c.price,
                  })
                }}
                style={{ backgroundColor: '#161B22', borderRadius: 12, border: '1px solid #30363D', overflow: 'hidden', cursor: 'pointer' }}
              >
                <div style={{ position: 'relative', paddingBottom: '100%', overflow: 'hidden', backgroundColor: '#1C2430' }}>
                  {c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo_url} alt={c.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                      {c.category === 'memorabilia' ? '✍️' : c.category === 'souvenir' ? '🛍️' : c.category === 'food' ? '🍽️' : '🎁'}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#F5A623', fontWeight: 600, textTransform: 'capitalize', marginBottom: 6 }}>
                    {c.category === 'giveaway' && c.giveaway_type ? (giveawayTypeLabels[c.giveaway_type] ?? c.category) : c.category}
                  </div>
                  {stadiumName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      {mlbStadium && <TeamLogo abbreviation={mlbStadium.abbreviation} size={20} />}
                      {!mlbStadium && milbStadium && (
                        <MiLBLogo milbTeamId={milbStadium.milb_team_id} fallbackAbbr={milbStadium.affiliate} logoUrl={milbStadium.logo_url} size={20} />
                      )}
                      <span style={{ fontSize: 12, color: '#E6EDF3' }}>{stadiumName}</span>
                    </div>
                  )}
                  {visitDate && (
                    <div style={{ fontSize: 12, color: '#8B949E' }}>{formatDate(visitDate)}</div>
                  )}
                  {c.category === 'food' && c.rating && (
                    <div style={{ fontSize: 13, color: '#F5A623', marginTop: 4 }}>{'⭐'.repeat(c.rating)}</div>
                  )}
                </div>
              </div>
            )
          }

          const getVisitDate = (c: typeof stadiumCollectibles[number]): string => {
            if (c.stadium_visit_id) return allVisits.find(v => v.id === c.stadium_visit_id)?.visit_date ?? ''
            if (c.baseball_life_entry_id) return allBle.find(e => e.id === c.baseball_life_entry_id)?.visit_date ?? ''
            return ''
          }
          const byGameDate = [...stadiumCollectibles].sort((a, b) => getVisitDate(b).localeCompare(getVisitDate(a)))

          const giveaways = byGameDate.filter(c => c.category === 'giveaway')
          const souvenirs = byGameDate.filter(c => c.category === 'souvenir')
          const memorabilia = byGameDate.filter(c => c.category === 'memorabilia')
          const food = byGameDate.filter(c => c.category === 'food')
          const filteredGiveaways = giveaways.filter(c => collectionTypeFilter === 'all' || c.giveaway_type === collectionTypeFilter)

          const giveawayTypeLabels: Record<string, string> = { all: 'All', bobblehead: 'Bobblehead', jersey: 'Jersey', tshirt: 'T-Shirt', hat: 'Hat', other: 'Other' }
          const giveawayTypeEmojis: Record<string, string> = { all: '🎁', bobblehead: '🪆', jersey: '👕', tshirt: '👔', hat: '🧢', other: '🎁' }

          return (
            <div style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#E6EDF3', marginBottom: 2 }}>🎁 My Collection</h2>
                  <div style={{ fontSize: 13, color: '#8B949E' }}>{stadiumCollectibles.length} item{stadiumCollectibles.length !== 1 ? 's' : ''} collected</div>
                </div>
                <button
                  onClick={() => setEditingItem({ id: 'new', name: '', category: 'giveaway', photoUrl: null })}
                  style={{ fontSize: 13, fontWeight: 600, color: '#58A6FF', background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.25)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
                >
                  + Add Item
                </button>
              </div>

              {giveaways.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    🎁 Giveaways ({giveaways.length})
                  </div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
                    {['all', 'bobblehead', 'jersey', 'tshirt', 'hat', 'other'].map(val => {
                      const count = val === 'all' ? giveaways.length : giveaways.filter(c => c.giveaway_type === val).length
                      return (
                        <button
                          key={val}
                          onClick={() => setCollectionTypeFilter(val)}
                          style={{
                            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                            backgroundColor: collectionTypeFilter === val ? '#E6EDF3' : '#161B22',
                            color: collectionTypeFilter === val ? '#0D1117' : '#8B949E',
                            border: '1px solid #30363D', cursor: 'pointer',
                          }}
                        >
                          <span>{giveawayTypeEmojis[val]}</span> {giveawayTypeLabels[val]} <span style={{ opacity: 0.7 }}>({count})</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: 10 }}>
                    {filteredGiveaways.map(renderCard)}
                  </div>
                </div>
              )}

              {souvenirs.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    🛍️ Souvenirs ({souvenirs.length})
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: 10 }}>
                    {souvenirs.map(renderCard)}
                  </div>
                </div>
              )}

              {memorabilia.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    ✍️ Memorabilia ({memorabilia.length})
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: 10 }}>
                    {memorabilia.map(renderCard)}
                  </div>
                </div>
              )}

              {food.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    🍔 Food & Drink ({food.length})
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4" style={{ gap: 10 }}>
                    {food.map(renderCard)}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

      </div>

      {/* ── Milestone detail modal (centered, auto achievements) ────────────── */}
      {selected?.type === 'milestone' && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          onClick={closeModal}
        >
          <div
            className={selected.isEarned ? 'unlock-card' : undefined}
            style={{ width: '100%', maxWidth: 360, borderRadius: 20, backgroundColor: '#161B22', position: 'relative', border: selected.isEarned ? '1px solid rgba(245,166,35,0.4)' : '1px solid #30363D', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {selected.isEarned && <div className="earned-card-shine" style={{ position: 'absolute', top: 0, bottom: 0, width: '60%', background: 'linear-gradient(105deg,transparent,rgba(245,166,35,0.08),transparent)', pointerEvents: 'none', animation: 'earned-shine 3s ease-in-out infinite' }} />}
            <button onClick={closeModal} style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(139,148,158,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color="#8B949E" />
            </button>

            <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, backgroundColor: selected.isEarned ? 'rgba(245,166,35,0.18)' : 'rgba(139,148,158,0.08)', border: `2px solid ${selected.isEarned ? 'rgba(245,166,35,0.4)' : '#30363D'}` }}>
                {selected.milestone.icon}
              </div>

              {selected.isEarned && (
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', color: '#F5A623', textTransform: 'uppercase', marginBottom: 8 }}>
                  Achievement Unlocked!
                </div>
              )}

              <div style={{ fontSize: 19, fontWeight: 800, color: '#E6EDF3', marginBottom: 6 }}>{selected.milestone.name}</div>
              <div style={{ fontSize: 14, color: '#8B949E', marginBottom: 18 }}>{selected.milestone.description}</div>

              {selected.isEarned && (() => {
                const m   = selected.milestone
                const pts = MILESTONE_POINTS[m.id] ?? 25
                return (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 14px', borderRadius: 20, backgroundColor: 'rgba(63,185,80,0.12)', color: '#3FB950', fontSize: 13, fontWeight: 700 }}>
                        ⚡ +{pts} pts
                      </span>
                    </div>
                    {milestoneContext && (
                      <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 18, backgroundColor: 'rgba(139,148,158,0.06)', border: '1px solid #30363D', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#E6EDF3' }}>
                          <Calendar size={13} color="#F5A623" style={{ flexShrink: 0 }} />
                          {formatDate(milestoneContext.date)}
                        </div>
                        {milestoneContext.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#E6EDF3' }}>
                            <MapPin size={13} color="#F5A623" style={{ flexShrink: 0 }} />
                            {milestoneContext.location}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => navigator.share?.({ title: 'Achievement Unlocked!', text: `I just earned "${m.name}" on Chasing 30! 🏆` }).catch(() => {})}
                        style={{ flex: 1, padding: '11px 0', borderRadius: 12, backgroundColor: 'rgba(139,148,158,0.12)', border: '1px solid #30363D', color: '#E6EDF3', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <Share2 size={14} /> Share
                      </button>
                      <button onClick={closeModal} style={{ flex: 1, padding: '11px 0', borderRadius: 12, backgroundColor: '#F5A623', border: 'none', color: '#0B1117', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        Awesome!
                      </button>
                    </div>
                  </>
                )
              })()}

              {!selected.isEarned && (() => {
                const prog = getMilestoneProgress(selected.milestone.id, allVisits, allStadiums, allEvents)
                if (!prog) {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 20, backgroundColor: 'rgba(139,148,158,0.08)', color: '#8B949E', fontSize: 13, fontWeight: 600 }}>
                      🔒 Not yet unlocked
                    </div>
                  )
                }
                const isGames = ['five_games', 'ten_games', 'first_game'].includes(selected.milestone.id)
                const label = isGames ? 'Games' : 'Parks'
                const maxDots = 15
                const step = prog.total <= maxDots ? 1 : Math.ceil(prog.total / maxDots)
                const totalDots = Math.ceil(prog.total / step)
                const filledDots = Math.min(Math.floor(prog.current / step), totalDots)
                return (
                  <div style={{ width: '100%' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', marginBottom: 10 }}>
                      <span style={{ color: filledDots > 0 ? '#3FB950' : '#8B949E' }}>{prog.current}</span>
                      {' '}<span style={{ fontWeight: 400 }}>of</span>{' '}
                      {prog.total} {label}
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {Array.from({ length: totalDots }).map((_, i) => (
                        <div key={i} style={{
                          width: 10, height: 10, borderRadius: 3,
                          backgroundColor: i < filledDots ? '#3FB950' : '#30363D',
                          transition: 'background-color 0.2s',
                        }} />
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Static experience bottom sheet (manual_once / manual_repeatable) ── */}
      {selected?.type === 'static' && (() => {
        const exp          = selected.experience
        const isBobble     = exp.id === 'bobblehead'
        const isAutomatic  = exp.tracking_type === 'automatic'
        const expClaims    = claims.filter(c => c.achievement_id === exp.id).sort((a, b) => b.claim_date.localeCompare(a.claim_date))
        const hasClaims    = isBobble ? hasBobbleheadGiveaway : expClaims.length > 0
        const isRepeatable = exp.tracking_type === 'manual_repeatable'
        const showsPlayer  = PLAYER_NAME_EXP.has(exp.id)
        const showForm     = !isAutomatic && (isRepeatable || !hasClaims)

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
            onClick={closeModal}
          >
            <div
              style={{ width: '100%', maxWidth: 560, borderRadius: 20, backgroundColor: '#161B22', border: '1px solid #30363D', maxHeight: '88vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle bar + close */}
              <div style={{ position: 'sticky', top: 0, backgroundColor: '#161B22', zIndex: 1, padding: '14px 20px 10px', borderBottom: '1px solid #30363D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#30363D' }} />
                <button onClick={closeModal} style={{ position: 'absolute', right: 16, width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(139,148,158,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={15} color="#8B949E" />
                </button>
              </div>

              <div style={{ padding: '20px 20px 40px' }}>

                {/* Icon + heading */}
                <div style={{ textAlign: 'center', marginBottom: 22 }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, backgroundColor: hasClaims ? 'rgba(245,166,35,0.15)' : 'rgba(139,148,158,0.08)', border: `2px solid ${hasClaims ? 'rgba(245,166,35,0.35)' : '#30363D'}` }}>
                    {exp.icon}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#E6EDF3', marginBottom: 4 }}>{exp.name}</div>
                  <div style={{ fontSize: 13, color: '#8B949E' }}>{exp.description}</div>
                </div>

                {/* ── automatic tracking state ── */}
                {isAutomatic && (
                  <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: hasClaims ? 'rgba(63,185,80,0.07)' : 'rgba(139,148,158,0.06)', border: `1px solid ${hasClaims ? 'rgba(63,185,80,0.2)' : '#30363D'}`, marginBottom: 16 }}>
                    {hasClaims ? (
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#3FB950' }}>✓ Automatically earned</div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#8B949E' }}>
                        {isBobble
                          ? 'Automatically earned when you log a bobblehead giveaway to your collection.'
                          : 'Automatically earned — no manual logging needed.'}
                      </div>
                    )}
                  </div>
                )}

                {/* ── manual_once claimed state ── */}
                {!isRepeatable && !isAutomatic && hasClaims && (() => {
                  const claim   = expClaims[0]
                  const visit   = allVisits.find(v => v.id === claim.stadium_visit_id)
                  const stadium = visit ? allStadiums.find(s => s.id === visit.stadium_id) : null
                  return (
                    <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: 'rgba(63,185,80,0.07)', border: '1px solid rgba(63,185,80,0.2)', marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#3FB950', marginBottom: (stadium || claim.notes) ? 10 : 0 }}>
                        ✓ Achieved · {formatDate(claim.claim_date)}
                      </div>
                      {stadium && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: claim.notes ? 6 : 0 }}>
                          <TeamLogo abbreviation={stadium.abbreviation} size={22} />
                          <div>
                            <div style={{ fontSize: 13, color: '#E6EDF3' }}>{stadium.name}</div>
                            {visit && <div style={{ fontSize: 13, color: '#8B949E' }}>{visit.home_team} vs {visit.visiting_team}</div>}
                          </div>
                        </div>
                      )}
                      {claim.notes && <div style={{ fontSize: 13, color: '#8B949E', fontStyle: 'italic' }}>&ldquo;{claim.notes}&rdquo;</div>}
                      <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center' }}>
                        <button
                          onClick={() => openEditClaim(claim, exp)}
                          style={{ fontSize: 13, color: '#58A6FF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button onClick={() => { removeClaim(claim.id); closeModal() }} style={{ fontSize: 13, color: '#8B949E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* ── Log form ── */}
                {showForm && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: isRepeatable && hasClaims ? 24 : 0 }}>
                    {isRepeatable && hasClaims && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                        Log Another
                      </div>
                    )}

                    {/* Game selector */}
                    <div style={{ position: 'relative' }}>
                      <select
                        value={claimVisitId}
                        onChange={e => setClaimVisitId(e.target.value)}
                        style={{ ...inputStyle, paddingRight: 36, appearance: 'none', WebkitAppearance: 'none' }}
                      >
                        <option value="">Which game? (optional)</option>
                        {sortedVisits.map(v => (
                          <option key={v.id} value={v.id}>{visitLabel(v, allStadiums)}</option>
                        ))}
                      </select>
                      <ChevronRight size={14} color="#8B949E" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none' }} />
                    </div>

                    {/* Player name (autograph / met_player) */}
                    {showsPlayer && (
                      <input
                        type="text"
                        placeholder={exp.id === 'autograph' ? 'Whose autograph? (e.g. Shohei Ohtani)' : 'Which player? (e.g. Mike Trout)'}
                        value={claimPlayerName}
                        onChange={e => setClaimPlayerName(e.target.value)}
                        style={inputStyle}
                      />
                    )}

                    {/* Notes */}
                    <textarea
                      placeholder="Notes (optional)"
                      value={claimNotes}
                      onChange={e => setClaimNotes(e.target.value)}
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />


                    {/* Save */}
                    <button
                      onClick={() => saveClaim(exp)}
                      disabled={claimSaving}
                      style={{ padding: '12px 0', borderRadius: 12, border: 'none', backgroundColor: claimSaving ? '#30363D' : '#1F6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: claimSaving ? 'default' : 'pointer', marginTop: 2 }}
                    >
                      {claimSaving ? 'Saving…' : isRepeatable ? 'Log It' : 'Mark as Achieved'}
                    </button>
                  </div>
                )}

                {/* ── History list (repeatable only) ── */}
                {isRepeatable && hasClaims && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                      {isBobble ? `${expClaims.length} in collection` : `${expClaims.length} log${expClaims.length !== 1 ? 's' : ''}`}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {expClaims.map(claim => {
                        const visit         = allVisits.find(v => v.id === claim.stadium_visit_id)
                        const stadium       = visit ? allStadiums.find(s => s.id === visit.stadium_id) : null
                        const bobble        = claim.extra_data?.bobblehead_name ? String(claim.extra_data.bobblehead_name) : null
                        const player        = claim.extra_data?.player_name     ? String(claim.extra_data.player_name)     : null
                        const photoUrl      = claim.extra_data?.photo_url       ? String(claim.extra_data.photo_url)       : null
                        const typeInfo      = GIVEAWAY_TYPES.find(t => t.value === claim.giveaway_type)
                        const isMiLB        = claim.extra_data?.is_milb === true
                        const milbAffiliate = isMiLB && claim.extra_data?.milb_affiliate    ? String(claim.extra_data.milb_affiliate)    : null
                        const milbStadName  = isMiLB && claim.extra_data?.milb_stadium_name ? String(claim.extra_data.milb_stadium_name) : null
                        const milbTeamId    = isMiLB && claim.extra_data?.milb_team_id      ? Number(claim.extra_data.milb_team_id)      : null
                        const milbLogoUrl   = isMiLB && claim.extra_data?.milb_logo_url     ? String(claim.extra_data.milb_logo_url)     : null
                        const isBleItem     = typeof claim.id === 'string' && claim.id.startsWith('ble-')

                        return (
                          <div key={claim.id} style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: 'rgba(139,148,158,0.06)', border: '1px solid #30363D' }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', marginBottom: 6 }}>
                                  {formatDate(claim.claim_date)}
                                </div>
                                {(stadium || (isMiLB && milbAffiliate)) && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (bobble || player || claim.notes) ? 6 : 0 }}>
                                    {isMiLB && milbAffiliate
                                      ? <MiLBLogo milbTeamId={milbTeamId} fallbackAbbr={milbAffiliate} size={24} logoUrl={milbLogoUrl} />
                                      : <TeamLogo abbreviation={stadium!.abbreviation} size={24} />
                                    }
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 600 }}>{isMiLB && milbStadName ? milbStadName : stadium?.name}</div>
                                      {isMiLB
                                        ? <div style={{ fontSize: 13, fontWeight: 600, color: '#8B949E', backgroundColor: 'rgba(139,148,158,0.1)', padding: '1px 6px', borderRadius: 20, display: 'inline-block', marginTop: 2 }}>MiLB</div>
                                        : visit && <div style={{ fontSize: 13, color: '#8B949E' }}>{visit.home_team} vs {visit.visiting_team}</div>
                                      }
                                    </div>
                                  </div>
                                )}
                                {bobble && (
                                  <div style={{ fontSize: 13, color: '#8B949E', marginBottom: claim.notes ? 4 : 0 }}>
                                    {typeInfo?.emoji ?? '🪆'} {bobble}
                                  </div>
                                )}
                                {player && (
                                  <div style={{ fontSize: 13, color: '#8B949E', marginBottom: claim.notes ? 4 : 0 }}>
                                    {exp.id === 'autograph' ? '✍️' : '🤝'} {player}
                                  </div>
                                )}
                                {claim.notes && (
                                  <div style={{ fontSize: 13, color: '#8B949E', fontStyle: 'italic' }}>&ldquo;{claim.notes}&rdquo;</div>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                                {!isBleItem && (
                                  <div style={{ display: 'flex', gap: 2 }}>
                                    <button
                                      onClick={() => openEditClaim(claim, exp)}
                                      title="Edit"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', padding: 2, display: 'flex', alignItems: 'center' }}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      onClick={() => removeClaim(claim.id)}
                                      title="Remove"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B949E', padding: 2, display: 'flex', alignItems: 'center' }}
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                )}
                                {photoUrl && (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={photoUrl}
                                    alt="Item photo"
                                    style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}


      {/* ── Edit claim modal ─────────────────────────────────────────────────── */}
      {editingClaim && editingExp && (() => {
        const showsPlayer = PLAYER_NAME_EXP.has(editingExp.id)
        const existingPhotoUrl    = editingClaim.extra_data?.photo_url ? String(editingClaim.extra_data.photo_url) : null
        const showExistingPhoto   = !!existingPhotoUrl && !editDeletePhoto && !editPhotoFile
        const showDeletedNotice   = !!existingPhotoUrl && editDeletePhoto && !editPhotoFile

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}
            onClick={closeEditModal}
          >
            <div
              style={{ width: '100%', maxWidth: 480, borderRadius: 20, backgroundColor: '#161B22', border: '1px solid #30363D', maxHeight: '88vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ position: 'sticky', top: 0, backgroundColor: '#161B22', zIndex: 1, padding: '16px 20px', borderBottom: '1px solid #30363D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{editingExp.icon}</span>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#E6EDF3' }}>Edit {editingExp.name}</div>
                </div>
                <button onClick={closeEditModal} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(139,148,158,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={15} color="#8B949E" />
                </button>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Game selector */}
                <div style={{ position: 'relative' }}>
                  <select
                    value={editVisitId}
                    onChange={e => {
                      const val = e.target.value
                      setEditVisitId(val)
                      const v = allVisits.find(v => v.id === val)
                      if (v) setEditClaimDate(v.visit_date)
                    }}
                    style={{ ...inputStyle, paddingRight: 36, appearance: 'none', WebkitAppearance: 'none' }}
                  >
                    <option value="">No game linked</option>
                    {sortedVisits.map(v => (
                      <option key={v.id} value={v.id}>{visitLabel(v, allStadiums)}</option>
                    ))}
                  </select>
                  <ChevronRight size={14} color="#8B949E" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none' }} />
                </div>

                {/* Claim date */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#8B949E', marginBottom: 4 }}>Date</div>
                  <input
                    type="date"
                    value={editClaimDate}
                    onChange={e => setEditClaimDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                {/* Player name (autograph / met_player) */}
                {showsPlayer && (
                  <input
                    type="text"
                    placeholder={editingExp.id === 'autograph' ? 'Whose autograph? (e.g. Shohei Ohtani)' : 'Which player? (e.g. Mike Trout)'}
                    value={editPlayerName}
                    onChange={e => setEditPlayerName(e.target.value)}
                    style={inputStyle}
                  />
                )}

                {/* Notes */}
                <textarea
                  placeholder="Notes (optional)"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />

                {/* Photo management */}
                <div>
                  <input
                    type="file"
                    id="edit-photo-input"
                    accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null
                      setEditPhotoFile(f)
                      if (f) setEditDeletePhoto(false)
                      ;(e.target as HTMLInputElement).value = ''
                    }}
                    style={{ display: 'none' }}
                  />

                  {showExistingPhoto && (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={existingPhotoUrl!} alt="Current photo" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, display: 'block', marginBottom: 6 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setEditDeletePhoto(true)}
                          style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid rgba(248,81,73,0.35)', backgroundColor: 'rgba(248,81,73,0.08)', color: '#F85149', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Remove photo
                        </button>
                        <label
                          htmlFor="edit-photo-input"
                          style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #30363D', backgroundColor: 'rgba(139,148,158,0.08)', color: '#8B949E', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center', display: 'block' }}
                        >
                          Replace photo
                        </label>
                      </div>
                    </div>
                  )}

                  {showDeletedNotice && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)' }}>
                      <span style={{ fontSize: 13, color: '#F85149', flex: 1 }}>Photo will be removed on save</span>
                      <button onClick={() => setEditDeletePhoto(false)} style={{ fontSize: 13, color: '#58A6FF', background: 'none', border: 'none', cursor: 'pointer' }}>Undo</button>
                    </div>
                  )}

                  {editPhotoFile && (
                    <div style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={URL.createObjectURL(editPhotoFile)}
                        alt="Preview"
                        style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, display: 'block' }}
                      />
                      <button
                        onClick={() => setEditPhotoFile(null)}
                        style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={12} color="#fff" />
                      </button>
                    </div>
                  )}

                  {!existingPhotoUrl && !editPhotoFile && (
                    <label
                      htmlFor="edit-photo-input"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: '1.5px dashed #30363D', backgroundColor: '#0B1117', cursor: 'pointer', fontSize: 13, color: '#8B949E' }}
                    >
                      📷 Add photo (optional)
                    </label>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={closeEditModal}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #30363D', backgroundColor: 'transparent', color: '#8B949E', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditClaim}
                    disabled={editSaving}
                    style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', backgroundColor: editSaving ? '#30363D' : '#1F6FEB', color: '#fff', fontSize: 14, fontWeight: 700, cursor: editSaving ? 'default' : 'pointer' }}
                  >
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {viewingItem && (
        <CollectibleLightbox
          item={viewingItem}
          onClose={() => setViewingItem(null)}
          onEdit={() => { setEditingItem(viewingItem); setViewingItem(null) }}
        />
      )}

      {editingItem && (
        <GiveawayFoodEditor
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); fetchClaims(); fetchCollectibles() }}
          onDeleted={() => { setEditingItem(null); fetchClaims(); fetchCollectibles() }}
        />
      )}
    </>
  )
}
