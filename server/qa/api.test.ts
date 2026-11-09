import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import * as jwt from 'jsonwebtoken'
import { generate } from 'otplib'
import { BASE, QA_DB_URL, req, login, startServer, stopServer, getServerLogs } from './harness'

const prisma = new PrismaClient({ datasources: { db: { url: QA_DB_URL } } })

const tokens: Record<'admin' | 'manager' | 'employee', string> = { admin: '', manager: '', employee: '' }
const ids: Record<string, string> = {}
const created = {
  transactions: new Set<string>(),
  parties: new Set<string>(),
  users: new Set<string>(),
  years: new Set<string>(),
  categories: new Set<string>(),
  notifications: new Set<string>(),
  backupRuns: new Set<string>(),
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function reqForm(route: string, form: FormData, token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${route}`, { method: 'POST', headers, body: form })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* binary */ }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers }
}

async function createTxn(body: Record<string, unknown>, token = tokens.admin) {
  const res = await req('POST', '/api/transactions', { token, body })
  if (res.status === 201 && res.json?.data?.id) created.transactions.add(res.json.data.id)
  return res
}

beforeAll(async () => {
  await startServer()
  const [a, m, e] = await Promise.all([
    login('qa_admin', 'Admin#12345'),
    login('qa_manager', 'Manager#12345'),
    login('qa_employee', 'Employee#12345'),
  ])
  expect(a.status, a.text).toBe(200)
  expect(m.status, m.text).toBe(200)
  expect(e.status, e.text).toBe(200)
  tokens.admin = a.json.token
  tokens.manager = m.json.token
  tokens.employee = e.json.token

  const parties = await req('GET', '/api/parties', { token: tokens.admin })
  for (const p of parties.json.data) {
    if (p.name === 'QA Alpha Traders') ids.alpha = p.id
    if (p.name === 'QA Beta Suppliers') ids.beta = p.id
    if (p.name === 'QA Gamma Exports') ids.gamma = p.id
  }
  const years = await req('GET', '/api/accounting-years', { token: tokens.admin })
  const active = years.json.data.find((y: any) => y.status === 'active')
  ids.year = active.id
})

afterAll(async () => {
  try {
    await prisma.transaction.deleteMany({ where: { id: { in: [...created.transactions] } } })
    await prisma.party.deleteMany({ where: { id: { in: [...created.parties] } } })
    await prisma.accountingYear.deleteMany({ where: { id: { in: [...created.years] } } })
    await prisma.expenseCategory.deleteMany({ where: { id: { in: [...created.categories] } } })
    await prisma.user.deleteMany({ where: { id: { in: [...created.users] } } })
    await prisma.backupRun.deleteMany({ where: { id: { in: [...created.backupRuns] } } })
    await prisma.notification.deleteMany({ where: { id: { in: [...created.notifications] } } })
  } catch (e) {
    console.error('cleanup warning', e)
  }
  await prisma.$disconnect()
  await stopServer()
  if (process.env.QA_DEBUG_SERVER === '1') console.log(getServerLogs())
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. Authentication & session
// ─────────────────────────────────────────────────────────────────────────────
describe('auth & session', () => {
  it('logs in a valid admin and returns a signed JWT + safe user', async () => {
    const res = await login('qa_admin', 'Admin#12345')
    expect(res.status).toBe(200)
    expect(res.json.success).toBe(true)
    expect(typeof res.json.token).toBe('string')
    expect(res.json.user.role).toBe('admin')
    expect(res.json.user.passwordHash).toBeUndefined()
    expect(res.json.user.pinHash).toBeUndefined()
  })

  it('rejects a wrong password with 401 (no user enumeration)', async () => {
    const res = await login('qa_admin', 'wrong-password')
    expect(res.status).toBe(401)
    expect(res.json.message).toBe('Invalid username or password')
  })

  it('rejects an unknown username with the same 401 message', async () => {
    const res = await login('no_such_user_xyz', 'whatever')
    expect(res.status).toBe(401)
    expect(res.json.message).toBe('Invalid username or password')
  })

  it('rejects an inactive account with 401', async () => {
    const res = await login('qa_inactive', 'Inactive#12345')
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing password (schema validation)', async () => {
    const res = await req('POST', '/api/auth/login', { body: { username: 'qa_admin' } })
    expect(res.status).toBe(400)
    expect(res.json.errors).toBeTruthy()
  })

  it('returns 400 for malformed login JSON', async () => {
    const res = await req('POST', '/api/auth/login', { rawBody: '{bad json' })
    expect(res.status).toBe(400)
  })

  it('returns 401 for /auth/me without a token', async () => {
    const res = await req('GET', '/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 for a malformed token', async () => {
    const res = await req('GET', '/api/auth/me', { token: 'not.a.jwt' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ userId: ids.alpha, username: 'qa_admin', role: 'admin' }, 'attacker-secret', { expiresIn: '1h' })
    const res = await req('GET', '/api/auth/me', { token: forged })
    expect(res.status).toBe(401)
  })

  it('returns the current user for a valid token', async () => {
    const res = await req('GET', '/api/auth/me', { token: tokens.employee })
    expect(res.status).toBe(200)
    expect(res.json.user.username).toBe('qa_employee')
    expect(res.json.user.role).toBe('employee')
    expect(res.json.user.passwordHash).toBeUndefined()
    expect(res.json.user.pinHash).toBeUndefined()
    expect(res.json.user.hasPin).toBe(false)
  })

  it('rejects a 2FA verification call with an invalid temp token', async () => {
    const res = await req('POST', '/api/auth/login/2fa', { body: { tempToken: 'garbage', code: '123456' } })
    expect(res.status).toBe(401)
  })

  it('rejects an email-OTP send with an invalid temp token', async () => {
    const res = await req('POST', '/api/auth/login/2fa/send-email-otp', { body: { tempToken: 'garbage' } })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Security headers & CORS
// ─────────────────────────────────────────────────────────────────────────────
describe('transport security', () => {
  it('sets Helmet security headers', async () => {
    const res = await req('GET', '/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBeTruthy()
    expect(res.headers.get('strict-transport-security')).toBeTruthy()
    expect(res.headers.get('content-security-policy')).toBeTruthy()
  })

  it('allows the configured frontend origin via CORS', async () => {
    const res = await req('OPTIONS', '/api/auth/login', {
      headers: {
        Origin: 'http://localhost:8443',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    expect(res.status).toBeLessThan(300)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8443')
  })

  it('does not reflect an unknown origin', async () => {
    const res = await req('GET', '/health', { headers: { Origin: 'http://evil.example' } })
    expect(res.headers.get('access-control-allow-origin')).not.toBe('http://evil.example')
  })

  it('returns JSON 404 for unknown routes', async () => {
    const res = await req('GET', '/api/definitely-not-a-route')
    expect(res.status).toBe(404)
    expect(res.json.success).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Financial accuracy against the deterministic seed
// ─────────────────────────────────────────────────────────────────────────────
describe('financial accuracy (seeded fixture)', () => {
  it('summary: cash balance = opening 100000 + (income 39000 - expense 22000)', async () => {
    const res = await req('GET', '/api/reports/summary', { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(res.json.data.cashBalance).toBe(117000)
    expect(res.json.data.totalParties).toBe(3)
    expect(res.json.data.today.income).toBe(0)
    expect(res.json.data.today.expense).toBe(0)
  })

  it('monthly April 2026: income 25000, expense 17000, profit 8000', async () => {
    const res = await req('GET', '/api/reports/monthly?month=2026-04', { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(res.json.data.income).toBe(25000)
    expect(res.json.data.expense).toBe(17000)
    expect(res.json.data.profit).toBe(8000)
    expect(res.json.data.transactions).toHaveLength(4)
  })

  it('monthly May 2026: income 14000, expense 5000, profit 9000', async () => {
    const res = await req('GET', '/api/reports/monthly?month=2026-05', { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(res.json.data.income).toBe(14000)
    expect(res.json.data.expense).toBe(5000)
    expect(res.json.data.profit).toBe(9000)
  })

  it('yearly 2026: totals and 12 month buckets are exact', async () => {
    const res = await req('GET', '/api/reports/yearly?year=2026', { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(res.json.data.totalIncome).toBe(39000)
    expect(res.json.data.totalExpense).toBe(22000)
    expect(res.json.data.netProfit).toBe(17000)
    expect(res.json.data.monthly).toHaveLength(12)
    expect(res.json.data.monthly[3]).toMatchObject({ month: '2026-04', income: 25000, expense: 17000 })
    expect(res.json.data.monthly[4]).toMatchObject({ month: '2026-05', income: 14000, expense: 5000 })
  })

  it('by-category expense totals match', async () => {
    const res = await req('GET', '/api/reports/by-category?type=expense', { token: tokens.admin })
    expect(res.status).toBe(200)
    const map = Object.fromEntries(res.json.data.map((r: any) => [r.category, r.total]))
    expect(map.Hotel).toBe(5000)
    expect(map.Logistic).toBe(12000)
    expect(map.Ticket).toBe(3000)
    expect(map.Other).toBe(2000)
  })

  it('party ledger: Alpha credit 25000, debit 7000, net 18000', async () => {
    const res = await req('GET', `/api/reports/party/${ids.alpha}`, { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(res.json.data.totalCredit).toBe(25000)
    expect(res.json.data.totalDebit).toBe(7000)
    expect(res.json.data.netBalance).toBe(18000)
    expect(res.json.data.ledger).toHaveLength(4)
    expect(res.json.data.ledger[3].balance).toBe(18000)
  })

  it('party list balances are correct all-time (Alpha 18000, Beta -8000)', async () => {
    const res = await req('GET', '/api/parties', { token: tokens.admin })
    const alpha = res.json.data.find((p: any) => p.id === ids.alpha)
    const beta = res.json.data.find((p: any) => p.id === ids.beta)
    expect(alpha.balance).toBe(18000)
    expect(beta.balance).toBe(-8000)
  })

  it('outstanding report is scoped to the active accounting year (expected)', async () => {
    const res = await req('GET', '/api/reports/outstanding', { token: tokens.admin })
    const gamma = res.json.data.find((p: any) => p.id === ids.gamma)
    expect(res.status).toBe(200)
    // FY 2026-27 scope: 10000 - 3000 = 7000. Prior-year 99999 must NOT leak in.
    expect(gamma.net).toBe(7000)
  })

  it('transactions date range includes both boundary days', async () => {
    const res = await req('GET', '/api/transactions?dateFrom=2026-05-01&dateTo=2026-05-01', { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(res.json.data).toHaveLength(1)
    expect(res.json.data[0].voucherNo).toBe('INC-003')
  })

  it('API serialises Decimal amounts as strings (frontend normalises)', async () => {
    const res = await req('GET', '/api/transactions?limit=1', { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(typeof res.json.data[0].amount).toBe('string')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Input validation
// ─────────────────────────────────────────────────────────────────────────────
describe('transaction validation', () => {
  const base = { date: '2026-06-01', type: 'income', amount: 100, paymentMode: 'cash', category: 'Travel', description: 'qa' }

  it('rejects a negative amount', async () => {
    const res = await req('POST', '/api/transactions', { token: tokens.admin, body: { ...base, amount: -5 } })
    expect(res.status).toBe(400)
  })

  it('rejects a zero amount', async () => {
    const res = await req('POST', '/api/transactions', { token: tokens.admin, body: { ...base, amount: 0 } })
    expect(res.status).toBe(400)
  })

  it('rejects a missing amount', async () => {
    const res = await req('POST', '/api/transactions', { token: tokens.admin, body: { ...base, amount: undefined } })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid transaction type', async () => {
    const res = await req('POST', '/api/transactions', { token: tokens.admin, body: { ...base, type: 'refund' } })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid payment mode', async () => {
    const res = await req('POST', '/api/transactions', { token: tokens.admin, body: { ...base, paymentMode: 'card' } })
    expect(res.status).toBe(400)
  })

  it('rejects a missing date', async () => {
    const res = await req('POST', '/api/transactions', { token: tokens.admin, body: { ...base, date: undefined } })
    expect(res.status).toBe(400)
  })

  it('rejects a non-date date string with 400 (not 500)', async () => {
    const res = await req('POST', '/api/transactions', { token: tokens.admin, body: { ...base, date: 'not-a-date' } })
    expect(res.status).toBe(400)
  })

  it('rejects an impossible calendar date 2026-04-31 with 400', async () => {
    const res = await createTxn({ ...base, date: '2026-04-31', amount: 777 })
    expect(res.status).toBe(400)
  })

  it('rejects a non-existent partyId with 400/404 (not 500)', async () => {
    const res = await createTxn({ ...base, partyId: 'does-not-exist', amount: 888 })
    expect([400, 404, 422]).toContain(res.status)
  })

  it('rejects an amount that overflows Decimal(15,2)', async () => {
    const res = await createTxn({ ...base, amount: 99999999999999.99 })
    expect(res.status).toBe(400)
  })

  it('rejects more than 2 decimal places for currency', async () => {
    const res = await createTxn({ ...base, amount: 10.999 })
    expect(res.status).toBe(400)
  })

  it('caps the page size to prevent unbounded queries', async () => {
    const res = await req('GET', '/api/transactions?limit=100000', { token: tokens.admin })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid dateFrom query parameter with 400', async () => {
    const res = await req('GET', '/api/transactions?dateFrom=garbage', { token: tokens.admin })
    expect(res.status).toBe(400)
  })

  it('strips unknown fields instead of persisting them', async () => {
    const res = await createTxn({ ...base, category: 'Travel', amount: 111, isAdmin: true, role: 'admin' })
    expect(res.status).toBe(201)
    expect(res.json.data.isAdmin).toBeUndefined()
    expect(res.json.data.role).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. RBAC & authorisation
// ─────────────────────────────────────────────────────────────────────────────
describe('RBAC', () => {
  it('employee cannot list users (403)', async () => {
    const res = await req('GET', '/api/users', { token: tokens.employee })
    expect(res.status).toBe(403)
  })

  it('manager cannot list users (403)', async () => {
    const res = await req('GET', '/api/users', { token: tokens.manager })
    expect(res.status).toBe(403)
  })

  it('admin can list users (200) without hashes', async () => {
    const res = await req('GET', '/api/users', { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.json.data)).toBe(true)
    for (const u of res.json.data) {
      expect(u.passwordHash).toBeUndefined()
      expect(u.pinHash).toBeUndefined()
    }
  })

  it('employee cannot read audit logs (403)', async () => {
    const res = await req('GET', '/api/audit-logs', { token: tokens.employee })
    expect(res.status).toBe(403)
  })

  it('manager cannot read audit logs (403)', async () => {
    const res = await req('GET', '/api/audit-logs', { token: tokens.manager })
    expect(res.status).toBe(403)
  })

  it('employee cannot update settings (403)', async () => {
    const res = await req('PUT', '/api/settings', { token: tokens.employee, body: { name: 'Hacked' } })
    expect(res.status).toBe(403)
  })

  it('manager cannot update settings (403)', async () => {
    const res = await req('PUT', '/api/settings', { token: tokens.manager, body: { name: 'Hacked' } })
    expect(res.status).toBe(403)
  })

  it('admin can update settings', async () => {
    const res = await req('PUT', '/api/settings', { token: tokens.admin, body: { name: 'Gopinathji Gems QA' } })
    expect(res.status).toBe(200)
    expect(res.json.data.name).toBe('Gopinathji Gems QA')
  })

  it('employee cannot create an expense category (403)', async () => {
    const res = await req('POST', '/api/expense-categories', { token: tokens.employee, body: { name: 'QA Employee Cat' } })
    expect(res.status).toBe(403)
  })

  it('admin category creation uses standard HTTP 201', async () => {
    const name = `QA Cat ${Date.now()}`
    const res = await req('POST', '/api/expense-categories', { token: tokens.admin, body: { name } })
    if (res.json?.data?.id) created.categories.add(res.json.data.id)
    expect(res.status).toBe(201)
  })

  it('employee cannot create a party (403)', async () => {
    const res = await req('POST', '/api/parties', { token: tokens.employee, body: { name: 'QA Employee Party', category: 'Customer' } })
    expect(res.status).toBe(403)
  })

  it('manager can create a party; manager cannot delete it; admin can', async () => {
    const create = await req('POST', '/api/parties', { token: tokens.manager, body: { name: `QA Party ${Date.now()}`, category: 'Customer' } })
    expect(create.status).toBe(201)
    const id = create.json.data.id
    created.parties.add(id)
    const delManager = await req('DELETE', `/api/parties/${id}`, { token: tokens.manager })
    expect(delManager.status).toBe(403)
    const delAdmin = await req('DELETE', `/api/parties/${id}`, { token: tokens.admin })
    expect(delAdmin.status).toBe(200)
  })

  it('employee can create a transaction (data entry allowed)', async () => {
    const res = await createTxn({ date: '2026-06-02', type: 'income', amount: 1234, paymentMode: 'cash', category: 'Travel', description: 'employee entry' }, tokens.employee)
    expect(res.status).toBe(201)
  })

  it('employee cannot edit a transaction (403) — backend vs UI mismatch', async () => {
    const txn = [...created.transactions][0]
    const res = await req('PUT', `/api/transactions/${txn}`, { token: tokens.employee, body: { amount: 1 } })
    expect(res.status).toBe(403)
  })

  it('manager can edit a transaction', async () => {
    const txn = [...created.transactions][0]
    const res = await req('PUT', `/api/transactions/${txn}`, { token: tokens.manager, body: { description: 'manager edit' } })
    expect(res.status).toBe(200)
    expect(res.json.data.description).toBe('manager edit')
  })

  it('employee cannot delete a transaction (403)', async () => {
    const txn = [...created.transactions][0]
    const res = await req('DELETE', `/api/transactions/${txn}`, { token: tokens.employee })
    expect(res.status).toBe(403)
  })

  it('manager cannot delete a transaction (403)', async () => {
    const txn = [...created.transactions][0]
    const res = await req('DELETE', `/api/transactions/${txn}`, { token: tokens.manager })
    expect(res.status).toBe(403)
  })

  it('employee cannot create an accounting year (403)', async () => {
    const res = await req('POST', '/api/accounting-years', { token: tokens.employee, body: { name: 'QA FY Emp', startDate: '2028-04-01', endDate: '2029-03-31' } })
    expect(res.status).toBe(403)
  })

  it('manager can create and delete an empty accounting year', async () => {
    const name = `QA FY ${Date.now()}`
    const create = await req('POST', '/api/accounting-years', { token: tokens.manager, body: { name, startDate: '2030-04-01', endDate: '2031-03-31', status: 'inactive' } })
    expect(create.status).toBe(201)
    created.years.add(create.json.data.id)
    const del = await req('DELETE', `/api/accounting-years/${create.json.data.id}`, { token: tokens.manager })
    expect(del.status).toBe(200)
  })

  it('manager cannot create users (403)', async () => {
    const res = await req('POST', '/api/users', { token: tokens.manager, body: { name: 'X', username: 'xman', email: 'xman@example.test', password: 'secret1', role: 'employee' } })
    expect(res.status).toBe(403)
  })

  it('employee can read reports (function-level access control finding)', async () => {
    const res = await req('GET', '/api/reports/pl', { token: tokens.employee })
    expect(res.status).toBe(403)
  })

  it('employee can read backup JSON export (expected: forbidden)', async () => {
    const res = await req('GET', '/api/backup/json', { token: tokens.employee })
    expect(res.status).toBe(403)
  })

  it('employee can export the full Excel backup (expected: forbidden)', async () => {
    const res = await req('POST', '/api/backup/export-excel', { token: tokens.employee, body: {} })
    expect(res.status).toBe(403)
  })

  it('employee cannot reach Excel preview (expected: forbidden)', async () => {
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'application/octet-stream' }), 'x.xlsx')
    const res = await reqForm('/api/backup/preview-excel', fd, tokens.employee)
    expect(res.status).toBe(403)
  })

  it('employee cannot reach Excel import/restore (expected: forbidden)', async () => {
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'application/octet-stream' }), 'x.xlsx')
    const res = await reqForm('/api/backup/import-excel', fd, tokens.employee)
    expect(res.status).toBe(403)
  })

  it('employee cannot use Drive backup admin routes (403)', async () => {
    const a = await req('GET', '/api/backup/drive-status', { token: tokens.employee })
    const b = await req('POST', '/api/backup/drive-trigger', { token: tokens.employee, body: {} })
    expect(a.status).toBe(403)
    expect(b.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Default credentials & user lifecycle
// ─────────────────────────────────────────────────────────────────────────────
describe('user lifecycle', () => {
  it('rejects a weak password on user creation', async () => {
    const res = await req('POST', '/api/users', { token: tokens.admin, body: { name: 'Weak', username: `weak${Date.now()}`, email: `weak${Date.now()}@example.test`, password: 'x', role: 'employee' } })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate username with 409', async () => {
    const res = await req('POST', '/api/users', { token: tokens.admin, body: { name: 'Dup', username: 'qa_admin', email: `dup${Date.now()}@example.test`, password: 'secret1', role: 'employee' } })
    expect(res.status).toBe(409)
  })

  it('does NOT silently create accounts with the default password admin123', async () => {
    const username = `qa_default_${Date.now()}`
    const res = await req('POST', '/api/users', { token: tokens.admin, body: { name: 'Default Pwd', username, email: `${username}@example.test`, role: 'employee' } })
    if (res.json?.data?.id) created.users.add(res.json.data.id)
    expect(res.status).toBe(400)
  })

  it('confirms whether the default password admin123 actually works (evidence)', async () => {
    const users = await req('GET', '/api/users', { token: tokens.admin })
    const defaultUser = users.json.data.find((u: any) => u.username.startsWith('qa_default_'))
    if (!defaultUser) return // creation was correctly rejected
    const res = await login(defaultUser.username, 'admin123')
    expect(res.status).toBe(200)
  })

  it('admin cannot delete their own account', async () => {
    const me = await req('GET', '/api/auth/me', { token: tokens.admin })
    const res = await req('DELETE', `/api/users/${me.json.user.id}`, { token: tokens.admin })
    expect(res.status).toBe(400)
  })

  it('2FA enrol → login challenge → verify → disable works end-to-end', async () => {
    const username = `qa_2fa_${Date.now()}`
    const password = 'TwoFactor#123'
    const create = await req('POST', '/api/users', { token: tokens.admin, body: { name: '2FA User', username, email: `${username}@example.test`, role: 'employee', password } })
    expect(create.status).toBe(201)
    created.users.add(create.json.data.id)

    const firstLogin = await login(username, password)
    expect(firstLogin.status).toBe(200)
    const userToken = firstLogin.json.token

    const setup = await req('GET', '/api/auth/2fa/setup', { token: userToken })
    expect(setup.status).toBe(200)
    expect(typeof setup.json.secret).toBe('string')

    const badVerify = await req('POST', '/api/auth/2fa/verify-setup', { token: userToken, body: { secret: setup.json.secret, code: '000000' } })
    expect(badVerify.status).toBe(400)

    const code = await generate({ secret: setup.json.secret })
    const goodVerify = await req('POST', '/api/auth/2fa/verify-setup', { token: userToken, body: { secret: setup.json.secret, code } })
    expect(goodVerify.status).toBe(200)
    expect(goodVerify.json.user.twoFactorEnabled).toBe(true)

    const challenged = await login(username, password)
    expect(challenged.status).toBe(200)
    expect(challenged.json.require2FA).toBe(true)
    expect(typeof challenged.json.tempToken).toBe('string')

    const badCode = await req('POST', '/api/auth/login/2fa', { body: { tempToken: challenged.json.tempToken, code: '000000' } })
    expect(badCode.status).toBe(400)

    const freshCode = await generate({ secret: setup.json.secret })
    const okCode = await req('POST', '/api/auth/login/2fa', { body: { tempToken: challenged.json.tempToken, code: freshCode } })
    expect(okCode.status).toBe(200)
    expect(okCode.json.user.twoFactorEnabled).toBe(true)

    const disable = await req('POST', '/api/auth/2fa/disable', { token: okCode.json.token, body: { password } })
    expect(disable.status).toBe(200)

    const afterDisable = await login(username, password)
    expect(afterDisable.status).toBe(200)
    expect(afterDisable.json.require2FA).toBeFalsy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. PIN flows
// ─────────────────────────────────────────────────────────────────────────────
describe('security PIN', () => {
  it('verify before setup returns 400', async () => {
    const res = await req('POST', '/api/auth/pin/verify', { token: tokens.employee, body: { pin: '1234' } })
    expect(res.status).toBe(400)
  })

  it('rejects a non-numeric PIN', async () => {
    const res = await req('POST', '/api/auth/pin/setup', { token: tokens.employee, body: { pin: '12ab' } })
    expect(res.status).toBe(400)
  })

  it('sets up, verifies, changes and resets a PIN', async () => {
    const setup = await req('POST', '/api/auth/pin/setup', { token: tokens.employee, body: { pin: '1234' } })
    expect(setup.status).toBe(200)

    const wrong = await req('POST', '/api/auth/pin/verify', { token: tokens.employee, body: { pin: '9999' } })
    expect(wrong.status).toBe(400)

    const ok = await req('POST', '/api/auth/pin/verify', { token: tokens.employee, body: { pin: '1234' } })
    expect(ok.status).toBe(200)

    const change = await req('POST', '/api/auth/pin/change', { token: tokens.employee, body: { currentPin: '1234', newPin: '5678' } })
    expect(change.status).toBe(200)

    const reset = await req('POST', '/api/auth/pin/reset', { token: tokens.employee, body: { password: 'Employee#12345', newPin: '4321' } })
    expect(reset.status).toBe(200)

    const verifyNew = await req('POST', '/api/auth/pin/verify', { token: tokens.employee, body: { pin: '4321' } })
    expect(verifyNew.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Profile / password
// ─────────────────────────────────────────────────────────────────────────────
describe('profile & password', () => {
  it('updates the profile name and rejects a duplicate email', async () => {
    const update = await req('PUT', '/api/auth/profile', { token: tokens.employee, body: { name: 'QA Employee Renamed' } })
    expect(update.status).toBe(200)
    expect(update.json.user.name).toBe('QA Employee Renamed')

    const dup = await req('PUT', '/api/auth/profile', { token: tokens.employee, body: { email: 'qa_admin@example.test' } })
    expect(dup.status).toBe(400)
  })

  it('rejects a wrong current password', async () => {
    const res = await req('POST', '/api/auth/change-password', { token: tokens.employee, body: { currentPassword: 'nope', newPassword: 'NewPass#123' } })
    expect(res.status).toBe(400)
  })

  it('changes the password and allows changing back with the new password', async () => {
    const change = await req('POST', '/api/auth/change-password', { token: tokens.employee, body: { currentPassword: 'Employee#12345', newPassword: 'NewPass#123' } })
    expect(change.status).toBe(200)
    const back = await req('POST', '/api/auth/change-password', { token: tokens.employee, body: { currentPassword: 'NewPass#123', newPassword: 'Employee#12345' } })
    expect(back.status).toBe(200)
  })

  it('rejects a new password shorter than 6 chars', async () => {
    const res = await req('POST', '/api/auth/change-password', { token: tokens.employee, body: { currentPassword: 'Employee#12345', newPassword: '123' } })
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Stale JWT / deactivated accounts
// ─────────────────────────────────────────────────────────────────────────────
describe('token lifecycle vs database state', () => {
  it('rejects requests from a token whose user role was downgraded in DB', async () => {
    const users = await req('GET', '/api/users', { token: tokens.admin })
    const manager = users.json.data.find((u: any) => u.username === 'qa_manager')
    const txn = await createTxn({ date: '2026-06-03', type: 'income', amount: 222, paymentMode: 'cash', category: 'Travel', description: 'role test' })
    expect(txn.status).toBe(201)

    const downgrade = await req('PUT', `/api/users/${manager.id}`, { token: tokens.admin, body: { role: 'employee' } })
    expect(downgrade.status).toBe(200)

    try {
      // Manager token still says role=manager; desired behaviour is 403.
      const res = await req('PUT', `/api/transactions/${txn.json.data.id}`, { token: tokens.manager, body: { description: 'stale token edit' } })
      expect(res.status).toBe(403)
    } finally {
      await req('PUT', `/api/users/${manager.id}`, { token: tokens.admin, body: { role: 'manager' } })
    }
  })

  it('rejects requests from a token whose user was deactivated in DB', async () => {
    const users = await req('GET', '/api/users', { token: tokens.admin })
    const employee = users.json.data.find((u: any) => u.username === 'qa_employee')

    const deactivate = await req('PUT', `/api/users/${employee.id}`, { token: tokens.admin, body: { status: 'inactive' } })
    expect(deactivate.status).toBe(200)

    try {
      const me = await req('GET', '/api/auth/me', { token: tokens.employee })
      expect([401, 403]).toContain(me.status)

      const txn = await req('POST', '/api/transactions', { token: tokens.employee, body: { date: '2026-06-04', type: 'income', amount: 333, paymentMode: 'cash', category: 'Travel', description: 'inactive user entry' } })
      if (txn.status === 201 && txn.json?.data?.id) created.transactions.add(txn.json.data.id)
      expect([401, 403]).toContain(txn.status)
    } finally {
      await req('PUT', `/api/users/${employee.id}`, { token: tokens.admin, body: { status: 'active' } })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. Voucher numbering
// ─────────────────────────────────────────────────────────────────────────────
describe('voucher numbering', () => {
  it('concurrent creates must all receive unique vouchers', async () => {
    const payload = (i: number) => ({ date: '2026-06-05', type: 'income', amount: 100 + i, paymentMode: 'cash', category: 'Travel', description: `concurrent ${i}` })
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => req('POST', '/api/transactions', { token: tokens.admin, body: payload(i) })))
    for (const r of results) {
      if (r.status === 201 && r.json?.data?.id) created.transactions.add(r.json.data.id)
    }
    const failures = results.filter(r => r.status !== 201)
    expect(failures.map(f => `${f.status}:${f.json?.message}`)).toEqual([])
  })

  it('does not reuse a deleted voucher number', async () => {
    const a = await createTxn({ date: '2026-06-06', type: 'income', amount: 401, paymentMode: 'cash', category: 'Travel', description: 'voucher A' })
    const b = await createTxn({ date: '2026-06-06', type: 'income', amount: 402, paymentMode: 'cash', category: 'Travel', description: 'voucher B' })
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    const aNo = a.json.data.voucherNo

    const del = await req('DELETE', `/api/transactions/${a.json.data.id}`, { token: tokens.admin })
    expect(del.status).toBe(200)

    const c = await createTxn({ date: '2026-06-06', type: 'income', amount: 403, paymentMode: 'cash', category: 'Travel', description: 'voucher C' })
    expect(c.status).toBe(201)
    expect(c.json.data.voucherNo).not.toBe(aNo)
  })

  it('creating after a middle deletion does not collide with an existing voucher', async () => {
    const a = await createTxn({ date: '2026-06-07', type: 'income', amount: 501, paymentMode: 'cash', category: 'Travel', description: 'gap A' })
    const b = await createTxn({ date: '2026-06-07', type: 'income', amount: 502, paymentMode: 'cash', category: 'Travel', description: 'gap B' })
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)

    const del = await req('DELETE', `/api/transactions/${a.json.data.id}`, { token: tokens.admin })
    expect(del.status).toBe(200)

    const c = await createTxn({ date: '2026-06-07', type: 'income', amount: 503, paymentMode: 'cash', category: 'Travel', description: 'gap C' })
    expect(c.status).toBe(201)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. Audit trail
// ─────────────────────────────────────────────────────────────────────────────
describe('audit trail', () => {
  it('records create/update/delete actions with the acting user', async () => {
    const txn = await createTxn({ voucherNo: 'AUD-9001', date: '2026-06-08', type: 'income', amount: 900, paymentMode: 'cash', category: 'Travel', description: 'audit me' })
    expect(txn.status).toBe(201)
    await req('PUT', `/api/transactions/${txn.json.data.id}`, { token: tokens.admin, body: { description: 'audit edited' } })
    await req('DELETE', `/api/transactions/${txn.json.data.id}`, { token: tokens.admin })
    await sleep(500)

    const res = await req('GET', '/api/audit-logs?limit=500', { token: tokens.admin })
    expect(res.status).toBe(200)
    const mine = res.json.data.filter((l: any) => l.details.includes('audit edited') || l.details.includes(txn.json.data.voucherNo))
    expect(mine.length).toBeGreaterThan(0)
    expect(mine[0].userName).toBe('qa_admin')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. Notifications isolation
// ─────────────────────────────────────────────────────────────────────────────
describe('notifications', () => {
  it('isolates notifications per user', async () => {
    const users = await req('GET', '/api/users', { token: tokens.admin })
    const admin = users.json.data.find((u: any) => u.username === 'qa_admin')
    const employee = users.json.data.find((u: any) => u.username === 'qa_employee')

    const adminNotif = await prisma.notification.create({ data: { userId: admin.id, type: 'info', title: 'Admin only', message: 'secret' } })
    const empNotif = await prisma.notification.create({ data: { userId: employee.id, type: 'info', title: 'Employee only', message: 'hello' } })
    created.notifications.add(adminNotif.id)
    created.notifications.add(empNotif.id)

    const list = await req('GET', '/api/notifications', { token: tokens.employee })
    expect(list.status).toBe(200)
    expect(list.json.data.map((n: any) => n.id)).toContain(empNotif.id)
    expect(list.json.data.map((n: any) => n.id)).not.toContain(adminNotif.id)

    await req('PATCH', `/api/notifications/${adminNotif.id}/read`, { token: tokens.employee })
    const stillUnread = await prisma.notification.findUnique({ where: { id: adminNotif.id } })
    expect(stillUnread?.read).toBe(false)

    const markAll = await req('PATCH', '/api/notifications/mark-all-read', { token: tokens.employee })
    expect(markAll.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. Backup endpoints
// ─────────────────────────────────────────────────────────────────────────────
describe('backup', () => {
  it('admin can export an Excel backup', async () => {
    const res = await req('POST', '/api/backup/export-excel', { token: tokens.admin, body: {} })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('spreadsheetml')
    expect(res.text.length).toBeGreaterThan(1000)
  })

  it('admin Excel preview rejects a non-Excel file with 400', async () => {
    const fd = new FormData()
    fd.append('file', new Blob(['this is not xlsx'], { type: 'application/octet-stream' }), 'bad.xlsx')
    const res = await reqForm('/api/backup/preview-excel', fd, tokens.admin)
    expect(res.status).toBe(400)
  })

  it('admin Excel import rejects a non-Excel file with 400', async () => {
    const fd = new FormData()
    fd.append('file', new Blob(['this is not xlsx'], { type: 'application/octet-stream' }), 'bad.xlsx')
    fd.append('confirm', 'RESTORE')
    const res = await reqForm('/api/backup/import-excel', fd, tokens.admin)
    expect(res.status).toBe(400)
  })

  it('restore requires an explicit confirmation flag', async () => {
    const fd = new FormData()
    fd.append('file', new Blob(['this is not xlsx'], { type: 'application/octet-stream' }), 'bad.xlsx')
    const res = await reqForm('/api/backup/import-excel', fd, tokens.admin)
    expect(res.status).toBe(400)
    expect(String(res.json?.message || '')).toMatch(/confirmation required/i)
  })

  it('drive-history serialises BigInt fileSizeBytes without crashing', async () => {
    const run = await prisma.backupRun.create({ data: { status: 'SUCCESS', trigger: 'CLI', fileSizeBytes: 123456789n, checksumSha256: 'qa' } })
    created.backupRuns.add(run.id)
    const res = await req('GET', '/api/backup/drive-history', { token: tokens.admin })
    expect(res.status).toBe(200)
    expect(res.json.data.runs[0].fileSizeBytes).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 14. Database invariants (CHECK / partial unique / exclusion constraints)
// ─────────────────────────────────────────────────────────────────────────────
describe('database invariants', () => {
  afterAll(async () => {
    await prisma.accountingYear.deleteMany({ where: { name: { startsWith: 'QA-CONSTRAINT-' } } })
    await prisma.transaction.deleteMany({ where: { voucherNo: { startsWith: 'QA-CONSTRAINT-' } } })
  })

  it('rejects a negative transaction amount at the database level', async () => {
    await expect(
      prisma.transaction.create({
        data: {
          voucherNo: 'QA-CONSTRAINT-NEG',
          date: new Date('2026-06-01T00:00:00.000Z'),
          type: 'income',
          amount: -1,
          createdBy: 'qa',
        },
      })
    ).rejects.toThrow()
  })

  it('rejects an inverted accounting-year range', async () => {
    await expect(
      prisma.accountingYear.create({
        data: {
          name: 'QA-CONSTRAINT-INVERTED',
          startDate: new Date('2035-12-31T00:00:00.000Z'),
          endDate: new Date('2035-01-01T00:00:00.000Z'),
          status: 'inactive',
        },
      })
    ).rejects.toThrow()
  })

  it('rejects a second active accounting year', async () => {
    await expect(
      prisma.accountingYear.create({
        data: {
          name: 'QA-CONSTRAINT-ACTIVE',
          startDate: new Date('2030-01-01T00:00:00.000Z'),
          endDate: new Date('2030-12-31T00:00:00.000Z'),
          status: 'active',
        },
      })
    ).rejects.toThrow()
  })

  it('rejects an accounting year that overlaps an existing one', async () => {
    await expect(
      prisma.accountingYear.create({
        data: {
          name: 'QA-CONSTRAINT-OVERLAP',
          startDate: new Date('2026-06-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          status: 'inactive',
        },
      })
    ).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. Rate limiting (must run last — locks out login from this IP)
// ─────────────────────────────────────────────────────────────────────────────
describe('rate limiting', () => {
  it('throttles repeated failed logins with 429', async () => {
    let saw429 = false
    for (let i = 0; i < 30; i++) {
      const res = await login('qa_admin', 'wrong-password')
      if (res.status === 429) { saw429 = true; break }
    }
    expect(saw429).toBe(true)
  })
})
