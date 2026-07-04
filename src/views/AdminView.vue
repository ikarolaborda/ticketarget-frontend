<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api/client'
import type { EventDetail } from '@/types'
import { usePoll } from '@/composables/usePoll'
import StatTile from '@/components/admin/StatTile.vue'
import RevenueChart from '@/components/admin/RevenueChart.vue'
import SellThroughBar from '@/components/admin/SellThroughBar.vue'
import SortableTable from '@/components/admin/SortableTable.vue'
import LiveFeed from '@/components/admin/LiveFeed.vue'
import VenueMap from '@/components/venue/VenueMap.vue'
import type { AdminBookingRow, AdminStats } from '@/components/admin/types'
import { formatMoney } from '@/components/admin/types'
import type { EventZone, ZoneGeometry } from '@/types'

interface AdminVenue {
  id: string
  name: string
  city: string
  address: string
  capacity: number
}

const SECTIONS = ['dashboard', 'bookings', 'venues', 'events', 'tickets', 'manage'] as const
type Section = (typeof SECTIONS)[number]

const route = useRoute()
const router = useRouter()

const section = computed<Section>(() => {
  const raw = String(route.params.section ?? 'dashboard')
  return (SECTIONS as readonly string[]).includes(raw) ? (raw as Section) : 'dashboard'
})

function go(target: Section): void {
  void router.push({ name: 'admin', params: { section: target === 'dashboard' ? undefined : target } })
}

// ── Live dashboard data ──
const stats = ref<AdminStats | null>(null)
const feed = ref<AdminBookingRow[]>([])

const statsPoll = usePoll(async () => {
  const { data } = await api.get<AdminStats>('/booking/admin/stats')
  stats.value = data
}, 10_000)

const feedPoll = usePoll(async () => {
  const { data } = await api.get<{ data: AdminBookingRow[] }>('/booking/admin/bookings', { params: { limit: 12 } })
  feed.value = data.data
}, 5_000)

const stale = computed(() => statsPoll.failures.value >= 3 || feedPoll.failures.value >= 3)
const updatedSeconds = ref(0)
let clockTimer: number | undefined
onMounted(() => {
  clockTimer = window.setInterval(() => {
    updatedSeconds.value = statsPoll.lastUpdated.value
      ? Math.round((Date.now() - statsPoll.lastUpdated.value.getTime()) / 1000)
      : 0
  }, 1000)
})
onUnmounted(() => window.clearInterval(clockTimer))

// ── Bookings data table (cursor-paged) ──
const bookings = ref<AdminBookingRow[]>([])
const bookingsCursor = ref<string | null>(null)
const bookingsBusy = ref(false)

async function loadBookings(reset = false): Promise<void> {
  bookingsBusy.value = true
  try {
    const params: Record<string, string | number> = { limit: 50 }
    if (!reset && bookingsCursor.value !== null) params.cursor = bookingsCursor.value
    const { data } = await api.get<{ data: AdminBookingRow[]; next_cursor: string | null }>(
      '/booking/admin/bookings',
      { params },
    )
    bookings.value = reset ? data.data : [...bookings.value, ...data.data]
    bookingsCursor.value = data.next_cursor
  } finally {
    bookingsBusy.value = false
  }
}

watch(section, (s) => {
  if (s === 'bookings' && bookings.value.length === 0) void loadBookings(true)
})

// ── Catalog state (venues / events / tickets / manage) ──
const venues = ref<AdminVenue[]>([])
const events = ref<EventDetail[]>([])
const message = ref<string | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)

const venueForm = ref({ name: '', address: '', city: '', capacity: 100 })

const emptyEvent = { name: '', description: '', type: '', artist: '', status: 'published', date: '', venue_id: '' }
const eventForm = ref({ ...emptyEvent })
const editingId = ref<string | null>(null)

const gen = ref({ event_id: '', rows: 3, seatsPerRow: 10, price: 150, type: 'standard' })
const generatedCount = computed(() => Math.max(0, gen.value.rows) * Math.max(0, gen.value.seatsPerRow))

// ── Venue zone manager ──
const zoneVenueId = ref('')
const venueZones = ref<EventZone[]>([])
const editingZoneId = ref<string | null>(null)
const emptyZone = { name: '', kind: 'seated', rows: 4, seats_per_row: 10, capacity: 100, color_index: 0, sort_order: 0 }
const zoneForm = ref({ ...emptyZone })

async function loadZones(): Promise<void> {
  if (!zoneVenueId.value) return
  const { data } = await api.get<{ data: EventZone[] }>(`/venues/${zoneVenueId.value}/zones`)
  venueZones.value = data.data
}

function zonePayload(geometry: ZoneGeometry): Record<string, unknown> {
  const seated = zoneForm.value.kind === 'seated'
  return {
    name: zoneForm.value.name,
    kind: zoneForm.value.kind,
    rows: seated ? zoneForm.value.rows : null,
    seats_per_row: seated ? zoneForm.value.seats_per_row : null,
    capacity: seated ? null : zoneForm.value.capacity,
    color_index: zoneForm.value.color_index,
    geometry,
    sort_order: zoneForm.value.sort_order,
  }
}

async function submitZone(): Promise<void> {
  await run(async () => {
    if (editingZoneId.value) {
      const existing = venueZones.value.find((z) => z.id === editingZoneId.value)
      await api.put(
        `/venues/${zoneVenueId.value}/zones/${editingZoneId.value}`,
        zonePayload(existing?.geometry ?? defaultGeometry()),
      )
      cancelZoneEdit()
      await loadZones()
      return 'Zone updated.'
    }

    await api.post(`/venues/${zoneVenueId.value}/zones`, zonePayload(defaultGeometry()))
    zoneForm.value = { ...emptyZone }
    await loadZones()
    return 'Zone created — drag it into position on the preview.'
  })
}

// New zones stagger down the canvas so they never stack invisibly.
function defaultGeometry(): ZoneGeometry {
  const n = venueZones.value.length
  return { type: 'rect', x: 10 + (n % 3) * 28, y: 14 + Math.floor(n / 3) * 18, w: 24, h: 14 }
}

function startZoneEdit(zone: EventZone): void {
  editingZoneId.value = zone.id
  zoneForm.value = {
    name: zone.name,
    kind: zone.kind,
    rows: zone.rows ?? 4,
    seats_per_row: zone.seats_per_row ?? 10,
    capacity: zone.capacity ?? 100,
    color_index: zone.color_index,
    sort_order: zone.sort_order,
  }
}

function cancelZoneEdit(): void {
  editingZoneId.value = null
  zoneForm.value = { ...emptyZone }
}

async function removeZone(zone: EventZone): Promise<void> {
  if (!window.confirm(`Delete zone "${zone.name}"?`)) return
  await run(async () => {
    await api.delete(`/venues/${zoneVenueId.value}/zones/${zone.id}`)
    await loadZones()
    return `Zone "${zone.name}" deleted.`
  })
}

function onZoneMove(zoneId: string, geometry: ZoneGeometry): void {
  const zone = venueZones.value.find((z) => z.id === zoneId)
  if (zone) zone.geometry = geometry
}

async function onZoneMoveEnd(zoneId: string): Promise<void> {
  const zone = venueZones.value.find((z) => z.id === zoneId)
  if (!zone) return
  const seated = zone.kind === 'seated'
  await api.put(`/venues/${zoneVenueId.value}/zones/${zoneId}`, {
    name: zone.name,
    kind: zone.kind,
    rows: seated ? zone.rows : null,
    seats_per_row: seated ? zone.seats_per_row : null,
    capacity: seated ? null : zone.capacity,
    color_index: zone.color_index,
    geometry: zone.geometry,
    sort_order: zone.sort_order,
  })
}

// ── Zone-based ticket generation ──
const genMode = ref<'rows' | 'zone'>('rows')
const genZone = ref({ zone_id: '', price: 150, type: 'standard' })
const genEventZones = ref<EventZone[]>([])

async function loadEventZones(): Promise<void> {
  genEventZones.value = []
  genZone.value.zone_id = ''
  const event = events.value.find((e) => e.id === gen.value.event_id)
  if (!event?.venue?.id) return
  const { data } = await api.get<{ data: EventZone[] }>(`/venues/${event.venue.id}/zones`)
  genEventZones.value = data.data
}

async function generateZoneTickets(): Promise<void> {
  await run(async () => {
    const { data } = await api.post<{ created: number }>(
      `/events/${gen.value.event_id}/zones/${genZone.value.zone_id}/tickets`,
      { price: genZone.value.price, type: genZone.value.type || 'standard' },
    )
    return `${data.created} tickets created for the zone.`
  })
}

onMounted(async () => {
  await Promise.all([loadVenues(), loadEvents()])
  if (section.value === 'bookings') void loadBookings(true)
})

async function loadVenues(): Promise<void> {
  const { data } = await api.get<{ data: AdminVenue[] }>('/venues')
  venues.value = data.data
}

async function loadEvents(): Promise<void> {
  const { data } = await api.get<{ data: EventDetail[] }>('/events', { params: { per_page: 100 } })
  events.value = data.data
}

async function run(action: () => Promise<string>): Promise<void> {
  message.value = null
  error.value = null
  busy.value = true
  try {
    message.value = await action()
  } catch (e) {
    error.value = extractMessage(e)
  } finally {
    busy.value = false
  }
}

async function createVenue(): Promise<void> {
  await run(async () => {
    const { data } = await api.post<{ data: AdminVenue }>('/venues', venueForm.value)
    venueForm.value = { name: '', address: '', city: '', capacity: 100 }
    await loadVenues()
    return `Venue "${data.data.name}" created.`
  })
}

async function submitEvent(): Promise<void> {
  await run(async () => {
    const payload = {
      name: eventForm.value.name,
      description: eventForm.value.description || null,
      type: eventForm.value.type || null,
      artist: eventForm.value.artist || null,
      status: eventForm.value.status,
      date: eventForm.value.date,
      venue_id: eventForm.value.venue_id,
    }

    if (editingId.value) {
      await api.put(`/events/${editingId.value}`, payload)
      const name = payload.name
      cancelEdit()
      await loadEvents()
      return `Event "${name}" updated.`
    }

    const { data } = await api.post<{ data?: EventDetail } & EventDetail>('/events', payload)
    const created = 'data' in data && data.data ? data.data : (data as EventDetail)
    eventForm.value = { ...emptyEvent }
    await loadEvents()
    return `Event "${created.name}" created. Search indexing follows within a few seconds via CDC.`
  })
}

function startEdit(event: EventDetail): void {
  editingId.value = event.id
  eventForm.value = {
    name: event.name,
    description: event.description ?? '',
    type: event.type ?? '',
    artist: event.artist ?? '',
    status: event.status,
    // datetime-local wants "YYYY-MM-DDTHH:mm"
    date: event.date ? event.date.slice(0, 16) : '',
    venue_id: event.venue?.id ?? '',
  }
  go('events')
}

function cancelEdit(): void {
  editingId.value = null
  eventForm.value = { ...emptyEvent }
}

async function removeEvent(event: EventDetail): Promise<void> {
  if (!window.confirm(`Delete "${event.name}"? Its tickets are removed with it. This cannot be undone.`)) return
  await run(async () => {
    await api.delete(`/events/${event.id}`)
    await loadEvents()
    return `Event "${event.name}" deleted.`
  })
}

async function generateTickets(): Promise<void> {
  await run(async () => {
    const tickets = []
    for (let r = 0; r < gen.value.rows; r++) {
      const rowLabel = String.fromCharCode(65 + r)
      for (let s = 1; s <= gen.value.seatsPerRow; s++) {
        tickets.push({
          seat: `${rowLabel}${String(s).padStart(2, '0')}`,
          price: gen.value.price,
          type: gen.value.type || 'standard',
        })
      }
    }
    const { data } = await api.post<{ created: number }>(`/events/${gen.value.event_id}/tickets`, { tickets })
    return `${data.created} tickets created.`
  })
}

function extractMessage(e: unknown): string {
  const response = (e as {
    response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } }
  }).response
  const firstValidation = response?.data?.errors ? Object.values(response.data.errors)[0]?.[0] : null
  const message = firstValidation ?? response?.data?.message
  if (!message) return 'Something went wrong. Please try again.'
  // Server exceptions leak raw SQL in debug mode — translate the common one.
  if (message.includes('Unique violation') || message.includes('SQLSTATE')) {
    return message.includes('seat')
      ? 'Some of those seat labels already exist for this event — pick different rows or remove the old tickets first.'
      : 'That conflicts with existing data. Please review and try again.'
  }
  return message
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
}
</script>

<template>
  <section class="admin-shell">
    <nav class="admin-rail" aria-label="Admin sections">
      <span class="rail-title">Admin</span>
      <button class="rail-link" :class="{ active: section === 'dashboard' }" @click="go('dashboard')">Dashboard</button>
      <button class="rail-link" :class="{ active: section === 'bookings' }" @click="go('bookings')">Bookings</button>
      <span class="rail-group">Catalog</span>
      <button class="rail-link" :class="{ active: section === 'venues' }" @click="go('venues')">Venues</button>
      <button class="rail-link" :class="{ active: section === 'events' }" @click="go('events')">Events</button>
      <button class="rail-link" :class="{ active: section === 'tickets' }" @click="go('tickets')">Tickets</button>
      <button class="rail-link" :class="{ active: section === 'manage' }" @click="go('manage')">Manage</button>
    </nav>

    <div class="admin-content">
      <!-- ── Dashboard ── -->
      <template v-if="section === 'dashboard'">
        <div class="dash-header">
          <h1>Sales overview</h1>
          <span class="live-pill" :class="{ stale }">
            <span class="live-dot" aria-hidden="true"></span>
            {{ stale ? 'Stale — retrying' : `Live · updated ${updatedSeconds}s ago` }}
          </span>
        </div>
        <p class="muted">All figures use UTC day boundaries. Revenue counts paid and refund-pending bookings.</p>

        <template v-if="stats">
          <div class="stat-grid">
            <StatTile label="Revenue today" :value="formatMoney(stats.totals.revenue_today)" :caption="`${stats.totals.sold_today} tickets sold today`" tone="accent" />
            <StatTile label="Revenue (7 days)" :value="formatMoney(stats.totals.revenue_7d)" />
            <StatTile label="Revenue (all time)" :value="formatMoney(stats.totals.revenue_recognized)" :caption="`${stats.totals.tickets_sold} tickets total`" />
            <StatTile label="Active holds" :value="String(stats.totals.active_holds)" caption="unexpired reservations" />
            <StatTile label="Refunded" :value="formatMoney(stats.totals.refunded_amount)" :caption="`${stats.totals.refunds_count} refunds`" />
          </div>

          <div class="dash-grid">
            <div class="dash-panel">
              <h2 class="panel-title">Revenue — last 14 days (UTC)</h2>
              <RevenueChart :series="stats.revenue_by_day" />
            </div>

            <div class="dash-panel">
              <h2 class="panel-title">Live bookings</h2>
              <LiveFeed :rows="feed" />
            </div>
          </div>

          <div class="dash-panel">
            <h2 class="panel-title">Top events by revenue</h2>
            <SortableTable
              :columns="[
                { key: 'name', label: 'Event', sortable: true },
                { key: 'sold', label: 'Sold', sortable: true, numeric: true },
                { key: 'capacity', label: 'Capacity', numeric: true },
                { key: 'sellthrough', label: 'Sell-through' },
                { key: 'revenue', label: 'Revenue', sortable: true, numeric: true },
              ]"
              :rows="stats.top_events"
              row-key="event_id"
              empty="No sales yet."
            >
              <template #sellthrough="{ row }">
                <SellThroughBar :sold="(row as any).sold" :capacity="(row as any).capacity" />
              </template>
              <template #revenue="{ row }">{{ formatMoney((row as any).revenue) }}</template>
            </SortableTable>
          </div>
        </template>
        <p v-else class="muted">Loading sales data…</p>
      </template>

      <!-- ── Bookings table ── -->
      <template v-else-if="section === 'bookings'">
        <h1>Bookings</h1>
        <p class="muted">Newest first. Sorting applies to the loaded rows.</p>
        <div class="dash-panel">
          <SortableTable
            :columns="[
              { key: 'created_at', label: 'When', sortable: true },
              { key: 'event_name', label: 'Event', sortable: true },
              { key: 'seat', label: 'Seat' },
              { key: 'email', label: 'Buyer', sortable: true },
              { key: 'amount', label: 'Amount', sortable: true, numeric: true },
              { key: 'status', label: 'Status', sortable: true },
            ]"
            :rows="bookings"
            row-key="id"
            empty="No bookings yet."
          >
            <template #created_at="{ row }">{{ formatDateTime((row as any).created_at) }}</template>
            <template #amount="{ row }">{{ formatMoney((row as any).amount) }}</template>
            <template #status="{ row }">
              <span class="status-chip" :class="(row as any).status">{{ (row as any).status }}</span>
            </template>
          </SortableTable>
          <button v-if="bookingsCursor" class="btn-ghost" type="button" :disabled="bookingsBusy" @click="loadBookings()">
            {{ bookingsBusy ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </template>

      <!-- ── Catalog sections (forms preserved) ── -->
      <template v-else>
        <h1>Catalog administration</h1>
        <p class="muted">Create venues and events, generate seat inventory, and manage the published catalog.</p>

        <div class="panel" style="position: static; max-width: 760px">
          <!-- ── Venues ── -->
          <form v-if="section === 'venues'" class="form" @submit.prevent="createVenue">
            <label>
              Name
              <input v-model="venueForm.name" type="text" required maxlength="255" />
            </label>
            <label>
              Address
              <input v-model="venueForm.address" type="text" required maxlength="255" />
            </label>
            <label>
              City
              <input v-model="venueForm.city" type="text" required maxlength="128" />
            </label>
            <label>
              Capacity
              <input v-model.number="venueForm.capacity" type="number" min="1" required />
            </label>
            <button class="btn-block" type="submit" :disabled="busy">
              <span v-if="busy" class="spinner" aria-hidden="true"></span>
              Create venue
            </button>
            <p class="muted" style="font-size: 0.85rem">{{ venues.length }} venues exist.</p>
          </form>

          <div v-if="section === 'venues'" class="zone-manager">
            <h2 class="panel-title">Venue layout (zones)</h2>
            <label>
              Venue
              <select v-model="zoneVenueId" class="select" @change="loadZones">
                <option value="" disabled>Pick a venue…</option>
                <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }} — {{ v.city }}</option>
              </select>
            </label>

            <template v-if="zoneVenueId">
              <p class="muted" style="font-size: 0.85rem">
                Drag zones on the preview to match the physical layout. Buyers see this exact map.
              </p>
              <VenueMap
                :zones="venueZones"
                editable
                class="zone-editor-map"
                @move="onZoneMove"
                @moveend="onZoneMoveEnd"
              />

              <form class="form zone-form" @submit.prevent="submitZone">
                <p v-if="editingZoneId" class="muted" style="font-size: 0.85rem">
                  Editing zone — <button type="button" class="linklike" @click="cancelZoneEdit">switch back to create</button>
                </p>
                <label>
                  Zone name
                  <input v-model="zoneForm.name" type="text" required maxlength="64" />
                </label>
                <label>
                  Kind
                  <select v-model="zoneForm.kind" class="select">
                    <option value="seated">Seated (numbered)</option>
                    <option value="standing">Standing (capacity)</option>
                  </select>
                </label>
                <template v-if="zoneForm.kind === 'seated'">
                  <label>
                    Rows
                    <input v-model.number="zoneForm.rows" type="number" min="1" max="99" required />
                  </label>
                  <label>
                    Seats per row
                    <input v-model.number="zoneForm.seats_per_row" type="number" min="1" max="200" required />
                  </label>
                </template>
                <label v-else>
                  Capacity
                  <input v-model.number="zoneForm.capacity" type="number" min="1" max="100000" required />
                </label>
                <label>
                  Color
                  <select v-model.number="zoneForm.color_index" class="select">
                    <option v-for="n in 6" :key="n" :value="n - 1">Category {{ n }}</option>
                  </select>
                </label>
                <button class="btn-block" type="submit" :disabled="busy">
                  {{ editingZoneId ? 'Save zone' : 'Add zone' }}
                </button>
              </form>

              <table v-if="venueZones.length > 0" class="admin-table">
                <thead>
                  <tr><th>Zone</th><th>Kind</th><th>Seats</th><th></th></tr>
                </thead>
                <tbody>
                  <tr v-for="z in venueZones" :key="z.id">
                    <td>
                      <span class="zone-swatch" :style="{ background: `var(--zone-${z.color_index % 6})` }" aria-hidden="true"></span>
                      {{ z.name }}
                    </td>
                    <td class="muted">{{ z.kind }}</td>
                    <td class="muted">{{ z.total_seats }}</td>
                    <td class="row-actions">
                      <button type="button" class="linklike" @click="startZoneEdit(z)">Edit</button>
                      <button type="button" class="linklike danger" :disabled="busy" @click="removeZone(z)">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>

          <!-- ── Events ── -->
          <form v-else-if="section === 'events'" class="form" @submit.prevent="submitEvent">
            <p v-if="editingId" class="muted" style="font-size: 0.85rem">
              Editing an existing event — <button type="button" class="linklike" @click="cancelEdit">switch back to create</button>
            </p>
            <label>
              Name
              <input v-model="eventForm.name" type="text" required maxlength="255" />
            </label>
            <label>
              Description
              <input v-model="eventForm.description" type="text" />
            </label>
            <label>
              Type
              <input v-model="eventForm.type" type="text" placeholder="show, festival…" maxlength="64" />
            </label>
            <label>
              Artist
              <input v-model="eventForm.artist" type="text" maxlength="255" />
            </label>
            <label>
              Status
              <select v-model="eventForm.status" class="select" required>
                <option value="published">published</option>
                <option value="draft">draft (hidden from the catalog and this list)</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
            <label>
              Date
              <input v-model="eventForm.date" type="datetime-local" required />
            </label>
            <label>
              Venue
              <select v-model="eventForm.venue_id" class="select" required>
                <option value="" disabled>Pick a venue…</option>
                <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }} — {{ v.city }}</option>
              </select>
            </label>
            <button class="btn-block" type="submit" :disabled="busy">
              <span v-if="busy" class="spinner" aria-hidden="true"></span>
              {{ editingId ? 'Save changes' : 'Create event' }}
            </button>
          </form>

          <!-- ── Tickets ── -->
          <form v-else-if="section === 'tickets'" class="form" @submit.prevent="genMode === 'zone' ? generateZoneTickets() : generateTickets()">
            <label>
              Mode
              <select v-model="genMode" class="select">
                <option value="rows">Simple rows (no zones)</option>
                <option value="zone">Venue zone</option>
              </select>
            </label>
            <label>
              Event
              <select v-model="gen.event_id" class="select" required @change="genMode === 'zone' ? loadEventZones() : undefined">
                <option value="" disabled>Pick an event…</option>
                <option v-for="e in events" :key="e.id" :value="e.id">{{ e.name }}</option>
              </select>
            </label>
            <template v-if="genMode === 'zone'">
              <label>
                Zone
                <select v-model="genZone.zone_id" class="select" required>
                  <option value="" disabled>
                    {{ genEventZones.length === 0 ? 'No zones on this venue — define them under Venues' : 'Pick a zone…' }}
                  </option>
                  <option v-for="z in genEventZones" :key="z.id" :value="z.id">
                    {{ z.name }} ({{ z.total_seats }} {{ z.kind === 'seated' ? 'seats' : 'standing' }})
                  </option>
                </select>
              </label>
              <label>
                Price per ticket
                <input v-model.number="genZone.price" type="number" min="0" step="0.01" required />
              </label>
              <label>
                Ticket type
                <input v-model="genZone.type" type="text" placeholder="standard" maxlength="32" />
              </label>
              <button class="btn-block" type="submit" :disabled="busy || !genZone.zone_id">
                <span v-if="busy" class="spinner" aria-hidden="true"></span>
                Generate zone tickets
              </button>
              <p class="muted" style="font-size: 0.85rem">
                Each zone can be generated once per event; seat labels carry the zone prefix.
              </p>
            </template>
            <template v-else>
            <label>
              Rows (A, B, C…)
              <input v-model.number="gen.rows" type="number" min="1" max="26" required />
            </label>
            <label>
              Seats per row
              <input v-model.number="gen.seatsPerRow" type="number" min="1" max="100" required />
            </label>
            <label>
              Price per seat
              <input v-model.number="gen.price" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Ticket type
              <input v-model="gen.type" type="text" placeholder="standard" maxlength="32" />
            </label>
            <button class="btn-block" type="submit" :disabled="busy || !gen.event_id">
              <span v-if="busy" class="spinner" aria-hidden="true"></span>
              Generate {{ generatedCount }} tickets
            </button>
            <p class="muted" style="font-size: 0.85rem">
              Seats are labeled A01…{{ String.fromCharCode(64 + Math.max(1, gen.rows)) }}{{ String(Math.max(1, gen.seatsPerRow)).padStart(2, '0') }}.
              Seat labels must be unique per event — generating twice for the same event fails.
            </p>
            </template>
          </form>

          <!-- ── Manage ── -->
          <div v-else>
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Venue</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in events" :key="e.id">
                  <td>{{ e.name }}</td>
                  <td class="muted">{{ formatDate(e.date) }}</td>
                  <td class="muted">{{ e.venue?.name ?? '—' }}</td>
                  <td><span class="status-chip" :class="e.status">{{ e.status }}</span></td>
                  <td class="row-actions">
                    <button type="button" class="linklike" @click="startEdit(e)">Edit</button>
                    <button type="button" class="linklike danger" :disabled="busy" @click="removeEvent(e)">Delete</button>
                  </td>
                </tr>
                <tr v-if="events.length === 0">
                  <td colspan="5" class="muted">No published events.</td>
                </tr>
              </tbody>
            </table>
            <p class="muted" style="font-size: 0.85rem; margin-top: 1rem">
              Deleting an event with paid or refund-pending bookings is blocked — refund those bookings first.
            </p>
          </div>

          <p v-if="message" class="success" style="margin-top: 1rem">{{ message }}</p>
          <p v-if="error" class="error">{{ error }}</p>
        </div>
      </template>
    </div>
  </section>
</template>
