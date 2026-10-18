import type { AppState, Team } from '../domain/types'
import { computeTeamBalances, totalBalance } from '../domain/budget'
import { formatWon, sumWon, itemAmount } from '../domain/money'

interface Props {
  state: AppState
  team: Team
  onNewRequest: () => void
  onOpenRequest: (id: string) => void
}

function statusLabel(status: 'submitted' | 'approved' | 'rejected'): string {
  if (status === 'submitted') return '승인 대기'
  if (status === 'approved') return '승인'
  return '반려'
}

export function StudentHome({ state, team, onNewRequest, onOpenRequest }: Props) {
  const balances = computeTeamBalances(team, state.requests)
  const total = totalBalance(balances)
  const myRequests = state.requests
    .filter((r) => r.teamId === team.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{team.name}</h2>

      <div className="rounded border border-slate-200 p-4">
        <h3 className="font-semibold mb-2">총 예산</h3>
        <div className="flex gap-6 text-sm">
          <span>배정 {formatWon(total.allocated)}</span>
          <span>승인 집행 {formatWon(total.approved)}</span>
          <span>승인 대기 {formatWon(total.pending)}</span>
          <span className="font-bold">잔액 {formatWon(total.available)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {balances.map((b) => (
          <div key={b.category} className="rounded border border-slate-200 p-3">
            <div className="font-medium mb-1">{b.category}</div>
            <div className="flex gap-3 text-sm">
              <span>승인 {formatWon(b.approved)}</span>
              <span>대기 {formatWon(b.pending)}</span>
              <span data-testid={`category-available-${b.category}`} className="font-bold">
                잔액 {formatWon(b.available)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-semibold mb-2">내 팀 요청 목록</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-slate-300">
              <th className="py-1">요청번호</th>
              <th>날짜</th>
              <th>용도</th>
              <th>합계</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {myRequests.map((r) => {
              const total = sumWon(r.items.map(itemAmount)) + r.shippingFee + r.vatFee
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                  onClick={() => onOpenRequest(r.id)}
                >
                  <td className="py-1">{r.id}</td>
                  <td>{r.createdAt.slice(0, 10)}</td>
                  <td>{r.purpose}</td>
                  <td>{formatWon(total)}</td>
                  <td>{statusLabel(r.status)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        data-testid="new-request"
        className="rounded bg-sky-600 px-4 py-2 text-white"
        onClick={onNewRequest}
      >
        새 구매 요청
      </button>
    </div>
  )
}
