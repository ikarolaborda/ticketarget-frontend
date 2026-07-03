// Admin-only contracts (mirror /booking/admin/*). Keep these out of the
// customer-facing types module so the admin boundary stays extractable.

export interface AdminTotals {
  revenue_recognized: string
  paid_amount: string
  revenue_today: string
  revenue_7d: string
  tickets_sold: number
  sold_today: number
  refunded_amount: string
  refunds_count: number
  active_holds: number
}

export interface RevenueDay {
  date: string
  revenue: string
  bookings: number
}

export interface TopEvent {
  event_id: string
  name: string
  date: string | null
  sold: number
  capacity: number | null
  revenue: string
}

export interface AdminStats {
  generated_at: string
  timezone: string
  totals: AdminTotals
  status_breakdown: Record<string, number>
  revenue_by_day: RevenueDay[]
  top_events: TopEvent[]
}

export interface AdminBookingRow {
  id: string
  created_at: string
  email: string | null
  amount: string
  status: string
  seat: string | null
  event_name: string | null
}

export function formatMoney(value: string | number): string {
  return `R$ ${Number.parseFloat(String(value)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
