import type { BudgetType, Category } from '../domain/types'

export const BUDGET_CATEGORIES: Record<BudgetType, Category[]> = {
  rne: ['재료비', '소모품비', '도서·자료비', '인쇄비', '기타'],
  club: ['물품구입비', '인쇄비', '행사·체험비', '기타'],
}

export const OTHER_CATEGORY = '기타'

interface ClassifyKeywordGroup {
  keywords: string[]
  rne: Category
  club: Category
}

export const CLASSIFY_KEYWORD_GROUPS: ClassifyKeywordGroup[] = [
  {
    keywords: [
      '아두이노', '라즈베리', 'ESP32', '센서', '모듈', '보드', '모터', '서보', '릴레이',
      '펌프', '저항', '콘덴서', '커패시터', 'LED', '트랜지스터', '기판', 'PCB', '브레드보드',
      '필라멘트', '아크릴', '프로파일', '기어', '베어링', '디스플레이', '카메라', '오실로스코프',
      '멀티미터', '전원공급기', '납땜인두',
    ],
    rne: '재료비',
    club: '물품구입비',
  },
  {
    keywords: [
      '점퍼', '케이블', '전선', '납', '플럭스', '테이프', '글루', '건전지', '배터리', '호스',
      '나사', '볼트', '너트', '수축튜브', '케이블타이', '장갑', '사포',
    ],
    rne: '소모품비',
    club: '물품구입비',
  },
  {
    keywords: ['도서', '책', '교재', '논문', '자료집', '구독'],
    rne: '도서·자료비',
    club: '기타',
  },
  {
    keywords: ['인쇄', '출력', '포스터', '현수막', '제본', '명함', '스티커'],
    rne: '인쇄비',
    club: '인쇄비',
  },
  {
    keywords: ['입장', '체험', '참가비', '대관', '교통', '버스'],
    rne: '기타',
    club: '행사·체험비',
  },
]

export const EVENT_CATEGORY: Category = '행사·체험비'

export const RULE_CONFIG = {
  /** R3: 품목 단가가 이 값 이상이면 비품 의심 경고 */
  highUnitPriceThreshold: 300_000,
  /** R4: 요청 합계(배송비 포함)가 이 값 이상이면 비교 견적 경고 */
  highTotalThreshold: 500_000,
  /** R7: 허용 수량 범위 */
  minQty: 1,
  maxQty: 1_000,
  /** R8: 허용 단가 최소값 */
  minUnitPrice: 1,
  /** R12: 품목에 상품 링크(url)를 반드시 입력해야 하는지 */
  requireProductLink: true,
}

/** R5: 품명에 포함되면 구매 불가 (상품권류) */
export const FORBIDDEN_GIFT_KEYWORDS = [
  '상품권', '기프티콘', '기프트카드', '선불카드', '포인트 충전', '캐시 충전',
]

/** R6: 품명에 포함되면 식비로 판정 (R&E는 항상 금지, 동아리는 행사·체험비면 경고) */
export const FOOD_KEYWORDS = ['간식', '음료', '과자', '식사', '도시락', '피자', '치킨', '커피']
