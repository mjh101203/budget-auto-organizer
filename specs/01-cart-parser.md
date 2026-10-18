# 01 · 장바구니 텍스트 인식

쇼핑몰 장바구니 화면을 드래그해서 복사한 텍스트(또는 엑셀 표 복사)를 받아 품목 목록으로 바꾼다.
네트워크 요청은 하지 않는다. 위치: `src/domain/parser/`.

## 인터페이스
```ts
interface ParsedItem { name: string; spec?: string; url?: string; qty: number; unitPrice: number; amount: number; sourceLine: number }
interface ParseWarning { code: WarningCode; line?: number; message: string }   // message는 한국어
type WarningCode = 'EMPTY_INPUT' | 'NO_ITEMS' | 'QTY_PRICE_MISMATCH' | 'TOTAL_MISMATCH' | 'UNPARSED_LINE' | 'MISSING_QTY' | 'MISSING_PRICE'
interface ParseResult {
  items: ParsedItem[]
  shippingFee: number            // 못 찾으면 0
  vatFee: number                 // 부가세가 별도로 적힌 쇼핑몰의 부가세. 못 찾으면 0
  declaredSubtotal?: number      // "상품금액" 등 장바구니에 적힌 상품 합계
  declaredTotal?: number         // "결제예정금액" 등 장바구니에 적힌 최종 합계
  warnings: ParseWarning[]
  format: 'tsv' | 'block' | 'line'
}
function parseCart(text: string, html?: string): ParseResult   // 절대 throw 하지 않는다
```
`sourceLine`은 입력의 1부터 세는 줄 번호(품명이 있는 줄).

## 1단계 · 정규화
- 전각 숫자·쉼표(`１２，３００`) → 반각, NBSP·탭 앞뒤 공백 정리, `\r\n` → `\n`
- 금액 표기: `12,300원`, `12,300 원`, `₩12,300`, `12300원` → 12300. 금액은 반드시 `원` 또는 `₩`가 붙어 있어야 금액으로 본다 (TSV 금액 열은 예외)
- 수량 표기: `수량 3`, `수량: 3`, `수량：3`, `3개`, `x3`, `x 3`, `× 3`, `*3` → 3
- 배송비: `배송비 3,000원` → 3000, `배송비 무료` / `무료배송` → 0
- 합계 줄: `상품금액` / `총 상품금액` / `상품합계` → declaredSubtotal, `결제예정금액` / `총 결제금액` / `최종 결제금액` / `총 주문금액` → declaredTotal. 합계 줄은 품목으로 만들지 않는다
- 잡음 줄은 무시하고 경고도 내지 않는다. **잡음 줄** = 빈 줄, 또는 공백으로 나눈 모든 토큰이 잡음 단어인 줄 (예: `전체선택  선택삭제`), 또는 `장바구니 (n)` 형태
  - 잡음 단어: `삭제`, `선택삭제`, `전체선택`, `찜`, `관심상품`, `바로구매`, `주문하기`, `쿠폰`, `적립`, `품절`, `장바구니`

## 2단계 · 형식 판별 (위에서부터 먼저 맞는 것)
"내용 줄" = 잡음·합계·배송비 줄을 뺀 나머지 줄.
1. **tsv** — 탭이 있는 줄이 2줄 이상이고, 그중 한 줄이 헤더 키워드를 2개 이상 포함
   - 품명: `상품명|품명|제품명|품목` · 옵션: `옵션|규격|사양` · 수량: `수량` · 단가: `단가|판매가|가격` · 금액: `금액|합계|소계|주문금액`
   - TSV의 숫자 열은 `원` 없이도 금액으로 본다 (`22,000`). 빈 옵션 칸은 spec 없음
2. **line** — 내용 줄의 절반 이상이 한 줄 안에 수량 토큰과 `원` 금액을 둘 다 가짐. 예: `LED 5mm 빨강 100개입 x 2 = 3,000원`
3. **block** — 그 외. 품명 줄 다음 5줄 안에 금액·수량 줄이 오는 덩어리 구조 (웹 장바구니 복사의 흔한 형태)

## 3단계 · block 형식 규칙
- **품명 줄**: 내용 줄 중 `원` 금액이 없고, 수량 줄(`수량 n`, `n개`, `x n`만 있는 줄)이 아니고, `옵션:`/`규격:` 줄이 아니고, 한글 또는 영문자를 포함하고, 길이 3자 이상. 숫자로 시작해도 된다 (`5V 1채널 릴레이 모듈`, `18650 리튬이온 배터리`)
  - `V`, `mm`, `mAh`, `MHz`, `kg`, `cm`, `P` 같은 단위가 붙은 숫자는 수량·금액이 아니다
- **옵션 줄**: 품명 바로 다음의 `옵션:` / `옵션 :` / `규격:`으로 시작하는 줄 → `spec`
- 품명 뒤에 나오는 금액 줄이 2개면 첫째 = 단가, 둘째 = 금액. 1개면 수량과 비교해서 결정:
  - 금액 1개 + 수량 n: 그 값을 단가로 보고 amount = 단가 × n
- 덩어리는 다음 품명 줄이 나오거나 합계·배송비 줄이 나오면 끝난다
- 수량 줄이 없으면 수량 1 + 경고 `MISSING_QTY`. 금액이 없으면 그 덩어리는 품목으로 만들지 않고 `MISSING_PRICE`

## 3-2단계 · line 형식 규칙
- 수량: `[x×*]\s*(\d+)` 또는 `수량\s*[:：]?\s*(\d+)`를 먼저 찾는다. 둘 다 없을 때만 `(\d+)개`(뒤에 `입`이 오면 제외)를 수량으로 본다. `100개입`, `100개` 같은 포장 단위가 수량 토큰보다 앞에 있으면 품명의 일부다
- 금액: 줄의 **마지막** `원` 금액 = 그 줄의 금액(amount). unitPrice = amount ÷ qty (나누어떨어지지 않으면 내림 + `QTY_PRICE_MISMATCH`)
- 품명: 수량 토큰 앞부분에서 끝의 구분자(`|`, `-`, `=`, `,`, 공백)를 걷어낸 것

## 3-3단계 · 디바이스마트 형식 (실제 샘플 `fixtures/carts/real/devicemart-1.txt` 기준, block의 변형)
감지: 텍스트에 헤더 줄 `주문상품 … 수량 … 상품금액`(세 단어가 모두 들어 있는 줄)이 있으면 이 형식을 먼저 적용한다. 결과 `format`은 `block`.
- **범위**: 헤더 줄 다음부터 `결제 예정금액` 값 줄까지만 읽는다. 그 앞(메뉴·배너)과 뒤(이용안내·푸터·사업자정보)는 전부 버린다. 버린 줄에 대해서는 경고도 내지 않는다
- **품명 줄**: 탭으로 나눈 칸이 둘이고 **연속 공백을 한 칸으로 줄인 뒤 같으면**(`이름\t이름`) 한 칸만 품명. 실제 샘플에서 앞 칸에는 공백이 두 개(`R4  오픈형`), 뒤 칸에는 하나라서 그냥 비교하면 다르게 나온다. 다르면 첫 칸을 쓴다. 결과 품명은 항상 연속 공백을 한 칸으로 줄인 형태. 모델명 `[SZH-PSU01]`은 품명에 그대로 둔다
- **수량**: 품명 뒤에 연속된 세 줄 `-` / 정수 / `+`의 가운데 정수
- **금액**: 수량 블록 다음 첫 `원` 금액 줄 = 상품금액 열 = **줄 합계(amount)**. unitPrice = amount ÷ qty (실제 샘플 2에서 확인: 수량 3, 17,700원 → 단가 5,900원). 나누어떨어지지 않으면 `QTY_PRICE_MISMATCH`
- **무시하는 줄**: `마일리지 …원`(59원 같은 적립금이 가격으로 오인되면 안 됨), `1~2일 삭제`, `본사`, `…택배…`, `n원 (선불)`/`(착불)`(품목별 배송비 — 요약의 배송비를 쓴다), `변경`, 단독 `+` / `=` 줄
- **요약 블록**은 라벨 줄과 값 줄이 따로 떨어져 있다. 값은 라벨 다음 줄의 금액(건너뛰는 줄: 빈 줄, `+`, `=`)
  - `상품 주문 금액` → declaredSubtotal / `부가세` → **vatFee** / `배송비` → shippingFee / `결제 예정금액` → declaredTotal (`9,190 원`처럼 숫자와 `원` 사이 공백 허용)
- **이 쇼핑몰의 상품 가격은 부가세 별도**다 (5,900 + 부가세 590 + 배송비 2,700 = 결제 예정 9,190). 그래서 이 형식에서는 `품목 합계 + vatFee + shippingFee = declaredTotal`이어야 한다

일반 규칙: 어떤 형식이든 `배송비`·`부가세`·합계 라벨 줄에 금액이 없으면 다음 비어 있지 않은 줄(`+`, `=` 제외)의 금액을 쓴다. `vatFee`는 못 찾으면 0.

## 3-4단계 · G마켓 형식 (실제 샘플 `fixtures/carts/real/gmarket-1.txt` 기준, P1)
복사본이 마크다운처럼 변환돼 링크 `[글자](주소)`가 섞여 있고, 디바이스마트와 구조가 다르다.
- 감지: `나의 장바구니 목록`과 `최종 결제정보`가 둘 다 있다. 품목은 그 사이만 읽는다
- **링크 처리**: 품명 줄은 `[상품명:이름](주소)` 모양이다. 이름은 **대괄호 안의 글자**(`상품명:` 뒤)만 쓴다. 링크 뒤에 붙은 `판매자 스타배송10/20(화) 도착보장` 같은 글자는 버린다. 링크만 있는 줄·`* [메뉴](주소)` 줄은 잡음
- **금액**: 품명 다음에 나오는 `상품 금액 :32,600원`(콜론이 붙은 것) = 그 품목의 amount. 같은 블록의 `상품금액32,600원`(콜론 없음, 판매자 소계)·`주문금액`·`할인금액`·`배송비무료배송`·`빼기`·`더하기`·`계산값은`은 판매자별 소계라서 품목으로 만들지 않는다
- **수량**: 복사 텍스트에 수량 숫자가 없다 (`상품 수 1 증가상품 수 1 감소`는 버튼 이름). 수량 1 + `MISSING_QTY` 경고로 두고, 사용자가 화면에서 고치게 한다
- **요약**: `최종 결제정보` 이후. 라벨과 숫자가 **공백 없이 붙어** 있다 (`총 결제금액51,800원`, `상품금액51,800원`, `배송비0원`). `총 결제금액` → declaredTotal, `상품금액` → declaredSubtotal, `배송비` → shippingFee. `할인금액`이 0이 아니면 합계 대조에서 그만큼 뺀다. `무료배송`은 0원
- 일반 규칙으로도: 라벨 바로 뒤에 숫자가 공백 없이 붙어 있어도 금액으로 읽는다

## 3-5단계 · 상품 링크 (붙여넣을 때 HTML에서)
학교 제출에 상품 링크가 필수다. 복사한 **글자**에는 주소가 없지만, 브라우저는 복사할 때 링크가 담긴 HTML(`text/html`)도 클립보드에 같이 넣는다.
- UI: 붙여넣기 이벤트에서 `clipboardData.getData('text/plain')`과 `getData('text/html')`을 둘 다 읽어 `parseCart(text, html)`로 넘긴다
- 링크 추출 (`src/domain/parser/links.ts`, DOMParser 사용 가능하게 순수 함수는 `(html: string) → {text, href}[]`):
  - `a[href]` 중 `http://`·`https://`로 시작하고 글자가 있는 것만. 글자는 연속 공백을 한 칸으로 줄여서 비교
  - 같은 주소가 반복되면 첫 글자만 (이미지 링크·"바로가기" 같은 짧은 글자는 품명 매칭에 안 걸리면 버려진다)
- 매칭: 품목 `name`(연속 공백 정규화)과 링크 글자가 **같거나, 한쪽이 다른 쪽을 포함하고 길이 8자 이상**이면 그 품목의 `url`. 여러 개면 가장 긴 글자와 매칭된 것
- HTML이 없거나 매칭이 하나도 안 되면 url은 비워둔다 (오류 아님). UI는 "링크를 못 찾았어요 — 직접 입력하세요" 안내를 띄운다
- 링크 주소 직접 입력/수정은 품목표의 링크 칸에서 가능. 입력값 검증: `http://` 또는 `https://`로 시작
- fixture: `demo-cart.html` + `demo-cart.txt`를 같이 넣으면 8개 품목 모두 `https://shop.example/item/1`…`/8`이 붙어야 한다
- ⚠ 실제 쇼핑몰은 `tools/clipboard-dump.html`로 뽑은 `real/<쇼핑몰>-<n>.html` 샘플이 있을 때만 맞춘다. 같은 이름의 `.txt`와 `.html` 쌍이면 fixture 테스트가 둘 다 넣고, `.expected.json`에 `url`이 있으면 같이 비교한다

## 4단계 · 검증
- `unitPrice × qty ≠ amount`이면 `QTY_PRICE_MISMATCH` 경고. amount가 qty로 나누어떨어지면 unitPrice = amount / qty로 고치고, 아니면 unitPrice는 유지하고 amount = unitPrice × qty
- declaredSubtotal이 있고 품목 합계와 다르면 `TOTAL_MISMATCH`
- declaredTotal이 있고 (품목 합계 + vatFee + 배송비)와 다르면 `TOTAL_MISMATCH`
- 기존 fixture(demo/tsv/line)의 expected.json에는 `vatFee` 키가 없다 → 비교 시 없는 키는 0으로 본다
- 품목·잡음·합계 어디에도 해당하지 않는데 금액 패턴이 있는 줄 → `UNPARSED_LINE` (UI에서 수동 추가할 수 있게 줄 번호 포함)
- 입력이 공백뿐이면 `EMPTY_INPUT`, 품목이 0개면 `NO_ITEMS`

## 수용 기준
- Given `specs/fixtures/carts/demo-cart.txt`, When `parseCart`, Then 결과가 `demo-cart.expected.json`과 같다 (품목 8개, 배송비 3000, declaredSubtotal 438000, declaredTotal 441000, warnings 없음)
- Given `specs/fixtures/carts/real/devicemart-1.txt`, `devicemart-2.txt`, `devicemart-3.txt`, `gmarket-1.txt`(P1, `_review` 표시가 있어 수량 가정 확인 필요), Then 각각의 expected.json과 같다 (실제 복사본이라 가장 중요한 테스트. 이 둘은 절대 약화·수정 금지. devicemart-2: 품목 2개, 부가세 3,470, 배송비 2,700, 경고 없음)
- Given `specs/fixtures/carts/tsv-sample.txt`, Then `tsv-sample.expected.json`과 같다
- Given `specs/fixtures/carts/line-sample.txt`, Then `line-sample.expected.json`과 같다
- expected.json 비교 규칙: `spec`이 없거나 빈 문자열이면 키 자체를 생략, `warnings`는 `code`와 `line`만 비교(message는 비교 안 함)
- `specs/fixtures/carts/` 아래의 모든 `*.txt`에 대해 같은 이름의 `*.expected.json`이 있으면 자동으로 테스트된다 (fixture 기반 테스트 하나로 전부 돌린다). 사람이 샘플을 추가하면 테스트가 늘어난다
- 정규화 단위 테스트: 위 1단계의 모든 표기 예시가 각각 테스트 케이스
- 어떤 입력에도 throw하지 않는다 (랜덤 문자열 100개 퍼징 테스트)

## 실제 쇼핑몰 어댑터 (P1)
⚠ `specs/fixtures/carts/real/<쇼핑몰>-<n>.txt` 실제 복사 샘플이 있을 때만 만든다.
샘플이 generic 규칙으로 안 읽히면 쇼핑몰 감지(텍스트에 쇼핑몰 이름·고유 문구) → 전용 어댑터. 어댑터도 `parseCart` 하나로 들어가야 한다.
expected.json이 없는 실제 샘플은 사람이 확인해야 하므로, 에이전트는 파싱 결과를 `*.expected.json`으로 만들되 파일 첫 키에 `"_review": "에이전트 생성 — 사람 확인 필요"`를 넣는다.

## 가정
<!-- 에이전트가 추가 -->
