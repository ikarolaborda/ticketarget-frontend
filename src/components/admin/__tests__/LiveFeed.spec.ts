import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LiveFeed from '../LiveFeed.vue'
import type { AdminBookingRow } from '../types'

function row(id: string, overrides: Partial<AdminBookingRow> = {}): AdminBookingRow {
  return {
    id,
    created_at: new Date().toISOString(),
    email: 'buyer@example.com',
    amount: '100.00',
    status: 'paid',
    seat: 'A01',
    event_name: 'Gala',
    ...overrides,
  }
}

describe('LiveFeed', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not highlight the initial rows', () => {
    const wrapper = mount(LiveFeed, { props: { rows: [row('a'), row('b')] } })

    expect(wrapper.findAll('.feed-row.fresh')).toHaveLength(0)
  })

  it('highlights only rows that arrive after the first paint, then decays', async () => {
    const wrapper = mount(LiveFeed, { props: { rows: [row('a'), row('b')] } })

    await wrapper.setProps({ rows: [row('c'), row('a'), row('b')] })

    const fresh = wrapper.findAll('.feed-row.fresh')
    expect(fresh).toHaveLength(1)
    expect(fresh[0].text()).toContain('Gala')

    vi.advanceTimersByTime(4_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.feed-row.fresh')).toHaveLength(0)
  })

  it('renders relative timestamps and status chips', () => {
    const past = new Date(Date.now() - 90_000).toISOString()
    const wrapper = mount(LiveFeed, {
      props: { rows: [row('a', { created_at: past, status: 'refunded' })] },
    })

    expect(wrapper.text()).toContain('1m ago')
    expect(wrapper.find('.status-chip').classes()).toContain('refunded')
  })

  it('shows an empty state without rows', () => {
    const wrapper = mount(LiveFeed, { props: { rows: [] } })

    expect(wrapper.text()).toContain('No bookings yet.')
  })
})
