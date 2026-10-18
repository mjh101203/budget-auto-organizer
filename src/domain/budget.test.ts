import { describe, expect, it } from 'vitest'
import {
  attributeCategory,
  computeTeamBalances,
  remainingAfterDraft,
  requestCategoryTotals,
  totalBalance,
} from './budget'
import { createSeedState } from '../store/seed'
import type { Item, PurchaseRequest, Team } from './types'

const seed = createSeedState()
const teamA = seed.teams.find((t) => t.id === 'rne-3')!
const teamB = seed.teams.find((t) => t.id === 'club-robot')!

describe('computeTeamBalances (시드 데이터)', () => {
  it('rne-3 재료비 available 317,700원', () => {
    const balances = computeTeamBalances(teamA, seed.requests)
    const materials = balances.find((b) => b.category === '재료비')!
    expect(materials.approved).toBe(182_300)
    expect(materials.pending).toBe(0)
    expect(materials.available).toBe(317_700)
  })

  it('rne-3 도서·자료비는 반려된 REQ-0002를 집계하지 않아 available이 배정 그대로', () => {
    const balances = computeTeamBalances(teamA, seed.requests)
    const books = balances.find((b) => b.category === '도서·자료비')!
    expect(books.approved).toBe(0)
    expect(books.pending).toBe(0)
    expect(books.available).toBe(50_000)
  })

  it('club-robot 물품구입비 available 311,600원', () => {
    const balances = computeTeamBalances(teamB, seed.requests)
    const goods = balances.find((b) => b.category === '물품구입비')!
    expect(goods.approved).toBe(0)
    expect(goods.pending).toBe(88_400)
    expect(goods.available).toBe(311_600)
  })
})

describe('attributeCategory', () => {
  const order = ['재료비', '소모품비', '도서·자료비', '인쇄비', '기타']

  it('품목 0개면 기타', () => {
    expect(attributeCategory([], order)).toBe('기타')
  })

  it('품목 금액 합이 가장 큰 항목을 고른다', () => {
    const items: Item[] = [
      { id: '1', name: 'a', qty: 1, unitPrice: 1_000, category: '소모품비' },
      { id: '2', name: 'b', qty: 1, unitPrice: 5_000, category: '재료비' },
    ]
    expect(attributeCategory(items, order)).toBe('재료비')
  })

  it('동점이면 표 순서가 빠른 항목', () => {
    const items: Item[] = [
      { id: '1', name: 'a', qty: 1, unitPrice: 1_000, category: '인쇄비' },
      { id: '2', name: 'b', qty: 1, unitPrice: 1_000, category: '재료비' },
    ]
    expect(attributeCategory(items, order)).toBe('재료비')
  })
})

describe('requestCategoryTotals', () => {
  const order = ['재료비', '소모품비', '도서·자료비', '인쇄비', '기타']

  it('배송비·부가세를 귀속 항목에 더한다', () => {
    const request = {
      items: [
        { id: '1', name: 'a', qty: 1, unitPrice: 1_000, category: '소모품비' },
        { id: '2', name: 'b', qty: 1, unitPrice: 5_000, category: '재료비' },
      ] as Item[],
      shippingFee: 2_000,
      vatFee: 500,
    }
    const totals = requestCategoryTotals(request, order)
    expect(totals['재료비']).toBe(5_000 + 2_000 + 500)
    expect(totals['소모품비']).toBe(1_000)
  })
})

describe('resubmit: 재제출 시 자기 pending 제외', () => {
  const team: Team = {
    id: 'team-x',
    name: 'x',
    shortName: 'x',
    type: 'rne',
    advisor: 'a',
    leader: 'b',
    members: [],
    allocations: { 재료비: 100_000, 소모품비: 0, '도서·자료비': 0, 인쇄비: 0, 기타: 0 },
  }

  const pendingRequest: PurchaseRequest = {
    id: 'REQ-X',
    teamId: 'team-x',
    purpose: 'p',
    items: [{ id: '1', name: 'a', qty: 1, unitPrice: 30_000, category: '재료비' }],
    shippingFee: 0,
    vatFee: 0,
    status: 'submitted',
    acknowledgements: [],
    history: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('excludeRequestId 없으면 자기 pending도 포함', () => {
    const balances = computeTeamBalances(team, [pendingRequest])
    expect(balances.find((b) => b.category === '재료비')!.available).toBe(70_000)
  })

  it('excludeRequestId로 자기 자신의 기존 pending을 뺀다', () => {
    const balances = computeTeamBalances(team, [pendingRequest], { excludeRequestId: 'REQ-X' })
    expect(balances.find((b) => b.category === '재료비')!.available).toBe(100_000)
  })
})

describe('remainingAfterDraft', () => {
  it('이번 요청 후 잔액 = available - 이번 요청 해당 항목 금액', () => {
    const draft = {
      items: [{ id: '1', name: 'a', qty: 1, unitPrice: 50_000, category: '재료비' }] as Item[],
      shippingFee: 0,
      vatFee: 0,
    }
    const result = remainingAfterDraft(teamA, seed.requests, draft)
    expect(result.byCategory['재료비']).toBe(317_700 - 50_000)
  })
})

describe('totalBalance', () => {
  it('항목별 합계를 모두 더한다', () => {
    const balances = computeTeamBalances(teamA, seed.requests)
    const total = totalBalance(balances)
    expect(total.allocated).toBe(500_000 + 150_000 + 50_000 + 100_000 + 0)
    expect(total.available).toBe(total.allocated - total.approved - total.pending)
  })
})
