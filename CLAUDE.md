# CLAUDE.md — 에이전트 운영 매뉴얼

## 프로젝트
**예산척척** — R&E·동아리 학생이 쇼핑몰 장바구니를 붙여넣으면 품목표·예산 항목 분류·규정 검사가 자동으로 되고, 지도교사 승인을 거쳐 엑셀 품의서가 나오는 웹앱.
무엇을 만드는지는 **`specs/`가 진실의 원천**이다. 먼저 `specs/00-overview.md`를 읽어라.
- `00-overview` 전체 그림·데모 시나리오·데이터 모델·시드 / `01-cart-parser` 장바구니 인식 / `02-budget-rules` 분류·규정·잔액
- `03-approval` 승인 흐름 / `04-excel-export` 엑셀 / `05-ui` 화면·data-testid / `fixtures/` 테스트 데이터

## 작동 방식
- 이 저장소는 랄프 루프(`scripts/ralph.mjs`)로 개발된다. 매 실행은 빈 컨텍스트이고 상태는 파일에만 남는다.
  - `specs/` — 무엇을 만들지 (사람 소유. 에이전트는 각 파일의 `## 가정` 섹션에만 추가 가능)
  - `IMPLEMENTATION_PLAN.md` — 할 일 체크리스트 (에이전트 소유)
  - `PROGRESS.md` — 진행 로그 (맨 아래에 추가만)
- 사람은 거의 개입하지 않는다. 질문하지 말고, 합리적으로 가정하고, 기록하라.
- `.ralph/`는 runner 전용 상태 폴더다. 읽지도 쓰지도 마라.
- 프롬프트 맨 위에 "실시간 지시"가 붙어 오면 사람(또는 QA)이 루프 도중 보낸 것이다. 최우선으로 처리한다.

## 명령어
<!-- 스캐폴딩 후 실제 명령으로 갱신할 것 -->
- 설치: `npm install` (+ 최초 1회 `npx playwright install chromium`)
- 개발 서버: `npm run dev`
- **전체 검증: `npm run check`** = `tsc --noEmit` → `eslint .` → `vitest run` → `vite build` → `playwright test`. 커밋 전에 반드시 통과.
- 단위 테스트만: `npm test` / e2e만: `npm run e2e`

## 기술 스택
- Vite + React + TypeScript(strict) + Tailwind CSS. 서버 없음, 저장은 localStorage
- 엑셀: exceljs (브라우저) / 테스트: Vitest + Playwright(chromium)
- 폴더 구조는 `specs/00-overview.md` 10장을 따른다. 도메인 로직(`src/domain/`)은 React·브라우저 API를 import하지 않는다
- 학교 규정 수치·키워드는 `src/config/`에만 둔다 (로직에 숫자 하드코딩 금지)
- 금액은 정수(원)만. 부동소수점 금지. 표시는 `toLocaleString('ko-KR') + '원'`
- `specs/fixtures/`는 테스트 데이터다. 테스트에서 직접 읽어 쓰고, 수정하지 않는다 (`carts/real/`의 `_review` expected 생성만 예외)

## 코드 규칙
- TypeScript strict. `any` 금지 (불가피하면 이유 주석).
- 핵심 도메인 로직은 UI와 분리된 순수 함수로 두고 단위 테스트한다.
- 테스트 삭제·skip·약화 금지. 실패하면 코드를 고친다.
- placeholder, 스텁, 가짜 반환값 금지. 시드 데이터는 실제 학교처럼 (한국어 이름·과목·일정).
- 외부 API 키가 필요한 기능은 만들지 않는다 (specs에 명시된 경우만 예외).
- 의존성은 꼭 필요한 것만. 네이티브 빌드가 필요한 패키지(better-sqlite3, bcrypt, canvas 등)는 피한다 — Windows에서 설치가 깨진다.
- UI 문구는 한국어.
- `npm run dev`처럼 끝나지 않는 명령은 직접 띄우지 않는다. 동작 확인은 테스트(단위/e2e)로 한다.

## 운영 메모
<!-- 에이전트가 배운 함정·명령어를 여기에 짧게 추가 (진행 상황은 쓰지 말 것) -->
- `npm create vite@latest .`은 저장소에 이미 파일이 있으면(CLAUDE.md 등) 비대화형에서 멈춘다. 빈 임시 폴더에 스캐폴딩한 뒤 필요한 파일만 repo 루트로 옮기고 임시 폴더를 지운다.
- Tailwind는 v4 + `@tailwindcss/vite` 플러그인 사용 (postcss.config 불필요, `src/index.css`에 `@import 'tailwindcss';` 한 줄만). vite.config.ts는 `vitest/config`의 `defineConfig`를 써서 `plugins`와 `test`(vitest) 옵션을 한 파일에서 같이 관리한다.
- ESLint는 flat config(`eslint.config.js`) + `typescript-eslint` + `eslint-plugin-react-hooks`/`react-refresh`. create-vite 최신 템플릿은 기본 oxlint를 쓰므로 그건 삭제하고 ESLint로 교체해야 CLAUDE.md 요구사항(`npm run check`의 `eslint .`)과 맞는다.
- `npm run check`는 stop-hook이 종료 시 그대로 재실행해서 검사한다. 테스트 파일이 하나도 없으면 vitest가 "No test files found"로 실패 코드를 뱉으니, 스캐폴딩 직후에도 placeholder 테스트 1개는 바로 커밋해야 한다.
- `@playwright/test` 버전을 올리면 캐시된 브라우저 리비전 번호가 바뀌어 `Executable doesn't exist` 에러가 난다 — `npx playwright install chromium`을 다시 돌려서 맞는 리비전을 받으면 해결된다.
- `playwright.config.ts`의 `webServer`는 `npm run preview`(vite preview, dist 서빙)를 쓴다. `npm run check` 순서가 `vite build` → `playwright test`라서 build 산출물이 이미 있는 상태로 preview가 뜬다.
