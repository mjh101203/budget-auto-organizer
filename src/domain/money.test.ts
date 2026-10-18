import { describe, expect, it } from 'vitest'
import { formatWon, itemAmount, sumWon } from './money'

describe('formatWon', () => {
  it('formats zero', () => {
    expect(formatWon(0)).toBe('0원')
  })

  it('formats with thousands separators', () => {
    expect(formatWon(317700)).toBe('317,700원')
  })

  it('formats large amounts', () => {
    expect(formatWon(1234567)).toBe('1,234,567원')
  })
})

describe('itemAmount', () => {
  it('multiplies quantity by unit price', () => {
    expect(itemAmount({ qty: 2, unitPrice: 5500 })).toBe(11000)
  })
})

describe('sumWon', () => {
  it('sums a list of amounts', () => {
    expect(sumWon([89000, 79800, 11000])).toBe(179800)
  })

  it('returns 0 for an empty list', () => {
    expect(sumWon([])).toBe(0)
  })
})
