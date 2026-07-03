import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RevenueChart from '../RevenueChart.vue'
import type { RevenueDay } from '../types'

function series(revenues: number[]): RevenueDay[] {
  return revenues.map((revenue, i) => ({
    date: `2026-06-${String(20 + i).padStart(2, '0')}`,
    revenue: revenue.toFixed(2),
    bookings: revenue > 0 ? 1 : 0,
  }))
}

describe('RevenueChart', () => {
  it('draws a bar only for days with revenue', () => {
    const wrapper = mount(RevenueChart, {
      props: { series: series([0, 0, 100, 0, 50, 0, 0, 0, 0, 0, 0, 0, 0, 25]) },
    })

    expect(wrapper.findAll('.chart-bar')).toHaveLength(3)
  })

  it('direct-labels only the peak and the latest day', () => {
    const wrapper = mount(RevenueChart, {
      props: { series: series([0, 10, 900, 0, 50, 0, 0, 0, 0, 0, 0, 0, 0, 25]) },
    })

    const labels = wrapper.findAll('.chart-bar-label')
    expect(labels).toHaveLength(2)
    const texts = labels.map((l) => l.text())
    expect(texts.some((t) => t.includes('900'))).toBe(true)
    expect(texts.some((t) => t.includes('25'))).toBe(true)
  })

  it('collapses the peak/latest labels into one when the latest day is the peak', () => {
    const wrapper = mount(RevenueChart, {
      props: { series: series([0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 900]) },
    })

    expect(wrapper.findAll('.chart-bar-label')).toHaveLength(1)
  })

  it('shows the empty state when there are no sales at all', () => {
    const wrapper = mount(RevenueChart, { props: { series: series(new Array(14).fill(0)) } })

    expect(wrapper.findAll('.chart-bar')).toHaveLength(0)
    expect(wrapper.text()).toContain('No recognized sales')
  })

  it('reveals a tooltip when hovering a day column', async () => {
    const wrapper = mount(RevenueChart, {
      props: { series: series([0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
    })

    expect(wrapper.find('.chart-tooltip').exists()).toBe(false)

    await wrapper.findAll('rect')[2].trigger('mouseenter')

    const tooltip = wrapper.find('.chart-tooltip')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toContain('2026-06-22')
    expect(tooltip.text()).toContain('1 booking')
  })
})
