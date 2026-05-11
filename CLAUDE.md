@AGENTS.md

# Chasing 30 — MLB Stadium Tracker

Next.js 16 (App Router, Turbopack), Supabase (auth + DB), react-leaflet maps, Tailwind CSS.

## Setup
1. `cp .env.local.example .env.local` — fill in Supabase URL and anon key
2. Run `supabase/schema.sql` in the Supabase SQL Editor (creates tables + seeds 30 stadiums)
3. Create 2 user accounts in Supabase Auth → Authentication → Users
4. `npm run dev` to develop locally, deploy via Vercel

## Key files
- `proxy.ts` — auth guard (Next.js 16 middleware replacement)
- `lib/supabase.ts` — browser Supabase client
- `lib/supabase-server.ts` — server Supabase client (uses cookies)
- `lib/milestones.ts` — milestone definitions and check logic
- `supabase/schema.sql` — full DB schema + RLS policies + stadium seed data
- `components/GameDayForm.tsx` — full game-day validation form
- `components/TripForm.tsx` — trip planner with budget breakdown

## Architecture note
Both users share all data (visits, trips). RLS policies allow any authenticated user to read/write all rows — there's no per-user isolation by design.

## Workflow
After completing any full update or feature, always run:
git add .
git commit -m "[brief description of what was changed]"
git push
