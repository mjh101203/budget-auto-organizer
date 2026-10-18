# 랄프톤 하네스 (Claude Code)

에이전트가 사람 손 없이 몇 시간 동안 스스로 만들고, 검증하고, 커밋하게 하는 틀.
주제와 무관한 공통 부분만 들어 있다. 무엇을 만들지는 `specs/`에 쓴다.

```
CLAUDE.md               에이전트 운영 매뉴얼 (매 세션 자동 로드)
PROMPT_interview.md     [사람+Claude 대화] 루프 전에 specs를 모호함 없이 완성
PROMPT_plan.md          [루프] specs ↔ 코드 차이 → IMPLEMENTATION_PLAN.md (코드 안 씀)
PROMPT_build.md         [루프] 1 iteration = 작업 1개 → 검증 → 기록 → 커밋
PROMPT_qa.md            [루프] 리뷰어. 코드 안 고치고 문제만 빌더에게 say로 보냄
specs/00-overview.md    PRD 템플릿 (사람 소유)
IMPLEMENTATION_PLAN.md  할 일 체크리스트 (에이전트 소유)
PROGRESS.md             iteration별 한 줄 로그 → 발표 자료로도 씀
scripts/ralph.mjs       루프 runner (Windows/macOS/Linux, 의존성 없음)
scripts/stop-check.mjs  Stop 훅: build 중 `npm run check` 실패하면 종료를 막음
scripts/claude-settings.json  Stop 훅 등록 + --safe 모드용 권한 허용목록 (runner가 --settings로 매번 주입)
```

## 대회 전 체크리스트
- [ ] **이 폴더를 OneDrive 밖으로 복사해서 쓴다** (예: `C:\dev\ralphthon`). OneDrive 바탕화면에 `node_modules`가 생기면 동기화 때문에 `npm install`이 느려지거나 EPERM으로 깨진다. 경로에 한글·공백도 없는 게 안전하다.
- [ ] Node.js LTS(20 이상), Git, Claude Code 최신 버전(`claude update`), 로그인 확인(`claude` 한 번 실행)
- [ ] 구독 플랜 사용량 한도 확인. 한도에 걸리면 runner가 리셋 시각까지 기다렸다 이어서 돈다 (그동안은 시간 손해)
- [ ] **리허설 1회**: 폴더를 하나 더 복사해서 `specs/00-overview.md`에 아주 작은 앱(예: "급식 메뉴 별점")을 쓰고 `node scripts/ralph.mjs build --for 20` 돌려보기. 권한·훅·커밋·로그가 다 도는지 확인
- [ ] 대회 규칙에서 **사전 준비 허용 범위** 확인 (하네스·프롬프트는 보통 OK, 앱 코드 사전 작성은 금지일 수 있음)

## 당일 흐름 (반나절 예시)
| 단계 | 시간 | 사람 | 에이전트 |
|---|---|---|---|
| 1. 스펙 | 60~90분 | `claude` 실행 → "PROMPT_interview.md 읽고 그대로 진행해" → 질문에 답 | 질문·specs 작성 |
| 2. 계획 | 10분 | `node scripts/ralph.mjs plan` → 계획 읽고 순서/범위 손보기 | plan |
| 3. 루프 | 2.5~3시간 | 터미널 2에서 `status`, 앱 직접 띄워 확인, `say`로 조향 | build (+5회마다 QA) |
| 4. 마무리 | 30~60분 | `stop` → 데모 리허설, 발표 준비 | — |

**스펙에 시간을 제일 많이 써라.** 결과물 품질은 루프 전에 거의 결정된다.
1회 랄프톤 우승팀은 개발 전에 에이전트와 Q&A를 133라운드 돌려서 설계의 모호함을 없앴다.

## 명령어
```bash
node scripts/ralph.mjs plan                       # 계획 1회
node scripts/ralph.mjs build --until 16:40        # 16:40 이후로는 새 iteration 시작 안 함
node scripts/ralph.mjs build --for 180            # 지금부터 180분
node scripts/ralph.mjs say 시간표 화면에서 월요일이 두 번 나옴. 날짜 계산 확인해줘
node scripts/ralph.mjs status                     # 계획 진행·최근 iteration·PROGRESS·git log
node scripts/ralph.mjs pause / resume / stop      # 다음 iteration 전에 멈춤 / 재개 / 종료
node scripts/ralph.mjs qa                         # QA 1회 (빌더 루프와 따로, 병렬 가능)
node scripts/ralph.mjs help                       # 전체 옵션
```
`--until`은 실제 종료 시각보다 20~30분 앞으로 잡는다 (진행 중인 iteration이 끝날 시간).

## runner가 알아서 하는 것
- **매 iteration 새 컨텍스트** — 프롬프트는 stdin(UTF-8)으로 넘김. Windows 인코딩·따옴표 문제 없음
- **실시간 지시 주입** — `say`로 넣은 지시가 다음 iteration 프롬프트 맨 위에 "최우선"으로 붙음
- **거짓 완료 차단** — 에이전트가 `RALPH_DONE`을 외쳐도 계획에 `- [ ]`가 남았거나 `npm run check`가 실패하면 거부하고 다시 일 시킴
- **백프레셔** — Stop 훅이 build 중 check 실패 시 종료를 막고 에러를 돌려줌 (세션당 최대 3회)
- **막힘 감지** — 3회 연속 커밋이 없으면 plan을 자동으로 1회 돌리고, 그래도 막히면 멈추고 알림
- **사용량 제한** — 감지하면 리셋 시각(모르면 1분→최대 15분 백오프)까지 기다렸다 재시도, iteration으로 안 셈
- **안전망** — iteration이 커밋 안 하고 끝나면 `wip:` 스냅샷 커밋. 1회 30분 넘으면 강제 종료
- **기록** — `.ralph/logs/iter-NNN-<mode>.jsonl`에 전체 이벤트, `.ralph/runs.jsonl`에 요약

## 루프 중 사람이 할 일 (이번 대회는 루프 중 조작 허용)
- **코드를 직접 고치지 말고 `say`로 시킨다.** 빌더와 같은 파일을 동시에 고치면 충돌한다. 직접 고쳐야 하면 `pause` → 수정 → 커밋 → `resume`.
- `say`는 구체적으로, 한 번에 문제 하나: 무엇이 / 어디서 / 기대 동작.
- 같은 실수를 반복하면 `CLAUDE.md`의 `## 운영 메모`에 규칙 한 줄을 직접 추가한다. 다음 iteration부터 적용된다.
- 방향을 크게 틀 때는 `specs/`를 고치고 `say 스펙 바뀜. specs/01-xx.md 다시 읽고 계획 갱신해`.
- QA를 사람이 직접 하고 싶으면 터미널 2에서 `claude` 실행 → "PROMPT_qa.md 읽고 그대로 해".
  단 `npm run build`처럼 빌드 폴더를 쓰는 명령은 빌더와 충돌하니 피한다.

## 발표 팁
`PROGRESS.md`와 `git log --oneline`이 그대로 "에이전트가 몇 시간 동안 뭘 했는지" 타임라인이 된다.
iteration 수, 커밋 수, 테스트 수, 사람이 보낸 `say` 횟수(`.ralph/steer/done/`)를 숫자로 보여주면 좋다.

## 문제 해결
| 증상 | 해결 |
|---|---|
| `claude 실행 실패` | Claude Code 설치·PATH 확인. 경로가 특이하면 `CLAUDE_BIN` 환경변수로 지정 |
| `인증 오류` | 터미널에서 `claude` 실행해 로그인 |
| 권한 확인 없이 도는 게 불안함 | `--safe` (acceptEdits + `scripts/claude-settings.json` 허용목록). 허용목록 밖 명령은 막혀서 에이전트가 헤맬 수 있음 |
| 연속 실패로 멈춤 | `node scripts/ralph.mjs status`, 마지막 `.ralph/logs/*.jsonl` 확인 |
| 훅이 안 도는 것 같음 | `scripts/claude-settings.json`이 JSON 문법 오류면 `-p` 모드에서 조용히 무시된다. 수정 후 리허설로 확인 |
