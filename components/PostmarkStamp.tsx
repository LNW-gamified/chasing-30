'use client'

interface Props {
  stadiumName: string
  city: string
  state: string
  visitDate: string  // ISO date
  size?: number
}

/**
 * A small circular postmark, styled after the real ink stamps ballparks use
 * on tickets: stadium name arced along the top, city/state arced along the
 * bottom, the visit date centered in the middle, all in a single faded ink
 * color with a slight rotation for an authentic "stamped at an angle" feel.
 */
export default function PostmarkStamp({ stadiumName, city, state, visitDate, size = 64 }: Props) {
  const d = new Date(visitDate + 'T12:00:00')
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = d.getDate()
  const year = String(d.getFullYear()).slice(2)
  const dateLabel = `${month} ${day} '${year}`

  const ink = '#FFFFFF'
  // Unique per-instance path ids so multiple stamps on one page (a whole
  // grid of cards) don't collide on the same <path> id.
  const uid = `${stadiumName}-${city}`.replace(/[^a-zA-Z0-9]/g, '')

  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      style={{ transform: 'rotate(-8deg)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
    >
      <defs>
        <path id={`postmark-top-${uid}`} d="M 12,50 A 38,38 0 0 1 88,50" fill="none" />
        <path id={`postmark-bottom-${uid}`} d="M 14,58 A 38,38 0 0 0 86,58" fill="none" />
      </defs>

      {/* Dark backing so the stamp reads clearly no matter what part of
          the photo sits behind it */}
      <circle cx="50" cy="50" r="47" fill="rgba(11,17,23,0.55)" />

      {/* Outer + inner ring, slightly uneven like a real stamped impression */}
      <circle cx="50" cy="50" r="46" fill="none" stroke={ink} strokeWidth="2" opacity={0.9} />
      <circle cx="50" cy="50" r="39" fill="none" stroke={ink} strokeWidth="1" opacity={0.5} />

      <text fill={ink} fontSize="8.5" fontWeight={700} letterSpacing="0.5" style={{ fontFamily: 'monospace' }}>
        <textPath href={`#postmark-top-${uid}`} startOffset="50%" textAnchor="middle">
          {stadiumName.toUpperCase()}
        </textPath>
      </text>

      <text x="50" y="52" fill={ink} fontSize="11" fontWeight={800} textAnchor="middle" style={{ fontFamily: 'monospace' }}>
        {dateLabel}
      </text>

      <text fill={ink} fontSize="8" fontWeight={600} letterSpacing="0.5" style={{ fontFamily: 'monospace' }}>
        <textPath href={`#postmark-bottom-${uid}`} startOffset="50%" textAnchor="middle">
          {city.toUpperCase()}, {state.toUpperCase()}
        </textPath>
      </text>
    </svg>
  )
}
