'use client'

import { useState } from 'react'
import SpecialVisitForm from '@/components/SpecialVisitForm'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'

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
          transition: 'border-color 0.2s, color 0.2s',
        }}
      >
        <ClipboardList size={14} /> Log Special Visit
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
