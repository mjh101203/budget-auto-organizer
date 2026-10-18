import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { generatePurchaseOrder } from './index'
import { createSeedState } from '../store/seed'
import type { AppState, PurchaseRequest } from '../domain/types'

function buildReq0004(): PurchaseRequest {
  return {
    id: 'REQ-0004',
    teamId: 'rne-3',
    purpose: '토양 수분 자동 관수 시제품 제작',
    items: [
      { id: 'i1', name: '아두이노 우노 R4 WiFi 호환보드', qty: 1, unitPrice: 32000, category: '재료비', url: 'https://shop.example/item/1' },
      { id: 'i2', name: '정전용량 토양 수분 센서 v2.0', qty: 4, unitPrice: 3300, category: '재료비', url: 'https://shop.example/item/2' },
      { id: 'i3', name: '5V 1채널 릴레이 모듈', qty: 4, unitPrice: 1800, category: '재료비', url: 'https://shop.example/item/3' },
      { id: 'i4', name: '미니 워터펌프 DC 3~6V', qty: 4, unitPrice: 4500, category: '재료비', url: 'https://shop.example/item/4' },
      { id: 'i5', name: '실리콘 호스 내경 6mm 1m', qty: 3, unitPrice: 2000, category: '소모품비', url: 'https://shop.example/item/5' },
      { id: 'i6', name: '점퍼 케이블 M-M 20cm 40P', qty: 2, unitPrice: 2500, category: '소모품비', url: 'https://shop.example/item/6' },
      { id: 'i7', name: '18650 리튬이온 배터리 3000mAh', qty: 4, unitPrice: 6900, category: '소모품비', url: 'https://shop.example/item/7' },
    ],
    shippingFee: 3000,
    vatFee: 0,
    status: 'approved',
    acknowledgements: [],
    history: [
      { at: '2026-10-18T09:00:00.000Z', actor: '김민준', action: 'submit' },
      { at: '2026-10-18T10:00:00.000Z', actor: '최윤서', action: 'approve' },
    ],
    createdAt: '2026-10-18T09:00:00.000Z',
    decidedAt: '2026-10-18T10:00:00.000Z',
    decidedBy: '최윤서',
  }
}

function seedStateWith(request: PurchaseRequest): AppState {
  const state = createSeedState()
  return { ...state, requests: [...state.requests, request] }
}

describe('generatePurchaseOrder', () => {
  it('REQ-0004: 품목 7행, 배송비 3,000, 합계 112,000, 소계 재료비 73,400 / 소모품비 38,600', async () => {
    const state = seedStateWith(buildReq0004())
    const result = await generatePurchaseOrder(state, 'REQ-0004', new Date('2026-10-18T12:00:00.000Z'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.filename).toBe('품의서_R&E3팀_REQ-0004_20261018.xlsx')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(result.buffer)
    const sheet = workbook.getWorksheet('구매품의서')
    expect(sheet).toBeDefined()
    if (!sheet) return

    expect(sheet.getCell('B3').value).toBe('REQ-0004')
    expect(sheet.getCell('F3').value).toBe('R&E 연구비')
    expect(sheet.getCell('D4').value).toBe('김민준')
    expect(sheet.getCell('F4').value).toBe('최윤서')
    expect(sheet.getCell('B5').value).toBe('토양 수분 자동 관수 시제품 제작')

    // 품목 7행: header=7, items=8~14
    expect(sheet.getCell('A8').value).toBe(1)
    expect(sheet.getCell('B8').value).toBe('아두이노 우노 R4 WiFi 호환보드')
    expect(sheet.getCell('A14').value).toBe(7)
    const linkCell = sheet.getCell('G8')
    expect((linkCell.value as { hyperlink: string; text: string }).hyperlink).toBe(
      'https://shop.example/item/1',
    )

    // 배송비 15, 합계 16
    expect(sheet.getCell('E15').value).toBe(3000)
    const totalCell = sheet.getCell('E16')
    expect((totalCell.value as { result: number }).result).toBe(112000)
    expect(totalCell.numFmt).toBe('#,##0')

    const subtotalText = sheet.getCell('A18').value as string
    expect(subtotalText).toContain('재료비 73,400')
    expect(subtotalText).toContain('소모품비 38,600')
  })

  it('승인 안 된 요청이면 실패 결과를 반환한다', async () => {
    const state = createSeedState() // REQ-0003은 submitted
    const result = await generatePurchaseOrder(state, 'REQ-0003', new Date('2026-10-18T12:00:00.000Z'))
    expect(result.ok).toBe(false)
  })

  it('존재하지 않는 요청이면 실패 결과를 반환한다', async () => {
    const state = createSeedState()
    const result = await generatePurchaseOrder(state, 'REQ-9999', new Date('2026-10-18T12:00:00.000Z'))
    expect(result.ok).toBe(false)
  })
})
