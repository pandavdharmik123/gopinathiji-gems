export type UserRole = 'admin' | 'manager' | 'employee'

export interface User {
  id: string
  name: string
  username: string
  role: UserRole
  email: string
  status: 'active' | 'inactive'
  createdAt: string
}

export interface Party {
  id: string
  name: string
  category: string
  contactPerson: string
  mobile: string
  email: string
  gst: string
  address: string
  notes: string
  status: 'active' | 'inactive'
  balance: number
  createdAt: string
}

export interface Transaction {
  id: string
  voucherNo: string
  date: string
  type: 'income' | 'expense' | 'transfer' | 'adjustment'
  partyId: string
  partyName: string
  category: string
  amount: number
  paymentMode: 'cash' | 'bank' | 'upi' | 'cheque'
  description: string
  createdBy: string
  createdAt: string
  updatedAt?: string
}

export interface AccountingYear {
  id: string
  name: string
  startDate: string
  endDate: string
  openingBalance: number
  notes: string
  status: 'active' | 'inactive'
}

export interface AuditLog {
  id: string
  user: string
  action: string
  entity: string
  details: string
  timestamp: string
  entityId?: string
}

export interface Notification {
  id: string
  type: 'warning' | 'info' | 'error' | 'success'
  title: string
  message: string
  read: boolean
  createdAt: string
}

export interface CompanySettings {
  name: string
  gst: string
  address: string
  phone: string
  email: string
  currency: string
  dateFormat: string
  language: string
  lastBackup: string
}

export interface ExpenseCategory {
  id: string
  name: string
  createdAt: string
}

export interface AppState {
  users: User[]
  parties: Party[]
  transactions: Transaction[]
  accountingYears: AccountingYear[]
  selectedYearId: string | null
  language: 'en' | 'gu'
  auditLogs: AuditLog[]
  notifications: Notification[]
  settings: CompanySettings
  expenseCategories: ExpenseCategory[]
}

export type AppAction =
  | { type: 'SET_STATE'; payload: AppState }
  // Users
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'DELETE_USER'; payload: string }
  // Parties
  | { type: 'ADD_PARTY'; payload: Party }
  | { type: 'UPDATE_PARTY'; payload: Party }
  | { type: 'DELETE_PARTY'; payload: string }
  // Transactions
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  // AccountingYear
  | { type: 'ADD_ACCOUNTING_YEAR'; payload: AccountingYear }
  | { type: 'UPDATE_ACCOUNTING_YEAR'; payload: AccountingYear }
  | { type: 'DELETE_ACCOUNTING_YEAR'; payload: string }
  | { type: 'SET_SELECTED_YEAR'; payload: string | null }
  | { type: 'SET_LANGUAGE'; payload: 'en' | 'gu' }
  // AuditLog
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLog }
  // Notifications
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  // Settings
  | { type: 'UPDATE_SETTINGS'; payload: Partial<CompanySettings> }
  // Expense Categories
  | { type: 'ADD_EXPENSE_CATEGORY'; payload: ExpenseCategory }
  | { type: 'DELETE_EXPENSE_CATEGORY'; payload: string }
