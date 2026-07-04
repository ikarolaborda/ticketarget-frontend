<script setup lang="ts">
import type { EventZone } from '@/types'

defineProps<{
  zones: EventZone[]
  selectedId?: string | null
}>()

const emit = defineEmits<{
  select: [zone: EventZone]
}>()

function soldOut(zone: EventZone): boolean {
  return zone.available === 0 && (zone.tickets_total ?? 0) > 0
}
</script>

<template>
  <ul class="zone-panel" aria-label="Zones">
    <li
      v-for="zone in zones"
      :key="zone.id"
      class="zone-row"
      :class="{ selected: zone.id === selectedId, 'sold-out': soldOut(zone) }"
    >
      <button
        type="button"
        class="zone-row-btn"
        :disabled="soldOut(zone) || (zone.tickets_total ?? 0) === 0"
        @click="emit('select', zone)"
      >
        <span class="zone-swatch" :style="soldOut(zone) ? undefined : { background: `var(--zone-${zone.color_index % 6})` }" aria-hidden="true"></span>
        <span class="zone-info">
          <span class="zone-title">{{ zone.name }}</span>
          <span class="muted zone-meta">
            {{ zone.kind === 'seated' ? 'Numbered seats' : 'Standing — no assigned seat' }}
          </span>
        </span>
        <span class="zone-side">
          <template v-if="soldOut(zone)">
            <span class="zone-soldout-chip">Sold out</span>
          </template>
          <template v-else-if="(zone.tickets_total ?? 0) === 0">
            <span class="muted zone-meta">Not on sale</span>
          </template>
          <template v-else>
            <span class="zone-price">from R$ {{ zone.from_price }}</span>
            <span class="muted zone-meta">{{ zone.available }} left</span>
          </template>
        </span>
      </button>
    </li>
  </ul>
</template>
