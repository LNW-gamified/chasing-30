// Maps team abbreviation → Wikipedia article title for stadium photo lookup.
// Used with the Wikipedia REST API: /api/rest_v1/page/summary/{title}
export const STADIUM_WIKI_ARTICLES: Record<string, string> = {
  BOS: 'Fenway_Park',
  NYY: 'Yankee_Stadium',
  BAL: 'Oriole_Park_at_Camden_Yards',
  TB:  'Tropicana_Field',
  TOR: 'Rogers_Centre',
  CWS: 'Guaranteed_Rate_Field',
  CLE: 'Progressive_Field',
  DET: 'Comerica_Park',
  KC:  'Kauffman_Stadium',
  MIN: 'Target_Field',
  HOU: 'Minute_Maid_Park',
  LAA: 'Angel_Stadium_of_Anaheim',
  OAK: 'Sutter_Health_Park',
  SEA: 'T-Mobile_Park',
  TEX: 'Globe_Life_Field',
  ATL: 'Truist_Park',
  MIA: 'loanDepot_park',
  NYM: 'Citi_Field',
  PHI: 'Citizens_Bank_Park',
  WSH: 'Nationals_Park',
  CHC: 'Wrigley_Field',
  CIN: 'Great_American_Ball_Park',
  MIL: 'American_Family_Field',
  STL: 'Busch_Stadium',
  PIT: 'PNC_Park',
  ARI: 'Chase_Field',
  COL: 'Coors_Field',
  LAD: 'Dodger_Stadium',
  SD:  'Petco_Park',
  SF:  'Oracle_Park',
}

export async function fetchStadiumSummary(abbreviation: string): Promise<string | null> {
  const article = STADIUM_WIKI_ARTICLES[abbreviation]
  if (!article) return null
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.extract ?? null
  } catch {
    return null
  }
}

export async function fetchStadiumPhoto(abbreviation: string): Promise<string | null> {
  const article = STADIUM_WIKI_ARTICLES[abbreviation]
  if (!article) return null
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.originalimage?.source ?? data?.thumbnail?.source ?? null
  } catch {
    return null
  }
}
