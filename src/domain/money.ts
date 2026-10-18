import type { Item } from './types'

export function formatWon(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

export function itemAmount(item: Pick<Item, 'qty' | 'unitPrice'>): number {
  return item.qty * item.unitPrice
}

export function sumWon(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0)
}
