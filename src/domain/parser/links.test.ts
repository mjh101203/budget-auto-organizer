import { describe, expect, it } from 'vitest'
import { extractDevicemartItemLinks, extractLinks, matchLinkUrl } from './links'

describe('extractLinks', () => {
  it('http(s) 링크이고 글자가 있는 a[href]만 추출한다', () => {
    const html =
      '<a href="https://shop.example/item/1">아두이노 우노</a>' +
      '<a href="javascript:void(0)">바로가기</a>' +
      '<a href="https://shop.example/item/2"></a>'
    expect(extractLinks(html)).toEqual([{ text: '아두이노 우노', href: 'https://shop.example/item/1' }])
  })

  it('연속 공백을 한 칸으로 줄인다', () => {
    const html = '<a href="https://shop.example/item/1">아두이노   우노\n\nR4</a>'
    expect(extractLinks(html)).toEqual([{ text: '아두이노 우노 R4', href: 'https://shop.example/item/1' }])
  })

  it('같은 주소가 반복되면 첫 글자만 남긴다', () => {
    const html =
      '<a href="https://shop.example/item/1">아두이노 우노 R4</a>' +
      '<a href="https://shop.example/item/1">이미지 링크</a>'
    expect(extractLinks(html)).toEqual([{ text: '아두이노 우노 R4', href: 'https://shop.example/item/1' }])
  })
})

describe('matchLinkUrl', () => {
  const links = [
    { text: '아두이노 우노 R4 WiFi 호환보드', href: 'https://shop.example/item/1' },
    { text: '정전용량 토양 수분 센서 v2.0', href: 'https://shop.example/item/2' },
  ]

  it('품명이 완전히 같으면 매칭한다', () => {
    expect(matchLinkUrl('아두이노 우노 R4 WiFi 호환보드', links)).toBe('https://shop.example/item/1')
  })

  it('한쪽이 다른 쪽을 포함하고 8자 이상이면 매칭한다', () => {
    expect(matchLinkUrl('정전용량 토양 수분 센서', links)).toBe('https://shop.example/item/2')
  })

  it('짧은 글자(8자 미만)는 매칭되지 않는다', () => {
    expect(matchLinkUrl('센서', links)).toBeUndefined()
  })

  it('매칭이 없으면 undefined를 반환한다', () => {
    expect(matchLinkUrl('완전히 다른 품목명입니다', links)).toBeUndefined()
  })

  it('여러 후보가 있으면 가장 긴 글자와 매칭된 것을 고른다', () => {
    const multi = [
      { text: '아두이노 우노 R4', href: 'https://shop.example/short' },
      { text: '아두이노 우노 R4 WiFi 호환보드 풀패키지', href: 'https://shop.example/long' },
    ]
    expect(matchLinkUrl('아두이노 우노 R4 WiFi 호환보드', multi)).toBe('https://shop.example/long')
  })
})

describe('extractDevicemartItemLinks', () => {
  it('썸네일 앵커(class 없음)는 건너뛰고 order_name 앵커의 goods/view 링크만 품목 순서대로 뽑는다', () => {
    const html =
      '<a href="https://www.devicemart.co.kr/goods/view?no=111"><img src="thumb1.jpg"></a>' +
      '<a href="https://www.devicemart.co.kr/goods/view?no=111" class="order_name">아두이노 우노</a>' +
      '<a href="https://www.devicemart.co.kr/goods/view?no=222"><img src="thumb2.jpg"></a>' +
      '<a href="https://www.devicemart.co.kr/goods/view?no=222" class="order_name">브레드보드</a>'
    expect(extractDevicemartItemLinks(html)).toEqual([
      'https://www.devicemart.co.kr/goods/view?no=111',
      'https://www.devicemart.co.kr/goods/view?no=222',
    ])
  })

  it('품명과 글자가 겹치는 배너·내비게이션 링크(사이트 루트 등)는 order_name이 아니므로 무시한다', () => {
    const html =
      '<a href="https://www.devicemart.co.kr/" class="promo">신학기 아두이노 우노 특가 이벤트 바로가기</a>' +
      '<a href="https://www.devicemart.co.kr/goods/view?no=333" class="order_name">아두이노 우노</a>'
    expect(extractDevicemartItemLinks(html)).toEqual(['https://www.devicemart.co.kr/goods/view?no=333'])
  })

  it('order_name이어도 상품 상세 패턴(goods/view, goods/catalog)이 아닌 href는 무시한다', () => {
    const html = '<a href="https://www.devicemart.co.kr/order/cart#none" class="order_name">장바구니</a>'
    expect(extractDevicemartItemLinks(html)).toEqual([])
  })
})
