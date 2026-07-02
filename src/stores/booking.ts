import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { Ticket } from '@/types'

interface Reservation {
  reservation_id: string
  status: string
  expires_at: string | null
}

type QueueStatus = 'idle' | 'waiting' | 'active'

const MAX_QUEUE_ATTEMPTS = 30
const DEFAULT_RETRY_SECONDS = 10
const MIN_RETRY_SECONDS = 3
const MAX_RETRY_SECONDS = 30

export const useBookingStore = defineStore('booking', () => {
  // A throwaway user id stands in for real auth in this reference build.
  const userId = ref(crypto.randomUUID())
  const eventId = ref<string | null>(null)
  const selected = ref<Ticket[]>([])
  const reservation = ref<Reservation | null>(null)
  const queueToken = ref<string | null>(null)
  const queueStatus = ref<QueueStatus>('idle')
  const retrySeconds = ref(0)
  const error = ref<string | null>(null)
  let waitCancelled = false

  const total = computed(() =>
    selected.value.reduce((sum, t) => sum + Number.parseFloat(t.price), 0),
  )

  function setEvent(id: string): void {
    if (eventId.value !== id) {
      eventId.value = id
      selected.value = []
      queueToken.value = null
      queueStatus.value = 'idle'
    }
  }

  function toggle(ticket: Ticket): void {
    const idx = selected.value.findIndex((t) => t.id === ticket.id)
    if (idx >= 0) selected.value.splice(idx, 1)
    else if (ticket.status === 'available') selected.value.push(ticket)
  }

  function isSelected(ticketId: string): boolean {
    return selected.value.some((t) => t.id === ticketId)
  }

  // Waiting room: obtain an admission token before touching the purchase path.
  // At capacity the API answers 503 (+ Retry-After); instead of failing we show
  // a real waiting state and retry automatically until admitted or cancelled.
  async function joinQueue(): Promise<boolean> {
    if (queueToken.value) return true
    if (eventId.value === null) return false
    waitCancelled = false

    for (let attempt = 0; attempt < MAX_QUEUE_ATTEMPTS; attempt++) {
      if (waitCancelled) break
      try {
        const { data } = await api.post<{ queue_token: string }>('/queue/join', {
          user_id: userId.value,
          event_id: eventId.value,
        })
        queueToken.value = data.queue_token
        queueStatus.value = 'active'
        return true
      } catch (e) {
        if (!isStatus(e, 503)) {
          queueStatus.value = 'idle'
          error.value = 'Could not join the queue.'
          return false
        }
        queueStatus.value = 'waiting'
        await countdown(retryAfterSeconds(e))
      }
    }

    queueStatus.value = 'idle'
    if (!waitCancelled) error.value = 'The event is still at capacity — please try again shortly.'
    return false
  }

  function cancelQueueWait(): void {
    waitCancelled = true
    retrySeconds.value = 0
    if (queueStatus.value === 'waiting') queueStatus.value = 'idle'
  }

  async function countdown(seconds: number): Promise<void> {
    for (retrySeconds.value = seconds; retrySeconds.value > 0; retrySeconds.value--) {
      if (waitCancelled) return
      await sleep(1000)
    }
  }

  async function reserve(): Promise<boolean> {
    error.value = null
    if (!(await joinQueue())) return false
    try {
      const { data } = await api.post<Reservation>(
        '/reserve',
        { user_id: userId.value, tickets: selected.value.map((t) => t.id) },
        { headers: { 'X-Queue-Token': queueToken.value ?? '' } },
      )
      reservation.value = data
      return true
    } catch (e) {
      if (isStatus(e, 409)) error.value = 'Those seats were just taken. Please pick others.'
      else if (isStatus(e, 403)) {
        // The pass expired while the user dawdled: force a fresh admission.
        queueToken.value = null
        queueStatus.value = 'idle'
        error.value = 'Your queue pass expired — please retry.'
      } else error.value = 'Could not reserve those seats.'
      return false
    }
  }

  async function confirm(paymentToken: string): Promise<boolean> {
    if (reservation.value === null) return false
    error.value = null
    try {
      await api.post('/booking', {
        reservation_id: reservation.value.reservation_id,
        user_id: userId.value,
        payment_token: paymentToken,
      })
      selected.value = []
      reservation.value = null
      queueToken.value = null
      queueStatus.value = 'idle'
      return true
    } catch (e) {
      error.value = isStatus(e, 402) ? 'Payment could not be completed.' : 'Booking failed.'
      return false
    }
  }

  return {
    userId,
    eventId,
    selected,
    reservation,
    queueStatus,
    retrySeconds,
    error,
    total,
    setEvent,
    toggle,
    isSelected,
    reserve,
    confirm,
    cancelQueueWait,
  }
})

function isStatus(error: unknown, status: number): boolean {
  return (error as { response?: { status?: number } })?.response?.status === status
}

function retryAfterSeconds(error: unknown): number {
  const raw = (error as { response?: { headers?: Record<string, string> } })?.response?.headers?.[
    'retry-after'
  ]
  const parsed = Number.parseInt(raw ?? '', 10)
  if (Number.isNaN(parsed)) return DEFAULT_RETRY_SECONDS
  return Math.min(MAX_RETRY_SECONDS, Math.max(MIN_RETRY_SECONDS, parsed))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
