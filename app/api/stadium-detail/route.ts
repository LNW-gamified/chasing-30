import { NextRequest, NextResponse } from 'next/server'
import {
  fetchUpcomingHomeGames, fetchVenueDimensions, fetchTeamSeasonStats,
  fetchTeamRoster, fetchRecentTransactions, fetchMinorLeagueAffiliates,
} from '@/lib/mlb-api'
import { fetchStadiumWiki } from '@/lib/stadium-wikipedia'
import { fetchTeamNews } from '@/lib/espn-api'

// The stadium detail page ('use client') used to call all of these
// directly, which meant every one of their `next.revalidate` cache
// configs was silently inert — that option only affects Next's patched
// fetch during server rendering, not the browser's native fetch a client
// component actually uses. Running them here, server-side, behind one
// route the client fetches instead, makes that caching real: repeat page
// loads are served from Next's Data Cache per each function's own
// revalidate window instead of re-hitting five external APIs every time.
export async function GET(req: NextRequest) {
  const abbr = req.nextUrl.searchParams.get('abbr')
  if (!abbr) return NextResponse.json({}, { status: 400 })

  const [
    upcomingGames, wiki, venueDimensions, teamStats,
    roster, transactions, affiliates, teamNews,
  ] = await Promise.all([
    fetchUpcomingHomeGames(abbr),
    fetchStadiumWiki(abbr),
    fetchVenueDimensions(abbr),
    fetchTeamSeasonStats(abbr),
    fetchTeamRoster(abbr),
    fetchRecentTransactions(abbr),
    fetchMinorLeagueAffiliates(abbr),
    fetchTeamNews(abbr),
  ])

  return NextResponse.json({
    upcomingGames,
    photo: wiki.photo,
    summary: wiki.summary,
    venueDimensions,
    teamStats,
    roster,
    transactions,
    affiliates,
    teamNews,
  })
}
