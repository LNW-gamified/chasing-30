// Single source of truth for all 30 MLB team brand colors.
// Import from here instead of defining local color maps.

// Accent color per team — visible on dark (#161B22) backgrounds.
// Used for row highlights, borders, and badges.
export const TEAM_PRIMARY: Record<string, string> = {
  ARI: '#A71930', ATL: '#CE1141', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#C4CED4', CIN: '#C6011F', CLE: '#E31937',
  COL: '#33006F', DET: '#0C2C56', HOU: '#EB6E1F', KC:  '#004687',
  LAA: '#BA0021', LAD: '#005A9C', MIA: '#00A3E0', MIL: '#FFC52F',
  MIN: '#D31145', NYM: '#002D72', NYY: '#003087', OAK: '#EFB21E',
  PHI: '#E81828', PIT: '#FDB827', SD:  '#FFC425', SF:  '#FD5A1E',
  SEA: '#005C5C', STL: '#C41E3A', TB:  '#8FBCE6', TEX: '#C0111F',
  TOR: '#134A8E', WSH: '#AB0003',
}

// Button/interactive background color — darker variants that are legible with white text.
// Use this anywhere a team-colored button or badge needs white text on top.
export const TEAM_BTN_COLOR: Record<string, string> = {
  ARI: '#A71930', ATL: '#CE1141', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#27251F', CIN: '#C6011F', CLE: '#00385D',
  COL: '#33006F', DET: '#0C2C56', HOU: '#EB6E1F', KC:  '#004687',
  LAA: '#BA0021', LAD: '#005A9C', MIA: '#00A3E0', MIL: '#12284B',
  MIN: '#002B5C', NYM: '#002D72', NYY: '#003087', OAK: '#003831',
  PHI: '#E81828', PIT: '#27251F', SD:  '#2F241D', SF:  '#FD5A1E',
  SEA: '#005C5C', STL: '#C41E3A', TB:  '#092C5C', TEX: '#003278',
  TOR: '#134A8E', WSH: '#AB0003',
}

// Logo container background overrides — only defined for teams where TEAM_BTN_COLOR
// clashes with the logo (same hue makes the logo invisible).
// Used exclusively by TeamLogo; does NOT affect button/badge colors.
// '#FFFFFF' = white bg for red/same-color logos; '#1A1A1A' = near-black for orange logos.
export const TEAM_LOGO_BG: Record<string, string> = {
  ARI: '#1A1A1A',  // dark snake logo on red bg — use near-black
  ATL: '#FFFFFF',  // red A on red bg — use white
  BAL: '#1A1A1A',  // orange bird on orange bg — use near-black
  BOS: '#FFFFFF',  // red B on red bg — use white
  CIN: '#FFFFFF',  // red C on red bg — use white
  LAA: '#FFFFFF',  // red A on red bg — use white
  MIN: '#FFFFFF',  // TC mark on dark bg — use white
  PHI: '#FFFFFF',  // red P on red bg — use white
  SF:  '#1A1A1A',  // orange logo on orange bg — use near-black
  STL: '#FFFFFF',  // red bird on red bg — use white
  WSH: '#FFFFFF',  // red W on red bg — use white
}

// Two-color gradients for hero / card backgrounds.
export const TEAM_GRADIENTS: Record<string, [string, string]> = {
  LAA: ['#003263', '#BA0021'], ARI: ['#A71930', '#1A1A1A'],
  BAL: ['#1A1A1A', '#DF4601'], BOS: ['#0C2340', '#BD3039'],
  CHC: ['#0E3386', '#CC3433'], CWS: ['#27251F', '#C4CED4'],
  CIN: ['#C6011F', '#1A1A1A'], CLE: ['#00385D', '#E31937'],
  COL: ['#33006F', '#C4CED4'], DET: ['#0C2C56', '#FA4616'],
  HOU: ['#002D62', '#EB6E1F'], KC:  ['#004687', '#BD9B60'],
  LAD: ['#005A9C', '#EF3E42'], MIA: ['#00A3E0', '#EF3340'],
  MIL: ['#12284B', '#FFC52F'], MIN: ['#002B5C', '#D31145'],
  NYM: ['#002D72', '#FF5910'], NYY: ['#003087', '#C4CED4'],
  OAK: ['#003831', '#EFB21E'], PHI: ['#002D72', '#E81828'],
  PIT: ['#27251F', '#FDB827'], SD:  ['#2F241D', '#FFC425'],
  SF:  ['#27251F', '#FD5A1E'], SEA: ['#0C2C56', '#005C5C'],
  STL: ['#0C2340', '#C41E3A'], TB:  ['#092C5C', '#8FBCE6'],
  TEX: ['#003278', '#C0111F'], TOR: ['#134A8E', '#1D2D5C'],
  WSH: ['#14225A', '#AB0003'], ATL: ['#13274F', '#CE1141'],
}

// Relative luminance (0-1, higher = lighter) for a hex color.
function luminance(hex: string): number {
  const n = hex.replace('#', '')
  const r = parseInt(n.substring(0, 2), 16) / 255
  const g = parseInt(n.substring(2, 4), 16) / 255
  const b = parseInt(n.substring(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Picks the visually darker of a team's two gradient colors — used for photo
// overlay tints, where the vibrant/brand color of the pair would be too intense
// washed across an entire image (e.g. ATL and BAL both have a saturated color
// as the second entry, which floods the hero photo if used directly).
export function darkerOf(pair: [string, string]): string {
  return luminance(pair[0]) <= luminance(pair[1]) ? pair[0] : pair[1]
}
