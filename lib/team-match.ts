// Team names reach this app from more than one place (the stadiums table,
// MLB's schedule API, box score data) and don't always agree: the stadiums
// table says "Oakland Athletics" while MLB's own data now says "Athletics",
// and some sources prefix an opponent with "vs ". Matching on the exact string
// would silently drop games, so this compares the way a person would.
const norm = (s: string | null | undefined) =>
  (s ?? '').replace(/^vs\.?\s+/i, '').trim().toLowerCase()

export function sameTeam(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  // One name is the other minus a city prefix ("Athletics" / "Oakland Athletics").
  // Requiring the space boundary keeps "Red Sox" from ever matching "White Sox".
  return x.endsWith(' ' + y) || y.endsWith(' ' + x)
}

const TWO_WORD_NICKNAMES = ['red sox', 'white sox', 'blue jays']

// "Seattle Mariners" -> "Mariners", "Boston Red Sox" -> "Red Sox"
export function teamNickname(fullName: string): string {
  const words = fullName.trim().split(/\s+/)
  const lower = fullName.trim().toLowerCase()
  return TWO_WORD_NICKNAMES.some(n => lower.endsWith(n))
    ? words.slice(-2).join(' ')
    : words[words.length - 1]
}
