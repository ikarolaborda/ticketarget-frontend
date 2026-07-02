<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { SearchHit } from '@/types'

const props = defineProps<{ hit: SearchHit }>()

// Deterministic banner gradient per event: hash the id into a hue pair so the
// same event always renders the same colors, with no images to host.
const banner = computed(() => {
  let hash = 0
  for (const ch of props.hit.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const h1 = hash % 360
  const h2 = (h1 + 50) % 360
  return {
    background: `linear-gradient(135deg, hsl(${h1} 55% 38%), hsl(${h2} 60% 26%))`,
  }
})

const dateChip = computed(() => {
  if (!props.hit.date) return null
  return new Date(props.hit.date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})
</script>

<template>
  <RouterLink :to="{ name: 'event', params: { id: hit.id } }" class="card">
    <div class="card-banner" :style="banner">
      <span v-if="dateChip" class="chip">{{ dateChip }}</span>
    </div>
    <div class="card-body">
      <h3>{{ hit.name }}</h3>
      <p v-if="hit.artist" class="muted">{{ hit.artist }}</p>
      <p v-if="hit.venue_name" class="muted">
        {{ hit.venue_name }}<span v-if="hit.venue_city">, {{ hit.venue_city }}</span>
      </p>
      <div v-if="hit.min_price !== null" class="price-row">
        <span class="from">from</span>
        <span class="price">R$ {{ hit.min_price.toFixed(2) }}</span>
      </div>
    </div>
  </RouterLink>
</template>
