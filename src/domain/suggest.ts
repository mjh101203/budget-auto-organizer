import type { Category, Item } from './types'
import { itemAmount } from './money'

export interface QuantitySuggestion {
  itemId: string
  itemName: string
  currentQty: number
  suggestedQty: number
  reducedAmount: number
}

/**
 * 항목 잔액 초과분(excessAmount)을 없애려면 어떤 품목의 수량을 얼마나 줄여야 하는지 제안한다.
 * 해당 항목의 품목을 금액 큰 순으로 훑으며, 초과분이 없어질 때까지 각 품목의 수량을 최소한으로 줄인다.
 */
export function suggestQuantityFix(items: Item[], category: Category, excessAmount: number): QuantitySuggestion[] {
  if (excessAmount <= 0) return []

  const candidates = items
    .filter((item) => item.category === category && item.unitPrice > 0 && item.qty > 0)
    .sort((a, b) => itemAmount(b) - itemAmount(a))

  const suggestions: QuantitySuggestion[] = []
  let remaining = excessAmount

  for (const item of candidates) {
    if (remaining <= 0) break
    const reduceQty = Math.min(item.qty, Math.ceil(remaining / item.unitPrice))
    if (reduceQty <= 0) continue
    const reducedAmount = reduceQty * item.unitPrice
    suggestions.push({
      itemId: item.id,
      itemName: item.name,
      currentQty: item.qty,
      suggestedQty: item.qty - reduceQty,
      reducedAmount,
    })
    remaining -= reducedAmount
  }

  return suggestions
}
