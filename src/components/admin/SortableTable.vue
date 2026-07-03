<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref } from 'vue'

export interface Column {
  key: string
  label: string
  sortable?: boolean
  numeric?: boolean
}

const props = defineProps<{
  columns: Column[]
  rows: T[]
  rowKey: string
  empty?: string
}>()

const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('desc')

// Sorting applies to the loaded rows only — the API's newest-first order is
// the global truth; this is a view convenience, not a server sort.
const sorted = computed(() => {
  if (sortKey.value === null) return props.rows
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  const numeric = props.columns.find((c) => c.key === key)?.numeric === true
  return [...props.rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (numeric) return (Number.parseFloat(String(av)) - Number.parseFloat(String(bv))) * dir
    return String(av).localeCompare(String(bv)) * dir
  })
})

function toggleSort(column: Column): void {
  if (column.sortable !== true) return
  if (sortKey.value === column.key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = column.key
  sortDir.value = 'desc'
}
</script>

<template>
  <table class="admin-table">
    <thead>
      <tr>
        <th
          v-for="c in columns"
          :key="c.key"
          :class="{ sortable: c.sortable, numeric: c.numeric }"
          :aria-sort="sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined"
          @click="toggleSort(c)"
        >
          {{ c.label }}
          <span v-if="sortKey === c.key" class="sort-arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in sorted" :key="String(row[rowKey])">
        <td v-for="c in columns" :key="c.key" :class="{ numeric: c.numeric }">
          <slot :name="c.key" :row="row">{{ row[c.key] ?? '—' }}</slot>
        </td>
      </tr>
      <tr v-if="rows.length === 0">
        <td :colspan="columns.length" class="muted">{{ empty ?? 'Nothing here yet.' }}</td>
      </tr>
    </tbody>
  </table>
</template>
