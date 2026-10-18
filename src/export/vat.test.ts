import { describe, expect, it } from 'vitest'
import { distributeVat } from './vat'

describe('distributeVat', () => {
  it('devicemart-2 예시: 17,700/17,000, vatFee 3,470 → 1,770/1,700', () => {
    expect(distributeVat([17700, 17000], 3470)).toEqual([1770, 1700])
  })

  it('devicemart-3 예시: 17,700/34,000/1,000, vatFee 5,270 → 1,770/3,400/100', () => {
    expect(distributeVat([17700, 34000, 1000], 5270)).toEqual([1770, 3400, 100])
  })

  it('나누어떨어지지 않으면 금액 큰 품목부터 1원씩: 1:1:1, vatFee 100 → 34/33/33', () => {
    expect(distributeVat([1000, 1000, 1000], 100)).toEqual([34, 33, 33])
  })

  it('vatFee 0이면 전부 0', () => {
    expect(distributeVat([17700, 34000], 0)).toEqual([0, 0])
  })

  it('품목 금액 합 = 배분 합이 항상 성립(랜덤 케이스)', () => {
    let seed = 42
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed
    }
    for (let i = 0; i < 50; i++) {
      const count = 1 + (rand() % 5)
      const amounts = Array.from({ length: count }, () => 1 + (rand() % 100000))
      const vatFee = rand() % 10000
      const shares = distributeVat(amounts, vatFee)
      expect(shares.reduce((a, b) => a + b, 0)).toBe(vatFee)
    }
  })
})
