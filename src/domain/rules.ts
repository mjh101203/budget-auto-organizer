import type { Finding, Item, PurchaseRequest, Team } from './types'
import {
  BUDGET_CATEGORIES,
  EVENT_CATEGORY,
  FOOD_KEYWORDS,
  FORBIDDEN_GIFT_KEYWORDS,
  OTHER_CATEGORY,
  RULE_CONFIG,
} from '../config/budget'
import { formatWon, itemAmount, sumWon } from './money'
import { remainingAfterDraft } from './budget'

export type CheckRequestDraft = Pick<PurchaseRequest, 'items' | 'shippingFee' | 'vatFee' | 'purpose'>

function itemSearchText(item: Pick<Item, 'name' | 'spec'>): string {
  return `${item.name} ${item.spec ?? ''}`.toLowerCase()
}

function isValidLink(url: string | undefined): boolean {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'))
}

export function checkRequest(
  team: Team,
  requests: PurchaseRequest[],
  draft: CheckRequestDraft,
  options: { excludeRequestId?: string } = {},
): Finding[] {
  const findings: Finding[] = []
  const order = BUDGET_CATEGORIES[team.type]

  const remaining = remainingAfterDraft(team, requests, draft, options)

  // R1
  for (const category of order) {
    const after = remaining.byCategory[category] ?? 0
    if (after < 0) {
      findings.push({
        ruleId: 'R1',
        severity: 'error',
        category,
        message: `${category} 잔액 초과 (${formatWon(Math.abs(after))} 초과)`,
      })
    }
  }

  // R2
  if (remaining.total < 0) {
    findings.push({
      ruleId: 'R2',
      severity: 'error',
      message: `총 예산 잔액 초과 (${formatWon(Math.abs(remaining.total))} 초과)`,
    })
  }

  for (const item of draft.items) {
    // R3
    if (item.unitPrice >= RULE_CONFIG.highUnitPriceThreshold) {
      findings.push({
        ruleId: 'R3',
        severity: 'warning',
        itemId: item.id,
        category: item.category,
        message: `${item.name} 단가 ${formatWon(item.unitPrice)} — 비품 의심, 지도교사와 사전 협의 필요`,
      })
    }

    // R5
    const text = itemSearchText(item)
    if (FORBIDDEN_GIFT_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
      findings.push({
        ruleId: 'R5',
        severity: 'error',
        itemId: item.id,
        category: item.category,
        message: '상품권류는 구매할 수 없음',
      })
    }

    // R6
    if (FOOD_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
      const isEvent = item.category === EVENT_CATEGORY
      findings.push({
        ruleId: 'R6',
        severity: team.type === 'rne' ? 'error' : isEvent ? 'warning' : 'error',
        itemId: item.id,
        category: item.category,
        message:
          team.type === 'rne'
            ? 'R&E 연구비로 식비 집행 불가'
            : isEvent
              ? '식비는 행사·체험비 지출 — 사유를 입력하세요'
              : '동아리 활동비로 식비 집행 불가 (행사·체험비 항목만 가능)',
      })
    }

    // R7
    if (item.qty < RULE_CONFIG.minQty || item.qty > RULE_CONFIG.maxQty || !Number.isInteger(item.qty)) {
      findings.push({
        ruleId: 'R7',
        severity: 'error',
        itemId: item.id,
        category: item.category,
        message: '수량은 1~1,000 정수',
      })
    }

    // R8
    if (item.unitPrice < RULE_CONFIG.minUnitPrice || !Number.isInteger(item.unitPrice)) {
      findings.push({
        ruleId: 'R8',
        severity: 'error',
        itemId: item.id,
        category: item.category,
        message: '단가를 입력하세요',
      })
    }

    // R9
    if (item.category === OTHER_CATEGORY) {
      findings.push({
        ruleId: 'R9',
        severity: 'info',
        itemId: item.id,
        category: item.category,
        message: '예산 항목을 확인하세요',
      })
    }

    // R12
    if (RULE_CONFIG.requireProductLink && !isValidLink(item.url)) {
      findings.push({
        ruleId: 'R12',
        severity: 'error',
        itemId: item.id,
        category: item.category,
        message: '상품 링크를 입력하세요 (학교 제출 필수)',
      })
    }
  }

  // R4
  const totalAmount = sumWon(draft.items.map(itemAmount)) + draft.shippingFee + draft.vatFee
  if (totalAmount >= RULE_CONFIG.highTotalThreshold) {
    findings.push({
      ruleId: 'R4',
      severity: 'warning',
      message: '요청 합계 50만 원 이상 — 비교 견적 2개 필요',
    })
  }

  // R10
  if (draft.items.length === 0) {
    findings.push({
      ruleId: 'R10',
      severity: 'error',
      message: '품목이 없습니다',
    })
  }

  // R11
  if (draft.purpose.trim().length === 0) {
    findings.push({
      ruleId: 'R11',
      severity: 'error',
      message: '용도를 입력하세요',
    })
  }

  return findings
}
