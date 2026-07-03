<script setup lang="ts">
defineProps<{
  label: string
  value: string
  caption?: string
  tone?: 'accent' | 'plain'
}>()
</script>

<template>
  <div class="stat-tile" :class="{ 'stat-tile-accent': tone === 'accent' }">
    <span class="stat-label">{{ label }}</span>
    <span class="stat-value">{{ value }}</span>
    <span v-if="caption" class="stat-caption">{{ caption }}</span>
  </div>
</template>
