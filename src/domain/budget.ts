import type { Category, Item, PurchaseRequest, Team } from './types'
import { BUDGET_CATEGORIES, OTHER_CATEGORY } from '../config/budget'
import { itemAmount, sumWon } from './money'

export interface CategoryBalance {
  category: Category
  allocated: number
  approved: number
  pending: number
  available: number
}

export function categoryItemTotals(items: Item[]): Record<Category, number> {
  const totals: Record<Category, number> = {}
  for (const item of items) {
    totals[item.category] = (totals[item.category] ?? 0) + itemAmount(item)
  }
  return totals
}

/** 배송비·부가세 귀속 대상 항목: 품목 금액 합이 가장 큰 항목(동점이면 표 순서), 품목 0개면 기타 */
export function attributeCategory(items: Item[], order: readonly Category[]): Category {
  if (items.length === 0) return OTHER_CATEGORY
  const totals = categoryItemTotals(items)
  let best = order[0]
  let bestAmount = totals[order[0]] ?? 0
  for (const category of order.slice(1)) {
    const amount = totals[category] ?? 0
    if (amount > bestAmount) {
      bestAmount = amount
      best = category
    }
  }
  return best
}

/** 요청의 항목별 금액(배송비+부가세를 귀속 항목에 더한 값) */
export function requestCategoryTotals(
  request: Pick<PurchaseRequest, 'items' | 'shippingFee' | 'vatFee'>,
  order: readonly Category[],
): Record<Category, number> {
  const totals = categoryItemTotals(request.items)
  const attributed = attributeCategory(request.items, order)
  totals[attributed] = (totals[attributed] ?? 0) + request.shippingFee + request.vatFee
  return totals
}

export function computeTeamBalances(
  team: Team,
  requests: PurchaseRequest[],
  options: { excludeRequestId?: string } = {},
): CategoryBalance[] {
  const order = BUDGET_CATEGORIES[team.type]
  const approved: Record<Category, number> = {}
  const pending: Record<Category, number> = {}

  for (const request of requests) {
    if (request.teamId !== team.id) continue
    if (request.status === 'rejected') continue
    if (request.status === 'submitted' && request.id === options.excludeRequestId) continue

    const totals = requestCategoryTotals(request, order)
    const bucket = request.status === 'approved' ? approved : pending
    for (const category of Object.keys(totals)) {
      bucket[category] = (bucket[category] ?? 0) + totals[category]
    }
  }

  return order.map((category) => {
    const allocated = team.allocations[category] ?? 0
    const approvedAmount = approved[category] ?? 0
    const pendingAmount = pending[category] ?? 0
    return {
      category,
      allocated,
      approved: approvedAmount,
      pending: pendingAmount,
      available: allocated - approvedAmount - pendingAmount,
    }
  })
}

export function totalBalance(balances: CategoryBalance[]): Omit<CategoryBalance, 'category'> {
  return {
    allocated: sumWon(balances.map((b) => b.allocated)),
    approved: sumWon(balances.map((b) => b.approved)),
    pending: sumWon(balances.map((b) => b.pending)),
    available: sumWon(balances.map((b) => b.available)),
  }
}

/**
 * 이번 요청 후 잔액 = available - 이번 요청의 해당 항목 금액.
 * 재제출(기존 요청을 고쳐서 다시 냄)이면 options.excludeRequestId로 자기 자신의 기존 pending을 뺀다.
 */
export function remainingAfterDraft(
  team: Team,
  requests: PurchaseRequest[],
  draft: Pick<PurchaseRequest, 'items' | 'shippingFee' | 'vatFee'>,
  options: { excludeRequestId?: string } = {},
): { byCategory: Record<Category, number>; total: number } {
  const order = BUDGET_CATEGORIES[team.type]
  const balances = computeTeamBalances(team, requests, options)
  const draftTotals = requestCategoryTotals(draft, order)

  const byCategory: Record<Category, number> = {}
  for (const balance of balances) {
    byCategory[balance.category] = balance.available - (draftTotals[balance.category] ?? 0)
  }

  return { byCategory, total: sumWon(Object.values(byCategory)) }
}
