# IMPLEMENTATION PLAN
> 마지막 갱신: 14:38 (build) · P0 22 / P1 4 / P2 3 (완료 3)

현재 코드 상태: 스캐폴딩 + 테스트 파이프라인 + 도메인 타입/money.ts 완료. `npm run check` 전체 통과. 다음은 P0 4번(src/config/budget.ts)부터.

## P0 — 데모 필수 (없으면 발표 불가)
- [x] 1. 프로젝트 스캐폴딩: Vite + React + TypeScript(strict) + Tailwind 초기화, `src/domain/ src/config/ src/export/ src/store/ src/ui/` 폴더 생성, ESLint 설정, `package.json`에 `dev/build/test` 스크립트. — 완료 기준: `npm install` 성공, `npx tsc --noEmit` 통과, `npx eslint .` 통과, `npx vite build` 성공 (spec: 00-overview.md 10장)
- [x] 2. 테스트 파이프라인 배선: Vitest 설정(+placeholder 테스트 1개) + Playwright 설정(`npx playwright install chromium` 안내, `e2e/` 폴더, 더미 e2e 1개) + `package.json`에 `npm run check` = `tsc --noEmit && eslint . && vitest run && vite build && playwright test`. — 완료 기준: `npm run check` 전체 통과 (spec: 00-overview.md 10장, CLAUDE.md)
- [x] 3. 도메인 타입 정의 `src/domain/types.ts` (Team/Item/PurchaseRequest/AppState, specs/00 7장 그대로) + `src/domain/money.ts` (정수 원 연산, `toLocaleString('ko-KR')+'원'` 포맷 헬퍼). — 완료 기준: `vitest run src/domain/money` money 포맷 단위 테스트 통과 (spec: 00-overview.md §7)
- [ ] 4. `src/config/budget.ts`: 예산 구분·항목(rne/club), 분류 키워드 묶음, 규정 수치(R3 300000, R4 500000, requireProductLink 등), 금지 키워드(R5/R6) — specs/02 표를 숫자 하드코딩 없이 옮긴다. — 완료 기준: config를 import하는 테스트에서 상수값 확인 (spec: 02-budget-rules.md)
- [ ] 5. `src/domain/parser/normalize.ts` (1단계 정규화: 전각→반각, 금액/수량 표기, 배송비, 합계 줄 감지, 잡음 줄 제거). — 완료 기준: 01-cart-parser.md 1단계의 모든 표기 예시가 각각 테스트 케이스로 통과 (spec: 01-cart-parser.md §1)
- [ ] 6. 형식 판별(tsv/line/block) + block 파서(3단계) `src/domain/parser/parseCart.ts`. — 완료 기준: `specs/fixtures/carts/demo-cart.txt` → `demo-cart.expected.json`과 일치 (품목 8개, 배송비 3000, declaredSubtotal 438000, declaredTotal 441000, warnings 없음) (spec: 01-cart-parser.md §2~3)
- [ ] 7. line 파서(3-2단계) + tsv 파서. — 완료 기준: `line-sample.txt`/`tsv-sample.txt`가 각각 expected.json과 일치 (spec: 01-cart-parser.md §3-2)
- [ ] 8. 디바이스마트 어댑터(3-3단계). — 완료 기준: `real/devicemart-1.txt`, `devicemart-2.txt`(품목 2개, 부가세 3,470, 배송비 2,700, 경고 없음), `devicemart-3.txt` 전부 expected.json과 일치. 이 테스트는 절대 약화·skip 금지 (spec: 01-cart-parser.md §3-3)
- [ ] 9. 4단계 검증: `QTY_PRICE_MISMATCH`/`TOTAL_MISMATCH`/`UNPARSED_LINE`/`EMPTY_INPUT`/`NO_ITEMS`/`MISSING_QTY`/`MISSING_PRICE` + `parseCart`가 어떤 입력에도 throw하지 않는 퍼징 테스트(랜덤 문자열 100개). — 완료 기준: 각 WarningCode에 대한 단위 테스트 + 퍼징 테스트 통과 (spec: 01-cart-parser.md §4)
- [ ] 10. 링크 추출 `src/domain/parser/links.ts` (`a[href]` 추출, 품명 매칭) + 붙여넣기 HTML 연동. — 완료 기준: `demo-cart.html`+`demo-cart.txt`를 같이 넣으면 8개 품목 전부 `https://shop.example/item/1`…`/8` url이 붙음 (spec: 01-cart-parser.md §3-5)
- [ ] 11. `src/store/seed.ts`: specs/00 §8 그대로 (팀 A `rne-3`, 팀 B `club-robot`, REQ-0001~0003, nextSeq=4, 시드 품목 전부 `https://shop.example/seed/<n>` 링크 포함). — 완료 기준: 시드 로드 결과가 §8 수치와 모두 일치하는 테스트 (spec: 00-overview.md §8)
- [ ] 12. `src/domain/classify.ts` 자동 분류(키워드 개수·동점 규칙·`기타`). — 완료 기준: 02-budget-rules.md §분류 예 5개 케이스(점퍼 케이블→소모품비, 릴레이 모듈→재료비, 배터리→소모품비, 서보모터→물품구입비, 센서공학입문→재료비(틀린 분류 의도적)) 테스트 통과 (spec: 02-budget-rules.md)
- [ ] 13. `src/domain/budget.ts` 잔액 계산(approved/pending/available, 배송비·부가세 귀속: 품목합 최대 항목, 재제출 시 자기 pending 제외). — 완료 기준: 시드 데이터 기준 rne-3 재료비 available 317,700원, club-robot 물품구입비 available 311,600원 테스트 통과 (spec: 02-budget-rules.md §잔액계산, §수용기준)
- [ ] 14. `src/domain/rules.ts` `checkRequest` (R1~R12 전부). — 완료 기준: 데모 장바구니(8품목, 전부 링크 있음) 기준 R1 error 1개("재료비 잔액 초과 (84,700원 초과)") + R3 warning 1개, 다른 finding 없음. 각 규칙 경계값(299,999/300,000, 499,999/500,000, 잔액 정확히 0) 테스트 통과 (spec: 02-budget-rules.md §규정검사)
- [ ] 15. `src/domain/workflow.ts` submit/approve/reject/resubmit 상태 전이 (throw 대신 `{ok,reason}`). — 완료 기준: specs/03 §표의 모든 성공/실패 케이스 + nextSeq 시드(4)에서 submit 2번→REQ-0004/0005 + "두 대기 요청 중 하나만 승인 가능" 케이스 테스트 통과 (spec: 03-approval.md)
- [ ] 16. `src/store/index.ts` localStorage persistence (키 `yesan:v1`, 최초 로드 시 시드, 저장/복원). — 완료 기준: save→reload 후 상태 동일 테스트, 손상된 데이터일 때 시드로 복구 테스트 (spec: 00-overview.md §10)
- [ ] 17. `src/export/` 구매 품의서 엑셀 생성(exceljs, `layouts/purchaseOrder.ts`, 부가세 배분 로직). — 완료 기준: 버퍼를 exceljs로 재읽기해서 데모 REQ-0004(품목 7행, 배송비 3,000, 합계 112,000, 소계 "재료비 73,400 / 소모품비 38,600", 지도교사 최윤서) 검증 + devicemart-2/3 부가세 배분 수치 + 링크 셀 하이퍼링크 테스트 통과, 미승인 요청으로 생성 시도 시 실패 (spec: 04-excel-export.md P0)
- [ ] 18. UI 앱 셸: 상단 바(서비스명+역할 전환 드롭다운), 화면 상태 라우팅(라이브러리 없음), 하단 [데모 초기화] 틀. — 완료 기준: 역할 전환 시 화면 전환 vitest/컴포넌트 테스트 통과 (spec: 05-ui.md §공통레이아웃)
- [ ] 19. UI 학생 홈: 총 예산 카드, 항목별 막대 카드(`category-available-<항목명>` testid), 내 팀 요청 목록, [새 구매 요청] 버튼. — 완료 기준: 시드 데이터로 렌더 시 rne-3 재료비 잔액 317,700원 표시 확인 테스트 (spec: 05-ui.md §학생홈)
- [ ] 20. UI 새 구매 요청 화면: 붙여넣기 영역(`cart-input`, text/plain+text/html 캡처) + [인식](`parse-button`) + 파싱 경고 박스 + 품목표(`item-row`/`item-delete`/`item-url`, 편집 가능) + 배송비(`shipping-fee`) + 합계(`total-amount`). — 완료 기준: 데모 장바구니 붙여넣기→인식 시 품목 8개, 합계 441,000원 표시 테스트 (spec: 05-ui.md §새구매요청 1-3)
- [ ] 21. UI 규정 검사 패널(`finding-error`/`finding-warning`, 경고 사유 입력) + 항목별 "현재→이번 요청 후 잔액" 표 + [제출](`submit-button`) 활성/비활성 로직 + 용도(`purpose-input`). — 완료 기준: 오실로스코프 삭제 전/후 finding 표시·제출 버튼 활성 상태 변화 테스트 (spec: 05-ui.md §새구매요청 4-5)
- [ ] 22. UI 요청 상세 화면(`request-id`, `status-badge`, 이력 타임라인, 반려 시 사유+재제출, 승인 시 [품의서 엑셀] `download-po`). — 완료 기준: REQ-0002(반려) 상세에 사유 표시, REQ-0001(승인) 상세에 다운로드 버튼 활성 테스트 (spec: 05-ui.md §요청상세, 03-approval.md)
- [ ] 23. UI 교사 홈(`pending-row`, 승인 대기 목록 오래된 순) + 상세의 [승인](`approve-button`)/[반려](`reject-button`, 사유 모달). — 완료 기준: REQ-0003이 승인 대기 목록에 표시, 승인/반려 동작 후 상태 갱신 테스트 (spec: 05-ui.md §교사홈, 03-approval.md)
- [ ] 24. [데모 초기화](`reset-demo`) 동작 연결 + specs/05 §e2e용 data-testid 전체 실제 DOM에 부여 확인 (브라우저 alert/confirm 미사용). — 완료 기준: 전체 testid 목록이 코드에서 grep되고, 데모 초기화 클릭 시 localStorage가 시드로 복원되는 테스트 (spec: 05-ui.md §공통, §e2e용 data-testid)
- [ ] 25. 데모 시나리오 e2e 테스트 (`e2e/demo.spec.ts`, specs/00 §6 6단계 전부, chromium). — 완료 기준: `npm run e2e` (playwright) 통과 — 학생 김민준 홈 317,700원 → 장바구니 붙여넣기(텍스트+HTML) → 인식 8품목/441,000원 → R1 error+R3 warning → 오실로스코프 삭제 → 112,000원/244,300원 → 제출 REQ-0004 → 교사 최윤서 승인 → 학생 복귀 승인 상태/244,300원 → 품의서 엑셀 다운로드 (spec: 00-overview.md §6)

## P1 — 완성도
- [ ] 1. G마켓 어댑터(3-4단계). `real/gmarket-1.expected.json`은 이미 `_review`(에이전트 생성, 수량 1 가정) 표시로 존재 — 그 가정을 반영해 파서를 맞추고, 결과가 바뀌면 expected.json을 갱신한다. — 완료 기준: `gmarket-1.txt` → 기존/갱신된 expected.json과 일치 (spec: 01-cart-parser.md §3-4)
- [ ] 2. `UNPARSED_LINE` 경고 줄을 품목표에서 [품목으로 추가] 클릭으로 수동 추가. — 완료 기준: UNPARSED_LINE이 있는 입력에서 클릭 시 품목 행 추가되는 테스트 (spec: 05-ui.md §새구매요청 2, 01-cart-parser.md §4)
- [ ] 3. 팀 예산 집행 현황 엑셀(`src/export/layouts/budgetStatus.ts`, 시트 `예산현황`+`집행내역`) + 학생 홈 [예산현황 엑셀] 버튼. — 완료 기준: 시드 팀 데이터로 집행률·배정/승인/대기/잔액 셀 값 검증 테스트 (spec: 04-excel-export.md P1)
- [ ] 4. 교사 화면 팀별 집행률 막대 2개(rne-3, club-robot). — 완료 기준: 교사 홈 렌더 시 두 팀의 집행률이 시드 수치로 표시되는 테스트 (spec: 05-ui.md §교사홈 P1)

> 학교 실제 엑셀 양식 채우기(04-excel-export.md P1)는 `specs/fixtures/school-template.xlsx`가 없어 대상 제외. 파일이 생기면 플랜에 추가한다.

## P2 — 스트레치 (시간 남으면)
- [ ] 1. 예산 맞추기 추천: 항목 잔액 초과 시 어떤 품목 수량을 줄이면 맞는지 제안. (spec: 00-overview.md §4 P2)
- [ ] 2. 요청 복제("지난번 주문 다시 담기"). (spec: 00-overview.md §4 P2)
- [ ] 3. 인쇄용 화면(Ctrl+P → A4 가로). (spec: 00-overview.md §4 P2)

## 완료
- P0-1 프로젝트 스캐폴딩 (iteration 5)
- P0-2 테스트 파이프라인 배선 (iteration 5, stop-hook이 `npm run check` 실패를 잡아내서 같은 iteration에 이어서 완료)
- P0-3 도메인 타입 `src/domain/types.ts` + `src/domain/money.ts` (iteration 6)
