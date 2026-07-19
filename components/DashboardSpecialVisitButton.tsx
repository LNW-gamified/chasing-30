'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'

// Large form only ever shown behind a click — load it on demand instead
// of shipping its code in the dashboard's initial bundle.
const BaseballLifeForm = dynamic(() => import('@/components/BaseballLifeForm'), { ssr: false })

export default function DashboardSpecialVisitButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 0', borderRadius: 999, width: '80%',
          background: 'transparent',
          border: '1.5px solid rgba(201,209,217,0.2)',
          color: '#8B949E', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}
      >
        <ClipboardList size={14} /> Log Beyond the 30 Entry
      </button>
      {open && (
        <BaseballLifeForm
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
