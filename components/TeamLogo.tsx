'use client'

import { useState } from 'react'
import { getTeamLogoUrl } from '@/lib/team-logos'

interface Props {
  abbreviation: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function TeamLogo({ abbreviation, size = 32, className, style }: Props) {
  const [error, setError] = useState(false)

  const wrapperStyle: React.CSSProperties = {
    flexShrink: 0,
    borderRadius: 6,
    ...style,
    // Always applied — cannot be overridden via style prop
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  }

  if (error) {
    return (
      <div className={className} style={wrapperStyle}>
        <span style={{
          fontSize: size * 0.38,
          fontWeight: 700,
          color: 'rgba(0,0,0,0.5)',
          lineHeight: 1,
        }}>
          {abbreviation.slice(0, 2)}
        </span>
      </div>
    )
  }

  return (
    <div className={className} style={wrapperStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getTeamLogoUrl(abbreviation)}
        alt={abbreviation}
        width={Math.round(size * 0.84)}
        height={Math.round(size * 0.84)}
        onError={() => setError(true)}
        style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
      />
    </div>
  )
}
