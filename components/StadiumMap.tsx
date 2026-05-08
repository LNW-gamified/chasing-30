'use client'

import dynamic from 'next/dynamic'
import type { StadiumWithVisit } from '@/types'

const StadiumMapInner = dynamic(() => import('./StadiumMapInner'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl"
      style={{ height: '100%', backgroundColor: '#0d1424', border: '1px solid #1f2937' }}
    >
      <div style={{ color: '#8896ae' }}>Loading map...</div>
    </div>
  ),
})

export default function StadiumMap({ stadiums }: { stadiums: StadiumWithVisit[] }) {
  return <StadiumMapInner stadiums={stadiums} />
}
