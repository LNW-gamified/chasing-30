import type { Milestone, StadiumVisit, Stadium } from '@/types'

function visitedIds(visits: StadiumVisit[]): Set<string> {
  return new Set(visits.map((v) => v.stadium_id))
}

function stadiumsInDivision(
  stadiums: Stadium[],
  league: string,
  division: string
) {
  return stadiums.filter((s) => s.league === league && s.division === division)
}

function allVisited(
  group: Stadium[],
  visited: Set<string>
): boolean {
  return group.every((s) => visited.has(s.id))
}

export const MILESTONES: Milestone[] = [
  {
    id: 'first_game',
    name: 'First Pitch',
    description: 'Attend your first MLB game',
    icon: '⚾',
    check: (visits) => visits.length >= 1,
  },
  {
    id: 'five_stadiums',
    name: 'Road Warrior',
    description: 'Visit 5 different stadiums',
    icon: '🚗',
    check: (visits) => visitedIds(visits).size >= 5,
  },
  {
    id: 'ten_stadiums',
    name: 'Double Digits',
    description: 'Visit 10 different stadiums',
    icon: '🔟',
    check: (visits) => visitedIds(visits).size >= 10,
  },
  {
    id: 'fifteen_stadiums',
    name: 'Halfway There',
    description: 'Visit 15 different stadiums',
    icon: '🏟️',
    check: (visits) => visitedIds(visits).size >= 15,
  },
  {
    id: 'twenty_stadiums',
    name: 'On Deck',
    description: 'Visit 20 different stadiums',
    icon: '🎯',
    check: (visits) => visitedIds(visits).size >= 20,
  },
  {
    id: 'twentyfive_stadiums',
    name: 'Final Stretch',
    description: 'Visit 25 different stadiums',
    icon: '🏃',
    check: (visits) => visitedIds(visits).size >= 25,
  },
  {
    id: 'all_stadiums',
    name: 'The Full 30',
    description: 'Visit all 30 MLB stadiums',
    icon: '🏆',
    check: (visits) => visitedIds(visits).size >= 30,
  },
  {
    id: 'al_east',
    name: 'AL East Complete',
    description: 'Visit all 5 AL East stadiums',
    icon: '🗽',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'AL', 'East'), visitedIds(visits)),
  },
  {
    id: 'al_central',
    name: 'AL Central Complete',
    description: 'Visit all 5 AL Central stadiums',
    icon: '🌽',
    check: (visits, stadiums) =>
      allVisited(
        stadiumsInDivision(stadiums, 'AL', 'Central'),
        visitedIds(visits)
      ),
  },
  {
    id: 'al_west',
    name: 'AL West Complete',
    description: 'Visit all 5 AL West stadiums',
    icon: '🌵',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'AL', 'West'), visitedIds(visits)),
  },
  {
    id: 'nl_east',
    name: 'NL East Complete',
    description: 'Visit all 5 NL East stadiums',
    icon: '🦅',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'NL', 'East'), visitedIds(visits)),
  },
  {
    id: 'nl_central',
    name: 'NL Central Complete',
    description: 'Visit all 5 NL Central stadiums',
    icon: '🐻',
    check: (visits, stadiums) =>
      allVisited(
        stadiumsInDivision(stadiums, 'NL', 'Central'),
        visitedIds(visits)
      ),
  },
  {
    id: 'nl_west',
    name: 'NL West Complete',
    description: 'Visit all 5 NL West stadiums',
    icon: '🌉',
    check: (visits, stadiums) =>
      allVisited(stadiumsInDivision(stadiums, 'NL', 'West'), visitedIds(visits)),
  },
  {
    id: 'american_league',
    name: 'Junior Circuit',
    description: 'Visit all 15 American League stadiums',
    icon: '🇺🇸',
    check: (visits, stadiums) =>
      allVisited(
        stadiums.filter((s) => s.league === 'AL'),
        visitedIds(visits)
      ),
  },
  {
    id: 'national_league',
    name: 'Senior Circuit',
    description: 'Visit all 15 National League stadiums',
    icon: '⭐',
    check: (visits, stadiums) =>
      allVisited(
        stadiums.filter((s) => s.league === 'NL'),
        visitedIds(visits)
      ),
  },
  {
    id: 'east_coast',
    name: 'East Coast Tour',
    description: 'Visit all East division stadiums (AL + NL East)',
    icon: '🌅',
    check: (visits, stadiums) => {
      const east = stadiums.filter((s) => s.division === 'East')
      return allVisited(east, visitedIds(visits))
    },
  },
  {
    id: 'midwest',
    name: 'Midwest Swing',
    description: 'Visit all Central division stadiums (AL + NL Central)',
    icon: '🌾',
    check: (visits, stadiums) => {
      const central = stadiums.filter((s) => s.division === 'Central')
      return allVisited(central, visitedIds(visits))
    },
  },
  {
    id: 'west_coast',
    name: 'West Coast Wanderer',
    description: 'Visit all West division stadiums (AL + NL West)',
    icon: '🌊',
    check: (visits, stadiums) => {
      const west = stadiums.filter((s) => s.division === 'West')
      return allVisited(west, visitedIds(visits))
    },
  },
  {
    id: 'five_games',
    name: 'Season Ticket Holder',
    description: 'Attend 5 total games',
    icon: '🎟️',
    check: (visits) => visits.length >= 5,
  },
  {
    id: 'ten_games',
    name: 'Superfan',
    description: 'Attend 10 total games',
    icon: '🤩',
    check: (visits) => visits.length >= 10,
  },
]
