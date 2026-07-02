import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { EventDetail, SearchHit, SearchResponse } from '@/types'

const PAGE_SIZE = 12

export const useCatalogStore = defineStore('catalog', () => {
  const results = ref<SearchHit[]>([])
  const current = ref<EventDetail | null>(null)
  const loading = ref(false)
  const lastTookMs = ref(0)
  const total = ref(0)
  const page = ref(1)
  const keyword = ref('')

  const hasMore = computed(() => results.value.length < total.value)

  async function fetchPage(reset: boolean): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      const { data } = await api.get<SearchResponse>('/search', {
        params: { keyword: keyword.value, page: page.value, size: PAGE_SIZE },
      })
      results.value = reset ? data.results : [...results.value, ...data.results]
      total.value = data.total
      lastTookMs.value = data.took_ms
    } finally {
      loading.value = false
    }
  }

  // Empty keyword lists the whole catalog; a term filters it. Both reset to page 1.
  async function search(term = ''): Promise<void> {
    keyword.value = term.trim()
    page.value = 1
    await fetchPage(true)
  }

  async function loadMore(): Promise<void> {
    if (loading.value || !hasMore.value) return
    page.value += 1
    await fetchPage(false)
  }

  async function loadEvent(id: string): Promise<void> {
    loading.value = true
    try {
      const { data } = await api.get<{ data: EventDetail }>(`/event/${id}`)
      current.value = data.data
    } finally {
      loading.value = false
    }
  }

  return { results, current, loading, lastTookMs, total, keyword, hasMore, search, loadMore, loadEvent }
})
