import Navigation from './Navigation'
import UpNextPill from './UpNextPill'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>
      <Navigation />

      {/* Mobile-only top header with Up Next pill */}
      <div
        className="md:hidden flex items-center justify-between"
        style={{
          position: 'sticky', top: 0, zIndex: 30,
          backgroundColor: 'rgba(11,17,23,0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #30363D',
          padding: '8px 16px',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 800, color: '#E6EDF3' }}>⚾ Chasing 30</span>
        <UpNextPill compact />
      </div>

      <main className="md:ml-64" style={{ minHeight: '100vh', paddingBottom: 88 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
