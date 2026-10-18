import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the service name', () => {
    render(<App />)
    expect(screen.getByText('예산 자동 정리 시스템')).toBeInTheDocument()
  })
})
