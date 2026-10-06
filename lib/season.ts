// Seasonal food and souvenir rows are tagged with the season they belong to
// (season_year). Screens used to filter for a literal 2026, which meant two
// things every winter: last year's items kept passing as current, and next
// year's rows never showed up until someone edited the code. Now every screen
// asks for "the newest season this stadium has rows for", so adding next
// season's rows is the only yearly step.

export function newestSeason<T extends { season_year: number | null }>(
  rows: T[],
): { rows: T[]; year: number | null } {
  const years = rows.map(r => r.season_year).filter((y): y is number => typeof y === 'number')
  if (years.length === 0) return { rows: [], year: null }
  const year = Math.max(...years)
  return { rows: rows.filter(r => r.season_year === year), year }
}

// "This Season" only when the rows really are from the current calendar year.
// Rows nobody has refreshed yet show their real year, so they can't pass as
// current once the calendar rolls over.
export function seasonHeading(year: number | null, now: Date = new Date()): string {
  return year == null || year === now.getFullYear() ? 'This Season' : `${year} Season`
}
