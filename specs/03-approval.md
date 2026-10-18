# 03 · 품의 · 승인 흐름

위치: `src/domain/workflow.ts` (순수 함수, 상태 객체를 받아 새 상태를 돌려준다. 실패는 throw 대신 `{ ok: false, reason }`)

## 상태와 전이
```
            submit                 approve
 (작성 중) ────────▶ 승인 대기 ─────────────▶ 승인 (끝)
                      │  ▲
               reject │  │ resubmit (수정 후)
                      ▼  │
                      반려
```
- "작성 중"은 저장하지 않는다. 새 요청 화면의 입력은 화면 상태일 뿐이고, 제출하는 순간 `submitted`로 처음 저장된다
- 승인된 요청은 수정·삭제 불가

| 동작 | 누가 | 조건 | 결과 |
|---|---|---|---|
| submit | 학생 | `checkRequest`에 error 없음, 모든 warning에 사유 있음 | 새 id(`REQ-` + 4자리, nextSeq 증가), status `submitted`, history에 submit |
| reject | 교사 | status `submitted`, 사유 1자 이상 | status `rejected`, decidedAt/decidedBy, history에 reject + note |
| resubmit | 학생 | status `rejected`, 수정된 내용으로 다시 검사해서 통과 | 같은 id, status `submitted`, decidedAt/decidedBy 지움, history에 resubmit |
| approve | 교사 | status `submitted`, **승인 시점에 다시 검사**해서 error 없음 (그사이 다른 요청 승인으로 잔액이 바뀌었을 수 있음) | status `approved`, decidedAt/decidedBy, history에 approve |

- 승인 시 재검사에서 error가 나면 승인 불가, 교사 화면에 이유를 보여주고 반려를 권한다
- 자기 자신의 pending 금액은 재검사 때 빼고 계산 (specs/02 잔액 계산)

## 화면에서 보이는 것
- 상태 배지: 승인 대기(노랑) / 승인(초록) / 반려(빨강)
- 요청 상세의 이력 타임라인: `2026.10.18 14:02 · 김민준 · 제출`, `… · 최윤서 · 반려 — 도서관 소장 도서`
- 반려된 요청에는 사유가 맨 위에 크게 보이고 [수정 후 재제출] 버튼
- 교사 홈: 승인 대기 목록 (오래된 순), 각 행에 팀명·요청번호·합계·경고 개수

## 수용 기준
- 위 표의 모든 전이 성공 케이스와, 조건을 어긴 모든 실패 케이스 테스트 (예: 승인된 요청 reject 시도 → 실패, 사유 없는 reject → 실패, error 있는 submit → 실패)
- 순번: 시드 상태(nextSeq 4)에서 submit 2번 → REQ-0004, REQ-0005
- 승인 시 재검사: 같은 팀의 두 대기 요청이 각각은 통과하지만 둘 다 승인하면 항목 잔액 초과인 경우 → 첫째 승인 성공, 둘째 승인 실패
- history는 추가만 되고 기존 항목은 바뀌지 않는다

## 가정
<!-- 에이전트가 추가 -->
- 승인 재검사는 "그사이 다른 요청 승인으로 잔액이 바뀌었을 수 있음"만 반영한다: 아직 결정되지 않은 다른 대기(submitted) 요청의 금액은 재검사에서 제외하고, 이미 승인된(approved) 요청 + 자기 자신의 내용만으로 잔액을 다시 계산한다. 그렇지 않으면(다른 대기 요청의 pending도 포함) "두 대기 요청이 각각은 통과하지만 둘 다 승인하면 초과" 시나리오에서 첫째 승인도 실패해버려 수용 기준과 맞지 않는다. submit/resubmit의 사전 검사는 반대로 다른 대기 요청의 pending을 그대로 포함해서 계산한다(새 제출이 현재 예산을 초과하지 않도록 하는 예약 개념, specs/02).
