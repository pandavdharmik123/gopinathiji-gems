import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ADMIN, login } from './helpers'

test.describe('login & session', () => {
  test('renders the login form and has no critical accessibility violations', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByPlaceholder('Enter your username')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const critical = results.violations.filter(v => v.impact === 'critical')
    const serious = results.violations.filter(v => v.impact === 'serious')
    console.log(
      'AXE_LOGIN=' +
        JSON.stringify(
          results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }))
        )
    )
    expect(critical, JSON.stringify(critical)).toEqual([])
    expect(serious, JSON.stringify(serious)).toEqual([])
  })

  test('rejects invalid credentials with an inline error', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByPlaceholder('Enter your username').fill('qa_admin')
    await page.getByPlaceholder('Password').fill('definitely-wrong')
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(page.getByText(/Invalid username or password/i)).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('logs in, loads dashboard data and survives a page reload', async ({ page }) => {
    await login(page, ADMIN)
    await expect(page.getByText(/Welcome,/)).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    console.log(
      'AXE_DASHBOARD=' +
        JSON.stringify(
          results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }))
        )
    )
    const critical = results.violations.filter(v => v.impact === 'critical')
    expect(critical, JSON.stringify(critical)).toEqual([])

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('jikadara_erp_token'))).toBeTruthy()
  })
})
