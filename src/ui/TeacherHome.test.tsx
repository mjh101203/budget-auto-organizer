import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeacherHome } from './TeacherHome'
import { createSeedState } from '../store/seed'

describe('TeacherHome', () => {
  it('REQ-0003이 승인 대기 목록에 표시되고 클릭 시 상세로 이동한다', () => {
    const state = createSeedState()
    const onOpenRequest = vi.fn()

    render(<TeacherHome state={state} onOpenRequest={onOpenRequest} />)

    const rows = screen.getAllByTestId('pending-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('REQ-0003')

    fireEvent.click(rows[0])
    expect(onOpenRequest).toHaveBeenCalledWith('REQ-0003')
  })

  it('팀별 집행률을 승인된 요청 기준으로 표시한다', () => {
    const state = createSeedState()
    render(<TeacherHome state={state} onOpenRequest={vi.fn()} />)

    // rne-3: 배정 800,000 / 승인 REQ-0001 182,300 → 23%
    expect(screen.getByTestId('execution-rate-value-rne-3')).toHaveTextContent('23%')
    // club-robot: REQ-0003은 승인대기(pending)라 approved에 안 들어가 0%
    expect(screen.getByTestId('execution-rate-value-club-robot')).toHaveTextContent('0%')
  })
})
