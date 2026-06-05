'use client'

import { useState } from 'react'
import TeamLogo from '@/components/TeamLogo'

interface Props {
  milbTeamId: number | null
  fallbackAbbr: string
  size?: number
  style?: React.CSSProperties
}

export default function MiLBLogo({ milbTeamId, fallbackAbbr, size = 48, style }: Props) {
  const [failed, setFailed] = useState(false)

  if (!milbTeamId || failed) {
    return <TeamLogo abbreviation={fallbackAbbr} size={size} style={style} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.milb.com/assets/images/teams/primary/light/${milbTeamId}.svg`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  )
}
