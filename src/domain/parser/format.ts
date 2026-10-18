import { parseAmount, parseQty } from './normalize'
import type { CartFormat } from './parseCart.types'

export type TsvColumnType = 'name' | 'spec' | 'qty' | 'price' | 'amount'

const TSV_HEADER_GROUPS: [TsvColumnType, RegExp][] = [
  ['qty', /수량/],
  ['price', /단가|판매가|가격/],
  ['amount', /금액|합계|소계|주문금액/],
  ['spec', /옵션|규격|사양/],
  ['name', /상품명|품명|제품명|품목/],
]

export function classifyTsvHeaderCell(cell: string): TsvColumnType | undefined {
  const found = TSV_HEADER_GROUPS.find(([, pattern]) => pattern.test(cell))
  return found?.[0]
}

function matchedHeaderGroupCount(line: string): number {
  const cells = line.split('\t')
  const types = new Set(cells.map(classifyTsvHeaderCell).filter((t): t is TsvColumnType => t !== undefined))
  return types.size
}

function isTsvFormat(contentLines: string[]): boolean {
  const tabLines = contentLines.filter((line) => line.includes('\t'))
  if (tabLines.length < 2) return false
  return tabLines.some((line) => matchedHeaderGroupCount(line) >= 2)
}

export function findTsvHeaderLine(lines: string[]): string | undefined {
  return lines.filter((line) => line.includes('\t')).find((line) => matchedHeaderGroupCount(line) >= 2)
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
