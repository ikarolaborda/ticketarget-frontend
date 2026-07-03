<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RevenueDay } from './types'
import { formatMoney } from './types'

const props = defineProps<{ series: RevenueDay[] }>()

const W = 560
const H = 190
const PAD_TOP = 26
const PAD_BOTTOM = 24
const PAD_X = 8
const GAP = 2

const plotH = H - PAD_TOP - PAD_BOTTOM
const baseline = H - PAD_BOTTOM

const values = computed(() => props.series.map((d) => Number.parseFloat(d.revenue)))
const max = computed(() => Math.max(...values.value, 0))
const hasSales = computed(() => max.value > 0)
const maxIndex = computed(() => values.value.indexOf(max.value))

const slot = computed(() => (W - PAD_X * 2) / Math.max(props.series.length, 1))
const barWidth = computed(() => Math.max(4, slot.value - GAP * 2))

interface Bar {
  day: RevenueDay
  x: number
  y: number
  h: number
  labeled: boolean
}

const bars = computed<Bar[]>(() =>
  props.series.map((day, i) => {
    const v = values.value[i]
    const h = hasSales.value ? Math.round((v / max.value) * (plotH - 4)) : 0
    return {
      day,
      x: PAD_X + i * slot.value + GAP,
      y: baseline - h,
      h,
      // Selective direct labels only: the peak and the most recent day.
      labeled: v > 0 && (i === maxIndex.value || i === props.series.length - 1),
    }
  }),
)

// Rounded top corners anchored to the baseline (bottom corners stay square).
function barPath(b: Bar): string {
  if (b.h <= 0) return ''
  const r = Math.min(4, b.h, barWidth.value / 2)
  const x2 = b.x + barWidth.value
  return [
    `M ${b.x} ${baseline}`,
    `L ${b.x} ${b.y + r}`,
    `Q ${b.x} ${b.y} ${b.x + r} ${b.y}`,
    `L ${x2 - r} ${b.y}`,
    `Q ${x2} ${b.y} ${x2} ${b.y + r}`,
    `L ${x2} ${baseline}`,
    'Z',
  ].join(' ')
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const hover = ref<{ bar: Bar; left: number } | null>(null)

function onEnter(bar: Bar): void {
  hover.value = { bar, left: ((bar.x + barWidth.value / 2) / W) * 100 }
}
</script>

<template>
  <div class="chart-wrap">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="revenue-chart"
      role="img"
      aria-label="Revenue per day over the last 14 days (UTC)"
      @mouseleave="hover = null"
    >
      <line :x1="PAD_X" :y1="baseline" :x2="W - PAD_X" :y2="baseline" class="chart-baseline" />
      <template v-if="hasSales">
        <line :x1="PAD_X" :y1="PAD_TOP" :x2="W - PAD_X" :y2="PAD_TOP" class="chart-gridline" />
        <text :x="PAD_X" :y="PAD_TOP - 5" class="chart-axis-label">{{ formatMoney(max) }}</text>
      </template>

      <g v-for="b in bars" :key="b.day.date">
        <path v-if="b.h > 0" :d="barPath(b)" class="chart-bar" :class="{ hovered: hover?.bar === b }" />
        <text v-if="b.labeled" :x="b.x + barWidth / 2" :y="b.y - 5" text-anchor="middle" class="chart-bar-label">
          {{ formatMoney(b.day.revenue) }}
        </text>
        <!-- Full-column hit target so hovering works on short and zero bars. -->
        <rect
          :x="b.x - GAP"
          :y="PAD_TOP"
          :width="barWidth + GAP * 2"
          :height="plotH"
          fill="transparent"
          @mouseenter="onEnter(b)"
        >
          <title>{{ b.day.date }} — {{ formatMoney(b.day.revenue) }} ({{ b.day.bookings }} bookings)</title>
        </rect>
      </g>

      <text :x="PAD_X" :y="H - 6" class="chart-axis-label">{{ shortDate(series[0]?.date ?? '') }}</text>
      <text :x="W - PAD_X" :y="H - 6" text-anchor="end" class="chart-axis-label">
        {{ shortDate(series[series.length - 1]?.date ?? '') }}
      </text>
    </svg>

    <div v-if="hover" class="chart-tooltip" :style="{ left: hover.left + '%' }">
      <strong>{{ formatMoney(hover.bar.day.revenue) }}</strong>
      <span>{{ hover.bar.day.date }} · {{ hover.bar.day.bookings }} booking{{ hover.bar.day.bookings === 1 ? '' : 's' }}</span>
    </div>

    <p v-if="!hasSales" class="muted chart-empty">No recognized sales in the last 14 days.</p>
  </div>
</template>
