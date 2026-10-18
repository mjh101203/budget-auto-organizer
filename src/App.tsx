import { useState } from 'react'
import type { AppState, PurchaseRequest } from './domain/types'
import { loadState, saveState, resetToSeed } from './store'
import { ROLE_OPTIONS, actorForRole, teamIdForRole } from './ui/roles'
import type { Role } from './ui/roles'
import { StudentHome } from './ui/StudentHome'
import { TeacherHome } from './ui/TeacherHome'
import { NewRequest } from './ui/NewRequest'
import { RequestDetail } from './ui/RequestDetail'

type Screen = 'home' | 'new-request' | 'request-detail'

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [role, setRole] = useState<Role>('student-rne')
  const [screen, setScreen] = useState<Screen>('home')
  const [currentRequestId, setCurrentRequestId] = useState<string | undefined>(undefined)
  const [resubmitTarget, setResubmitTarget] = useState<PurchaseRequest | undefined>(undefined)

  function applyState(next: AppState) {
    saveState(next)
    setState(next)
  }

  function handleRoleChange(next: Role) {
    setRole(next)
    setScreen('home')
    setCurrentRequestId(undefined)
    setResubmitTarget(undefined)
  }

  function handleResetDemo() {
    const seeded = resetToSeed()
    setState(seeded)
    setScreen('home')
    setCurrentRequestId(undefined)
    setResubmitTarget(undefined)
  }

  const actor = actorForRole(role)
  const teamId = teamIdForRole(role)
  const team = teamId ? state.teams.find((t) => t.id === teamId) : undefined
  const currentRequest = currentRequestId ? state.requests.find((r) => r.id === currentRequestId) : undefined
  const currentRequestTeam = currentRequest ? state.teams.find((t) => t.id === currentRequest.teamId) : undefined

  function openRequest(id: string) {
    setCurrentRequestId(id)
    setScreen('request-detail')
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">예산 자동 정리 시스템</h1>
        <select
          data-testid="role-select"
          className="border border-slate-300 rounded px-2 py-1"
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as Role)}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1">
        {screen === 'home' && role === 'teacher' && (
          <TeacherHome state={state} onOpenRequest={openRequest} />
        )}
        {screen === 'home' && role !== 'teacher' && team && (
          <StudentHome
            state={state}
            team={team}
            onNewRequest={() => {
              setResubmitTarget(undefined)
              setScreen('new-request')
            }}
            onOpenRequest={openRequest}
          />
        )}
        {screen === 'new-request' && team && (
          <NewRequest
            state={state}
            team={team}
            actor={actor}
            existingRequest={resubmitTarget}
            onDone={(next, requestId) => {
              applyState(next)
              setResubmitTarget(undefined)
              setCurrentRequestId(requestId)
              setScreen('request-detail')
            }}
            onCancel={() => setScreen('home')}
          />
        )}
        {screen === 'request-detail' && currentRequest && currentRequestTeam && (
          <RequestDetail
            state={state}
            request={currentRequest}
            team={currentRequestTeam}
            isTeacher={role === 'teacher'}
            actor={actor}
            onStateChange={applyState}
            onResubmit={() => {
              setResubmitTarget(currentRequest)
              setScreen('new-request')
            }}
            onBack={() => setScreen('home')}
          />
        )}
      </div>

      <div>
        <button
          type="button"
          data-testid="reset-demo"
          className="text-sm text-slate-500 underline"
          onClick={handleResetDemo}
        >
          데모 초기화
        </button>
      </div>
    </div>
  )
}

export default App
