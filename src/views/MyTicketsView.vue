<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

interface TicketRow {
  reservation_id: string
  seat: string | null
  type: string | null
  amount: string
  charge_id: string
  event_name: string | null
  event_date: string | null
  purchased_at: string
}

const auth = useAuthStore()
const router = useRouter()
const tickets = ref<TicketRow[]>([])
const loading = ref(true)

onMounted(async () => {
  // Guard on the persisted token (not the async /auth/me hydration) so a
  // refresh doesn't bounce a logged-in user to the sign-in page.
  if (!auth.token) {
    await router.replace({ name: 'auth' })
    return
  }
  try {
    const { data } = await api.get<{ tickets: TicketRow[] }>('/booking/mine')
    tickets.value = data.tickets
  } catch {
    auth.logout()
    await router.replace({ name: 'auth' })
  } finally {
    loading.value = false
  }
})

function fmt(value: string | null, opts: Intl.DateTimeFormatOptions): string {
  return value ? new Date(value).toLocaleDateString(undefined, opts) : '—'
}
</script>

<template>
  <section class="checkout-wrap">
    <h1>My tickets</h1>

    <div v-if="loading" class="center-row">
      <span class="spinner" aria-hidden="true"></span> Loading your tickets…
    </div>

    <div v-else-if="tickets.length === 0" class="empty-state">
      <span class="glyph" aria-hidden="true">🎫</span>
      <p>No tickets yet.</p>
      <RouterLink :to="{ name: 'browse' }">Find your next event</RouterLink>
    </div>

    <div v-else class="line-items" style="gap: 0.75rem">
      <div v-for="(t, i) in tickets" :key="t.reservation_id + i" class="panel" style="position: static">
        <div class="line-item">
          <strong>{{ t.event_name ?? 'Event' }}</strong>
          <span class="muted">{{ fmt(t.event_date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
        </div>
        <div class="line-item" style="margin-top: 0.5rem">
          <span class="seat-tag">{{ t.seat ?? '—' }}</span>
          <span class="muted">{{ t.type ?? '' }}</span>
          <span>R$ {{ Number.parseFloat(t.amount).toFixed(2) }}</span>
        </div>
        <p class="muted" style="font-size: 0.78rem; margin: 0.5rem 0 0">
          Bought {{ fmt(t.purchased_at, { day: 'numeric', month: 'short' }) }} · ref
          {{ t.reservation_id.slice(0, 8) }} · {{ t.charge_id }}
        </p>
      </div>
    </div>
  </section>
</template>
