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

  it('UNPARSED_LINE 경고에 원문과 [품목으로 추가] 버튼이 나오고 클릭하면 품목 행이 추가된다', () => {
    const state = createSeedState()
    const team = state.teams.find((t) => t.id === 'rne-3')!

    render(
      <NewRequest state={state} team={team} actor="김민준" onDone={vi.fn()} onCancel={vi.fn()} />,
    )

    const textarea = screen.getByTestId('cart-input')
    const cartText = '12,000원\n브레드보드\n수량 1\n12,000원'
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? cartText : ''),
      },
    })
    fireEvent.click(screen.getByTestId('parse-button'))

    expect(screen.getAllByTestId('item-row')).toHaveLength(1)
    expect(screen.getByTestId('unparsed-line-text')).toHaveTextContent('12,000원')
    fireEvent.click(screen.getByTestId('add-unparsed-line'))

    expect(screen.getAllByTestId('item-row')).toHaveLength(2)
    expect(screen.queryByTestId('add-unparsed-line')).not.toBeInTheDocument()
  })
})
