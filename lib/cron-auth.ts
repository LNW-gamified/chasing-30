import { timingSafeEqual } from 'node:crypto'

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
// a CRON_SECRET environment variable exists on the project. This decides what
// to do with a request that arrives at a cron-only route.
//
// It fails closed: with no CRON_SECRET configured the route refuses to run,
// instead of being open to anyone who finds the URL. 'not_configured' is kept
// separate from 'unauthorized' so a missing variable shows up in the logs as
// its own problem rather than looking like a rejected caller.
export type CronAuthResult = 'ok' | 'not_configured' | 'unauthorized'

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function checkCronAuth(authHeader: string | null, secret: string | undefined): CronAuthResult {
  if (!secret) return 'not_configured'
  if (!authHeader) return 'unauthorized'
  return safeEqual(authHeader, `Bearer ${secret}`) ? 'ok' : 'unauthorized'
}
