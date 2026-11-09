import { test, expect } from '@playwright/test'
import { ADMIN, login } from './helpers'

test.describe('mobile / responsive layout', () => {
  test('mobile menu opens and navigation works without horizontal overflow', async ({ page }) => {
    await login(page, ADMIN)

    const menuButton = page.locator('.mobile-menu-btn')
    await expect(menuButton).toBeVisible()
    await menuButton.click()

    const drawer = page.locator('.ant-drawer').last()
    await expect(drawer).toBeVisible()
    await drawer.getByRole('menuitem', { name: 'Expense', exact: true }).click()
    await expect(page).toHaveURL(/\/expense$/)
    await expect(page.getByRole('heading', { name: 'Expense Management', exact: true })).toBeVisible()

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }))
    console.log('MOBILE_OVERFLOW=' + JSON.stringify(overflow))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1)
  })

  test('login page fits the mobile viewport', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByPlaceholder('Enter your username')).toBeVisible()
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    console.log('MOBILE_LOGIN_OVERFLOW=' + JSON.stringify(layout))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth + 1)
  })
})
