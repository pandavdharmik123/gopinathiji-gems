import { test, expect } from '@playwright/test'
import { ADMIN, login } from './helpers'

test.describe('reports module', () => {
  test('PDF export does not crash when a date preset is selected', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: 'Reports & Analytics', exact: true })).toBeVisible()

    const dateSelect = page.locator('.ant-select').filter({ hasText: 'Entire Year' }).first()
    await dateSelect.click()
    await page.getByText('This Month', { exact: false }).last().click()

    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.getByRole('button', { name: /Print \/ PDF/i }).click()
    await page.waitForTimeout(750)

    expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([])
  })

  test('income form exposes every backend-supported payment mode', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/income')
    await expect(page.getByRole('heading', { name: 'Income Management', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Add Income', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // The first Select inside the modal is the payment mode control.
    await dialog.locator('.ant-select').first().click()
    const dropdown = page.locator('.ant-select-dropdown').last()
    await expect(dropdown).toBeVisible()
    const optionText = (await dropdown.locator('.ant-select-item-option').allTextContents()).join(' | ')
    console.log('PAYMENT_OPTIONS=' + optionText)
    expect(optionText).toMatch(/UPI|યુ\.?પી/i)
    expect(optionText).toMatch(/Cheque|ચેક/i)
  })
})
