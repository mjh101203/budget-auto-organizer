import ExcelJS from 'exceljs'
import type { PurchaseRequest, Team } from '../../domain/types'
import { itemAmount, sumWon, formatWon } from '../../domain/money'
import { attributeCategory, requestCategoryTotals } from '../../domain/budget'
import { BUDGET_CATEGORIES, BUDGET_TYPE_LABELS } from '../../config/budget'
import { distributeVat } from '../vat'
import { formatDate } from '../format'

const FONT_NAME = '맑은 고딕'
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } }
const BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN }
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
const MONEY_FORMAT = '#,##0'

function moneyCell(sheet: ExcelJS.Worksheet, ref: string, value: number): ExcelJS.Cell {
  const cell = sheet.getCell(ref)
  cell.value = value
  cell.numFmt = MONEY_FORMAT
  cell.font = { name: FONT_NAME, size: 10 }
  cell.border = BORDERS
  return cell
}

function submitActor(request: PurchaseRequest, fallback: string): string {
  const submit = [...request.history].reverse().find((h) => h.action === 'submit' || h.action === 'resubmit')
  return submit?.actor ?? fallback
}

export function buildPurchaseOrderSheet(
  workbook: ExcelJS.Workbook,
  team: Team,
  request: PurchaseRequest,
): void {
  const sheet = workbook.addWorksheet('구매품의서', {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  sheet.columns = [
    { width: 6 },
    { width: 40 },
    { width: 12 },
    { width: 6 },
    { width: 16 },
    { width: 16 },
    { width: 38 },
    { width: 12 },
    { width: 30 },
  ]

  sheet.mergeCells('A1:I1')
  const title = sheet.getCell('A1')
  title.value = '물품 구매 품의서'
  title.font = { name: FONT_NAME, size: 16, bold: true }
  title.alignment = { horizontal: 'center', vertical: 'middle' }

  const order = BUDGET_CATEGORIES[team.type]

  const row3 = sheet.getRow(3)
  row3.getCell(1).value = '요청번호'
  row3.getCell(2).value = request.id
  row3.getCell(3).value = '요청일'
  row3.getCell(4).value = formatDate(request.createdAt)
  row3.getCell(5).value = '예산 구분'
  row3.getCell(6).value = BUDGET_TYPE_LABELS[team.type]

  const row4 = sheet.getRow(4)
  row4.getCell(1).value = '팀명'
  row4.getCell(2).value = team.name
  row4.getCell(3).value = '요청자'
  row4.getCell(4).value = submitActor(request, team.leader)
  row4.getCell(5).value = '지도교사'
  row4.getCell(6).value = team.advisor

  sheet.getCell('A5').value = '용도'
  sheet.mergeCells('B5:I5')
  sheet.getCell('B5').value = request.purpose

  const headerRow = 7
  const headers = ['연번', '상품명', '단품 가격', '수량', '총 가격(VAT 포함)', '옵션', '링크', '예산 항목', '비고']
  headers.forEach((text, i) => {
    const cell = sheet.getRow(headerRow).getCell(i + 1)
    cell.value = text
    cell.font = { name: FONT_NAME, size: 10, bold: true }
    cell.fill = HEADER_FILL
    cell.border = BORDERS
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  const itemAmounts = request.items.map((item) => itemAmount(item))
  const vatShares = distributeVat(itemAmounts, request.vatFee)

  const itemsStartRow = headerRow + 1
  request.items.forEach((item, i) => {
    const rowNum = itemsStartRow + i
    const row = sheet.getRow(rowNum)
    const reason = request.acknowledgements.find((a) => a.itemId === item.id)?.reason ?? ''

    row.getCell(1).value = i + 1
    row.getCell(2).value = item.name
    moneyCell(sheet, `C${rowNum}`, item.unitPrice)
    row.getCell(4).value = item.qty
    moneyCell(sheet, `E${rowNum}`, itemAmounts[i] + vatShares[i])
    row.getCell(6).value = item.spec ?? ''
    const linkCell = row.getCell(7)
    if (item.url) {
      linkCell.value = { text: item.url, hyperlink: item.url }
    }
    row.getCell(8).value = item.category
    row.getCell(9).value = reason

    for (let col = 1; col <= 9; col++) {
      row.getCell(col).font = row.getCell(col).font ?? { name: FONT_NAME, size: 10 }
      row.getCell(col).border = BORDERS
    }
  })

  const itemsEndRow = itemsStartRow + request.items.length - 1
  const shippingRow = itemsEndRow + 1
  const totalRow = shippingRow + 1

  const attributed = attributeCategory(request.items, order)

  sheet.mergeCells(`A${shippingRow}:D${shippingRow}`)
  sheet.getCell(`A${shippingRow}`).value = '배송비'
  sheet.getCell(`A${shippingRow}`).font = { name: FONT_NAME, size: 10 }
  moneyCell(sheet, `E${shippingRow}`, request.shippingFee)
  sheet.getCell(`H${shippingRow}`).value = attributed
  sheet.getCell(`H${shippingRow}`).font = { name: FONT_NAME, size: 10 }

  sheet.mergeCells(`A${totalRow}:D${totalRow}`)
  sheet.getCell(`A${totalRow}`).value = '합계'
  sheet.getCell(`A${totalRow}`).font = { name: FONT_NAME, size: 10, bold: true }
  const totalResult = sumWon(itemAmounts) + sumWon(vatShares) + request.shippingFee
  const totalCell = sheet.getCell(`E${totalRow}`)
  totalCell.value = { formula: `SUM(E${itemsStartRow}:E${shippingRow})`, result: totalResult }
  totalCell.numFmt = MONEY_FORMAT
  totalCell.font = { name: FONT_NAME, size: 10, bold: true }
  totalCell.border = BORDERS

  const totals = requestCategoryTotals(request, order)
  const subtotalText =
    '항목별 소계: ' +
    order
      .filter((category) => (totals[category] ?? 0) > 0)
      .map((category) => `${category} ${formatWon(totals[category]).replace('원', '')}`)
      .join(' / ')

  const subtotalRow = totalRow + 2
  sheet.mergeCells(`A${subtotalRow}:I${subtotalRow}`)
  sheet.getCell(`A${subtotalRow}`).value = subtotalText
  sheet.getCell(`A${subtotalRow}`).font = { name: FONT_NAME, size: 10 }

  const signRow = subtotalRow + 2
  const row = sheet.getRow(signRow)
  row.getCell(1).value = '결재'
  row.getCell(2).value = `담당(학생) ${submitActor(request, team.leader)}`
  row.getCell(3).value = '지도교사'
  row.getCell(4).value = team.advisor
  row.getCell(5).value = '승인일'
  row.getCell(6).value = request.decidedAt ? formatDate(request.decidedAt) : ''
  for (let col = 1; col <= 6; col++) {
    row.getCell(col).font = { name: FONT_NAME, size: 10 }
  }
}
