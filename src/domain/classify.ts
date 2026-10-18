import type { BudgetType, Category } from './types'
import { BUDGET_CATEGORIES, CLASSIFY_KEYWORD_GROUPS, OTHER_CATEGORY } from '../config/budget'

/**
 * 품명(+spec)에 키워드 묶음별 일치 개수를 세어 가장 많이 매칭된 항목으로 분류한다.
 * 동점이면 BUDGET_CATEGORIES 표 순서가 빠른 항목, 전부 0개면 기타.
 */
export function classifyItem(name: string, spec: string | undefined, budgetType: BudgetType): Category {
  const text = `${name} ${spec ?? ''}`.toLowerCase()

  const counts = new Map<Category, number>()
  for (const group of CLASSIFY_KEYWORD_GROUPS) {
    const category = group[budgetType]
    const matched = group.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length
    counts.set(category, (counts.get(category) ?? 0) + matched)
  }

  let best: Category = OTHER_CATEGORY
  let bestCount = 0
  for (const category of BUDGET_CATEGORIES[budgetType]) {
    const count = counts.get(category) ?? 0
    if (count > bestCount) {
      best = category
      bestCount = count
    }
  }

  return bestCount > 0 ? best : OTHER_CATEGORY
}
