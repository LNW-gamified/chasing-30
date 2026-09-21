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

// Wikipedia's page-summary API sometimes returns a small team/stadium logo
// SVG as the "photo" instead of an actual photograph (this happens when
// the Wikipedia article's infobox image is a logo rather than a picture of
// the venue). These three were found and confirmed to have this problem —
// real photos uploaded to Supabase Storage take priority over whatever
// Wikipedia returns for them. The summary text still comes from Wikipedia
// normally, this only overrides the photo.
const STADIUM_PHOTO_OVERRIDES: Record<string, string> = {
  COL: 'https://ssrffcjbtdtyhjamyyio.supabase.co/storage/v1/object/public/stadium-photos/coors-field.jpg',
  PHI: 'https://ssrffcjbtdtyhjamyyio.supabase.co/storage/v1/object/public/stadium-photos/citizens-bank-park.jpg',
  NYM: 'https://ssrffcjbtdtyhjamyyio.supabase.co/storage/v1/object/public/stadium-photos/citi-field.jpg',
}

export async function fetchStadiumSummary(abbreviation: string): Promise<string | null> {
  const article = STADIUM_WIKI_ARTICLES[abbreviation]
  if (!article) return null
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 604800 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.extract ?? null
  } catch {
    return null
  }
}

export async function fetchStadiumPhoto(abbreviation: string): Promise<string | null> {
  if (STADIUM_PHOTO_OVERRIDES[abbreviation]) return STADIUM_PHOTO_OVERRIDES[abbreviation]
  const article = STADIUM_WIKI_ARTICLES[abbreviation]
  if (!article) return null
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 604800 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.originalimage?.source ?? data?.thumbnail?.source ?? null
  } catch {
    return null
  }
}

// Combined lookup — summary and photo come from the same Wikipedia
// response, so callers that need both (the stadium detail page) should use
// this instead of calling fetchStadiumSummary + fetchStadiumPhoto
// separately, which fires the identical request to Wikipedia twice.
export async function fetchStadiumWiki(abbreviation: string): Promise<{ summary: string | null; photo: string | null }> {
  const article = STADIUM_WIKI_ARTICLES[abbreviation]
  if (!article) return { summary: null, photo: STADIUM_PHOTO_OVERRIDES[abbreviation] ?? null }
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article)}`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 604800 } }
    )
    if (!res.ok) return { summary: null, photo: STADIUM_PHOTO_OVERRIDES[abbreviation] ?? null }
    const data = await res.json()
    return {
      summary: data?.extract ?? null,
      photo:   STADIUM_PHOTO_OVERRIDES[abbreviation] ?? data?.originalimage?.source ?? data?.thumbnail?.source ?? null,
    }
  } catch {
    return { summary: null, photo: STADIUM_PHOTO_OVERRIDES[abbreviation] ?? null }
  }
}
