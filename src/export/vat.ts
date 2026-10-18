import { sumWon } from '../domain/money'

/**
 * vatFee를 amounts 비율로 나눠 내림 → 남는 원은 금액이 큰 항목부터 1원씩.
 * amounts가 모두 0이거나 vatFee가 0이면 전부 0.
 */
export function distributeVat(amounts: number[], vatFee: number): number[] {
  const totalAmount = sumWon(amounts)
  if (vatFee === 0 || amounts.length === 0 || totalAmount === 0) {
    return amounts.map(() => 0)
  }

  const base = amounts.map((amount) => Math.floor((amount * vatFee) / totalAmount))
  const remainder = vatFee - sumWon(base)

  const order = amounts
    .map((amount, index) => ({ amount, index }))
    .sort((a, b) => b.amount - a.amount)

  const result = [...base]
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].index] += 1
  }
  return result
}
