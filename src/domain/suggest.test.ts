import { describe, expect, it } from 'vitest'
import type { Item } from './types'
import { suggestQuantityFix } from './suggest'

function item(partial: Partial<Item> & { id: string; name: string }): Item {
  return { qty: 1, unitPrice: 0, category: '재료비', ...partial }
}

describe('suggestQuantityFix', () => {
  it('초과분이 0 이하면 제안 없음', () => {
    expect(suggestQuantityFix([], '재료비', 0)).toEqual([])
    expect(suggestQuantityFix([], '재료비', -100)).toEqual([])
  })

  it('품목 하나면 초과분을 덮을 만큼만 수량을 줄인다', () => {
    const items = [item({ id: 'a', name: '점퍼 케이블', qty: 10, unitPrice: 3000, category: '재료비' })]
    const result = suggestQuantityFix(items, '재료비', 21000)
    expect(result).toEqual([{ itemId: 'a', itemName: '점퍼 케이블', currentQty: 10, suggestedQty: 3, reducedAmount: 21000 }])
  })

  it('나누어떨어지지 않으면 초과분 이상으로 줄이도록 올림한다', () => {
    const items = [item({ id: 'a', name: '서보모터', qty: 10, unitPrice: 3000, category: '재료비' })]
    const result = suggestQuantityFix(items, '재료비', 20000)
    // ceil(20000/3000) = 7 → 21,000원 절감(초과분 이상)
    expect(result).toEqual([{ itemId: 'a', itemName: '서보모터', currentQty: 10, suggestedQty: 3, reducedAmount: 21000 }])
  })

  it('금액이 큰 품목부터 순서대로 줄이고 다 안 되면 여러 품목에 걸쳐 제안한다', () => {
    const items = [
      item({ id: 'a', name: 'A', qty: 5, unitPrice: 10000, category: '재료비' }),
      item({ id: 'b', name: 'B', qty: 3, unitPrice: 5000, category: '재료비' }),
    ]
    const result = suggestQuantityFix(items, '재료비', 60000)
    expect(result).toEqual([
      { itemId: 'a', itemName: 'A', currentQty: 5, suggestedQty: 0, reducedAmount: 50000 },
      { itemId: 'b', itemName: 'B', currentQty: 3, suggestedQty: 1, reducedAmount: 10000 },
    ])
  })

  it('다른 항목(category)의 품목은 제안에서 제외한다', () => {
    const items = [
      item({ id: 'a', name: 'A', qty: 5, unitPrice: 10000, category: '재료비' }),
      item({ id: 'b', name: 'B', qty: 5, unitPrice: 10000, category: '소모품비' }),
    ]
    const result = suggestQuantityFix(items, '소모품비', 10000)
    expect(result).toEqual([{ itemId: 'b', itemName: 'B', currentQty: 5, suggestedQty: 4, reducedAmount: 10000 }])
  })

  it('품목들을 전부 0으로 줄여도 초과분을 못 채우면 가능한 만큼만 제안한다', () => {
    const items = [item({ id: 'a', name: 'A', qty: 2, unitPrice: 1000, category: '재료비' })]
    const result = suggestQuantityFix(items, '재료비', 100000)
    expect(result).toEqual([{ itemId: 'a', itemName: 'A', currentQty: 2, suggestedQty: 0, reducedAmount: 2000 }])
  })
})
