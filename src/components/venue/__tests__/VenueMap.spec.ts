import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { EventZone } from '@/types'
import { clampGeometry } from '../geometry'
import VenueMap from '../VenueMap.vue'

function zone(overrides: Partial<EventZone> = {}): EventZone {
  return {
    id: 'z1',
    name: 'VIP',
    kind: 'seated',
    rows: 2,
    seats_per_row: 3,
    capacity: null,
    total_seats: 6,
    color_index: 0,
    geometry: { type: 'rect', x: 10, y: 10, w: 30, h: 20 },
    sort_order: 0,
    tickets_total: 6,
    available: 4,
    from_price: '120.50',
    ...overrides,
  }
}

describe('VenueMap', () => {
  it('renders a shape and an always-visible label per zone', () => {
    const wrapper = mount(VenueMap, { props: { zones: [zone(), zone({ id: 'z2', name: 'Pit' })] } })

    expect(wrapper.findAll('.zone-shape')).toHaveLength(2)
    const names = wrapper.findAll('.zone-name').map((n) => n.text())
    expect(names).toContain('VIP')
    expect(names).toContain('Pit')
  })

  it('shows the from-price on zones that are on sale', () => {
    const wrapper = mount(VenueMap, { props: { zones: [zone()] } })

    expect(wrapper.find('.zone-sub').text()).toBe('R$ 120.50')
  })

  it('marks sold-out zones and refuses their selection', async () => {
    const wrapper = mount(VenueMap, {
      props: { zones: [zone({ available: 0 })] },
    })

    const group = wrapper.find('.map-zone')
    expect(group.classes()).toContain('sold-out')
    expect(wrapper.find('.zone-sub').text()).toBe('Sold out')

    await group.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('emits select for zones on sale when not editable', async () => {
    const wrapper = mount(VenueMap, { props: { zones: [zone()] } })

    await wrapper.find('.map-zone').trigger('click')

    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'z1' })
  })

  it('does not treat availability-free zones (admin preview) as sold out', () => {
    const wrapper = mount(VenueMap, {
      props: { zones: [zone({ available: undefined, tickets_total: undefined, from_price: undefined })] },
    })

    expect(wrapper.find('.map-zone').classes()).not.toContain('sold-out')
    expect(wrapper.find('.zone-sub').text()).toBe('6 seats')
  })
})

describe('clampGeometry', () => {
  it('keeps a dragged zone inside the canvas', () => {
    expect(clampGeometry({ type: 'rect', x: -5, y: -5, w: 30, h: 20 })).toMatchObject({ x: 0, y: 0 })
    expect(clampGeometry({ type: 'rect', x: 95, y: 65, w: 30, h: 20 })).toMatchObject({ x: 70, y: 50 })
  })

  it('enforces a minimum size', () => {
    expect(clampGeometry({ type: 'rect', x: 10, y: 10, w: 0.5, h: 0.5 })).toMatchObject({ w: 2, h: 2 })
  })
})
