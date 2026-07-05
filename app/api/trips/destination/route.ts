import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      name, status, start_date, end_date, experience_type,
      destination_slug, custom_name, custom_city,
      notes, est_travel, est_hotel, est_tickets, est_food, est_parking,
      actual_travel, actual_hotel, actual_tickets, actual_food, actual_parking,
    } = body

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!start_date) return NextResponse.json({ error: 'start_date is required' }, { status: 400 })

    // Resolve destination_id from slug
    let destination_id: string | null = null
    if (destination_slug) {
      const { data: dest } = await supabase
        .from('destinations')
        .select('id')
        .eq('slug', destination_slug)
        .maybeSingle()
      destination_id = dest?.id ?? null
    }

    const { data, error } = await supabase
      .from('trips')
      .insert({
        name,
        trip_type: 'destination',
        status: status ?? 'planned',
        start_date,
        end_date: end_date || null,
        experience_type: experience_type || 'other',
        destination_id,
        custom_name: custom_name || null,
        custom_city: custom_city || null,
        notes: notes || null,
        est_travel: est_travel ?? 0,
        est_hotel: est_hotel ?? 0,
        est_tickets: est_tickets ?? 0,
        est_food: est_food ?? 0,
        est_parking: est_parking ?? 0,
        actual_travel: actual_travel ?? 0,
        actual_hotel: actual_hotel ?? 0,
        actual_tickets: actual_tickets ?? 0,
        actual_food: actual_food ?? 0,
        actual_parking: actual_parking ?? 0,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If completed trip with a destination, also create a destination_visit
    if (status === 'completed' && destination_id) {
      await supabase.from('destination_visits').insert({
        destination_id,
        trip_id: data.id,
        visit_date: start_date,
        experience_type: experience_type || 'other',
        notes: notes || null,
        created_by: user.id,
      })
    }

    return NextResponse.json({ id: data.id })
  } catch (e) {
    console.error('destination trip POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
