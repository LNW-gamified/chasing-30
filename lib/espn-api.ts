export interface ESPNNewsItem {
  headline:    string
  description: string
  published:   string
  link:        string
  imageUrl:    string | null
}

// Maps our team abbreviation → ESPN team ID
const ESPN_TEAM_IDS: Record<string, number> = {
  ARI: 29, ATL: 15, BAL: 1,  BOS: 2,  CHC: 16, CWS: 4,  CIN: 17,
  CLE: 5,  COL: 27, DET: 6,  HOU: 18, KC:  7,  LAA: 3,  LAD: 19,
  MIA: 28, MIL: 8,  MIN: 9,  NYM: 21, NYY: 10, OAK: 11, PHI: 22,
  PIT: 23, SD:  25, SEA: 12, SF:  26, STL: 24, TB:  30, TEX: 13,
  TOR: 14, WSH: 20,
}

export async function fetchTeamNews(teamAbbr: string, limit = 3): Promise<ESPNNewsItem[]> {
  const espnId = ESPN_TEAM_IDS[teamAbbr]
  if (!espnId) return []
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?team=${espnId}&limit=${limit}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.articles ?? []).slice(0, limit).map((a: any) => ({
      headline:    a.headline    ?? '',
      description: a.description ?? '',
      published:   a.published   ?? '',
      link:        a.links?.web?.href ?? a.links?.mobile?.href ?? `https://www.espn.com/mlb/`,
      imageUrl:    a.images?.[0]?.url ?? null,
    }))
  } catch {
    return []
  }
}
