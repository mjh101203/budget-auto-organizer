import { describe, expect, it } from 'vitest'
import demoCartHtml from '../../specs/fixtures/carts/demo-cart.html?raw'
import demoCartText from '../../specs/fixtures/carts/demo-cart.txt?raw'
import { checkRequest } from './rules'
import { classifyItem } from './classify'
import { parseCart } from './parser/parseCart'
import { createSeedState } from '../store/seed'
import type { Item, PurchaseRequest, Team } from './types'

const seed = createSeedState()
const teamA = seed.teams.find((t) => t.id === 'rne-3')!
const teamB = seed.teams.find((t) => t.id === 'club-robot')!

function toItems(parsed: ReturnType<typeof parseCart>['items'], budgetType: 'rne' | 'club'): Item[] {
  return parsed.map((p, i) => ({
    id: `draft-item-${i + 1}`,
    name: p.name,
    spec: p.spec,
    qty: p.qty,
    unitPrice: p.unitPrice,
    category: classifyItem(p.name, p.spec, budgetType),
    url: p.url,
  }))
}

describe('checkRequest — 데모 시나리오', () => {
  const parsed = parseCart(demoCartText, demoCartHtml)
  const demoItems = toItems(parsed.items, 'rne')

  it('8품목 그대로면 R1 error(재료비 84,700원 초과) + R3 warning(오실로스코프), 다른 finding 없음', () => {
    const draft = { items: demoItems, shippingFee: parsed.shippingFee, vatFee: 0, purpose: '관수 시스템 제작' }
    const findings = checkRequest(teamA, seed.requests, draft)

    expect(findings).toHaveLength(2)
    const r1 = findings.find((f) => f.ruleId === 'R1')!
    expect(r1.severity).toBe('error')
    expect(r1.category).toBe('재료비')
    expect(r1.message).toBe('재료비 잔액 초과 (84,700원 초과)')

    const r3 = findings.find((f) => f.ruleId === 'R3')!
    expect(r3.severity).toBe('warning')
    expect(r3.message).toContain('오실로스코프')
  })

  it('오실로스코프 삭제 후 finding 없음', () => {
    const withoutScope = demoItems.filter((item) => !item.name.includes('오실로스코프'))
    const draft = { items: withoutScope, shippingFee: parsed.shippingFee, vatFee: 0, purpose: '관수 시스템 제작' }
    const findings = checkRequest(teamA, seed.requests, draft)
    expect(findings).toHaveLength(0)
  })
})

describe('R1 — 항목 잔액 초과', () => {
  it('이번 요청 후 잔액이 정확히 0이면 걸리지 않는다', () => {
    const draft = {
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 317_700, category: '재료비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamA, seed.requests, draft)
    expect(findings.some((f) => f.ruleId === 'R1')).toBe(false)
  })

  it('이번 요청 후 잔액이 1원이라도 음수면 걸린다', () => {
    const draft = {
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 317_701, category: '재료비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamA, seed.requests, draft)
    expect(findings.find((f) => f.ruleId === 'R1')!.message).toBe('재료비 잔액 초과 (1원 초과)')
  })
})

describe('R2 — 총 잔액 초과', () => {
  const team: Team = {
    id: 't',
    name: 't',
    shortName: 't',
    type: 'rne',
    advisor: 'a',
    leader: 'b',
    members: [],
    allocations: { 재료비: 10_000, 소모품비: 0, '도서·자료비': 0, 인쇄비: 0, 기타: 0 },
  }

  it('총 이번 요청 후 잔액이 정확히 0이면 걸리지 않는다', () => {
    const draft = {
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 10_000, category: '재료비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(team, [], draft)
    expect(findings.some((f) => f.ruleId === 'R2')).toBe(false)
  })

  it('총 이번 요청 후 잔액이 음수면 R1과 함께 걸린다', () => {
    const draft = {
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 10_001, category: '재료비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(team, [], draft)
    expect(findings.some((f) => f.ruleId === 'R1')).toBe(true)
    expect(findings.find((f) => f.ruleId === 'R2')!.message).toBe('총 예산 잔액 초과 (1원 초과)')
  })
})

describe('R3 — 단가 경계값 (300,000원)', () => {
  const draft = (unitPrice: number) => ({
    items: [{ id: '1', name: 'a', qty: 1, unitPrice, category: '재료비' }] as Item[],
    shippingFee: 0,
    vatFee: 0,
    purpose: 'p',
  })

  it('299,999원이면 걸리지 않는다', () => {
    const findings = checkRequest(teamA, [], draft(299_999))
    expect(findings.some((f) => f.ruleId === 'R3')).toBe(false)
  })

  it('300,000원이면 걸린다', () => {
    const findings = checkRequest(teamA, [], draft(300_000))
    expect(findings.some((f) => f.ruleId === 'R3')).toBe(true)
  })
})

describe('R4 — 요청 합계 경계값 (500,000원)', () => {
  const draft = (unitPrice: number) => ({
    items: [{ id: '1', name: 'a', qty: 1, unitPrice, category: '재료비' }] as Item[],
    shippingFee: 0,
    vatFee: 0,
    purpose: 'p',
  })

  it('499,999원이면 걸리지 않는다', () => {
    const findings = checkRequest(teamA, [], draft(499_999))
    expect(findings.some((f) => f.ruleId === 'R4')).toBe(false)
  })

  it('500,000원이면 걸린다', () => {
    const findings = checkRequest(teamA, [], draft(500_000))
    expect(findings.some((f) => f.ruleId === 'R4')).toBe(true)
  })
})

describe('R5 — 금지 품목', () => {
  it('상품권이 포함되면 error', () => {
    const draft = {
      items: [{ id: '1', name: '백화점 상품권 5만원', qty: 1, unitPrice: 50_000, category: '기타' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamA, [], draft)
    expect(findings.find((f) => f.ruleId === 'R5')!.severity).toBe('error')
  })

  it('충전기/충전 모듈은 걸리지 않는다', () => {
    const draft = {
      items: [
        { id: '1', name: 'USB 충전기', qty: 1, unitPrice: 10_000, category: '재료비' },
        { id: '2', name: '배터리 충전 모듈', qty: 1, unitPrice: 10_000, category: '재료비' },
      ] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamA, [], draft)
    expect(findings.some((f) => f.ruleId === 'R5')).toBe(false)
  })
})

describe('R6 — 식비', () => {
  it('R&E는 행사·체험비가 있어도 항상 error', () => {
    const draft = {
      items: [{ id: '1', name: '회의용 커피', qty: 1, unitPrice: 5_000, category: '기타' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamA, [], draft)
    expect(findings.find((f) => f.ruleId === 'R6')!.severity).toBe('error')
  })

  it('동아리는 행사·체험비 항목이면 warning', () => {
    const draft = {
      items: [{ id: '1', name: '체험 행사 도시락', qty: 1, unitPrice: 5_000, category: '행사·체험비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamB, [], draft)
    expect(findings.find((f) => f.ruleId === 'R6')!.severity).toBe('warning')
  })

  it('동아리인데 행사·체험비가 아니면 error', () => {
    const draft = {
      items: [{ id: '1', name: '간식 과자', qty: 1, unitPrice: 5_000, category: '물품구입비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamB, [], draft)
    expect(findings.find((f) => f.ruleId === 'R6')!.severity).toBe('error')
  })
})

describe('R7 — 수량', () => {
  const draft = (qty: number) => ({
    items: [{ id: '1', name: 'a', qty, unitPrice: 1_000, category: '재료비' }] as Item[],
    shippingFee: 0,
    vatFee: 0,
    purpose: 'p',
  })

  it('0이면 error', () => {
    expect(checkRequest(teamA, [], draft(0)).some((f) => f.ruleId === 'R7')).toBe(true)
  })
  it('1,000이면 괜찮다', () => {
    expect(checkRequest(teamA, [], draft(1_000)).some((f) => f.ruleId === 'R7')).toBe(false)
  })
  it('1,001이면 error', () => {
    expect(checkRequest(teamA, [], draft(1_001)).some((f) => f.ruleId === 'R7')).toBe(true)
  })
  it('정수가 아니면 error', () => {
    expect(checkRequest(teamA, [], draft(1.5)).some((f) => f.ruleId === 'R7')).toBe(true)
  })
})

describe('R8 — 단가', () => {
  const draft = (unitPrice: number) => ({
    items: [{ id: '1', name: 'a', qty: 1, unitPrice, category: '재료비' }] as Item[],
    shippingFee: 0,
    vatFee: 0,
    purpose: 'p',
  })

  it('0이면 error', () => {
    expect(checkRequest(teamA, [], draft(0)).some((f) => f.ruleId === 'R8')).toBe(true)
  })
  it('정수가 아니면 error', () => {
    expect(checkRequest(teamA, [], draft(100.5)).some((f) => f.ruleId === 'R8')).toBe(true)
  })
})

describe('R9 — 기타 항목', () => {
  it('항목이 기타면 info', () => {
    const draft = {
      items: [{ id: '1', name: '알 수 없는 물건', qty: 1, unitPrice: 1_000, category: '기타' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamA, [], draft)
    expect(findings.find((f) => f.ruleId === 'R9')!.severity).toBe('info')
  })
})

describe('R10 — 품목 없음', () => {
  it('품목이 0개면 error', () => {
    const draft = { items: [] as Item[], shippingFee: 0, vatFee: 0, purpose: 'p' }
    const findings = checkRequest(teamA, [], draft)
    expect(findings.find((f) => f.ruleId === 'R10')!.severity).toBe('error')
  })
})

describe('R11 — 용도 공백', () => {
  it('용도가 공백뿐이면 error', () => {
    const draft = {
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 1_000, category: '재료비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: '   ',
    }
    const findings = checkRequest(teamA, [], draft)
    expect(findings.find((f) => f.ruleId === 'R11')!.severity).toBe('error')
  })
})

describe('R12 — 상품 링크 필수', () => {
  it('url이 없으면 error', () => {
    const draft = {
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 1_000, category: '재료비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamA, [], draft)
    expect(findings.find((f) => f.ruleId === 'R12')!.severity).toBe('error')
  })

  it('http(s)://로 시작하는 url이 있으면 걸리지 않는다', () => {
    const draft = {
      items: [
        { id: '1', name: 'a', qty: 1, unitPrice: 1_000, category: '재료비', url: 'https://shop.example/item/1' },
      ] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const findings = checkRequest(teamA, [], draft)
    expect(findings.some((f) => f.ruleId === 'R12')).toBe(false)
  })
})

describe('resubmit — excludeRequestId', () => {
  it('재제출이면 자기 자신의 기존 pending 요청을 제외하고 계산한다', () => {
    const existing: PurchaseRequest = {
      id: 'REQ-X',
      teamId: teamA.id,
      purpose: 'p',
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 300_000, category: '재료비' }],
      shippingFee: 0,
      vatFee: 0,
      status: 'submitted',
      acknowledgements: [],
      history: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const draft = {
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 300_000, category: '재료비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
      purpose: 'p',
    }
    const withoutExclude = checkRequest(teamA, [existing], draft)
    expect(withoutExclude.some((f) => f.ruleId === 'R1')).toBe(true)

    const withExclude = checkRequest(teamA, [existing], draft, { excludeRequestId: 'REQ-X' })
    expect(withExclude.some((f) => f.ruleId === 'R1')).toBe(false)
  })
})
