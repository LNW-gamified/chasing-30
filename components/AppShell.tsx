import Navigation from './Navigation'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen" style={{ backgroundColor: '#0a0e1a' }}>
      <Navigation />
      <main className="flex-1 md:ml-64 min-h-screen pb-20 md:pb-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
