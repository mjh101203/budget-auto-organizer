import { classifyTsvHeaderCell, detectFormat, findTsvHeaderLine } from './format'
import { extractLinks, matchLinkUrl } from './links'
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
  const consumed = new Set<number>(nameIndices)

  nameIndices.forEach((startIdx, i) => {
    const endIdx = i + 1 < nameIndices.length ? nameIndices[i + 1] : entries.length
    const nameEntry = entries[startIdx]
    const restIndices: number[] = []
    for (let idx = startIdx + 1; idx < endIdx; idx++) restIndices.push(idx)

    let spec: string | undefined
    let specIdx = -1
    if (restIndices.length > 0 && isOptionLine(entries[restIndices[0]].text)) {
      specIdx = restIndices[0]
      spec = entries[specIdx].text.replace(/^(옵션|규격)\s*[:：]\s*/, '')
      consumed.add(specIdx)
    }

    const remainingIndices = restIndices.filter((idx) => idx !== specIdx)
    const qtyIdx = remainingIndices.find((idx) => isQtyOnlyLine(entries[idx].text))
    const amountIndices = remainingIndices.filter((idx) => parseAmount(entries[idx].text) !== undefined)

    let qty: number
    if (qtyIdx !== undefined) {
      qty = parseQty(entries[qtyIdx].text) ?? 1
      consumed.add(qtyIdx)
    } else {
      qty = 1
      warnings.push({
        code: 'MISSING_QTY',
        line: nameEntry.lineNo,
        message: '수량을 찾지 못해 1로 처리했습니다',
      })
    }

    if (amountIndices.length === 0) {
      warnings.push({
        code: 'MISSING_PRICE',
        line: nameEntry.lineNo,
        message: '금액을 찾지 못했습니다',
      })
      return
    }

    const useSecond = amountIndices.length >= 2
    const unitPriceIdx = amountIndices[0]
    const amountIdx = useSecond ? amountIndices[1] : amountIndices[0]
    consumed.add(unitPriceIdx)
    consumed.add(amountIdx)

    const unitPrice = parseAmount(entries[unitPriceIdx].text) ?? 0
    const amount = useSecond ? parseAmount(entries[amountIdx].text) ?? 0 : unitPrice * qty
    const amountLineNo = entries[amountIdx].lineNo

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

  entries.forEach((entry, idx) => {
    if (consumed.has(idx)) return
    if (parseAmount(entry.text) !== undefined) {
      warnings.push({
        code: 'UNPARSED_LINE',
        line: entry.lineNo,
        message: `인식하지 못한 줄입니다 (${entry.lineNo}번째 줄)`,
      })
    }
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

function isDevicemartHeaderLine(text: string): boolean {
  return text.includes('주문상품') && text.includes('수량') && text.includes('상품금액')
}

function findDevicemartHeaderIndex(rawLines: string[]): number {
  return rawLines.findIndex(isDevicemartHeaderLine)
}

function isDevicemartIgnoredLine(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return true
  if (/^[-+=]$/.test(trimmed)) return true
  if (text.includes('마일리지')) return true
  if (text.includes('삭제')) return true
  if (trimmed === '본사') return true
  if (text.includes('택배')) return true
  if (trimmed === '변경') return true
  if (/원\s*\(선불\)|원\s*\(착불\)/.test(text)) return true
  return false
}

function collapseSpaces(text: string): string {
  return text.replace(/ {2,}/g, ' ').trim()
}

type DevicemartLabel = 'subtotal' | 'vat' | 'shipping' | 'total'

const DEVICEMART_LABELS: [RegExp, DevicemartLabel][] = [
  [/^상품\s*주문\s*금액$/, 'subtotal'],
  [/^부가세$/, 'vat'],
  [/^배송비$/, 'shipping'],
  [/^결제\s*예정금액$/, 'total'],
]

function matchDevicemartLabel(text: string): DevicemartLabel | undefined {
  const trimmed = text.trim()
  return DEVICEMART_LABELS.find(([pattern]) => pattern.test(trimmed))?.[1]
}

function parseDevicemartCart(rawLines: string[], headerIdx: number): ParseResult {
  const warnings: ParseWarning[] = []

  const totalLabelIdx = rawLines.findIndex(
    (line, idx) => idx > headerIdx && matchDevicemartLabel(line) === 'total',
  )
  let endIdx = rawLines.length - 1
  if (totalLabelIdx !== -1) {
    const valueIdx = rawLines.findIndex(
      (line, idx) => idx > totalLabelIdx && parseAmount(line) !== undefined,
    )
    if (valueIdx !== -1) endIdx = valueIdx
  }

  const rangeEntries: LineEntry[] = []
  for (let idx = headerIdx + 1; idx <= endIdx; idx++) {
    rangeEntries.push({ lineNo: idx + 1, text: rawLines[idx] })
  }
  const filtered = rangeEntries.filter((entry) => !isDevicemartIgnoredLine(entry.text))

  const items: ParsedItem[] = []
  let shippingFee = 0
  let vatFee = 0
  let declaredSubtotal: number | undefined
  let declaredTotal: number | undefined

  let i = 0
  while (i < filtered.length) {
    const entry = filtered[i]
    const label = matchDevicemartLabel(entry.text)
    if (label) {
      i++
      const valueEntry = filtered[i]
      const value = valueEntry ? parseAmount(valueEntry.text) : undefined
      if (value !== undefined) {
        if (label === 'subtotal') declaredSubtotal = value
        else if (label === 'vat') vatFee = value
        else if (label === 'shipping') shippingFee = value
        else declaredTotal = value
        i++
      }
      continue
    }

    if (entry.text.includes('\t')) {
      const name = collapseSpaces(entry.text.split('\t')[0])
      i++
      let qty = 1
      if (filtered[i] && /^\d+$/.test(filtered[i].text.trim())) {
        qty = Number(filtered[i].text.trim())
        i++
      } else {
        warnings.push({
          code: 'MISSING_QTY',
          line: entry.lineNo,
          message: '수량을 찾지 못해 1로 처리했습니다',
        })
      }

      const amountEntry = filtered[i]
      const amount = amountEntry ? parseAmount(amountEntry.text) : undefined
      if (amount === undefined) {
        warnings.push({ code: 'MISSING_PRICE', line: entry.lineNo, message: '금액을 찾지 못했습니다' })
        continue
      }
      i++

      const unitPrice = computeLineUnitPrice(amount, qty, entry.lineNo, warnings)
      items.push({ name, qty, unitPrice, amount, sourceLine: entry.lineNo })
      continue
    }

    i++
  }

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
    format: 'block',
  }
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

function applyLinks(items: ParsedItem[], html: string | undefined): void {
  if (!html) return
  const links = extractLinks(html)
  if (links.length === 0) return
  items.forEach((item) => {
    const url = matchLinkUrl(item.name, links)
    if (url) item.url = url
  })
}

export function parseCart(text: string, html?: string): ParseResult {
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

  const devicemartHeaderIdx = findDevicemartHeaderIndex(rawLines)
  if (devicemartHeaderIdx !== -1) {
    const result = parseDevicemartCart(rawLines, devicemartHeaderIdx)
    applyLinks(result.items, html)
    return result
  }

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

  applyLinks(items, html)

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
