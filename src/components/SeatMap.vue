<script setup lang="ts">
import { computed } from 'vue'
import type { Ticket } from '@/types'
import { useBookingStore } from '@/stores/booking'

const props = defineProps<{ tickets: Ticket[] }>()
const booking = useBookingStore()

// Seats are coded "A01".."D10"; group them into labeled rows. Anything that
// doesn't match falls into a catch-all row so no seat is ever hidden.
const rows = computed(() => {
  const grouped = new Map<string, Ticket[]>()
  for (const ticket of props.tickets) {
    const label = /^[A-Za-z]/.test(ticket.seat) ? ticket.seat[0].toUpperCase() : '•'
    const row = grouped.get(label)
    if (row) row.push(ticket)
    else grouped.set(label, [ticket])
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, seats]) => ({
      label,
      seats: [...seats].sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true })),
    }))
})
</script>

<template>
  <div>
    <div class="stage" aria-hidden="true">STAGE</div>
    <div class="seat-rows">
      <div v-for="row in rows" :key="row.label" class="seat-row">
        <span class="row-label">{{ row.label }}</span>
        <div class="seat-row-seats">
          <button
            v-for="ticket in row.seats"
            :key="ticket.id"
            class="seat"
            :class="{
              booked: ticket.status !== 'available',
              chosen: booking.isSelected(ticket.id),
            }"
            :disabled="ticket.status !== 'available'"
            :aria-label="`Seat ${ticket.seat}, R$ ${ticket.price}${ticket.status !== 'available' ? ', unavailable' : ''}`"
            @click="booking.toggle(ticket)"
          >
            {{ ticket.seat }}
            <span class="seat-price">R$ {{ Number.parseFloat(ticket.price).toFixed(0) }}</span>
          </button>
        </div>
      </div>
    </div>
    <div class="legend">
      <span><i></i> Available</span>
      <span><i class="chosen"></i> Selected</span>
      <span><i class="booked"></i> Taken</span>
    </div>
  </div>
</template>
