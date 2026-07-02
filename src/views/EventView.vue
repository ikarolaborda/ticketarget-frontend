<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRouter } from 'vue-router'
import SeatMap from '@/components/SeatMap.vue'
import { useCatalogStore } from '@/stores/catalog'
import { useBookingStore } from '@/stores/booking'

const props = defineProps<{ id: string }>()
const router = useRouter()
const catalog = useCatalogStore()
const booking = useBookingStore()
const { current, loading } = storeToRefs(catalog)

onMounted(async () => {
  booking.setEvent(props.id)
  await catalog.loadEvent(props.id)
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

        <h2>Select your seats</h2>
        <SeatMap v-if="current.tickets" :tickets="current.tickets" />
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
