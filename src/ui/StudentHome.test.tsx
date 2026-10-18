import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StudentHome } from './StudentHome'
import { createSeedState } from '../store/seed'

describe('StudentHome', () => {
  it('시드 데이터 기준 rne-3 재료비 잔액 317,700원을 표시한다', () => {
    const state = createSeedState()
    const team = state.teams.find((t) => t.id === 'rne-3')!

    render(
      <StudentHome state={state} team={team} onNewRequest={vi.fn()} onOpenRequest={vi.fn()} />,
    )

    expect(screen.getByTestId('category-available-재료비')).toHaveTextContent('317,700원')
    expect(screen.getByTestId('new-request')).toBeInTheDocument()
  })
})
