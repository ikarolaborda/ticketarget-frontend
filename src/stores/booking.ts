import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import type { Ticket } from '@/types'

interface Reservation {
  reservation_id: string
  status: string
  expires_at: string | null
}

interface ReservationDetail extends Reservation {
  event_id: string | null
  tickets: Ticket[]
}

interface CartSnapshot {
  version: number
  eventId: string | null
  selected: Ticket[]
  reservation: Reservation | null
}

type QueueStatus = 'idle' | 'waiting' | 'active'

const MAX_QUEUE_ATTEMPTS = 30
const DEFAULT_RETRY_SECONDS = 10
const MIN_RETRY_SECONDS = 3
const MAX_RETRY_SECONDS = 30

const GUEST_KEY = 'ticketarget.guest_id'
const CART_KEY = 'ticketarget.cart'
const CART_VERSION = 1

// A stable guest identity is what lets a guest re-claim their reservation
// after a refresh — the server matches on the reservation's user_id.
function loadGuestId(): string {
  try {
    const stored = localStorage.getItem(GUEST_KEY)
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored
    const fresh = crypto.randomUUID()
    localStorage.setItem(GUEST_KEY, fresh)
    return fresh
  } catch {
    return crypto.randomUUID()
  }
}

export const useBookingStore = defineStore('booking', () => {
  const auth = useAuthStore()
  // Guests act under a persisted throwaway id; account holders act under their
  // user id (the backend also enforces token identity server-side).
  const guestId = ref(loadGuestId())
  const userId = computed(() => auth.user?.id ?? guestId.value)
  const eventId = ref<string | null>(null)
  const selected = ref<Ticket[]>([])
  const reservation = ref<Reservation | null>(null)
  const queueToken = ref<string | null>(null)
  const queueStatus = ref<QueueStatus>('idle')
  const retrySeconds = ref(0)
  const restoring = ref(false)
  const error = ref<string | null>(null)
  let waitCancelled = false
  // Persistence stays off until restore() has read the snapshot, so a fresh
  // boot can't clobber a valid cart with empty transient state.
  let persistEnabled = false

  function persist(): void {
    if (!persistEnabled) return
    try {
      const snapshot: CartSnapshot = {
        version: CART_VERSION,
        eventId: eventId.value,
        selected: selected.value,
        reservation: reservation.value,
      }
      localStorage.setItem(CART_KEY, JSON.stringify(snapshot))
    } catch {
      // Private mode / quota — the cart just won't survive a refresh.
    }
  }

  watch([eventId, selected, reservation], persist, { deep: true })

  // Rebuild the cart after a reload. The snapshot is only a pointer: whenever
  // it references a reservation, the server's answer is the source of truth.
  async function restore(): Promise<void> {
    let snapshot: CartSnapshot | null = null
    try {
      const raw = localStorage.getItem(CART_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CartSnapshot
        if (parsed?.version === CART_VERSION) snapshot = parsed
      }
    } catch {
      snapshot = null
    }

    if (!snapshot) {
      persistEnabled = true
      return
    }

    eventId.value = snapshot.eventId ?? null
    selected.value = Array.isArray(snapshot.selected) ? snapshot.selected : []

    const pointer = snapshot.reservation
    if (!pointer?.reservation_id) {
      persistEnabled = true
      persist()
      return
    }

    restoring.value = true
    try {
      const { data } = await api.get<ReservationDetail>(
        `/booking/reservation/${pointer.reservation_id}`,
        { params: { user_id: userId.value } },
      )
      if (data.status === 'held') {
        reservation.value = {
          reservation_id: data.reservation_id,
          status: data.status,
          expires_at: data.expires_at,
        }
        // Canonicalize the cart from the hold itself — local drift loses.
        if (data.event_id) eventId.value = data.event_id
        if (data.tickets.length > 0) selected.value = data.tickets
      } else if (data.status === 'confirmed') {
        selected.value = []
        reservation.value = null
      } else {
        // Released: the seats are gone but the user's picks can be re-reserved.
        reservation.value = null
      }
    } catch {
      reservation.value = null
    } finally {
      restoring.value = false
      persistEnabled = true
      persist()
    }
  }

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

  async function confirm(paymentToken: string, email: string | null = null): Promise<boolean> {
    if (reservation.value === null) return false
    error.value = null
    try {
      await api.post('/booking', {
        reservation_id: reservation.value.reservation_id,
        user_id: userId.value,
        payment_token: paymentToken,
        // Guests must say where the tickets go; account holders' email comes
        // from the verified token server-side.
        ...(email ? { email } : {}),
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

  void restore()

  return {
    userId,
    eventId,
    selected,
    reservation,
    queueStatus,
    retrySeconds,
    restoring,
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
