import Navigation from './Navigation'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B1117' }}>
      <Navigation />
      <main className="md:ml-64" style={{ minHeight: '100vh', paddingBottom: 88 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
