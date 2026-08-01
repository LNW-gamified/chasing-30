export default function OfflinePage() {
  return (
    <div style={{
      minHeight: '100vh', color: '#E6EDF3',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>⚾</div>

      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#E6EDF3', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
        Chasing 30
      </h1>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28,
        padding: '6px 14px', borderRadius: 999,
        backgroundColor: 'rgba(248,81,73,0.12)', border: '1px solid rgba(248,81,73,0.25)',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F85149' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#F85149' }}>You&apos;re offline</span>
      </div>

      <p style={{ fontSize: 16, color: '#8B949E', marginBottom: 36, maxWidth: 300, lineHeight: 1.6 }}>
        Check your connection and try again.
      </p>

      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '12px 32px', borderRadius: 999, border: 'none', cursor: 'pointer',
          backgroundColor: '#1F6FEB', color: '#ffffff',
          fontSize: 15, fontWeight: 700,
        }}
      >
        Retry
      </button>
    </div>
  )
}
