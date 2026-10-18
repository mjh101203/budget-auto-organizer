import { parseAmount, parseQty } from './normalize'
import type { CartFormat } from './parseCart.types'

const TSV_HEADER_GROUPS = [
  /상품명|품명|제품명|품목/,
  /옵션|규격|사양/,
  /수량/,
  /단가|판매가|가격/,
  /금액|합계|소계|주문금액/,
]

function matchedHeaderGroupCount(line: string): number {
  return TSV_HEADER_GROUPS.filter((group) => group.test(line)).length
}

function isTsvFormat(contentLines: string[]): boolean {
  const tabLines = contentLines.filter((line) => line.includes('\t'))
  if (tabLines.length < 2) return false
  return tabLines.some((line) => matchedHeaderGroupCount(line) >= 2)
}

function isLineFormat(contentLines: string[]): boolean {
  if (contentLines.length === 0) return false
  const matching = contentLines.filter(
    (line) => parseQty(line) !== undefined && parseAmount(line) !== undefined,
  )
  return matching.length / contentLines.length >= 0.5
}

export function detectFormat(contentLines: string[]): CartFormat {
  if (isTsvFormat(contentLines)) return 'tsv'
  if (isLineFormat(contentLines)) return 'line'
  return 'block'
}
