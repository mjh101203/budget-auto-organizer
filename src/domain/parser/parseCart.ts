import { classifyTsvHeaderCell, detectFormat, findTsvHeaderLine } from './format'
import {
  isNoiseLine,
  matchDeclaredLabel,
  normalizeLines,
  normalizeText,
  parseAmount,
  parseQty,
  parseShippingFee,
} from './normalize'
import type { ParsedItem, ParseResult, ParseWarning } from './parseCart.types'

interface LineEntry {
  lineNo: number
  text: string
}

type LineKind = 'noise' | 'shipping' | 'subtotal' | 'total' | 'content'

function classifyLines(lines: string[]): LineKind[] {
  return lines.map((line) => {
    if (isNoiseLine(line)) return 'noise'
    if (parseShippingFee(line) !== undefined) return 'shipping'
    const label = matchDeclaredLabel(line)
    if (label === 'subtotal') return 'subtotal'
    if (label === 'total') return 'total'
    return 'content'
  })
}

function isQtyOnlyLine(text: string): boolean {
  return (
    /^수량\s*[:：]?\s*\d+$/.test(text) ||
    /^\d+\s*개(?!입)$/.test(text) ||
    /^[x×*]\s*\d+$/i.test(text)
  )
}

function isOptionLine(text: string): boolean {
  return /^(옵션|규격)\s*[:：]/.test(text)
}

function isNameLine(text: string): boolean {
  if (parseAmount(text) !== undefined) return false
  if (isQtyOnlyLine(text)) return false
  if (isOptionLine(text)) return false
  if (!/[가-힣a-zA-Z]/.test(text)) return false
  return text.length >= 3
}

function reconcileAmount(
  unitPrice: number,
  qty: number,
  amount: number,
  lineNo: number,
  warnings: ParseWarning[],
): { unitPrice: number; amount: number } {
  if (unitPrice * qty === amount) return { unitPrice, amount }
  warnings.push({
    code: 'QTY_PRICE_MISMATCH',
    line: lineNo,
    message: `수량×단가가 금액과 일치하지 않습니다 (${lineNo}번째 줄)`,
  })
  if (qty !== 0 && amount % qty === 0) return { unitPrice: amount / qty, amount }
  return { unitPrice, amount: unitPrice * qty }
}

function parseBlockItems(entries: LineEntry[], warnings: ParseWarning[]): ParsedItem[] {
  const nameIndices = entries
    .map((entry, idx) => (isNameLine(entry.text) ? idx : -1))
    .filter((idx) => idx >= 0)

  const items: ParsedItem[] = []
  nameIndices.forEach((startIdx, i) => {
    const endIdx = i + 1 < nameIndices.length ? nameIndices[i + 1] : entries.length
    const nameEntry = entries[startIdx]
    let rest = entries.slice(startIdx + 1, endIdx)

    let spec: string | undefined
    if (rest.length > 0 && isOptionLine(rest[0].text)) {
      spec = rest[0].text.replace(/^(옵션|규격)\s*[:：]\s*/, '')
      rest = rest.slice(1)
    }

    const qtyEntry = rest.find((entry) => isQtyOnlyLine(entry.text))
    const amountEntries = rest.filter((entry) => parseAmount(entry.text) !== undefined)

    let qty: number
    if (qtyEntry) {
      qty = parseQty(qtyEntry.text) ?? 1
    } else {
      qty = 1
      warnings.push({
        code: 'MISSING_QTY',
        line: nameEntry.lineNo,
        message: '수량을 찾지 못해 1로 처리했습니다',
      })
    }

    if (amountEntries.length === 0) {
      warnings.push({
        code: 'MISSING_PRICE',
        line: nameEntry.lineNo,
        message: '금액을 찾지 못했습니다',
      })
      return
    }

    const useSecond = amountEntries.length >= 2
    const unitPrice = parseAmount(amountEntries[0].text) ?? 0
    const amount = useSecond ? parseAmount(amountEntries[1].text) ?? 0 : unitPrice * qty
    const amountLineNo = useSecond ? amountEntries[1].lineNo : amountEntries[0].lineNo

    const reconciled = reconcileAmount(unitPrice, qty, amount, amountLineNo, warnings)

    items.push({
      name: nameEntry.text,
      ...(spec ? { spec } : {}),
      qty,
      unitPrice: reconciled.unitPrice,
      amount: reconciled.amount,
      sourceLine: nameEntry.lineNo,
    })
  })

  return items
}

function parseTsvNumber(cell: string | undefined): number | undefined {
  if (cell === undefined) return undefined
  const cleaned = normalizeText(cell).trim().replace(/,/g, '')
  if (cleaned === '') return undefined
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : undefined
}

function parseTsvItems(entries: LineEntry[], warnings: ParseWarning[]): ParsedItem[] {
  const headerLine = findTsvHeaderLine(entries.map((entry) => entry.text))
  if (!headerLine) return []
  const columnTypes = headerLine.split('\t').map((cell) => classifyTsvHeaderCell(cell))

  const headerLineNo = entries.find((entry) => entry.text === headerLine)?.lineNo
  const dataEntries = entries.filter(
    (entry) => entry.text.includes('\t') && entry.lineNo !== headerLineNo,
  )

  const items: ParsedItem[] = []
  dataEntries.forEach((entry) => {
    const cells = entry.text.split('\t')
    let name = ''
    let spec: string | undefined
    let qty = 1
    let unitPrice = 0
    let amount: number | undefined
    columnTypes.forEach((type, idx) => {
      const cell = cells[idx]
      if (type === 'name') name = (cell ?? '').trim()
      else if (type === 'spec') {
        const value = cell?.trim()
        if (value) spec = value
      } else if (type === 'qty') {
        const value = parseTsvNumber(cell)
        if (value !== undefined) qty = value
      } else if (type === 'price') {
        const value = parseTsvNumber(cell)
        if (value !== undefined) unitPrice = value
      } else if (type === 'amount') {
        amount = parseTsvNumber(cell)
      }
    })

    if (name === '') return

    const reconciled = reconcileAmount(unitPrice, qty, amount ?? unitPrice * qty, entry.lineNo, warnings)
    items.push({
      name,
      ...(spec ? { spec } : {}),
      qty,
      unitPrice: reconciled.unitPrice,
      amount: reconciled.amount,
      sourceLine: entry.lineNo,
    })
  })

  return items
}

function parseLastAmount(normalizedText: string): number | undefined {
  const matches = [...normalizedText.matchAll(/₩\s*(\d[\d,]*)|(\d[\d,]*)\s*원/g)]
  if (matches.length === 0) return undefined
  const last = matches[matches.length - 1]
  const numStr = last[1] ?? last[2]
  const amount = Number(numStr.replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : undefined
}

function matchQtyToken(normalizedText: string): RegExpMatchArray | undefined {
  const withLabel = normalizedText.match(/수량\s*[:：]?\s*(\d+)/)
  if (withLabel) return withLabel
  const withSign = normalizedText.match(/[x×*]\s*(\d+)/i)
  if (withSign) return withSign
  const withCount = normalizedText.match(/(\d+)\s*개(?!입)/)
  if (withCount) return withCount
  return undefined
}

function computeLineUnitPrice(
  amount: number,
  qty: number,
  lineNo: number,
  warnings: ParseWarning[],
): number {
  if (qty === 0) return amount
  if (amount % qty === 0) return amount / qty
  warnings.push({
    code: 'QTY_PRICE_MISMATCH',
    line: lineNo,
    message: `수량×단가가 금액과 일치하지 않습니다 (${lineNo}번째 줄)`,
  })
  return Math.floor(amount / qty)
}

function parseLineItems(entries: LineEntry[], warnings: ParseWarning[]): ParsedItem[] {
  const items: ParsedItem[] = []
  entries.forEach((entry) => {
    const normalized = normalizeText(entry.text)
    const amount = parseLastAmount(normalized)
    if (amount === undefined) {
      warnings.push({ code: 'MISSING_PRICE', line: entry.lineNo, message: '금액을 찾지 못했습니다' })
      return
    }

    const qtyMatch = matchQtyToken(normalized)
    let qty: number
    let namePart: string
    if (qtyMatch && qtyMatch.index !== undefined) {
      qty = Number(qtyMatch[1])
      namePart = normalized.slice(0, qtyMatch.index)
    } else {
      qty = 1
      namePart = normalized
      warnings.push({
        code: 'MISSING_QTY',
        line: entry.lineNo,
        message: '수량을 찾지 못해 1로 처리했습니다',
      })
    }

    const name = namePart.replace(/[\s|\-=,]+$/, '').trim()
    const unitPrice = computeLineUnitPrice(amount, qty, entry.lineNo, warnings)
    items.push({ name, qty, unitPrice, amount, sourceLine: entry.lineNo })
  })
  return items
}

function validateTotals(
  items: ParsedItem[],
  shippingFee: number,
  vatFee: number,
  declaredSubtotal: number | undefined,
  declaredTotal: number | undefined,
  warnings: ParseWarning[],
): void {
  const itemSum = items.reduce((sum, item) => sum + item.amount, 0)
  if (declaredSubtotal !== undefined && declaredSubtotal !== itemSum) {
    warnings.push({
      code: 'TOTAL_MISMATCH',
      message: `상품 합계(${itemSum}원)가 장바구니 표시 금액(${declaredSubtotal}원)과 다릅니다`,
    })
  }
  if (declaredTotal !== undefined && declaredTotal !== itemSum + vatFee + shippingFee) {
    warnings.push({
      code: 'TOTAL_MISMATCH',
      message: '결제 예정 금액이 품목 합계·부가세·배송비의 합과 다릅니다',
    })
  }
}

export function parseCart(text: string, html?: string): ParseResult {
  void html

  if (text.trim() === '') {
    return {
      items: [],
      shippingFee: 0,
      vatFee: 0,
      warnings: [{ code: 'EMPTY_INPUT', message: '입력이 비어 있습니다' }],
      format: 'block',
    }
  }

  const rawLines = normalizeLines(text)
  const kinds = classifyLines(rawLines)

  let shippingFee = 0
  let declaredSubtotal: number | undefined
  let declaredTotal: number | undefined
  rawLines.forEach((line, i) => {
    if (kinds[i] === 'shipping') shippingFee = parseShippingFee(line) ?? 0
    if (kinds[i] === 'subtotal') declaredSubtotal = parseAmount(line) ?? declaredSubtotal
    if (kinds[i] === 'total') declaredTotal = parseAmount(line) ?? declaredTotal
  })

  const contentEntries: LineEntry[] = rawLines
    .map((lineText, idx) => ({ lineNo: idx + 1, text: lineText }))
    .filter((_, idx) => kinds[idx] === 'content')

  const vatFee = 0
  const warnings: ParseWarning[] = []
  const format = detectFormat(contentEntries.map((entry) => entry.text))

  const items =
    format === 'block'
      ? parseBlockItems(contentEntries, warnings)
      : format === 'tsv'
        ? parseTsvItems(contentEntries, warnings)
        : parseLineItems(contentEntries, warnings)

  validateTotals(items, shippingFee, vatFee, declaredSubtotal, declaredTotal, warnings)

  if (items.length === 0) {
    warnings.push({ code: 'NO_ITEMS', message: '인식된 품목이 없습니다' })
  }

  return {
    items,
    shippingFee,
    vatFee,
    ...(declaredSubtotal !== undefined ? { declaredSubtotal } : {}),
    ...(declaredTotal !== undefined ? { declaredTotal } : {}),
    warnings,
    format,
  }
}
