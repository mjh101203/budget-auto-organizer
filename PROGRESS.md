# PROGRESS

에이전트가 iteration마다 맨 아래에 한 줄씩 추가한다. 형식: `- [HH:MM] <한 일> → <다음 할 일>`

- [14:22] PLAN: specs 전체 재확인 + fixture 수치(데모/디바이스마트/G마켓) 대조 검증, 기존 플랜(P0 25/P1 4/P2 3) 정확함을 확인하고 타임스탬프만 갱신 → 다음: build 모드로 P0 1번(프로젝트 스캐폴딩) 착수
- [14:30] P0-1 프로젝트 스캐폴딩 완료: Vite+React+TS(strict)+Tailwind v4(@tailwindcss/vite), ESLint flat config(typescript-eslint+react-hooks+react-refresh), `src/domain|config|export|store|ui` 폴더, package.json에 dev/build/lint/test/e2e/check 스크립트 배선(check는 아직 vitest/playwright 설정 없어 실패함). npm install·tsc -b --noEmit·eslint .·vite build 전부 통과 확인 → 다음: P0 2번(테스트 파이프라인 배선: vitest+placeholder 테스트, playwright+더미 e2e, npm run check 전체 통과)
- [14:33] stop-hook이 `npm run check` 실패(vitest 테스트 파일 없음)를 잡아서 같은 iteration에 P0-2까지 이어서 완료: `src/App.test.tsx`(+`src/test-setup.ts`, jest-dom matcher) vitest 테스트, `playwright.config.ts`(webServer=vite preview:4173)+`e2e/smoke.spec.ts` 더미 e2e, `npx playwright install chromium`으로 브라우저 캐시 갱신(1223→1248). `npm run check` 전체(tsc/eslint/vitest/vite build/playwright) 통과 확인 → 다음: P0 3번(도메인 타입 `src/domain/types.ts` + `src/domain/money.ts`)
- [14:38] P0-3 완료: `src/domain/types.ts`(Team/Item/PurchaseRequest/AppState/Finding, specs/00 §7 그대로 + Finding은 §02 규정검사에서 쓸 타입 미리 추가) + `src/domain/money.ts`(`formatWon`/`itemAmount`/`sumWon`) + `money.test.ts` 단위 테스트. `npm run check` 전체 통과 → 다음: P0 4번(`src/config/budget.ts` 예산 구분·항목·키워드·규정 수치)
- [14:40] P0-4 완료: `src/config/budget.ts`(`BUDGET_CATEGORIES`, `CLASSIFY_KEYWORD_GROUPS` 5묶음, `RULE_CONFIG`(R3/R4/R7/R8/R12 수치), `FORBIDDEN_GIFT_KEYWORDS`(R5), `FOOD_KEYWORDS`(R6)) + `budget.test.ts`. `npm run check` 전체 통과 → 다음: P0 5번(`src/domain/parser/normalize.ts` 1단계 정규화)
- [14:41] P0-5 완료: `src/domain/parser/normalize.ts`(`toHalfWidth`/`normalizeLineEndings`/`normalizeText`/`normalizeLines`/`parseAmount`/`parseQty`/`parseShippingFee`/`matchDeclaredLabel`/`isNoiseLine`) + `normalize.test.ts`(01-cart-parser.md §1의 모든 표기 예시 31케이스). 전각 공백(U+3000)·전각 문자 범위를 eslint `no-irregular-whitespace`가 잡아서 `　` 이스케이프로 수정. `npm run check` 전체 통과 → 다음: P0 6번(형식 판별 tsv/line/block + block 파서 `parseCart.ts`, demo-cart fixture 기준)

