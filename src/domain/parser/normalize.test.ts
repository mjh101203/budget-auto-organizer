import { describe, expect, it } from 'vitest'
import {
  isNoiseLine,
  matchDeclaredLabel,
  normalizeLineEndings,
  parseAmount,
  parseQty,
  parseShippingFee,
  toHalfWidth,
} from './normalize'

describe('toHalfWidth', () => {
  it('converts full-width digits and commas to half-width', () => {
    expect(toHalfWidth('１２，３００')).toBe('12,300')
  })
})

describe('normalizeLineEndings', () => {
  it('converts CRLF to LF', () => {
    expect(normalizeLineEndings('a\r\nb\r\nc')).toBe('a\nb\nc')
  })
})

describe('parseAmount', () => {
  it.each([
    ['12,300원', 12300],
    ['12,300 원', 12300],
    ['₩12,300', 12300],
    ['12300원', 12300],
  ])('parses %s as %i', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it('returns undefined when there is no 원/₩ marker', () => {
    expect(parseAmount('12300')).toBeUndefined()
  })
})

describe('parseQty', () => {
  it.each([
    ['수량 3', 3],
    ['수량: 3', 3],
    ['수량：3', 3],
    ['3개', 3],
    ['x3', 3],
    ['x 3', 3],
    ['× 3', 3],
    ['*3', 3],
  ])('parses %s as %i', (input, expected) => {
    expect(parseQty(input)).toBe(expected)
  })
})

describe('parseShippingFee', () => {
  it('parses an explicit amount', () => {
    expect(parseShippingFee('배송비 3,000원')).toBe(3000)
  })

  it('parses 무료 as 0', () => {
    expect(parseShippingFee('배송비 무료')).toBe(0)
  })

  it('parses 무료배송 as 0', () => {
    expect(parseShippingFee('무료배송')).toBe(0)
  })

  it('returns undefined when the line is not a shipping fee line', () => {
    expect(parseShippingFee('LED 5mm 빨강')).toBeUndefined()
  })
})

describe('matchDeclaredLabel', () => {
  it.each([
    ['상품금액', 'subtotal'],
    ['총 상품금액', 'subtotal'],
    ['상품합계', 'subtotal'],
    ['결제예정금액', 'total'],
    ['총 결제금액', 'total'],
    ['최종 결제금액', 'total'],
    ['총 주문금액', 'total'],
  ] as const)('matches %s as %s', (input, expected) => {
    expect(matchDeclaredLabel(input)).toBe(expected)
  })

  it('returns undefined for unrelated lines', () => {
    expect(matchDeclaredLabel('LED 5mm 빨강 100개입')).toBeUndefined()
  })
})

describe('isNoiseLine', () => {
  it('treats blank lines as noise', () => {
    expect(isNoiseLine('')).toBe(true)
    expect(isNoiseLine('   ')).toBe(true)
  })

  it('treats lines made only of noise words as noise', () => {
    expect(isNoiseLine('전체선택  선택삭제')).toBe(true)
  })

  it('treats 장바구니 (n) as noise', () => {
    expect(isNoiseLine('장바구니 (3)')).toBe(true)
  })

  it('does not treat item lines as noise', () => {
    expect(isNoiseLine('LED 5mm 빨강 100개입')).toBe(false)
  })
})
