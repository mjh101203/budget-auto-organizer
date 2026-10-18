import ExcelJS from 'exceljs'
import type { PurchaseRequest, Team } from '../../domain/types'
import { itemAmount } from '../../domain/money'
import { computeTeamBalances, totalBalance, attributeCategory } from '../../domain/budget'
import { BUDGET_CATEGORIES } from '../../config/budget'
import { formatDate } from '../format'

const FONT_NAME = '맑은 고딕'
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } }
const BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN }
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }
const MONEY_FORMAT = '#,##0'

function moneyCell(sheet: ExcelJS.Worksheet, ref: string, value: number, bold = false): ExcelJS.Cell {
  const cell = sheet.getCell(ref)
  cell.value = value
  cell.numFmt = MONEY_FORMAT
  cell.font = { name: FONT_NAME, size: 10, bold }
  cell.border = BORDERS
  return cell
}

function headerRow(sheet: ExcelJS.Worksheet, rowNum: number, headers: string[]): void {
  headers.forEach((text, i) => {
    const cell = sheet.getRow(rowNum).getCell(i + 1)
    cell.value = text
    cell.font = { name: FONT_NAME, size: 10, bold: true }
    cell.fill = HEADER_FILL
    cell.border = BORDERS
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
}

function executionRate(approved: number, allocated: number): number | string {
  if (allocated === 0) return '-'
  return Math.round((approved / allocated) * 100)
}

export function buildBudgetStatusSheets(
  workbook: ExcelJS.Workbook,
  team: Team,
  requests: PurchaseRequest[],
): void {
  const summarySheet = workbook.addWorksheet('예산현황', {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  summarySheet.columns = [{ width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }]
  headerRow(summarySheet, 1, ['항목', '배정액', '승인 집행액', '승인 대기', '잔액', '집행률(%)'])

  const balances = computeTeamBalances(team, requests)
  balances.forEach((balance, i) => {
    const rowNum = i + 2
    const row = summarySheet.getRow(rowNum)
    row.getCell(1).value = balance.category
    row.getCell(1).font = { name: FONT_NAME, size: 10 }
    row.getCell(1).border = BORDERS
    moneyCell(summarySheet, `B${rowNum}`, balance.allocated)
    moneyCell(summarySheet, `C${rowNum}`, balance.approved)
    moneyCell(summarySheet, `D${rowNum}`, balance.pending)
    moneyCell(summarySheet, `E${rowNum}`, balance.available)
    const rateCell = summarySheet.getCell(`F${rowNum}`)
    rateCell.value = executionRate(balance.approved, balance.allocated)
    rateCell.font = { name: FONT_NAME, size: 10 }
    rateCell.border = BORDERS
  })

  const totalRowNum = balances.length + 2
  const total = totalBalance(balances)
  const totalRow = summarySheet.getRow(totalRowNum)
  totalRow.getCell(1).value = '합계'
  totalRow.getCell(1).font = { name: FONT_NAME, size: 10, bold: true }
  totalRow.getCell(1).border = BORDERS
  moneyCell(summarySheet, `B${totalRowNum}`, total.allocated, true)
  moneyCell(summarySheet, `C${totalRowNum}`, total.approved, true)
  moneyCell(summarySheet, `D${totalRowNum}`, total.pending, true)
  moneyCell(summarySheet, `E${totalRowNum}`, total.available, true)
  const totalRateCell = summarySheet.getCell(`F${totalRowNum}`)
  totalRateCell.value = executionRate(total.approved, total.allocated)
  totalRateCell.font = { name: FONT_NAME, size: 10, bold: true }
  totalRateCell.border = BORDERS

  const detailSheet = workbook.addWorksheet('집행내역', {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  detailSheet.columns = [
    { width: 12 },
    { width: 12 },
    { width: 36 },
    { width: 8 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
  ]
  headerRow(detailSheet, 1, ['요청번호', '승인일', '품명', '수량', '단가', '금액', '예산 항목'])

  const order = BUDGET_CATEGORIES[team.type]
  const approvedRequests = requests
    .filter((r) => r.teamId === team.id && r.status === 'approved')
    .sort((a, b) => (a.decidedAt ?? '').localeCompare(b.decidedAt ?? ''))

  let detailRowNum = 2
  for (const request of approvedRequests) {
    const decided = request.decidedAt ? formatDate(request.decidedAt) : ''
    for (const item of request.items) {
      const row = detailSheet.getRow(detailRowNum)
      row.getCell(1).value = request.id
      row.getCell(2).value = decided
      row.getCell(3).value = item.name
      row.getCell(4).value = item.qty
      moneyCell(detailSheet, `E${detailRowNum}`, item.unitPrice)
      moneyCell(detailSheet, `F${detailRowNum}`, itemAmount(item))
      row.getCell(7).value = item.category
      for (const col of [1, 2, 3, 4, 7]) {
        row.getCell(col).font = { name: FONT_NAME, size: 10 }
        row.getCell(col).border = BORDERS
      }
      detailRowNum++
    }
    if (request.shippingFee > 0) {
      const row = detailSheet.getRow(detailRowNum)
      row.getCell(1).value = request.id
      row.getCell(2).value = decided
      row.getCell(3).value = '배송비'
      moneyCell(detailSheet, `F${detailRowNum}`, request.shippingFee)
      row.getCell(7).value = attributeCategory(request.items, order)
      for (const col of [1, 2, 3, 7]) {
        row.getCell(col).font = { name: FONT_NAME, size: 10 }
        row.getCell(col).border = BORDERS
      }
      detailRowNum++
    }
  }
}
