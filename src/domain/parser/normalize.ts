const NOISE_WORDS = [
  '삭제', '선택삭제', '전체선택', '찜', '관심상품', '바로구매', '주문하기', '쿠폰', '적립', '품절', '장바구니',
]

const SUBTOTAL_LABELS = ['총 상품금액', '상품합계', '상품금액']
const TOTAL_LABELS = ['결제예정금액', '총 결제금액', '최종 결제금액', '총 주문금액']

export function toHalfWidth(text: string): string {
  return text
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

export function normalizeText(text: string): string {
  return toHalfWidth(normalizeLineEndings(text)).replace(/\u00a0/g, ' ')
}

export function normalizeLines(text: string): string[] {
  return normalizeText(text).split('\n').map((line) => line.trim())
}

export function parseAmount(token: string): number | undefined {
  const normalized = normalizeText(token)
  const match = normalized.match(/₩\s*(\d[\d,]*)|(\d[\d,]*)\s*원/)
  if (!match) return undefined
  const numStr = match[1] ?? match[2]
  const amount = Number(numStr.replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : undefined
}

export function parseQty(token: string): number | undefined {
  const normalized = normalizeText(token)
  const withLabel = normalized.match(/수량\s*[:：]?\s*(\d+)/)
  if (withLabel) return Number(withLabel[1])
  const withSign = normalized.match(/[x×*]\s*(\d+)/i)
  if (withSign) return Number(withSign[1])
  const withCount = normalized.match(/(\d+)\s*개(?!입)/)
  if (withCount) return Number(withCount[1])
  return undefined
}

export function parseShippingFee(line: string): number | undefined {
  const normalized = normalizeText(line)
  if (!/배송비|무료배송/.test(normalized)) return undefined
  if (/무료/.test(normalized)) return 0
  return parseAmount(normalized) ?? 0
}

export function matchDeclaredLabel(line: string): 'subtotal' | 'total' | undefined {
  const normalized = normalizeText(line).replace(/\s+/g, '')
  if (TOTAL_LABELS.some((label) => normalized.includes(label.replace(/\s+/g, '')))) return 'total'
  if (SUBTOTAL_LABELS.some((label) => normalized.includes(label.replace(/\s+/g, '')))) return 'subtotal'
  return undefined
}

export function isNoiseLine(line: string): boolean {
  const trimmed = normalizeText(line).trim()
  if (trimmed === '') return true
  if (/^장바구니\s*\(\d+\)$/.test(trimmed)) return true
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.every((token) => NOISE_WORDS.includes(token))
}
