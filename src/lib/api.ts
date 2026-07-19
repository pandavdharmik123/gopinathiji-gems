import type { AuditLog, AccountingYear, CompanySettings, Notification, Party, Transaction, User, ExpenseCategory } from '../types'
import { DEFAULT_SETTINGS } from '../data/mockData'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'
const TOKEN_KEY = 'jikadara_erp_token'

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  user?: User
  token?: string
  message?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof body === 'object' && body?.message ? body.message : 'Request failed'
    if (response.status === 401) clearToken()
    throw new ApiError(message, response.status)
  }

  return body as T
}

function dateOnly(value: string | Date | undefined) {
  if (!value) return ''
  return String(value).split('T')[0]
}

function dateTime(value: string | Date | undefined) {
  return value ? String(value) : new Date().toISOString()
}

function normalizeUser(user: any): User {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    email: user.email,
    status: user.status,
    createdAt: dateOnly(user.createdAt),
  }
}

function normalizeParty(party: any): Party {
  return {
    id: party.id,
    name: party.name,
    category: party.category,
    contactPerson: party.contactPerson ?? '',
    mobile: party.mobile ?? '',
    email: party.email ?? '',
    gst: party.gst ?? '',
    address: party.address ?? '',
    notes: party.notes ?? '',
    status: party.status,
    balance: Number(party.balance ?? 0),
    createdAt: dateOnly(party.createdAt),
  }
}

function normalizeTransaction(txn: any): Transaction {
  return {
    id: txn.id,
    voucherNo: txn.voucherNo,
    date: dateOnly(txn.date),
    type: txn.type,
    partyId: txn.partyId ?? '',
    partyName: txn.party?.name ?? txn.partyName ?? '',
    category: txn.category ?? '',
    amount: Number(txn.amount ?? 0),
    paymentMode: txn.paymentMode,
    description: txn.description ?? '',
    createdBy: txn.createdBy,
    createdAt: dateTime(txn.createdAt),
    updatedAt: txn.updatedAt ? dateTime(txn.updatedAt) : undefined,
  }
}

function normalizeAccountingYear(year: any): AccountingYear {
  return {
    id: year.id,
    name: year.name,
    startDate: dateOnly(year.startDate),
    endDate: dateOnly(year.endDate),
    openingBalance: Number(year.openingBalance ?? 0),
    notes: year.notes ?? '',
    status: year.status,
  }
}

function normalizeAuditLog(log: any): AuditLog {
  return {
    id: log.id,
    user: log.userName ?? log.user ?? '',
    action: log.action,
    entity: log.entity,
    details: log.details,
    timestamp: dateTime(log.createdAt ?? log.timestamp),
    entityId: log.entityId ?? undefined,
  }
}

function normalizeNotification(notification: any): Notification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    createdAt: dateTime(notification.createdAt),
  }
}

function normalizeSettings(settings: any): CompanySettings {
  return {
    name: settings.name ?? DEFAULT_SETTINGS.name,
    gst: settings.gst ?? '',
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    currency: settings.currency ?? DEFAULT_SETTINGS.currency,
    dateFormat: settings.dateFormat ?? DEFAULT_SETTINGS.dateFormat,
    language: settings.language ?? DEFAULT_SETTINGS.language,
    lastBackup: settings.lastBackup ?? '',
  }
}
function normalizeExpenseCategory(cat: any): ExpenseCategory {
  return {
    id: cat.id,
    name: cat.name,
    createdAt: cat.createdAt,
  }
}

async function getData<T>(path: string, normalize: (item: any) => T): Promise<T[]> {
  const envelope = await request<ApiEnvelope<any[]>>(path)
  return (envelope.data ?? []).map(normalize)
}

export const api = {
  async login(username: string, password: string) {
    const envelope = await request<ApiEnvelope<never>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (!envelope.token || !envelope.user) throw new ApiError('Invalid login response', 500)
    setToken(envelope.token)
    return normalizeUser(envelope.user)
  },

  async me() {
    const envelope = await request<ApiEnvelope<never>>('/auth/me')
    if (!envelope.user) throw new ApiError('Invalid user response', 500)
    return normalizeUser(envelope.user)
  },

  users: {
    list: () => getData('/users', normalizeUser),
    create: async (data: { name: string; username: string; email: string; role: User['role']; password?: string }) => {
      const envelope = await request<ApiEnvelope<any>>('/users', { method: 'POST', body: JSON.stringify(data) })
      return normalizeUser(envelope.data)
    },
    update: async (id: string, data: Partial<Pick<User, 'name' | 'email' | 'role' | 'status'>>) => {
      const envelope = await request<ApiEnvelope<any>>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return normalizeUser(envelope.data)
    },
    delete: (id: string) => request<ApiEnvelope<never>>(`/users/${id}`, { method: 'DELETE' }),
  },

  parties: {
    list: () => getData('/parties', normalizeParty),
    create: async (data: Omit<Party, 'id' | 'balance' | 'createdAt'>) => {
      const envelope = await request<ApiEnvelope<any>>('/parties', { method: 'POST', body: JSON.stringify(data) })
      return normalizeParty(envelope.data)
    },
    update: async (id: string, data: Partial<Omit<Party, 'id' | 'balance' | 'createdAt'>>) => {
      const envelope = await request<ApiEnvelope<any>>(`/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return normalizeParty(envelope.data)
    },
    delete: (id: string) => request<ApiEnvelope<never>>(`/parties/${id}`, { method: 'DELETE' }),
  },

  transactions: {
    list: () => getData('/transactions?limit=500', normalizeTransaction),
    create: async (data: Omit<Transaction, 'id' | 'voucherNo' | 'partyName' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
      const envelope = await request<ApiEnvelope<any>>('/transactions', { method: 'POST', body: JSON.stringify(data) })
      return normalizeTransaction(envelope.data)
    },
    update: async (id: string, data: Partial<Omit<Transaction, 'id' | 'voucherNo' | 'partyName' | 'createdBy' | 'createdAt' | 'updatedAt'>>) => {
      const envelope = await request<ApiEnvelope<any>>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return normalizeTransaction(envelope.data)
    },
    delete: (id: string) => request<ApiEnvelope<never>>(`/transactions/${id}`, { method: 'DELETE' }),
  },

  accountingYears: {
    list: () => getData('/accounting-years', normalizeAccountingYear),
    create: async (data: { name: string; startDate: string; endDate: string; openingBalance: number; notes: string; status: 'active' | 'inactive' }) => {
      const envelope = await request<ApiEnvelope<any>>('/accounting-years', { method: 'POST', body: JSON.stringify(data) })
      return normalizeAccountingYear(envelope.data)
    },
    update: async (id: string, data: Partial<Pick<AccountingYear, 'name' | 'startDate' | 'endDate' | 'openingBalance' | 'notes' | 'status'>>) => {
      const envelope = await request<ApiEnvelope<any>>(`/accounting-years/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return normalizeAccountingYear(envelope.data)
    },
    delete: (id: string) => request<ApiEnvelope<never>>(`/accounting-years/${id}`, { method: 'DELETE' }),
  },

  auditLogs: {
    list: () => getData('/audit-logs?limit=500', normalizeAuditLog),
  },

  notifications: {
    list: () => getData('/notifications', normalizeNotification),
    markRead: (id: string) => request<ApiEnvelope<never>>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request<ApiEnvelope<never>>('/notifications/mark-all-read', { method: 'PATCH' }),
  },

  settings: {
    get: async () => {
      const envelope = await request<ApiEnvelope<any>>('/settings')
      return normalizeSettings(envelope.data)
    },
    update: async (data: Partial<CompanySettings>) => {
      const envelope = await request<ApiEnvelope<any>>('/settings', { method: 'PUT', body: JSON.stringify(data) })
      return normalizeSettings(envelope.data)
    },
  },
  expenseCategories: {
    list: () => getData('/expense-categories', normalizeExpenseCategory),
    create: async (name: string) => {
      const envelope = await request<ApiEnvelope<any>>('/expense-categories', { method: 'POST', body: JSON.stringify({ name }) })
      return normalizeExpenseCategory(envelope.data)
    },
    delete: (id: string) => request<ApiEnvelope<never>>(`/expense-categories/${id}`, { method: 'DELETE' }),
  },
}
