export interface Ticket {
  id: string
  seat: string
  price: string
  type: string
  status: 'available' | 'unavailable' | 'booked'
}

export interface Venue {
  id: string
  name: string
  city: string
  address: string
}

export interface EventDetail {
  id: string
  name: string
  description: string | null
  type: string | null
  artist: string | null
  status: string
  date: string | null
  venue?: Venue
  tickets?: Ticket[]
}

export interface SearchHit {
  id: string
  name: string
  artist: string | null
  venue_name: string | null
  venue_city: string | null
  date: string | null
  min_price: number | null
  score: number
}

export interface SearchResponse {
  total: number
  took_ms: number
  results: SearchHit[]
}
