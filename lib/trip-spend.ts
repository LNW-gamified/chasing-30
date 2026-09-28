// One definition of "how much did this trip actually cost", used anywhere a
// Total Spent number appears (dashboard tile, Stats overview). Before this
// existed, the dashboard and the Stats page each had their own copy and had
// already drifted: one counted every trip, the other only completed ones.
//
// Trip-level actuals (Travel, and Hotel for single-destination trips that
// have no stops to hold it) plus per-stop actuals (Tickets, Food, Parking,
// Hotel, Local Transport for regular multi-stop trips).

interface SpendStop {
  actual_tickets?: number | string | null
  actual_food?: number | string | null
  actual_parking?: number | string | null
  actual_hotel?: number | string | null
  actual_local_transport?: number | string | null
}

interface SpendTrip {
  actual_travel?: number | string | null
  actual_hotel?: number | string | null
}

export function tripActualSpent(trip: SpendTrip, stops: SpendStop[] | null | undefined): number {
  const n = (v: number | string | null | undefined) => Number(v ?? 0)
  const tripLevel = n(trip.actual_travel) + n(trip.actual_hotel)
  const stopLevel = (stops ?? []).reduce((sum, s) =>
    sum + n(s.actual_tickets) + n(s.actual_food) + n(s.actual_parking) + n(s.actual_hotel) + n(s.actual_local_transport), 0)
  return tripLevel + stopLevel
}
