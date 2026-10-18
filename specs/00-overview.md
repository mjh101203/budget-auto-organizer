# 00 · 개요 (PRD) — 예산척척 (가칭)

> 사람 소유 파일. 에이전트는 맨 아래 `## 가정` 섹션에만 추가할 수 있다.
> ⚠ 표시는 대회 전에 사람이 실제 자료로 확인·교체할 부분.

## 1. 페인포인트
- **누가**: R&E 팀장, 동아리 부장(학생) / 지도교사
- **언제**: 부품·물품을 살 때마다(구매 품의), 학기 중 잔액 확인, 학기 말 정산
- **지금 방식**: 쇼핑몰 장바구니를 보면서 품명·규격·수량·단가를 학교 엑셀 양식에 한 줄씩 옮겨 적고, 합계와 항목별 잔액을 손으로 계산한다. 살 수 없는 품목이나 비품 기준 같은 규정은 반려당하면서 알게 된다.
- **손해**: 옮겨 적기 실수(단가·수량 오타, 합계 불일치), 반려 → 재작성 왕복, 잔액을 몰라서 생기는 초과·남김. 선생님은 매번 계산을 검산한다.

## 2. 한 줄 해결책
장바구니를 붙여넣으면 품목표·예산 항목 분류·규정 검사가 자동으로 끝나고, 지도교사 승인을 거쳐 학교 제출용 엑셀 품의서가 바로 나온다.

## 3. 사용자와 역할
로그인은 만들지 않는다. 화면 상단 **역할 전환** 드롭다운으로 바꾼다.

| 역할 | 하는 일 |
|---|---|
| 학생 (팀장·부장) | 구매 요청 작성·제출, 반려되면 수정·재제출, 팀 예산 현황 보기, 승인된 품의서 엑셀 다운로드 |
| 지도교사 | 승인 대기 목록, 승인 / 반려(사유 필수), 팀별 예산 현황 |

## 4. 핵심 기능
### P0 — 데모 필수
- 장바구니 텍스트 붙여넣기 → 품목 자동 인식 → `specs/01-cart-parser.md`
- 상품 링크: 붙여넣을 때 HTML에서 자동 추출 → 안 되면 품목표에서 행마다 직접 입력 (`specs/01-cart-parser.md` 3-5단계)
- 품목표 편집 (수량·단가·항목 변경, 행 삭제·추가) + 합계 실시간 재계산
- 예산 항목 자동 분류 + 규정 검사 (오류는 제출 차단, 경고는 사유 입력하면 제출 가능) → `specs/02-budget-rules.md`
- 팀 예산 현황: 항목별 배정 / 승인 집행 / 승인 대기 / 잔액 → `specs/02-budget-rules.md`
- 제출 → 교사 승인·반려 → 반려되면 수정·재제출, 모든 단계 이력 기록 → `specs/03-approval.md`
- 승인된 요청의 **품의서 엑셀** 다운로드 → `specs/04-excel-export.md`
- 시드 데이터 + 하단 **데모 초기화** 버튼
- 데모 시나리오 e2e 테스트 (아래 6장)

### P1 — 완성도
- 팀 **예산 집행 현황 엑셀** → `specs/04-excel-export.md`
- 학교 실제 양식 템플릿 채우기 (⚠ `specs/fixtures/school-template.xlsx`가 있을 때만)
- 실제 쇼핑몰 장바구니 어댑터 (⚠ `specs/fixtures/carts/real/`에 샘플이 있을 때만)
- 인식 못 한 줄을 보여주고 클릭 한 번으로 품목 행으로 추가
- 교사 화면: 팀별 집행률 막대

### P2 — 스트레치
- 예산 맞추기 추천: 항목 잔액을 넘을 때 어떤 품목 수량을 줄이면 맞는지 제안
- 요청 복제 ("지난번 주문 다시 담기")
- 인쇄용 화면 (Ctrl+P → A4 가로)

## 5. 핵심 규칙
`specs/02-budget-rules.md`에 숫자로 정의한다. 모든 금액은 **정수(원)**. 품의 금액은 **부가세 포함 결제 금액** 기준이다. 부가세를 따로 적는 쇼핑몰(디바이스마트)은 부가세를 `vatFee`로 따로 보관하고, 배송비와 같은 방식으로 예산 항목에 귀속한다 (⚠ 학교가 부가세 포함 금액으로 집행하는지 확인).

## 6. 데모 시나리오 (3분) — e2e로 고정, 루프 내내 깨지면 안 됨
시드 데이터 기준. 데모 장바구니 = `specs/fixtures/carts/demo-cart.txt` (텍스트) + `demo-cart.html` (같은 장바구니의 HTML, 품명에 링크). e2e는 두 형식을 한 번에 붙여넣는다.

1. 역할 **학생 · 김민준 (R&E 3팀)**. 홈의 재료비 카드에 잔액 **317,700원**.
2. [새 구매 요청] → 데모 장바구니 붙여넣기(텍스트 + HTML, 링크 자동 채움) → [인식] → 품목 **8개** + 배송비 **3,000원**, 합계 **441,000원**.
3. 규정 검사 패널: 오류 "재료비 잔액 초과 (84,700원 초과)", 경고 "휴대용 디지털 오실로스코프 … 단가 329,000원 — 비품 의심". [제출] 비활성.
4. 오실로스코프 행 삭제 → 오류·경고 사라짐. 합계 **112,000원**, 재료비 "이번 요청 후 잔액" **244,300원**. 용도에 "토양 수분 자동 관수 시제품 제작" 입력 → [제출] → 요청번호 **REQ-0004**.
5. 역할 **교사 · 최윤서** → 승인 대기 목록에서 REQ-0004 → 상세 → [승인].
6. 역할 학생으로 돌아가기 → REQ-0004 상태 **승인**, 재료비 잔액 **244,300원** → [품의서 엑셀] → 파일에 품목 7개, 배송비 3,000원, 합계 112,000원, 승인자 최윤서.

## 7. 데이터 모델
```ts
type BudgetType = 'rne' | 'club'
type Category = string            // 예산 구분별 목록은 specs/02
type Severity = 'error' | 'warning' | 'info'

interface Team {
  id: string; name: string; shortName: string; type: BudgetType   // shortName은 파일명용 (예: 'R&E3팀')
  advisor: string; leader: string; members: string[]
  allocations: Record<Category, number>   // 항목별 배정액(원)
}
interface Item {
  id: string; name: string; spec?: string
  qty: number; unitPrice: number          // amount = qty * unitPrice (저장하지 말고 계산)
  category: Category; shop?: string; sourceLine?: number
  url?: string                            // 상품 링크 (학교 제출 필수, R12)
}
interface PurchaseRequest {
  id: string                              // 'REQ-0001' 형식, 앱 전체에서 순번
  teamId: string; purpose: string
  items: Item[]; shippingFee: number; vatFee: number   // 배송비·부가세 귀속 항목·합계는 계산값. 합계 = 품목 합 + vatFee + shippingFee
  status: 'submitted' | 'approved' | 'rejected'
  acknowledgements: { ruleId: string; itemId?: string; reason: string }[]  // 경고에 대한 사유
  history: { at: string; actor: string; action: 'submit' | 'approve' | 'reject' | 'resubmit'; note?: string }[]
  createdAt: string; decidedAt?: string; decidedBy?: string
}
interface AppState { version: 1; teams: Team[]; requests: PurchaseRequest[]; nextSeq: number }
```
날짜·시각은 ISO 문자열. 도메인 함수는 현재 시각을 `now` 인자로 받는다 (테스트에서 고정 가능하게).

## 8. 시드 데이터
학기: 2026학년도 2학기. 사람 이름은 전부 가상.

**팀 A** `rne-3` · "R&E 3팀 · 토양 수분 자동 관수 시스템" (짧은 이름 `R&E3팀`) · R&E 연구비 · 지도교사 최윤서 · 팀장 김민준 · 팀원 이서연, 박지호
- 배정: 재료비 500,000 / 소모품비 150,000 / 도서·자료비 50,000 / 인쇄비 100,000 / 기타 0 → 총 800,000
- `REQ-0001` 승인 (2026-09-15 요청, 2026-09-16 최윤서 승인) · 용도 "센서 데이터 수집 장치 제작"
  - 라즈베리파이 4 Model B 4GB 보드 · 1 × 89,000
  - 7인치 HDMI 디스플레이 모듈 · 1 × 79,800
  - DHT22 온습도 센서 모듈 · 2 × 5,500
  - 배송비 2,500 → 합계 182,300 (전부 재료비)
- `REQ-0002` 반려 (2026-09-28 요청, 2026-09-29 반려, 사유 "도서관 소장 도서 — 대출 이용") · 용도 "참고 도서"
  - 센서 공학 입문 (도서) · 1 × 32,000 → 도서·자료비

**팀 B** `club-robot` · "로봇공학 동아리 메카닉스" (짧은 이름 `메카닉스`) · 동아리 활동비 · 지도교사 최윤서 · 부장 한도윤 · 부원 정우진, 오하린
- 배정: 물품구입비 400,000 / 인쇄비 50,000 / 행사·체험비 150,000 / 기타 0 → 총 600,000
- `REQ-0003` 승인 대기 (2026-10-14 요청) · 용도 "로봇팔 시제품 부품"
  - MG996R 메탈기어 서보모터 · 6 × 6,900
  - 3D 프린터 PLA 필라멘트 1.75mm 1kg · 2 × 22,000
  - 배송비 3,000 → 합계 88,400 (물품구입비)

`nextSeq` = 4 (데모 첫 요청이 REQ-0004).
시드 요청의 모든 품목에도 `https://shop.example/seed/<n>` 형태의 가짜 링크를 넣는다 (R12 통과용).

## 9. 비목표 (이번엔 안 만든다)
- 실제 로그인·권한, 서버·DB (전부 브라우저 localStorage)
- 쇼핑몰 링크 크롤링 등 네트워크 요청 (붙여넣은 텍스트만 다룸)
- 영수증 OCR, 실제 주문·결제, 에듀파인 등 학교 회계 시스템 연동
- HWP 출력
- 학기 말 정산(영수증 대조)

## 10. 기술 스택 & 검증
- **Vite + React + TypeScript(strict) + Tailwind CSS** — 서버가 필요 없고 빌드가 빨라서 루프 검증 시간이 짧다
- 저장: localStorage (`src/store/`, 키 `yesan:v1`), 첫 실행 시 시드 로드, "데모 초기화"로 시드 복원
- 엑셀: **exceljs** (브라우저에서 생성, 순수 JS)
- 테스트: **Vitest** (도메인·파서·엑셀) + **Playwright** (데모 시나리오 e2e 1개, chromium만)
- `npm run check` = `tsc --noEmit` → `eslint .` → `vitest run` → `vite build` → `playwright test`
- 폴더
  ```
  src/domain/   순수 로직: parser/, classify.ts, rules.ts, budget.ts, workflow.ts, money.ts
  src/config/   예산 구분·항목·키워드·규정 수치 (specs/02를 코드로 옮긴 것, 여기만 바꾸면 학교 규정 교체)
  src/export/   엑셀 생성 (layouts/ 아래 양식별 파일)
  src/store/    localStorage 저장소 + seed.ts
  src/ui/       화면·컴포넌트
  e2e/          Playwright
  ```

## 가정
<!-- 에이전트가 추가 -->
