import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(here, '../specs/fixtures/carts')
const cartText = readFileSync(path.join(fixturesDir, 'demo-cart.txt'), 'utf-8')
const cartHtml = readFileSync(path.join(fixturesDir, 'demo-cart.html'), 'utf-8')

async function pasteCart(page: Page, text: string, html: string) {
  await page.getByTestId('cart-input').evaluate(
    (el, { text, html }) => {
      const win = globalThis as unknown as {
        DataTransfer: new () => { setData: (type: string, value: string) => void }
        ClipboardEvent: new (type: string, init: Record<string, unknown>) => Event
      }
      const dt = new win.DataTransfer()
      dt.setData('text/plain', text)
      dt.setData('text/html', html)
      const event = new win.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      el.dispatchEvent(event)
    },
    { text, html },
  )
}

test('데모 시나리오: 장바구니 붙여넣기 → 제출 → 승인 → 품의서 다운로드', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('reset-demo').click()

  // 1. 학생 김민준 (R&E 3팀) 홈 — 재료비 잔액 317,700원
  await expect(page.getByTestId('category-available-재료비')).toContainText('317,700원')

  // 2. 새 구매 요청 → 장바구니 붙여넣기(텍스트+HTML) → 인식
  await page.getByTestId('new-request').click()
  await pasteCart(page, cartText, cartHtml)
  await page.getByTestId('parse-button').click()

  const itemRows = page.getByTestId('item-row')
  await expect(itemRows).toHaveCount(8)
  await expect(page.getByTestId('shipping-fee')).toHaveValue('3000')
  await expect(page.getByTestId('total-amount')).toContainText('441,000원')
  for (const url of await page.getByTestId('item-url').all()) {
    await expect(url).not.toHaveValue('')
  }

  // 3. 규정 검사: R1 error + R3 warning, 제출 비활성
  await expect(page.getByTestId('finding-error').filter({ hasText: '재료비 잔액 초과 (84,700원 초과)' })).toBeVisible()
  await expect(page.getByTestId('finding-warning')).toContainText('단가 329,000원')
  await expect(page.getByTestId('submit-button')).toBeDisabled()

  // 4. 오실로스코프 행 삭제(장바구니 8번째 품목) → 오류·경고 사라짐, 합계 112,000원
  await itemRows.nth(7).getByTestId('item-delete').click()
  await expect(page.getByTestId('finding-error').filter({ hasText: '재료비 잔액 초과' })).toHaveCount(0)
  await expect(page.getByTestId('finding-warning')).toHaveCount(0)
  await expect(page.getByTestId('total-amount')).toContainText('112,000원')

  await page.getByTestId('purpose-input').fill('토양 수분 자동 관수 시제품 제작')
  await expect(page.getByTestId('finding-error')).toHaveCount(0)
  await expect(page.getByTestId('submit-button')).toBeEnabled()
  await page.getByTestId('submit-button').click()

  await expect(page.getByTestId('request-id')).toContainText('REQ-0004')
  await expect(page.getByTestId('status-badge')).toContainText('승인 대기')

  // 5. 역할 교사 최윤서 → 승인 대기 목록 → REQ-0004 → 승인
  await page.getByTestId('role-select').selectOption('teacher')
  const pendingRow = page.getByTestId('pending-row').filter({ hasText: 'REQ-0004' })
  await expect(pendingRow).toBeVisible()
  await pendingRow.click()
  await expect(page.getByTestId('request-id')).toContainText('REQ-0004')
  await page.getByTestId('approve-button').click()
  await expect(page.getByTestId('status-badge')).toContainText('승인')

  // 6. 학생으로 복귀 → REQ-0004 승인, 재료비 잔액 244,300원 → 품의서 엑셀 다운로드
  await page.getByTestId('role-select').selectOption('student-rne')
  await expect(page.getByTestId('category-available-재료비')).toContainText('244,300원')
  await page.getByText('REQ-0004').click()
  await expect(page.getByTestId('status-badge')).toContainText('승인')

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('download-po').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
})
