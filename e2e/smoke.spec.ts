import { expect, test } from '@playwright/test'

test('홈 화면에 서비스명이 보인다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('예산 자동 정리 시스템')).toBeVisible()
})
