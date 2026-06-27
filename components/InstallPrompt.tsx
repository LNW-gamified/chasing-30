'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed this session or running in standalone
    if (
      sessionStorage.getItem('pwa-install-dismissed') ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('pwa-install-dismissed', '1')
    setVisible(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setDeferredPrompt(null)
  }

  if (!visible) return null

  return (
    <div
      className="flex md:hidden items-center gap-3"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        backgroundColor: '#161B22', borderTop: '1px solid #30363D',
        padding: '12px 16px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontSize: 28, flexShrink: 0 }}>⚾</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', lineHeight: 1.3 }}>
          Add Chasing 30 to your home screen
        </div>
        <div style={{ fontSize: 13, color: '#8B949E', marginTop: 2 }}>
          Quick access, offline support
        </div>
      </div>
      <button
        onClick={install}
        style={{
          padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
          backgroundColor: '#1F6FEB', color: '#ffffff',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}
      >
        Install
      </button>
      <button
        onClick={dismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#8B949E', flexShrink: 0 }}
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>
    </div>
  )
}
