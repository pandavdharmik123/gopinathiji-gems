import { test, expect, type Page } from '@playwright/test'

export const ADMIN = { username: 'qa_admin', password: 'Admin#12345' }
export const MANAGER = { username: 'qa_manager', password: 'Manager#12345' }
export const EMPLOYEE = { username: 'qa_employee', password: 'Employee#12345' }

export async function login(page: Page, who: { username: string; password: string }) {
  await page.goto('/dashboard')
  await page.getByPlaceholder('Enter your username').fill(who.username)
  await page.getByPlaceholder('Password').fill(who.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

export const NAV = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/income', label: 'Income' },
  { path: '/expense', label: 'Expense' },
  { path: '/transactions', label: 'Transactions' },
  { path: '/cashbook', label: 'Financial Years' },
  { path: '/parties', label: 'Parties / Companies' },
  { path: '/ledger', label: 'Party Ledger' },
  { path: '/reports', label: 'Reports' },
  { path: '/users', label: 'Users Management' },
  { path: '/settings', label: 'Settings' },
  { path: '/audit', label: 'Audit Logs' },
  { path: '/profile', label: 'My Profile' },
]
