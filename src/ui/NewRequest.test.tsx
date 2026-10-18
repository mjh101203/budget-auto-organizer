import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NewRequest } from './NewRequest'
import { createSeedState } from '../store/seed'
import demoCartHtml from '../../specs/fixtures/carts/demo-cart.html?raw'
import demoCartText from '../../specs/fixtures/carts/demo-cart.txt?raw'

describe('NewRequest', () => {
  it('장바구니를 붙여넣고 인식하면 품목표와 합계, 규정 검사가 채워진다', () => {
    const state = createSeedState()
    const team = state.teams.find((t) => t.id === 'rne-3')!

    render(
      <NewRequest state={state} team={team} actor="김민준" onDone={vi.fn()} onCancel={vi.fn()} />,
    )

    const textarea = screen.getByTestId('cart-input')
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) => (type === 'text/html' ? demoCartHtml : demoCartText),
      },
    })
    fireEvent.click(screen.getByTestId('parse-button'))

    expect(screen.getAllByTestId('item-row')).toHaveLength(8)
    expect(screen.getByTestId('total-amount')).toHaveTextContent('441,000원')
    expect(screen.getAllByTestId('item-url')[0]).toHaveValue('https://shop.example/item/1')
    expect(screen.getAllByTestId('finding-error').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('finding-warning').length).toBeGreaterThan(0)
    expect(screen.getByTestId('submit-button')).toBeDisabled()
  })
})
