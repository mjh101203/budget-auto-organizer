import { describe, expect, it } from 'vitest'
import {
  BUDGET_CATEGORIES,
  CLASSIFY_KEYWORD_GROUPS,
  EVENT_CATEGORY,
  FOOD_KEYWORDS,
  FORBIDDEN_GIFT_KEYWORDS,
  OTHER_CATEGORY,
  RULE_CONFIG,
} from './budget'

describe('BUDGET_CATEGORIES', () => {
  it('rne 항목 순서가 표 순서와 같다 (분류 동점 우선순위)', () => {
    expect(BUDGET_CATEGORIES.rne).toEqual(['재료비', '소모품비', '도서·자료비', '인쇄비', '기타'])
  })

  it('club 항목 순서가 표 순서와 같다', () => {
    expect(BUDGET_CATEGORIES.club).toEqual(['물품구입비', '인쇄비', '행사·체험비', '기타'])
  })

  it('두 구분 모두 기타 항목을 포함한다', () => {
    expect(BUDGET_CATEGORIES.rne).toContain(OTHER_CATEGORY)
    expect(BUDGET_CATEGORIES.club).toContain(OTHER_CATEGORY)
  })
})

describe('CLASSIFY_KEYWORD_GROUPS', () => {
  it('부품 키워드 묶음이 재료비/물품구입비로 분류된다', () => {
    const parts = CLASSIFY_KEYWORD_GROUPS.find((g) => g.keywords.includes('서보'))
    expect(parts?.rne).toBe('재료비')
    expect(parts?.club).toBe('물품구입비')
    expect(parts?.keywords).toContain('모터')
    expect(parts?.keywords).toContain('릴레이')
    expect(parts?.keywords).toContain('오실로스코프')
  })

  it('소모품 키워드 묶음이 소모품비/물품구입비로 분류된다', () => {
    const consumables = CLASSIFY_KEYWORD_GROUPS.find((g) => g.keywords.includes('배터리'))
    expect(consumables?.rne).toBe('소모품비')
    expect(consumables?.club).toBe('물품구입비')
    expect(consumables?.keywords).toContain('점퍼')
    expect(consumables?.keywords).toContain('케이블')
  })

  it('도서 키워드 묶음이 도서·자료비/기타로 분류된다', () => {
    const books = CLASSIFY_KEYWORD_GROUPS.find((g) => g.keywords.includes('도서'))
    expect(books?.rne).toBe('도서·자료비')
    expect(books?.club).toBe('기타')
  })

  it('인쇄 키워드 묶음이 두 구분 모두 인쇄비로 분류된다', () => {
    const printing = CLASSIFY_KEYWORD_GROUPS.find((g) => g.keywords.includes('인쇄'))
    expect(printing?.rne).toBe('인쇄비')
    expect(printing?.club).toBe('인쇄비')
  })

  it('행사 키워드 묶음이 기타/행사·체험비로 분류된다', () => {
    const events = CLASSIFY_KEYWORD_GROUPS.find((g) => g.keywords.includes('체험'))
    expect(events?.rne).toBe('기타')
    expect(events?.club).toBe(EVENT_CATEGORY)
  })
})

describe('RULE_CONFIG', () => {
  it('R3/R4 금액 기준값', () => {
    expect(RULE_CONFIG.highUnitPriceThreshold).toBe(300_000)
    expect(RULE_CONFIG.highTotalThreshold).toBe(500_000)
  })

  it('R7 수량 허용 범위', () => {
    expect(RULE_CONFIG.minQty).toBe(1)
    expect(RULE_CONFIG.maxQty).toBe(1_000)
  })

  it('R12 기본값은 상품 링크 필수', () => {
    expect(RULE_CONFIG.requireProductLink).toBe(true)
  })
})

describe('FORBIDDEN_GIFT_KEYWORDS (R5)', () => {
  it('상품권류 키워드를 포함하지만 충전기/충전 모듈은 걸리지 않는다', () => {
    expect(FORBIDDEN_GIFT_KEYWORDS).toContain('상품권')
    expect(FORBIDDEN_GIFT_KEYWORDS).toContain('포인트 충전')
    const hitsChargerName = FORBIDDEN_GIFT_KEYWORDS.some((keyword) => '휴대폰 충전기'.includes(keyword))
    const hitsChargeModuleName = FORBIDDEN_GIFT_KEYWORDS.some((keyword) => '충전 모듈 보드'.includes(keyword))
    expect(hitsChargerName).toBe(false)
    expect(hitsChargeModuleName).toBe(false)
  })
})

describe('FOOD_KEYWORDS (R6)', () => {
  it('식비 키워드 목록', () => {
    expect(FOOD_KEYWORDS).toEqual(['간식', '음료', '과자', '식사', '도시락', '피자', '치킨', '커피'])
  })
})
