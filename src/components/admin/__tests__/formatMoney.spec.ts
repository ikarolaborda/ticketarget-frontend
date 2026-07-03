import { describe, expect, it } from 'vitest'
import { formatMoney } from '../types'

describe('formatMoney', () => {
  it('prefixes with the platform currency and keeps two decimals', () => {
    const expected = `R$ ${Number(4979.07).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

    expect(formatMoney('4979.07')).toBe(expected)
  })

  it('normalizes integers and numbers to two decimals', () => {
    expect(formatMoney(90)).toMatch(/^R\$ 90([.,]00)$/)
    expect(formatMoney('0')).toMatch(/^R\$ 0([.,]00)$/)
  })
})
