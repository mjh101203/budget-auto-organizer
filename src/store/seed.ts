import type { AppState, PurchaseRequest, Team } from '../domain/types'

const teamA: Team = {
  id: 'rne-3',
  name: 'R&E 3팀 · 토양 수분 자동 관수 시스템',
  shortName: 'R&E3팀',
  type: 'rne',
  advisor: '최윤서',
  leader: '김민준',
  members: ['이서연', '박지호'],
  allocations: {
    재료비: 500_000,
    소모품비: 150_000,
    '도서·자료비': 50_000,
    인쇄비: 100_000,
    기타: 0,
  },
}

const teamB: Team = {
  id: 'club-robot',
  name: '로봇공학 동아리 메카닉스',
  shortName: '메카닉스',
  type: 'club',
  advisor: '최윤서',
  leader: '한도윤',
  members: ['정우진', '오하린'],
  allocations: {
    물품구입비: 400_000,
    인쇄비: 50_000,
    '행사·체험비': 150_000,
    기타: 0,
  },
}

const req0001: PurchaseRequest = {
  id: 'REQ-0001',
  teamId: 'rne-3',
  purpose: '센서 데이터 수집 장치 제작',
  items: [
    {
      id: 'seed-item-1',
      name: '라즈베리파이 4 Model B 4GB 보드',
      qty: 1,
      unitPrice: 89_000,
      category: '재료비',
      url: 'https://shop.example/seed/1',
    },
    {
      id: 'seed-item-2',
      name: '7인치 HDMI 디스플레이 모듈',
      qty: 1,
      unitPrice: 79_800,
      category: '재료비',
      url: 'https://shop.example/seed/2',
    },
    {
      id: 'seed-item-3',
      name: 'DHT22 온습도 센서 모듈',
      qty: 2,
      unitPrice: 5_500,
      category: '재료비',
      url: 'https://shop.example/seed/3',
    },
  ],
  shippingFee: 2_500,
  vatFee: 0,
  status: 'approved',
  acknowledgements: [],
  history: [
    { at: '2026-09-15T09:00:00.000Z', actor: '김민준', action: 'submit' },
    { at: '2026-09-16T09:00:00.000Z', actor: '최윤서', action: 'approve' },
  ],
  createdAt: '2026-09-15T09:00:00.000Z',
  decidedAt: '2026-09-16T09:00:00.000Z',
  decidedBy: '최윤서',
}

const req0002: PurchaseRequest = {
  id: 'REQ-0002',
  teamId: 'rne-3',
  purpose: '참고 도서',
  items: [
    {
      id: 'seed-item-4',
      name: '센서 공학 입문 (도서)',
      qty: 1,
      unitPrice: 32_000,
      category: '도서·자료비',
      url: 'https://shop.example/seed/4',
    },
  ],
  shippingFee: 0,
  vatFee: 0,
  status: 'rejected',
  acknowledgements: [],
  history: [
    { at: '2026-09-28T09:00:00.000Z', actor: '김민준', action: 'submit' },
    {
      at: '2026-09-29T09:00:00.000Z',
      actor: '최윤서',
      action: 'reject',
      note: '도서관 소장 도서 — 대출 이용',
    },
  ],
  createdAt: '2026-09-28T09:00:00.000Z',
  decidedAt: '2026-09-29T09:00:00.000Z',
  decidedBy: '최윤서',
}

const req0003: PurchaseRequest = {
  id: 'REQ-0003',
  teamId: 'club-robot',
  purpose: '로봇팔 시제품 부품',
  items: [
    {
      id: 'seed-item-5',
      name: 'MG996R 메탈기어 서보모터',
      qty: 6,
      unitPrice: 6_900,
      category: '물품구입비',
      url: 'https://shop.example/seed/5',
    },
    {
      id: 'seed-item-6',
      name: '3D 프린터 PLA 필라멘트 1.75mm 1kg',
      qty: 2,
      unitPrice: 22_000,
      category: '물품구입비',
      url: 'https://shop.example/seed/6',
    },
  ],
  shippingFee: 3_000,
  vatFee: 0,
  status: 'submitted',
  acknowledgements: [],
  history: [{ at: '2026-10-14T09:00:00.000Z', actor: '한도윤', action: 'submit' }],
  createdAt: '2026-10-14T09:00:00.000Z',
}

export function createSeedState(): AppState {
  return {
    version: 1,
    teams: [teamA, teamB],
    requests: [req0001, req0002, req0003],
    nextSeq: 4,
  }
}
