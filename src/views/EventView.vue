<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRouter } from 'vue-router'
import { api } from '@/api/client'
import SeatMap from '@/components/SeatMap.vue'
import VenueMap from '@/components/venue/VenueMap.vue'
import ZonePanel from '@/components/venue/ZonePanel.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useBookingStore } from '@/stores/booking'
import type { EventZone } from '@/types'

const props = defineProps<{ id: string }>()
const router = useRouter()
const catalog = useCatalogStore()
const booking = useBookingStore()
const { current, loading } = storeToRefs(catalog)

const zones = ref<EventZone[]>([])
const selectedZoneId = ref<string | null>(null)

const selectedZone = computed(() => zones.value.find((z) => z.id === selectedZoneId.value) ?? null)

const zoneTickets = computed(() => {
  if (!current.value?.tickets || selectedZone.value === null) return []
  return current.value.tickets.filter((t) => t.zone_id === selectedZone.value?.id)
})

const standingSelectedCount = computed(() => {
  if (selectedZone.value === null) return 0
  return booking.selected.filter((t) => t.zone_id === selectedZone.value?.id).length
})

function selectZone(zone: EventZone): void {
  selectedZoneId.value = zone.id
}

// Standing inventory is fungible: quantity picks the first free seats in a
// stable order instead of making the buyer choose meaningless codes.
function addStanding(): void {
  const zone = selectedZone.value
  if (!zone) return
  const chosen = new Set(booking.selected.map((t) => t.id))
  const next = zoneTickets.value
    .filter((t) => t.status === 'available' && !chosen.has(t.id))
    .sort((a, b) => a.seat.localeCompare(b.seat))[0]
  if (next) booking.toggle(next)
}

function removeStanding(): void {
  const zone = selectedZone.value
  if (!zone) return
  const mine = booking.selected.filter((t) => t.zone_id === zone.id)
  const last = mine[mine.length - 1]
  if (last) booking.toggle(last)
}

onMounted(async () => {
  booking.setEvent(props.id)
  await catalog.loadEvent(props.id)
  const { data } = await api.get<{ data: EventZone[] }>(`/events/${props.id}/zones`)
  zones.value = data.data
})

// Navigating away abandons the waiting room; no timers may keep retrying.
onBeforeUnmount(() => booking.cancelQueueWait())

async function goToCheckout(): Promise<void> {
  if (await booking.reserve()) await router.push({ name: 'checkout' })
}

function eventDate(value: string | null | undefined): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>

<template>
  <section v-if="current">
    <RouterLink :to="{ name: 'browse' }" class="back-link">← All events</RouterLink>

    <div class="event-layout">
      <div>
        <div class="event-head">
          <h1>{{ current.name }}</h1>
          <p v-if="current.artist" class="muted">{{ current.artist }}</p>
          <p v-if="current.venue" class="muted">
            {{ current.venue.name }}, {{ current.venue.city }}
            <template v-if="eventDate(current.date)"> — {{ eventDate(current.date) }}</template>
          </p>
        </div>
        <p v-if="current.description" class="event-desc">{{ current.description }}</p>

        <template v-if="zones.length > 0">
          <h2>Choose your zone</h2>
          <p class="muted map-hint">Hover a zone for details, or pick one from the list.</p>
          <div class="zoned-layout">
            <VenueMap :zones="zones" :selected-id="selectedZoneId" @select="selectZone" />
            <ZonePanel :zones="zones" :selected-id="selectedZoneId" @select="selectZone" />
          </div>

          <template v-if="selectedZone">
            <template v-if="selectedZone.kind === 'seated'">
              <h2>Select your seats — {{ selectedZone.name }}</h2>
              <SeatMap v-if="zoneTickets.length > 0" :tickets="zoneTickets" />
              <p v-else class="muted">This zone is not on sale yet.</p>
            </template>

            <template v-else>
              <h2>{{ selectedZone.name }} — standing</h2>
              <div class="standing-picker">
                <button
                  class="qty-btn"
                  type="button"
                  :disabled="standingSelectedCount === 0"
                  aria-label="Remove one ticket"
                  @click="removeStanding"
                >
                  −
                </button>
                <span class="qty-count">{{ standingSelectedCount }}</span>
                <button
                  class="qty-btn"
                  type="button"
                  :disabled="standingSelectedCount >= Math.min(6, selectedZone.available ?? 0)"
                  aria-label="Add one ticket"
                  @click="addStanding"
                >
                  +
                </button>
                <span class="muted">tickets · entry order, no assigned spot (max 6)</span>
              </div>
            </template>
          </template>
        </template>

        <template v-else>
          <h2>Select your seats</h2>
          <SeatMap v-if="current.tickets" :tickets="current.tickets" />
        </template>
      </div>

      <aside class="panel">
        <h3>Your order</h3>

        <p v-if="booking.selected.length === 0" class="panel-empty">
          Pick seats on the map to start your order.
        </p>
        <div v-else class="line-items">
          <div v-for="ticket in booking.selected" :key="ticket.id" class="line-item">
            <span class="seat-tag">{{ ticket.seat }}</span>
            <span>R$ {{ Number.parseFloat(ticket.price).toFixed(2) }}</span>
            <button
              class="remove"
              :aria-label="`Remove seat ${ticket.seat}`"
              @click="booking.toggle(ticket)"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="total-row">
          <span>Total</span>
          <span class="amount">R$ {{ booking.total.toFixed(2) }}</span>
        </div>

        <button
          class="btn-block"
          :disabled="booking.selected.length === 0 || booking.queueStatus === 'waiting'"
          @click="goToCheckout"
        >
          {{ booking.queueStatus === 'waiting' ? 'Waiting…' : 'Reserve seats' }}
        </button>

        <div v-if="booking.queueStatus === 'waiting'" class="waiting" role="status">
          <strong>You're in the waiting room</strong>
          <p>
            Demand is high for this event. We'll keep trying automatically —
            <template v-if="booking.retrySeconds > 0">
              next attempt in {{ booking.retrySeconds }}s.
            </template>
            <template v-else>retrying now…</template>
          </p>
          <button class="ghost" @click="booking.cancelQueueWait">Leave the queue</button>
        </div>

        <p v-if="booking.error" class="error">{{ booking.error }}</p>
      </aside>
    </div>
  </section>

  <div v-else-if="loading" class="center-row">
    <span class="spinner" aria-hidden="true"></span> Loading event…
  </div>
</template>
