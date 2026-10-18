import { describe, expect, it } from 'vitest'
import demoCartExpectedRaw from '../../../specs/fixtures/carts/demo-cart.expected.json?raw'
import demoCartText from '../../../specs/fixtures/carts/demo-cart.txt?raw'
import lineSampleExpectedRaw from '../../../specs/fixtures/carts/line-sample.expected.json?raw'
import lineSampleText from '../../../specs/fixtures/carts/line-sample.txt?raw'
import devicemart1ExpectedRaw from '../../../specs/fixtures/carts/real/devicemart-1.expected.json?raw'
import devicemart1Text from '../../../specs/fixtures/carts/real/devicemart-1.txt?raw'
import devicemart2ExpectedRaw from '../../../specs/fixtures/carts/real/devicemart-2.expected.json?raw'
import devicemart2Text from '../../../specs/fixtures/carts/real/devicemart-2.txt?raw'
import devicemart3ExpectedRaw from '../../../specs/fixtures/carts/real/devicemart-3.expected.json?raw'
import devicemart3Text from '../../../specs/fixtures/carts/real/devicemart-3.txt?raw'
import tsvSampleExpectedRaw from '../../../specs/fixtures/carts/tsv-sample.expected.json?raw'
import tsvSampleText from '../../../specs/fixtures/carts/tsv-sample.txt?raw'
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

describe('parseCart — tsv 형식', () => {
  it('tsv-sample.txt를 tsv-sample.expected.json과 동일하게 인식한다', () => {
    const expected = JSON.parse(tsvSampleExpectedRaw) as ExpectedResult
    const result = parseCart(tsvSampleText)
    assertMatchesFixture(result, expected)
  })
})

describe('parseCart — line 형식', () => {
  it('line-sample.txt를 line-sample.expected.json과 동일하게 인식한다', () => {
    const expected = JSON.parse(lineSampleExpectedRaw) as ExpectedResult
    const result = parseCart(lineSampleText)
    assertMatchesFixture(result, expected)
  })
})

describe('parseCart — 디바이스마트 실제 샘플 (절대 약화·skip 금지)', () => {
  it('devicemart-1.txt를 devicemart-1.expected.json과 동일하게 인식한다', () => {
    const expected = JSON.parse(devicemart1ExpectedRaw) as ExpectedResult
    const result = parseCart(devicemart1Text)
    assertMatchesFixture(result, expected)
  })

  it('devicemart-2.txt를 devicemart-2.expected.json과 동일하게 인식한다 (품목 2개, 부가세 3,470, 배송비 2,700, 경고 없음)', () => {
    const expected = JSON.parse(devicemart2ExpectedRaw) as ExpectedResult
    const result = parseCart(devicemart2Text)
    assertMatchesFixture(result, expected)
    expect(result.warnings).toEqual([])
  })

  it('devicemart-3.txt를 devicemart-3.expected.json과 동일하게 인식한다', () => {
    const expected = JSON.parse(devicemart3ExpectedRaw) as ExpectedResult
    const result = parseCart(devicemart3Text)
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

  it('수량×단가가 금액과 다르면 QTY_PRICE_MISMATCH를 내고, 나누어떨어지면 단가를 보정한다', () => {
    const result = parseCart('배터리\n수량 2\n5,000원\n9,000원')
    expect(result.warnings.some((w) => w.code === 'QTY_PRICE_MISMATCH')).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ qty: 2, unitPrice: 4500, amount: 9000 })
  })

  it('장바구니 표시 합계와 품목 합계가 다르면 TOTAL_MISMATCH를 낸다', () => {
    const result = parseCart('브레드보드\n수량 1\n10,000원\n상품금액 20,000원')
    expect(result.warnings.some((w) => w.code === 'TOTAL_MISMATCH')).toBe(true)
  })

  it('수량 줄이 없으면 수량 1 + MISSING_QTY 경고를 낸다', () => {
    const result = parseCart('브레드보드\n12,000원')
    expect(result.warnings).toEqual([{ code: 'MISSING_QTY', line: 1, message: '수량을 찾지 못해 1로 처리했습니다' }])
    expect(result.items).toEqual([
      expect.objectContaining({ name: '브레드보드', qty: 1, unitPrice: 12000, amount: 12000 }),
    ])
  })

  it('금액이 없으면 그 품목은 만들지 않고 MISSING_PRICE 경고를 낸다', () => {
    const result = parseCart('브레드보드\n수량 1\n\n와이어 커넥터\n수량 1\n3,000원')
    expect(result.warnings.some((w) => w.code === 'MISSING_PRICE')).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].name).toBe('와이어 커넥터')
  })

  it('품목·잡음·합계 어디에도 속하지 않는 금액 줄은 UNPARSED_LINE으로 표시한다', () => {
    const result = parseCart('12,000원\n브레드보드\n수량 1\n12,000원')
    expect(result.warnings).toEqual([{ code: 'UNPARSED_LINE', line: 1, message: '인식하지 못한 줄입니다 (1번째 줄)' }])
    expect(result.items).toHaveLength(1)
  })

  it('랜덤 문자열 100개를 넣어도 throw하지 않는다 (퍼징)', () => {
    const charset =
      '가나다라마바사아자차카타파하 0123456789,.원₩=+-*xX×개수량옵션규격상품금액배송비결제예정금액[](){}:：　!@#$%' +
      String.fromCharCode(9, 10, 13)
    let seed = 42
    const nextRandom = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    for (let i = 0; i < 100; i++) {
      const length = Math.floor(nextRandom() * 60)
      let input = ''
      for (let j = 0; j < length; j++) {
        input += charset[Math.floor(nextRandom() * charset.length)]
      }
      expect(() => parseCart(input)).not.toThrow()
    }
  })
})
