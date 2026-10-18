import ExcelJS from 'exceljs'
import type { AppState } from '../domain/types'
import { buildPurchaseOrderSheet } from './layouts/purchaseOrder'
import { buildBudgetStatusSheets } from './layouts/budgetStatus'

export type PurchaseOrderResult =
  | { ok: true; buffer: ArrayBuffer; filename: string }
  | { ok: false; reason: string }

export type BudgetStatusResult = { ok: true; buffer: ArrayBuffer; filename: string } | { ok: false; reason: string }

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_')
}

export async function generatePurchaseOrder(
  state: AppState,
  requestId: string,
  now: Date,
): Promise<PurchaseOrderResult> {
  const request = state.requests.find((r) => r.id === requestId)
  if (!request) return { ok: false, reason: '요청을 찾을 수 없습니다' }
  if (request.status !== 'approved') {
    return { ok: false, reason: '승인된 요청만 품의서를 생성할 수 있습니다' }
  }
  const team = state.teams.find((t) => t.id === request.teamId)
  if (!team) return { ok: false, reason: '팀을 찾을 수 없습니다' }

  const workbook = new ExcelJS.Workbook()
  buildPurchaseOrderSheet(workbook, team, request)
  const buffer = await workbook.xlsx.writeBuffer()

  const decided = request.decidedAt ? new Date(request.decidedAt) : now
  const y = decided.getFullYear()
  const m = String(decided.getMonth() + 1).padStart(2, '0')
  const d = String(decided.getDate()).padStart(2, '0')
  const filename = sanitizeFilenamePart(`품의서_${team.shortName}_${request.id}_${y}${m}${d}.xlsx`)

  return { ok: true, buffer: buffer as ArrayBuffer, filename }
}

export async function generateBudgetStatus(
  state: AppState,
  teamId: string,
  now: Date,
): Promise<BudgetStatusResult> {
  const team = state.teams.find((t) => t.id === teamId)
  if (!team) return { ok: false, reason: '팀을 찾을 수 없습니다' }

  const workbook = new ExcelJS.Workbook()
  buildBudgetStatusSheets(workbook, team, state.requests)
  const buffer = await workbook.xlsx.writeBuffer()

  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const filename = sanitizeFilenamePart(`예산현황_${team.shortName}_${y}${m}${d}.xlsx`)

  return { ok: true, buffer: buffer as ArrayBuffer, filename }
}
