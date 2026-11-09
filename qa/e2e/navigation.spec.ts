import { test, expect } from '@playwright/test'
import { ADMIN, login } from './helpers'

const PAGES: { path: string; heading?: string; text?: string }[] = [
  { path: '/dashboard', heading: 'Dashboard' },
  { path: '/calendar', text: 'Calendar' },
  { path: '/income', heading: 'Income Management' },
  { path: '/expense', heading: 'Expense Management' },
  { path: '/transactions', heading: 'Transactions' },
  { path: '/cashbook', heading: 'Financial Years Management' },
  { path: '/parties', heading: 'Parties & Companies' },
  { path: '/ledger', heading: 'Party Ledger' },
  { path: '/reports', heading: 'Reports & Analytics' },
  { path: '/users', heading: 'Users Management' },
  { path: '/settings', heading: 'Settings' },
  { path: '/audit', heading: 'Audit Logs' },
  { path: '/profile', text: 'QA Admin' },
]

test.describe('authenticated page routing', () => {
  test('every declared route renders its page without a backend error', async ({ page }) => {
    await login(page, ADMIN)

    for (const item of PAGES) {
      await page.goto(item.path)
      await expect(page).toHaveURL(new RegExp(`${item.path}$`))

      if (item.heading) {
        await expect(page.getByRole('heading', { name: item.heading, exact: true }).first()).toBeVisible()
      }
      if (item.text) {
        await expect(page.getByText(item.text, { exact: false }).first()).toBeVisible()
      }

      await expect(page.getByText('Backend data load failed')).toHaveCount(0)
      await expect(page.getByText('Something went wrong')).toHaveCount(0)
    }
  })

  test('sidebar exposes only the navigation allowed for the signed-in role', async ({ page }) => {
    await login(page, ADMIN)
    const adminNav = ['Dashboard', 'Calendar', 'Income', 'Expense', 'Transactions', 'Parties / Companies', 'Party Ledger', 'Reports', 'Financial Years', 'Audit Logs', 'Users Management', 'Settings']
    for (const label of adminNav) {
      await expect(page.getByRole('menuitem', { name: label, exact: true })).toBeVisible()
    }
  })

  test('an unknown URL renders a 404 page instead of the dashboard', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/this-route-does-not-exist')
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible()
    await expect(page.getByText('Page not found')).toBeVisible()
  })
})
