// Each team's real, current flagship radio station — researched from
// Wikipedia's actively-maintained "List of current Major League Baseball
// broadcasters" page for the 2026 season, not guessed.
//
// This links out to a TuneIn search for the station rather than a direct
// stream URL. Two deliberate reasons: TuneIn aggregates almost all of
// these terrestrial broadcasts under one stable, always-valid URL
// pattern, and a station's own direct streaming page is the kind of
// detail that's genuinely easy to get subtly wrong or have go stale —
// a search link degrades gracefully (worst case, one extra click) where
// a wrong direct link just breaks.
//
// This is deliberately about routing to the OFFICIAL broadcast, not
// embedding or rehosting audio — the actual stream stays wherever the
// team and station intend it to be heard.
export const TEAM_RADIO_STATION: Record<string, string> = {
  ARI: 'KTAR 92.3 FM',
  ATL: 'WCNN 680 AM The Fan',
  BAL: 'WBAL 1090 AM',
  BOS: 'WEEI 93.7 FM',
  CHC: 'WSCR 670 AM The Score',
  CWS: 'WMVP 1000 AM ESPN Chicago',
  CIN: 'WLW 700 AM',
  CLE: 'WTAM 1100 AM',
  COL: 'KOA 850 AM',
  DET: 'WXYT 97.1 FM The Ticket',
  HOU: 'KTRH 740 AM',
  KC:  'KFNZ 1580 AM',
  LAA: 'KLAA 830 AM',
  LAD: 'KLAC 570 AM',
  MIA: 'WQAM 560 AM',
  MIL: 'WTMJ 620 AM',
  MIN: 'WCCO 830 AM',
  NYM: 'WHSQ 620 AM',
  NYY: 'WFAN 660 AM',
  OAK: "A's Cast",
  PHI: 'WIP 94.1 FM',
  PIT: 'KDKA 1020 AM',
  SD:  'KWFN 97.3 FM',
  SF:  'KNBR 680 AM',
  SEA: 'KIRO 710 AM',
  STL: 'KMOX 1120 AM',
  TB:  'WDAE 620 AM',
  TEX: 'KRLD 105.3 FM',
  TOR: 'Sportsnet 590 AM The FAN',
  WSH: 'WJFK 106.7 FM The Fan',
}

export function radioListenUrl(abbr: string): string | null {
  const station = TEAM_RADIO_STATION[abbr]
  if (!station) return null
  return `https://tunein.com/search/?query=${encodeURIComponent(station)}`
}
