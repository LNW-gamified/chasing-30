// Progress tier system for the 30-stadium chase.
// Drives the ring gradient, glow color, and tier badge on the dashboard.
// Centralized here so any other page (passport, milestones) can reuse the same tiers.

export interface Tier {
  id: string
  label: string
  gradient: [string, string]
  glow: string        // rgba string used for box-shadow / text-shadow glows
  textColor: string
}

const TIERS: Tier[] = [
  { id: 'rookie',  label: 'Rookie',    gradient: ['#1F6FEB', '#3FB950'], glow: 'rgba(63,185,80,0.55)',  textColor: '#3FB950' },
  { id: 'bronze',  label: 'Bronze',    gradient: ['#CD7F32', '#8B5A2B'], glow: 'rgba(205,127,50,0.55)', textColor: '#E3A25E' },
  { id: 'silver',  label: 'Silver',    gradient: ['#C7CCD4', '#8B939E'], glow: 'rgba(199,204,212,0.55)',textColor: '#C7CCD4' },
  { id: 'gold',    label: 'Gold',      gradient: ['#FFD866', '#F5A623'], glow: 'rgba(245,166,35,0.6)',  textColor: '#F5C05C' },
  { id: 'diamond', label: 'Diamond',   gradient: ['#7B2FF7', '#00D4FF'], glow: 'rgba(123,47,247,0.6)',  textColor: '#B98CFF' },
]

// visited: number of stadiums visited (0-30)
export function getTier(visited: number): Tier {
  if (visited >= 30) return TIERS[4]
  if (visited >= 20) return TIERS[3]
  if (visited >= 10) return TIERS[2]
  if (visited >= 1)  return TIERS[1]
  return TIERS[0]
}
