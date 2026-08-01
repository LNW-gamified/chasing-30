import { createClient } from '@/lib/supabase-server'
import PassportGrid, { type StampData } from '@/components/PassportGrid'

export default async function PassportPage() {
  const supabase = await createClient()

  const [
    { data: { user } },
    { data: stadiums },
    { data: visits },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('stadiums').select('id, abbreviation'),
    supabase.from('stadium_visits').select('stadium_id, visit_date').order('visit_date', { ascending: true }),
  ])

  // Build earliest-visit-date map: stadium_id → ISO date string
  const visitDateByStadiumId = new Map<string, string>()
  for (const v of (visits ?? [])) {
    if (!visitDateByStadiumId.has(v.stadium_id)) {
      visitDateByStadiumId.set(v.stadium_id, v.visit_date)
    }
  }

  // Build stamp data: one entry per stadium, matched by abbreviation
  const stamps: StampData[] = (stadiums ?? []).map(s => ({
    stadiumId: s.id,
    abbr: s.abbreviation,
    visitDate: visitDateByStadiumId.get(s.id) ?? null,
  }))

  const earnedCount = stamps.filter(s => s.visitDate !== null).length

  // User display name
  const meta = (user as any)?.user_metadata
  const fullName: string = meta?.full_name ?? meta?.name ?? ''
  const emailLocal = user?.email?.split('@')[0] ?? ''
  const raw = fullName || emailLocal
  const userName = raw.charAt(0).toUpperCase() + raw.slice(1)

  // Passport number from user UUID
  const uid = user?.id ?? '00000000-0000-0000-0000-000000000000'
  const passportNo = 'USR-' + uid.replace(/-/g, '').slice(0, 8).toUpperCase()

  return (
    <div style={{ minHeight: '100vh', color: '#E6EDF3', paddingTop: 24 }}>
      <PassportGrid
        stamps={stamps}
        userName={userName}
        passportNo={passportNo}
        earnedCount={earnedCount}
      />
    </div>
  )
}
