<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/client'
import type { SearchHit, SearchResponse } from '@/types'

const emit = defineEmits<{ (e: 'search', keyword: string): void }>()
const router = useRouter()

const keyword = ref('')
const suggestions = ref<SearchHit[]>([])
const open = ref(false)
const highlighted = ref(-1)

let timer: ReturnType<typeof setTimeout> | undefined
let blurTimer: ReturnType<typeof setTimeout> | undefined
// Monotonic sequence so a slow, stale autocomplete response can never
// overwrite the suggestions of a newer keystroke.
let requestSeq = 0

// Debounced search-as-you-type so each keystroke does not hit the gateway.
watch(keyword, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    emit('search', value)
    void suggest(value.trim())
  }, 250)
})

async function suggest(prefix: string): Promise<void> {
  if (prefix.length < 2) {
    close()
    return
  }
  const seq = ++requestSeq
  try {
    const { data } = await api.get<SearchResponse>('/search/autocomplete', {
      params: { q: prefix },
    })
    if (seq !== requestSeq) return
    suggestions.value = data.results
    highlighted.value = -1
    open.value = data.results.length > 0
  } catch {
    // Typeahead is best-effort; the main search still works without it.
  }
}

function close(): void {
  suggestions.value = []
  open.value = false
  highlighted.value = -1
}

function choose(hit: SearchHit): void {
  close()
  void router.push({ name: 'event', params: { id: hit.id } })
}

function move(step: number): void {
  if (!open.value) return
  const count = suggestions.value.length
  highlighted.value = (highlighted.value + step + count) % count
}

function onEnter(): void {
  const hit = suggestions.value[highlighted.value]
  if (open.value && hit) choose(hit)
  else close()
}

function onBlur(): void {
  // Delay so a mousedown on a suggestion wins over the input losing focus.
  blurTimer = setTimeout(close, 150)
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  clearTimeout(blurTimer)
})
</script>

<template>
  <div class="search-wrap">
    <span class="search-icon" aria-hidden="true">⌕</span>
    <input
      v-model="keyword"
      class="search"
      type="search"
      placeholder="Search artists, events, venues…"
      aria-label="Search events"
      role="combobox"
      :aria-expanded="open"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.esc="close"
      @blur="onBlur"
    />
    <ul v-if="open" class="autocomplete" role="listbox">
      <li
        v-for="(hit, i) in suggestions"
        :key="hit.id"
        role="option"
        :aria-selected="i === highlighted"
        :class="{ active: i === highlighted }"
        @mousedown.prevent="choose(hit)"
        @mouseenter="highlighted = i"
      >
        <span>{{ hit.name }}</span>
        <span v-if="hit.venue_name" class="muted">
          {{ hit.venue_name }}<template v-if="hit.venue_city">, {{ hit.venue_city }}</template>
        </span>
      </li>
    </ul>
  </div>
</template>
