'use client'

import { useEffect } from 'react'
import { getUserTimezone } from '@/lib/user-timezone'

const COOKIE_NAME = 'chasing30_tz'

// Writes the browser's real IANA timezone into a cookie on every page load,
// so server-rendered pages (which can't otherwise know where the visitor
// actually is) can read it back via cookies() instead of guessing a fixed
// timezone. Renders nothing, just a side effect.
export default function TimezoneSync() {
  useEffect(() => {
    const tz = getUserTimezone()
    const existing = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${COOKIE_NAME}=`))
      ?.split('=')[1]
    if (existing !== tz) {
      document.cookie = `${COOKIE_NAME}=${tz}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }
  }, [])

  return null
}
