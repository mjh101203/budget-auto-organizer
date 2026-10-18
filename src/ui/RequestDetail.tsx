import { useState } from 'react'
import type { AppState, PurchaseRequest, Team } from '../domain/types'
import { formatWon, itemAmount, sumWon } from '../domain/money'
import { generatePurchaseOrder } from '../export'
import { approve, reject } from '../domain/workflow'

interface Props {
  state: AppState
  request: PurchaseRequest
  team: Team
  isTeacher: boolean
  actor: string
  onStateChange: (state: AppState) => void
  onResubmit: () => void
  onBack: () => void
}

function statusLabel(status: PurchaseRequest['status']): string {
  if (status === 'submitted') return '승인 대기'
  if (status === 'approved') return '승인'
  return '반려'
}

export function RequestDetail({ state, request, team, isTeacher, actor, onStateChange, onResubmit, onBack }: Props) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionError, setActionError] = useState<string | undefined>(undefined)

  const total = sumWon(request.items.map(itemAmount)) + request.shippingFee + request.vatFee

  async function handleDownload() {
    const result = await generatePurchaseOrder(state, request.id, new Date())
    if (!result.ok) {
      setActionError(result.reason)
      return
    }
    const blob = new Blob([result.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleApprove() {
    const result = approve(state, request.id, actor, new Date().toISOString())
    if (!result.ok) {
      setActionError(result.reason)
      return
    }
    onStateChange(result.state)
  }

  function handleRejectConfirm() {
    const result = reject(state, request.id, actor, rejectReason, new Date().toISOString())
    if (!result.ok) {
      setActionError(result.reason)
      return
    }
    setShowRejectForm(false)
    onStateChange(result.state)
  }

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-slate-500" onClick={onBack}>
        ← 뒤로
      </button>
      <h2 className="text-xl font-bold">
        <span data-testid="request-id">{request.id}</span>{' '}
        <span data-testid="status-badge">{statusLabel(request.status)}</span>
      </h2>
      <div className="text-sm">
        팀 {team.name} · 용도 {request.purpose} · 합계 {formatWon(total)}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-slate-300">
            <th>품명</th>
            <th>규격</th>
            <th>수량</th>
            <th>단가</th>
            <th>금액</th>
            <th>예산 항목</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100">
              <td>{item.name}</td>
              <td>{item.spec ?? ''}</td>
              <td>{item.qty}</td>
              <td>{formatWon(item.unitPrice)}</td>
              <td>{formatWon(itemAmount(item))}</td>
              <td>{item.category}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {request.acknowledgements.length > 0 && (
        <div className="text-sm text-amber-700">
          경고 사유: {request.acknowledgements.map((a) => a.reason).join(', ')}
        </div>
      )}

      <div>
        <h3 className="font-semibold">이력</h3>
        <ul className="text-sm">
          {request.history.map((h, i) => (
            <li key={i}>
              {h.at.slice(0, 10)} {h.actor} {h.action}
              {h.note ? ` — ${h.note}` : ''}
            </li>
          ))}
        </ul>
      </div>

      {request.status === 'rejected' && !isTeacher && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm">
          반려 사유: {[...request.history].reverse().find((h) => h.action === 'reject')?.note ?? ''}
          <div>
            <button type="button" className="mt-2 rounded bg-sky-600 px-3 py-1 text-white" onClick={onResubmit}>
              수정 후 재제출
            </button>
          </div>
        </div>
      )}

      {request.status === 'approved' && !isTeacher && (
        <button type="button" data-testid="download-po" className="rounded bg-emerald-600 px-3 py-1 text-white" onClick={handleDownload}>
          품의서 엑셀
        </button>
      )}

      {request.status === 'submitted' && isTeacher && (
        <div className="flex gap-2">
          <button type="button" data-testid="approve-button" className="rounded bg-emerald-600 px-3 py-1 text-white" onClick={handleApprove}>
            승인
          </button>
          <button
            type="button"
            data-testid="reject-button"
            className="rounded bg-red-600 px-3 py-1 text-white"
            onClick={() => setShowRejectForm(true)}
          >
            반려
          </button>
        </div>
      )}

      {showRejectForm && (
        <div className="rounded border border-slate-300 p-2 space-y-2">
          <textarea
            data-testid="reject-reason-input"
            placeholder="반려 사유"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <button type="button" data-testid="reject-confirm" className="rounded bg-red-600 px-3 py-1 text-white" onClick={handleRejectConfirm}>
            반려 확정
          </button>
        </div>
      )}

      {actionError && <div className="text-sm text-red-600">{actionError}</div>}
    </div>
  )
}
