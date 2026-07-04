<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EventZone, ZoneGeometry } from '@/types'
import { CANVAS_H, CANVAS_W, clampGeometry } from './geometry'

const props = defineProps<{
  zones: EventZone[]
  selectedId?: string | null
  editable?: boolean
}>()

const emit = defineEmits<{
  select: [zone: EventZone]
  hover: [zone: EventZone | null]
  move: [zoneId: string, geometry: ZoneGeometry]
  moveend: [zoneId: string]
}>()

const svg = ref<SVGSVGElement | null>(null)

const ordered = computed(() => [...props.zones].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))

function soldOut(zone: EventZone): boolean {
  return zone.available !== undefined && zone.available === 0 && (zone.tickets_total ?? 0) > 0
}

function onSale(zone: EventZone): boolean {
  return zone.available === undefined || zone.available > 0
}

// ── Dragging (edit mode only) ──
const drag = ref<{ id: string; dx: number; dy: number } | null>(null)

function toCanvas(event: PointerEvent): { x: number; y: number } {
  const el = svg.value
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
    y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
  }
}

function startDrag(zone: EventZone, event: PointerEvent): void {
  if (!props.editable) return
  const point = toCanvas(event)
  drag.value = { id: zone.id, dx: point.x - zone.geometry.x, dy: point.y - zone.geometry.y }
  ;(event.target as Element).setPointerCapture(event.pointerId)
}

function onDrag(event: PointerEvent): void {
  if (!drag.value) return
  const zone = props.zones.find((z) => z.id === drag.value?.id)
  if (!zone) return
  const point = toCanvas(event)
  emit('move', zone.id, clampGeometry({
    type: 'rect',
    x: point.x - drag.value.dx,
    y: point.y - drag.value.dy,
    w: zone.geometry.w,
    h: zone.geometry.h,
  }))
}

function endDrag(): void {
  if (drag.value) emit('moveend', drag.value.id)
  drag.value = null
}
</script>

<template>
  <svg
    ref="svg"
    :viewBox="`0 0 ${CANVAS_W} ${CANVAS_H}`"
    class="venue-map"
    :class="{ editable }"
    role="group"
    aria-label="Venue map"
    @pointermove="onDrag"
    @pointerup="endDrag"
    @pointerleave="endDrag"
  >
    <rect :x="CANVAS_W * 0.3" y="1" :width="CANVAS_W * 0.4" height="6" rx="1.5" class="map-stage" />
    <text :x="CANVAS_W / 2" y="5.4" text-anchor="middle" class="map-stage-label">STAGE</text>

    <g
      v-for="zone in ordered"
      :key="zone.id"
      class="map-zone"
      :class="{
        selected: zone.id === selectedId,
        'sold-out': soldOut(zone),
        clickable: !editable && onSale(zone),
      }"
      @click="(!editable && onSale(zone)) ? emit('select', zone) : undefined"
      @pointerenter="emit('hover', zone)"
      @pointerleave="emit('hover', null)"
      @pointerdown="startDrag(zone, $event)"
    >
      <rect
        :x="zone.geometry.x"
        :y="zone.geometry.y"
        :width="zone.geometry.w"
        :height="zone.geometry.h"
        rx="1.2"
        class="zone-shape"
        :style="soldOut(zone) ? undefined : { fill: `var(--zone-${zone.color_index % 6})` }"
      />
      <text
        :x="zone.geometry.x + zone.geometry.w / 2"
        :y="zone.geometry.y + zone.geometry.h / 2 - (zone.geometry.h > 9 ? 1.2 : -1.1)"
        text-anchor="middle"
        class="zone-name"
      >
        {{ zone.name }}
      </text>
      <text
        v-if="zone.geometry.h > 9"
        :x="zone.geometry.x + zone.geometry.w / 2"
        :y="zone.geometry.y + zone.geometry.h / 2 + 3.4"
        text-anchor="middle"
        class="zone-sub"
      >
        {{ soldOut(zone) ? 'Sold out' : zone.from_price ? `R$ ${zone.from_price}` : `${zone.total_seats} seats` }}
      </text>
    </g>
  </svg>
</template>
