import { describe, expect, it } from 'vitest'
import { createSeedState } from './seed'
import { itemAmount, sumWon } from '../domain/money'

describe('createSeedState', () => {
  it('팀 A(rne-3)/팀 B(club-robot) 배정과 담당자를 §8대로 만든다', () => {
    const state = createSeedState()
    expect(state.version).toBe(1)
    expect(state.nextSeq).toBe(4)
    expect(state.teams.map((t) => t.id)).toEqual(['rne-3', 'club-robot'])

    const rne3 = state.teams[0]
    expect(rne3.shortName).toBe('R&E3팀')
    expect(rne3.type).toBe('rne')
    expect(rne3.advisor).toBe('최윤서')
    expect(rne3.leader).toBe('김민준')
    expect(rne3.members).toEqual(['이서연', '박지호'])
    expect(rne3.allocations).toEqual({
      재료비: 500_000,
      소모품비: 150_000,
      '도서·자료비': 50_000,
      인쇄비: 100_000,
      기타: 0,
    })

    const clubRobot = state.teams[1]
    expect(clubRobot.shortName).toBe('메카닉스')
    expect(clubRobot.type).toBe('club')
    expect(clubRobot.leader).toBe('한도윤')
    expect(clubRobot.members).toEqual(['정우진', '오하린'])
    expect(clubRobot.allocations).toEqual({
      물품구입비: 400_000,
      인쇄비: 50_000,
      '행사·체험비': 150_000,
      기타: 0,
    })
  })

  it('REQ-0001은 승인 상태이고 합계 182,300원(전부 재료비)이다', () => {
    const state = createSeedState()
    const req = state.requests.find((r) => r.id === 'REQ-0001')!
    expect(req.teamId).toBe('rne-3')
    expect(req.status).toBe('approved')
    expect(req.decidedBy).toBe('최윤서')
    expect(req.items).toHaveLength(3)
    expect(req.items.every((i) => i.category === '재료비')).toBe(true)
    const total = sumWon(req.items.map((i) => itemAmount(i))) + req.shippingFee + req.vatFee
    expect(total).toBe(182_300)
  })

  it('REQ-0002는 반려 상태이고 사유가 들어있다', () => {
    const state = createSeedState()
    const req = state.requests.find((r) => r.id === 'REQ-0002')!
    expect(req.status).toBe('rejected')
    expect(req.history.at(-1)?.note).toBe('도서관 소장 도서 — 대출 이용')
    const total = sumWon(req.items.map((i) => itemAmount(i))) + req.shippingFee + req.vatFee
    expect(total).toBe(32_000)
  })

  it('REQ-0003은 승인 대기(submitted) 상태이고 합계 88,400원(물품구입비)이다', () => {
    const state = createSeedState()
    const req = state.requests.find((r) => r.id === 'REQ-0003')!
    expect(req.teamId).toBe('club-robot')
    expect(req.status).toBe('submitted')
    expect(req.decidedAt).toBeUndefined()
    expect(req.items.every((i) => i.category === '물품구입비')).toBe(true)
    const total = sumWon(req.items.map((i) => itemAmount(i))) + req.shippingFee + req.vatFee
    expect(total).toBe(88_400)
  })

  it('모든 시드 품목에 https://shop.example/seed/<n> 형태 링크가 있다', () => {
    const state = createSeedState()
    const allItems = state.requests.flatMap((r) => r.items)
    expect(allItems).toHaveLength(6)
    for (const item of allItems) {
      expect(item.url).toMatch(/^https:\/\/shop\.example\/seed\/\d+$/)
    }
    const urls = new Set(allItems.map((i) => i.url))
    expect(urls.size).toBe(6)
  })
})
