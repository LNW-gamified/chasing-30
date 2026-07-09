'use client'

import { useState } from 'react'
import TeamLogo from '@/components/TeamLogo'

interface Props {
  milbTeamId: number | null
  fallbackAbbr: string
  size?: number
  style?: React.CSSProperties
  logoUrl?: string | null
}

export default function MiLBLogo({ fallbackAbbr, size = 48, style, logoUrl }: Props) {
  const [logoUrlFailed, setLogoUrlFailed] = useState(false)

  if (logoUrl && !logoUrlFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setLogoUrlFailed(true)}
        style={{ width: size, height: size, objectFit: 'contain', ...style }}
      />
    )
  }

  // No curated logoUrl (or it failed to load) — fall back to the team
  // abbreviation badge. There used to be a second fallback here that hit
  // MLB's image CDN using just the milbTeamId, but that URL pattern was
  // tested directly against a real team ID and returns HTTP 400, it never
  // actually worked, so it's been removed rather than left as a silent
  // failure on every uncurated team.
  return <TeamLogo abbreviation={fallbackAbbr} size={size} style={style} />
}
