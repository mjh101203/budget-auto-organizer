import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the service name', () => {
    render(<App />)
    expect(screen.getByText('예산 자동 정리 시스템')).toBeInTheDocument()
  })

  it('역할을 학생에서 교사로 전환하면 화면이 바뀐다', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /R&E 3팀/ })).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('role-select'), { target: { value: 'teacher' } })

    expect(screen.getByText('승인 대기 목록')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /R&E 3팀/ })).not.toBeInTheDocument()
  })

  it('역할을 다른 학생 팀으로 전환하면 해당 팀 홈이 보인다', () => {
    render(<App />)
    fireEvent.change(screen.getByTestId('role-select'), { target: { value: 'student-club' } })
    expect(screen.getByRole('heading', { name: /로봇공학 동아리/ })).toBeInTheDocument()
  })
})
