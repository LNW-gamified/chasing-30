// Returns the user's local IANA timezone string
// Falls back to UTC if unavailable
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

// Format a date string using the user's timezone
export function formatDateLocal(dateStr: string, options: Intl.DateTimeFormatOptions): string {
  const tz = getUserTimezone()
  return new Date(dateStr).toLocaleDateString('en-US', { ...options, timeZone: tz })
}

// Get today's date in YYYY-MM-DD format in the user's timezone
export function getTodayLocal(): string {
  const tz = getUserTimezone()
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}
