<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import SearchBar from '@/components/SearchBar.vue'
import EventCard from '@/components/EventCard.vue'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()
const { results, loading, total, hasMore, lastTookMs, keyword } = storeToRefs(catalog)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

onMounted(async () => {
  await catalog.search() // browse all events on landing
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) catalog.loadMore()
  })
  if (sentinel.value) observer.observe(sentinel.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section>
    <div class="hero">
      <h1>Find your next event</h1>
      <p>Concerts, shows and games — search by artist, event or venue and grab your seats.</p>
      <SearchBar @search="catalog.search" />
      <div v-if="total" class="results-meta">
        <span>{{ total }} event{{ total === 1 ? '' : 's' }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ lastTookMs }} ms</span>
      </div>
    </div>

    <!-- First load: skeleton grid instead of a bare "Loading…" line. -->
    <div v-if="loading && results.length === 0" class="grid" aria-hidden="true">
      <div v-for="i in 8" :key="i" class="skeleton-card">
        <div class="sk sk-banner"></div>
        <div class="sk sk-line"></div>
        <div class="sk sk-line short"></div>
      </div>
    </div>

    <div v-else class="grid">
      <EventCard v-for="hit in results" :key="hit.id" :hit="hit" />
    </div>

    <div v-if="!loading && total === 0" class="empty-state">
      <span class="glyph" aria-hidden="true">🎫</span>
      <p>No events match “{{ keyword }}”.</p>
      <p>Try another artist, event name, or venue.</p>
    </div>

    <div v-if="loading && results.length > 0" class="center-row">
      <span class="spinner" aria-hidden="true"></span> Loading more…
    </div>
    <div ref="sentinel" aria-hidden="true" style="height: 1px"></div>
    <p v-if="hasMore && !loading" class="center-row muted">Scroll for more</p>
  </section>
</template>
