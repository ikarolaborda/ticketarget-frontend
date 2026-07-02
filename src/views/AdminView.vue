<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/api/client'
import type { EventDetail } from '@/types'

interface AdminVenue {
  id: string
  name: string
  city: string
  address: string
  capacity: number
}

type Tab = 'venues' | 'events' | 'tickets' | 'manage'

const tab = ref<Tab>('venues')
const venues = ref<AdminVenue[]>([])
const events = ref<EventDetail[]>([])
const message = ref<string | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)

// ── Venue form ──
const venueForm = ref({ name: '', address: '', city: '', capacity: 100 })

// ── Event form (create + edit share it) ──
const emptyEvent = { name: '', description: '', type: '', artist: '', status: 'published', date: '', venue_id: '' }
const eventForm = ref({ ...emptyEvent })
const editingId = ref<string | null>(null)

// ── Ticket generator ──
const gen = ref({ event_id: '', rows: 3, seatsPerRow: 10, price: 150, type: 'standard' })
const generatedCount = computed(() => Math.max(0, gen.value.rows) * Math.max(0, gen.value.seatsPerRow))

onMounted(async () => {
  await Promise.all([loadVenues(), loadEvents()])
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
  tab.value = 'events'
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
</script>

<template>
  <section>
    <h1>Catalog administration</h1>
    <p class="muted">Create venues and events, generate seat inventory, and manage the published catalog.</p>

    <div class="panel" style="position: static; max-width: 760px">
      <div class="tab-row" role="tablist">
        <button class="tab" :class="{ active: tab === 'venues' }" role="tab" :aria-selected="tab === 'venues'" @click="tab = 'venues'">Venues</button>
        <button class="tab" :class="{ active: tab === 'events' }" role="tab" :aria-selected="tab === 'events'" @click="tab = 'events'">Events</button>
        <button class="tab" :class="{ active: tab === 'tickets' }" role="tab" :aria-selected="tab === 'tickets'" @click="tab = 'tickets'">Tickets</button>
        <button class="tab" :class="{ active: tab === 'manage' }" role="tab" :aria-selected="tab === 'manage'" @click="tab = 'manage'">Manage</button>
      </div>

      <!-- ── Venues ── -->
      <form v-if="tab === 'venues'" class="form" @submit.prevent="createVenue">
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

      <!-- ── Events ── -->
      <form v-else-if="tab === 'events'" class="form" @submit.prevent="submitEvent">
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
      <form v-else-if="tab === 'tickets'" class="form" @submit.prevent="generateTickets">
        <label>
          Event
          <select v-model="gen.event_id" class="select" required>
            <option value="" disabled>Pick an event…</option>
            <option v-for="e in events" :key="e.id" :value="e.id">{{ e.name }}</option>
          </select>
        </label>
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
  </section>
</template>
