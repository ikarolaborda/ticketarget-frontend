<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBookingStore } from '@/stores/booking'

const booking = useBookingStore()
const auth = useAuthStore()
const router = useRouter()
const done = ref(false)
const paying = ref(false)
const guestEmail = ref('')

const emailValid = computed(
  () => auth.isAuthenticated || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.value.trim()),
)
const now = ref(Date.now())

// The authoritative expiry comes from the reservation the API returned; the
// ticker only re-renders the remaining time.
const ticker = setInterval(() => {
  now.value = Date.now()
}, 500)
onBeforeUnmount(() => clearInterval(ticker))

const secondsLeft = computed(() => {
  const expiresAt = booking.reservation?.expires_at
  if (!expiresAt) return null
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.value) / 1000))
})

const countdown = computed(() => {
  if (secondsLeft.value === null) return null
  const m = Math.floor(secondsLeft.value / 60)
  const s = secondsLeft.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const expired = computed(() => secondsLeft.value !== null && secondsLeft.value <= 0)

async function pay(): Promise<void> {
  if (paying.value || expired.value || !emailValid.value) return
  paying.value = true
  try {
    // A real integration collects the token via Stripe.js Elements; here we pass
    // a test token so the booking flow is exercised end-to-end.
    const email = auth.isAuthenticated ? null : guestEmail.value.trim().toLowerCase()
    if (await booking.confirm('pm_card_visa', email)) {
      done.value = true
      setTimeout(() => router.push({ name: 'browse' }), 2200)
    }
  } finally {
    paying.value = false
  }
}
</script>

<template>
  <section class="checkout-wrap">
    <div v-if="done" class="success-box">
      <div class="success-check" aria-hidden="true">✓</div>
      <h1>Booking confirmed!</h1>
      <p class="muted">Your seats are locked in. Taking you back to the events…</p>
    </div>

    <template v-else>
      <h1>Checkout</h1>

      <div v-if="!booking.reservation" class="empty-state">
        <span class="glyph" aria-hidden="true">🪑</span>
        <p>No active reservation.</p>
        <RouterLink :to="{ name: 'browse' }">Browse events and pick your seats</RouterLink>
      </div>

      <div v-else class="panel" style="position: static">
        <h3>Order summary</h3>
        <div class="line-items">
          <div v-for="ticket in booking.selected" :key="ticket.id" class="line-item">
            <span class="seat-tag">{{ ticket.seat }}</span>
            <span>R$ {{ Number.parseFloat(ticket.price).toFixed(2) }}</span>
            <span class="muted">{{ ticket.type }}</span>
          </div>
        </div>

        <div class="total-row">
          <span>Total</span>
          <span class="amount">R$ {{ booking.total.toFixed(2) }}</span>
        </div>

        <div v-if="!auth.isAuthenticated" class="form" style="margin-bottom: 1rem">
          <label>
            Email for your tickets
            <input
              v-model="guestEmail"
              type="email"
              required
              placeholder="you@example.com"
              autocomplete="email"
            />
          </label>
          <p class="muted" style="margin: 0.25rem 0 0; font-size: 0.82rem">
            We'll send the tickets here — no account needed.
            <RouterLink :to="{ name: 'auth' }">Or sign in</RouterLink>
          </p>
        </div>
        <p v-else class="muted" style="font-size: 0.88rem">
          Tickets will be sent to <strong>{{ auth.user?.email }}</strong>
        </p>

        <p v-if="countdown && !expired" class="muted">
          Seats held for
          <span class="countdown" :class="{ low: (secondsLeft ?? 0) < 60 }">⏱ {{ countdown }}</span>
        </p>
        <p v-if="expired" class="error">
          This hold expired — the seats were released.
          <RouterLink :to="{ name: 'browse' }">Pick seats again</RouterLink>
        </p>

        <button class="btn-block" :disabled="paying || expired || !emailValid" @click="pay">
          <span v-if="paying" class="spinner" aria-hidden="true"></span>
          {{ paying ? 'Processing…' : `Pay R$ ${booking.total.toFixed(2)}` }}
        </button>

        <p v-if="booking.error" class="error">{{ booking.error }}</p>
      </div>
    </template>
  </section>
</template>
