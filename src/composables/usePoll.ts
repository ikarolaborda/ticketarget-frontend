import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Visibility-aware polling. Pauses while the tab is hidden and refreshes
 * immediately on refocus; overlapping requests are deduped so a slow
 * response never stacks. Consecutive failures are counted so the caller
 * can surface a "stale" badge instead of silently showing old data.
 */
export function usePoll(fn: () => Promise<void>, intervalMs: number) {
  const lastUpdated = ref<Date | null>(null)
  const failures = ref(0)
  const inFlight = ref(false)

  let timer: number | undefined

  async function tick(): Promise<void> {
    if (inFlight.value) return
    // Hidden tabs pause the poll loop — but only after the first successful
    // load, so the dashboard is never empty when the user switches back.
    if (document.hidden && lastUpdated.value !== null) return
    inFlight.value = true
    try {
      await fn()
      lastUpdated.value = new Date()
      failures.value = 0
    } catch {
      failures.value++
    } finally {
      inFlight.value = false
    }
  }

  function onVisibility(): void {
    if (!document.hidden) void tick()
  }

  onMounted(() => {
    void tick()
    timer = window.setInterval(() => void tick(), intervalMs)
    document.addEventListener('visibilitychange', onVisibility)
  })

  onUnmounted(() => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { lastUpdated, failures, refresh: tick }
}
