import { describe, expect, it } from 'vitest'
import { approve, reject, resubmit, submit } from './workflow'
import { createSeedState } from '../store/seed'
import type { AppState, Item, PurchaseRequest, Team } from './types'

const item = (overrides: Partial<Item>): Item => ({
  id: '1',
  name: '테스트 품목',
  qty: 1,
  unitPrice: 100_000,
  category: '재료비',
  url: 'https://shop.example/item/1',
  ...overrides,
})

describe('submit', () => {
  it('시드 상태(nextSeq 4)에서 두 번 제출하면 REQ-0004, REQ-0005가 순서대로 나온다', () => {
    const seed = createSeedState()

    const first = submit(
      seed,
      {
        teamId: 'rne-3',
        purpose: '센서 추가 구매',
        items: [item({ id: '1', unitPrice: 100_000 })],
        shippingFee: 0,
        vatFee: 0,
        acknowledgements: [],
      },
      '김민준',
      '2026-10-18T09:00:00.000Z',
    )
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.request.id).toBe('REQ-0004')
    expect(first.request.status).toBe('submitted')
    expect(first.request.history).toEqual([
      { at: '2026-10-18T09:00:00.000Z', actor: '김민준', action: 'submit' },
    ])
    expect(first.state.nextSeq).toBe(5)

    const second = submit(
      first.state,
      {
        teamId: 'rne-3',
        purpose: '케이블 추가 구매',
        items: [item({ id: '1', unitPrice: 50_000 })],
        shippingFee: 0,
        vatFee: 0,
        acknowledgements: [],
      },
      '김민준',
      '2026-10-18T09:05:00.000Z',
    )
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.request.id).toBe('REQ-0005')
    expect(second.state.nextSeq).toBe(6)
    expect(second.state.requests).toHaveLength(seed.requests.length + 2)
  })

  it('규정 검사에서 error가 나면 제출할 수 없다 (상품 링크 없음, R12)', () => {
    const seed = createSeedState()
    const result = submit(
      seed,
      {
        teamId: 'rne-3',
        purpose: '목적',
        items: [item({ id: '1', url: undefined })],
        shippingFee: 0,
        vatFee: 0,
        acknowledgements: [],
      },
      '김민준',
      '2026-10-18T09:00:00.000Z',
    )
    expect(result.ok).toBe(false)
    expect(seed.requests).toHaveLength(3)
  })

  it('warning(R3, 단가 30만원 이상)에 사유가 없으면 제출할 수 없고, 사유를 넣으면 제출된다', () => {
    const seed = createSeedState()
    const draft = {
      teamId: 'rne-3',
      purpose: '목적',
      items: [item({ id: '1', unitPrice: 300_000 })],
      shippingFee: 0,
      vatFee: 0,
      acknowledgements: [],
    }

    const withoutReason = submit(seed, draft, '김민준', '2026-10-18T09:00:00.000Z')
    expect(withoutReason.ok).toBe(false)

    const withReason = submit(
      seed,
      { ...draft, acknowledgements: [{ ruleId: 'R3', itemId: '1', reason: '학교 비품 등록 예정' }] },
      '김민준',
      '2026-10-18T09:00:00.000Z',
    )
    expect(withReason.ok).toBe(true)
  })

  it('팀을 찾을 수 없으면 실패한다', () => {
    const seed = createSeedState()
    const result = submit(
      seed,
      { teamId: 'no-such-team', purpose: 'p', items: [item({})], shippingFee: 0, vatFee: 0, acknowledgements: [] },
      '김민준',
      '2026-10-18T09:00:00.000Z',
    )
    expect(result.ok).toBe(false)
  })
})

describe('reject', () => {
  it('승인 대기 요청을 사유와 함께 반려하면 상태가 바뀌고 history가 쌓인다', () => {
    const seed = createSeedState()
    const result = reject(seed, 'REQ-0003', '최윤서', '예산 부족', '2026-10-18T10:00:00.000Z')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.status).toBe('rejected')
    expect(result.request.decidedAt).toBe('2026-10-18T10:00:00.000Z')
    expect(result.request.decidedBy).toBe('최윤서')
    expect(result.request.history.at(-1)).toEqual({
      at: '2026-10-18T10:00:00.000Z',
      actor: '최윤서',
      action: 'reject',
      note: '예산 부족',
    })

    const original = seed.requests.find((r) => r.id === 'REQ-0003')!
    expect(original.status).toBe('submitted')
    expect(original.history).toHaveLength(1)
  })

  it('사유가 빈 문자열이면 반려할 수 없다', () => {
    const seed = createSeedState()
    const result = reject(seed, 'REQ-0003', '최윤서', '   ', '2026-10-18T10:00:00.000Z')
    expect(result.ok).toBe(false)
  })

  it('승인 대기 상태가 아닌 요청은 반려할 수 없다 (이미 승인됨)', () => {
    const seed = createSeedState()
    const result = reject(seed, 'REQ-0001', '최윤서', '사유', '2026-10-18T10:00:00.000Z')
    expect(result.ok).toBe(false)
  })
})

describe('resubmit', () => {
  it('반려된 요청을 수정해서 다시 제출하면 같은 id로 submitted가 되고 결정 정보가 지워진다', () => {
    const seed = createSeedState()
    const result = resubmit(
      seed,
      'REQ-0002',
      {
        purpose: '참고 도서 재구매',
        items: [item({ id: 'seed-item-4', name: '센서 공학 입문 (도서)', unitPrice: 25_000, category: '도서·자료비' })],
        shippingFee: 0,
        vatFee: 0,
        acknowledgements: [],
      },
      '김민준',
      '2026-10-18T11:00:00.000Z',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.id).toBe('REQ-0002')
    expect(result.request.status).toBe('submitted')
    expect(result.request.decidedAt).toBeUndefined()
    expect(result.request.decidedBy).toBeUndefined()
    expect(result.request.history.at(-1)).toMatchObject({ actor: '김민준', action: 'resubmit' })
    expect(result.request.history).toHaveLength(3)
  })

  it('반려 상태가 아닌 요청은 재제출할 수 없다', () => {
    const seed = createSeedState()
    const result = resubmit(
      seed,
      'REQ-0003',
      { purpose: 'p', items: [item({})], shippingFee: 0, vatFee: 0, acknowledgements: [] },
      '한도윤',
      '2026-10-18T11:00:00.000Z',
    )
    expect(result.ok).toBe(false)
  })
})

describe('approve', () => {
  it('승인 대기 요청을 승인하면 상태가 바뀌고 history가 쌓인다', () => {
    const seed = createSeedState()
    const result = approve(seed, 'REQ-0003', '최윤서', '2026-10-18T12:00:00.000Z')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.status).toBe('approved')
    expect(result.request.decidedBy).toBe('최윤서')
    expect(result.request.history.at(-1)).toEqual({
      at: '2026-10-18T12:00:00.000Z',
      actor: '최윤서',
      action: 'approve',
    })
  })

  it('승인 대기 상태가 아닌 요청은 승인할 수 없다 (이미 반려됨)', () => {
    const seed = createSeedState()
    const result = approve(seed, 'REQ-0002', '최윤서', '2026-10-18T12:00:00.000Z')
    expect(result.ok).toBe(false)
  })

  it('두 대기 요청이 각각은 통과하지만 둘 다 승인하면 잔액을 초과하면 먼저 승인한 쪽만 성공한다', () => {
    const team: Team = {
      id: 'team-test',
      name: 'test',
      shortName: 'test',
      type: 'rne',
      advisor: 'a',
      leader: 'b',
      members: [],
      allocations: { 재료비: 300_000, 소모품비: 0, '도서·자료비': 0, 인쇄비: 0, 기타: 0 },
    }
    const baseRequest = (id: string): PurchaseRequest => ({
      id,
      teamId: team.id,
      purpose: 'p',
      items: [item({ id: '1', unitPrice: 200_000 })],
      shippingFee: 0,
      vatFee: 0,
      status: 'submitted',
      acknowledgements: [],
      history: [{ at: '2026-10-18T09:00:00.000Z', actor: 'b', action: 'submit' }],
      createdAt: '2026-10-18T09:00:00.000Z',
    })
    const state: AppState = {
      version: 1,
      teams: [team],
      requests: [baseRequest('REQ-A'), baseRequest('REQ-B')],
      nextSeq: 1,
    }

    const firstApprove = approve(state, 'REQ-A', '최윤서', '2026-10-18T12:00:00.000Z')
    expect(firstApprove.ok).toBe(true)
    if (!firstApprove.ok) return

    const secondApprove = approve(firstApprove.state, 'REQ-B', '최윤서', '2026-10-18T12:05:00.000Z')
    expect(secondApprove.ok).toBe(false)
  })

  it('팀을 찾을 수 없으면 실패한다', () => {
    const state: AppState = {
      version: 1,
      teams: [],
      requests: [
        {
          id: 'REQ-X',
          teamId: 'no-team',
          purpose: 'p',
          items: [item({})],
          shippingFee: 0,
          vatFee: 0,
          status: 'submitted',
          acknowledgements: [],
          history: [],
          createdAt: '2026-10-18T09:00:00.000Z',
        },
      ],
      nextSeq: 1,
    }
    const result = approve(state, 'REQ-X', '최윤서', '2026-10-18T12:00:00.000Z')
    expect(result.ok).toBe(false)
  })
})
