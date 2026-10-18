import type { AppState } from '../domain/types'
import { formatWon, itemAmount, sumWon } from '../domain/money'
import { checkRequest } from '../domain/rules'

interface Props {
  state: AppState
  onOpenRequest: (id: string) => void
}

export function TeacherHome({ state, onOpenRequest }: Props) {
  const pending = state.requests
    .filter((r) => r.status === 'submitted')
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">승인 대기 목록</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-slate-300">
            <th>팀</th>
            <th>요청번호</th>
            <th>요청일</th>
            <th>합계</th>
            <th>경고 수</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((r) => {
            const team = state.teams.find((t) => t.id === r.teamId)
            const total = sumWon(r.items.map(itemAmount)) + r.shippingFee + r.vatFee
            const warningCount = team
              ? checkRequest(team, state.requests, r, { excludeRequestId: r.id }).filter(
                  (f) => f.severity === 'warning',
                ).length
              : 0
            return (
              <tr
                key={r.id}
                data-testid="pending-row"
                className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                onClick={() => onOpenRequest(r.id)}
              >
                <td>{team?.shortName}</td>
                <td>{r.id}</td>
                <td>{r.createdAt.slice(0, 10)}</td>
                <td>{formatWon(total)}</td>
                <td>{warningCount}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
