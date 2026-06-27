import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null
  // If it's already a full URL (legacy data), return as-is for now
  if (path.startsWith('http')) return path
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('game-photos')
    .createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function getSignedPhotoUrls(paths: string[]): Promise<string[]> {
  if (!paths?.length) return []
  const results = await Promise.all(paths.map(p => getSignedPhotoUrl(p)))
  return results.filter(Boolean) as string[]
}
