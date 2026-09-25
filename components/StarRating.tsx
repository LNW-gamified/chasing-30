'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

interface Props {
  value: number | null
  onChange?: (value: number | null) => void
  size?: number
  readOnly?: boolean
  color?: string
}

export default function StarRating({ value, onChange, size = 20, readOnly = false, color = '#F5A623' }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => {
            if (readOnly || !onChange) return
            // Tapping the star that's already the rating clears it,
            // so a rating can be undone without a separate control.
            onChange(value === n ? null : n)
          }}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(null)}
          style={{
            background: 'none', border: 'none', padding: 0,
            cursor: readOnly ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center',
          }}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            color={color}
            fill={n <= display ? color : 'none'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  )
}
