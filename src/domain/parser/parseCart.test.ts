import { describe, expect, it } from 'vitest'
import demoCartExpectedRaw from '../../../specs/fixtures/carts/demo-cart.expected.json?raw'
import demoCartText from '../../../specs/fixtures/carts/demo-cart.txt?raw'
import { parseCart } from './parseCart'
import type { ParseResult } from './parseCart.types'

interface ExpectedItem {
  name: string
  spec?: string
  qty: number
  unitPrice: number
  amount: number
  sourceLine: number
}

interface ExpectedResult {
  format: ParseResult['format']
  items: ExpectedItem[]
  shippingFee: number
  vatFee?: number
  declaredSubtotal?: number
  declaredTotal?: number
  warnings: { code: string; line?: number }[]
}

function assertMatchesFixture(result: ParseResult, expected: ExpectedResult): void {
  expect(result.format).toBe(expected.format)
  expect(result.shippingFee).toBe(expected.shippingFee)
  expect(result.vatFee).toBe(expected.vatFee ?? 0)
  expect(result.declaredSubtotal).toBe(expected.declaredSubtotal)
  expect(result.declaredTotal).toBe(expected.declaredTotal)
  expect(result.items).toHaveLength(expected.items.length)
  result.items.forEach((item, i) => {
    const exp = expected.items[i]
    expect(item.name).toBe(exp.name)
    expect(item.qty).toBe(exp.qty)
    expect(item.unitPrice).toBe(exp.unitPrice)
    expect(item.amount).toBe(exp.amount)
    expect(item.sourceLine).toBe(exp.sourceLine)
    if (exp.spec) {
      expect(item.spec).toBe(exp.spec)
    } else {
      expect(item.spec).toBeUndefined()
    }
  })
  expect(result.warnings.map((w) => ({ code: w.code, line: w.line }))).toEqual(
    expected.warnings.map((w) => ({ code: w.code, line: w.line })),
  )
}

describe('parseCart — block 형식', () => {
  it('demo-cart.txt를 demo-cart.expected.json과 동일하게 인식한다', () => {
    const expected = JSON.parse(demoCartExpectedRaw) as ExpectedResult
    const result = parseCart(demoCartText)
    assertMatchesFixture(result, expected)
  })
})

describe('parseCart — 안전성', () => {
  it('빈 입력에는 EMPTY_INPUT 경고를 낸다', () => {
    const result = parseCart('   \n  ')
    expect(result.warnings).toEqual([{ code: 'EMPTY_INPUT', message: '입력이 비어 있습니다' }])
  })

  it('품목을 찾지 못하면 NO_ITEMS 경고를 낸다', () => {
    const result = parseCart('전체선택  선택삭제\n삭제')
    expect(result.warnings.some((w) => w.code === 'NO_ITEMS')).toBe(true)
  })

  it('어떤 입력에도 throw하지 않는다', () => {
    const inputs = ['\t\t\t', '원원원원', '수량 수량 수량', '[링크](주소)\t\t', '=====', '배송비', '상품금액']
    inputs.forEach((input) => {
      expect(() => parseCart(input)).not.toThrow()
    })
  })
})
