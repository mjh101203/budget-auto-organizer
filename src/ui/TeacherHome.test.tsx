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
})
