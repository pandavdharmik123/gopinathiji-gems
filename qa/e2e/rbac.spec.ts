import { test, expect } from '@playwright/test'
import { EMPLOYEE, login } from './helpers'

test.describe('role-based route enforcement (UI)', () => {
  test('employee cannot open admin-only pages by typing the URL', async ({ page }) => {
    await login(page, EMPLOYEE)

    // The sidebar hides these, but direct URL access must also be denied.
    await page.goto('/users')
    await page.waitForTimeout(1000)

    const denied = page.getByText(/access denied|forbidden|not authori[sz]ed|permission/i)
    const dashboard = page.getByRole('heading', { name: 'Dashboard', exact: true })
    await expect(denied.or(dashboard).first()).toBeVisible()
  })

  test('employee direct URL to settings does not expose admin settings', async ({ page }) => {
    await login(page, EMPLOYEE)
    await page.goto('/settings')
    await page.waitForTimeout(1000)

    const denied = page.getByText(/access denied|forbidden|not authori[sz]ed|permission/i)
    const dashboard = page.getByRole('heading', { name: 'Dashboard', exact: true })
    await expect(denied.or(dashboard).first()).toBeVisible()
  })

  test('employee sidebar hides admin-only entries', async ({ page }) => {
    await login(page, EMPLOYEE)
    await expect(page.getByRole('menuitem', { name: 'Income', exact: true })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Users Management', exact: true })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Audit Logs', exact: true })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Transactions', exact: true })).toHaveCount(0)
  })
})
