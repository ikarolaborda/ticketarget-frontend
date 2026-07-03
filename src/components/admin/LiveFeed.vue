<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AdminBookingRow } from './types'
import { formatMoney } from './types'

const props = defineProps<{ rows: AdminBookingRow[] }>()

const fresh = ref<Set<string>>(new Set())

// Baseline = whatever was visible at first paint. When the component mounts
// before the first poll resolves (empty rows), the first non-empty result
// becomes the baseline instead, so the initial fill never flashes.
let known: Set<string> | null = props.rows.length > 0 ? new Set(props.rows.map((r) => r.id)) : null

// Highlight only rows that ARRIVED after the first paint — the initial load
// must not flash the whole list.
watch(
  () => props.rows,
  (rows) => {
    if (known === null) {
      known = new Set(rows.map((r) => r.id))
      return
    }
    const arrived = rows.filter((r) => !known?.has(r.id)).map((r) => r.id)
    for (const id of arrived) known.add(id)
    if (arrived.length > 0) {
      fresh.value = new Set(arrived)
      window.setTimeout(() => {
        fresh.value = new Set()
      }, 4000)
    }
  },
)

function relative(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
</script>

<template>
  <ul class="live-feed">
    <li v-for="row in rows" :key="row.id" class="feed-row" :class="{ fresh: fresh.has(row.id) }">
      <div class="feed-main">
        <span class="feed-event">{{ row.event_name ?? 'Unknown event' }}</span>
        <span class="muted feed-detail">
          {{ row.seat ?? '—' }} · {{ row.email ?? 'guest' }} · {{ relative(row.created_at) }}
        </span>
      </div>
      <div class="feed-side">
        <span class="feed-amount">{{ formatMoney(row.amount) }}</span>
        <span class="status-chip" :class="row.status">{{ row.status }}</span>
      </div>
    </li>
    <li v-if="rows.length === 0" class="muted feed-empty">No bookings yet.</li>
  </ul>
</template>
