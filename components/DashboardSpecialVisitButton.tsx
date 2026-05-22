'use client'

import { useState } from 'react'
import SpecialVisitForm from '@/components/SpecialVisitForm'
import { useRouter } from 'next/navigation'

export default function DashboardSpecialVisitButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 0', borderRadius: 999, width: '100%',
          background: 'rgba(139,148,158,0.08)', border: '1px solid #30363D',
          color: '#C9D1D9', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
          marginTop: 8,
        }}
      >
        📋 Log Special Visit
      </button>
      {open && (
        <SpecialVisitForm
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
