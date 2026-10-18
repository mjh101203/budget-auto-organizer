import type { AppState, Item, PurchaseRequest, Team } from './types'
import { checkRequest, type CheckRequestDraft } from './rules'

export type Acknowledgement = PurchaseRequest['acknowledgements'][number]

export interface RequestDraftInput {
  teamId: string
  purpose: string
  items: Item[]
  shippingFee: number
  vatFee: number
  acknowledgements: Acknowledgement[]
}

export type WorkflowResult =
  | { ok: true; state: AppState; request: PurchaseRequest }
  | { ok: false; reason: string }

function padRequestId(seq: number): string {
  return `REQ-${String(seq).padStart(4, '0')}`
}

function findTeam(state: AppState, teamId: string): Team | undefined {
  return state.teams.find((team) => team.id === teamId)
}

function findRequest(state: AppState, requestId: string): PurchaseRequest | undefined {
  return state.requests.find((request) => request.id === requestId)
}

function draftOf(request: Pick<PurchaseRequest, 'items' | 'shippingFee' | 'vatFee' | 'purpose'>): CheckRequestDraft {
  return { items: request.items, shippingFee: request.shippingFee, vatFee: request.vatFee, purpose: request.purpose }
}

function hasUnacknowledgedWarning(
  findings: ReturnType<typeof checkRequest>,
  acknowledgements: Acknowledgement[],
): boolean {
  return findings.some(
    (finding) =>
      finding.severity === 'warning' &&
      !acknowledgements.some(
        (ack) => ack.ruleId === finding.ruleId && ack.itemId === finding.itemId && ack.reason.trim().length > 0,
      ),
  )
}

function replaceRequest(state: AppState, updated: PurchaseRequest): AppState {
  return { ...state, requests: state.requests.map((request) => (request.id === updated.id ? updated : request)) }
}

export function submit(state: AppState, input: RequestDraftInput, actor: string, now: string): WorkflowResult {
  const team = findTeam(state, input.teamId)
  if (!team) return { ok: false, reason: '팀을 찾을 수 없습니다' }

  const draft = draftOf(input)
  const findings = checkRequest(team, state.requests, draft)
  if (findings.some((finding) => finding.severity === 'error')) {
    return { ok: false, reason: '규정 검사에서 오류가 발견되어 제출할 수 없습니다' }
  }
  if (hasUnacknowledgedWarning(findings, input.acknowledgements)) {
    return { ok: false, reason: '경고 항목에 사유를 모두 입력해야 제출할 수 있습니다' }
  }

  const request: PurchaseRequest = {
    id: padRequestId(state.nextSeq),
    teamId: input.teamId,
    purpose: input.purpose,
    items: input.items,
    shippingFee: input.shippingFee,
    vatFee: input.vatFee,
    status: 'submitted',
    acknowledgements: input.acknowledgements,
    history: [{ at: now, actor, action: 'submit' }],
    createdAt: now,
  }

  return {
    ok: true,
    request,
    state: { ...state, requests: [...state.requests, request], nextSeq: state.nextSeq + 1 },
  }
}

export function reject(state: AppState, requestId: string, actor: string, reason: string, now: string): WorkflowResult {
  const request = findRequest(state, requestId)
  if (!request) return { ok: false, reason: '요청을 찾을 수 없습니다' }
  if (request.status !== 'submitted') return { ok: false, reason: '승인 대기 상태의 요청만 반려할 수 있습니다' }
  if (reason.trim().length === 0) return { ok: false, reason: '반려 사유를 입력해야 합니다' }

  const updated: PurchaseRequest = {
    ...request,
    status: 'rejected',
    decidedAt: now,
    decidedBy: actor,
    history: [...request.history, { at: now, actor, action: 'reject', note: reason }],
  }

  return { ok: true, request: updated, state: replaceRequest(state, updated) }
}

export function resubmit(
  state: AppState,
  requestId: string,
  input: Pick<RequestDraftInput, 'purpose' | 'items' | 'shippingFee' | 'vatFee' | 'acknowledgements'>,
  actor: string,
  now: string,
): WorkflowResult {
  const request = findRequest(state, requestId)
  if (!request) return { ok: false, reason: '요청을 찾을 수 없습니다' }
  if (request.status !== 'rejected') return { ok: false, reason: '반려 상태의 요청만 재제출할 수 있습니다' }

  const team = findTeam(state, request.teamId)
  if (!team) return { ok: false, reason: '팀을 찾을 수 없습니다' }

  const draft = draftOf(input)
  const findings = checkRequest(team, state.requests, draft, { excludeRequestId: request.id })
  if (findings.some((finding) => finding.severity === 'error')) {
    return { ok: false, reason: '규정 검사에서 오류가 발견되어 재제출할 수 없습니다' }
  }
  if (hasUnacknowledgedWarning(findings, input.acknowledgements)) {
    return { ok: false, reason: '경고 항목에 사유를 모두 입력해야 재제출할 수 있습니다' }
  }

  const updated: PurchaseRequest = {
    ...request,
    purpose: input.purpose,
    items: input.items,
    shippingFee: input.shippingFee,
    vatFee: input.vatFee,
    acknowledgements: input.acknowledgements,
    status: 'submitted',
    decidedAt: undefined,
    decidedBy: undefined,
    history: [...request.history, { at: now, actor, action: 'resubmit' }],
  }

  return { ok: true, request: updated, state: replaceRequest(state, updated) }
}

/**
 * 승인 재검사는 "그사이 다른 요청 승인으로 잔액이 바뀌었을 수 있음"만 반영한다(specs/03).
 * 즉 아직 결정되지 않은 다른 대기(submitted) 요청의 금액은 재검사에서 걷어내고,
 * 이미 승인된(approved) 요청 + 자기 자신의 내용만으로 잔액을 다시 계산한다.
 * 그래야 "두 대기 요청이 각각은 통과하지만 둘 다 승인하면 초과"인 경우
 * 먼저 승인한 쪽은 성공하고, 나중 쪽만 실패하는 specs/03 수용 기준이 성립한다.
 */
export function approve(state: AppState, requestId: string, actor: string, now: string): WorkflowResult {
  const request = findRequest(state, requestId)
  if (!request) return { ok: false, reason: '요청을 찾을 수 없습니다' }
  if (request.status !== 'submitted') return { ok: false, reason: '승인 대기 상태의 요청만 승인할 수 있습니다' }

  const team = findTeam(state, request.teamId)
  if (!team) return { ok: false, reason: '팀을 찾을 수 없습니다' }

  const recheckRequests = state.requests.filter((other) => other.status === 'approved' || other.id === request.id)
  const findings = checkRequest(team, recheckRequests, draftOf(request), { excludeRequestId: request.id })
  if (findings.some((finding) => finding.severity === 'error')) {
    return { ok: false, reason: '승인 시점 재검사에서 오류가 발견되어 승인할 수 없습니다' }
  }

  const updated: PurchaseRequest = {
    ...request,
    status: 'approved',
    decidedAt: now,
    decidedBy: actor,
    history: [...request.history, { at: now, actor, action: 'approve' }],
  }

  return { ok: true, request: updated, state: replaceRequest(state, updated) }
}
