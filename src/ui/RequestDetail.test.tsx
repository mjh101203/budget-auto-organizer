import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequestDetail } from './RequestDetail'
import { createSeedState } from '../store/seed'

describe('RequestDetail', () => {
  it('반려된 REQ-0002 상세에 반려 사유를 표시한다', () => {
    const state = createSeedState()
    const request = state.requests.find((r) => r.id === 'REQ-0002')!
    const team = state.teams.find((t) => t.id === request.teamId)!

    render(
      <RequestDetail
        state={state}
        request={request}
        team={team}
        isTeacher={false}
        actor="김민준"
        onStateChange={vi.fn()}
        onResubmit={vi.fn()}
        onDuplicate={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByTestId('status-badge')).toHaveTextContent('반려')
    expect(screen.getAllByText(/도서관 소장 도서/).length).toBeGreaterThan(0)
  })

  it('승인된 REQ-0001 상세에 품의서 다운로드 버튼이 활성화된다', () => {
    const state = createSeedState()
    const request = state.requests.find((r) => r.id === 'REQ-0001')!
    const team = state.teams.find((t) => t.id === request.teamId)!

    render(
      <RequestDetail
        state={state}
        request={request}
        team={team}
        isTeacher={false}
        actor="김민준"
        onStateChange={vi.fn()}
        onResubmit={vi.fn()}
        onDuplicate={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByTestId('status-badge')).toHaveTextContent('승인')
    expect(screen.getByTestId('download-po')).toBeEnabled()
  })

  it('[지난번 주문 다시 담기] 클릭 시 onDuplicate가 호출된다', () => {
    const state = createSeedState()
    const request = state.requests.find((r) => r.id === 'REQ-0001')!
    const team = state.teams.find((t) => t.id === request.teamId)!
    const onDuplicate = vi.fn()

    render(
      <RequestDetail
        state={state}
        request={request}
        team={team}
        isTeacher={false}
        actor="김민준"
        onStateChange={vi.fn()}
        onResubmit={vi.fn()}
        onDuplicate={onDuplicate}
        onBack={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('duplicate-request'))
    expect(onDuplicate).toHaveBeenCalledTimes(1)
  })

  it('[인쇄] 클릭 시 window.print가 호출된다', () => {
    const state = createSeedState()
    const request = state.requests.find((r) => r.id === 'REQ-0001')!
    const team = state.teams.find((t) => t.id === request.teamId)!
    const printSpy = vi.fn()
    window.print = printSpy

    render(
      <RequestDetail
        state={state}
        request={request}
        team={team}
        isTeacher={false}
        actor="김민준"
        onStateChange={vi.fn()}
        onResubmit={vi.fn()}
        onDuplicate={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('print-button'))
    expect(printSpy).toHaveBeenCalledTimes(1)
  })
})
