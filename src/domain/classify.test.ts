import { describe, expect, it } from 'vitest'
import { classifyItem } from './classify'

describe('classifyItem', () => {
  it('점퍼 케이블 M-M 20cm 40P → rne 소모품비', () => {
    expect(classifyItem('점퍼 케이블 M-M 20cm 40P', undefined, 'rne')).toBe('소모품비')
  })

  it('5V 1채널 릴레이 모듈 → rne 재료비', () => {
    expect(classifyItem('5V 1채널 릴레이 모듈', undefined, 'rne')).toBe('재료비')
  })

  it('18650 리튬이온 배터리 3000mAh → rne 소모품비', () => {
    expect(classifyItem('18650 리튬이온 배터리 3000mAh', undefined, 'rne')).toBe('소모품비')
  })

  it('MG996R 메탈기어 서보모터 → club 물품구입비', () => {
    expect(classifyItem('MG996R 메탈기어 서보모터', undefined, 'club')).toBe('물품구입비')
  })

  it('센서 공학 입문 (도서) → rne 재료비 (부품 vs 도서 동점, 표 순서상 재료비가 먼저. 틀린 분류이므로 사용자가 직접 바꿔야 함)', () => {
    expect(classifyItem('센서 공학 입문 (도서)', undefined, 'rne')).toBe('재료비')
  })

  it('키워드가 전혀 없으면 기타', () => {
    expect(classifyItem('알 수 없는 물건', undefined, 'rne')).toBe('기타')
    expect(classifyItem('알 수 없는 물건', undefined, 'club')).toBe('기타')
  })

  it('spec 필드도 매칭에 포함된다', () => {
    expect(classifyItem('부품', '아두이노 호환 보드', 'rne')).toBe('재료비')
  })

  it('영문 품명(부품류)도 키워드로 분류된다 - rne 재료비 / club 물품구입비', () => {
    const names = [
      'Arduino UNO Q',
      'ESP32-S3',
      'Raspberry Pi 5',
      'Servo Motor SG90',
      'Breadboard',
      'LED',
      'OLED Display',
      'Ultrasonic Sensor',
    ]
    for (const name of names) {
      expect(classifyItem(name, undefined, 'rne')).toBe('재료비')
      expect(classifyItem(name, undefined, 'club')).toBe('물품구입비')
    }
  })

  it('영문 품명(소모품류)도 키워드로 분류된다 - rne 소모품비 / club 물품구입비', () => {
    const names = ['Jumper Wire', 'Li-ion Battery']
    for (const name of names) {
      expect(classifyItem(name, undefined, 'rne')).toBe('소모품비')
      expect(classifyItem(name, undefined, 'club')).toBe('물품구입비')
    }
  })

  it('영문 품명이 소문자·혼합 표기여도 동일하게 분류된다', () => {
    expect(classifyItem('arduino uno q', undefined, 'rne')).toBe('재료비')
    expect(classifyItem('RASPBERRY pi 5', undefined, 'rne')).toBe('재료비')
    expect(classifyItem('jumper WIRE m-m', undefined, 'rne')).toBe('소모품비')
  })
})
