<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ sold: number; capacity: number | null }>()

const pct = computed(() => {
  if (props.capacity === null || props.capacity <= 0) return null
  return Math.min(100, Math.round((props.sold / props.capacity) * 100))
})
</script>

<template>
  <div class="sellthrough">
    <div class="sellthrough-track" role="progressbar" :aria-valuenow="pct ?? undefined" aria-valuemin="0" aria-valuemax="100">
      <div v-if="pct !== null" class="sellthrough-fill" :style="{ width: pct + '%' }"></div>
    </div>
    <span class="sellthrough-label">{{ pct !== null ? pct + '%' : '—' }}</span>
  </div>
</template>
