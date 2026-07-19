import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import type { AppState, AppAction, AuditLog, Notification, Party, Transaction, User, AccountingYear } from '../types'
import { DEFAULT_SETTINGS, uid, nowStr } from '../data/mockData'
import { ApiError, api } from '../lib/api'
import { getLanguage, setLanguage, translate, type Language } from '../lib/i18n'

// ─── Initial State ────────────────────────────────────────────────────────────
function getInitialState(): AppState {
  return {
    users: [],
    parties: [],
    transactions: [],
    accountingYears: [],
    selectedYearId: null,
    language: getLanguage(),
    auditLogs: [],
    notifications: [],
    settings: DEFAULT_SETTINGS,
    expenseCategories: [],
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload

    // Users
    case 'ADD_USER':
      return { ...state, users: [action.payload, ...state.users] }
    case 'UPDATE_USER':
      return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) }
    case 'DELETE_USER':
      return { ...state, users: state.users.filter(u => u.id !== action.payload) }

    // Parties
    case 'ADD_PARTY':
      return { ...state, parties: [action.payload, ...state.parties] }
    case 'UPDATE_PARTY':
      return { ...state, parties: state.parties.map(p => p.id === action.payload.id ? action.payload : p) }
    case 'DELETE_PARTY':
      return { ...state, parties: state.parties.filter(p => p.id !== action.payload) }

    // Transactions
    case 'ADD_TRANSACTION':
      return { ...state, transactions: [action.payload, ...state.transactions] }
    case 'UPDATE_TRANSACTION':
      return { ...state, transactions: state.transactions.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'DELETE_TRANSACTION':
      return { ...state, transactions: state.transactions.filter(t => t.id !== action.payload) }

    // AccountingYear
    case 'ADD_ACCOUNTING_YEAR':
      return { ...state, accountingYears: [action.payload, ...state.accountingYears] }
    case 'UPDATE_ACCOUNTING_YEAR':
      return { 
        ...state, 
        accountingYears: state.accountingYears.map(y => y.id === action.payload.id ? action.payload : y) 
      }
    case 'DELETE_ACCOUNTING_YEAR':
      return { ...state, accountingYears: state.accountingYears.filter(y => y.id !== action.payload) }
    case 'SET_SELECTED_YEAR':
      return { ...state, selectedYearId: action.payload }
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload }

    // AuditLog
    case 'ADD_AUDIT_LOG':
      return { ...state, auditLogs: [action.payload, ...state.auditLogs] }

    // Notifications
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] }
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n),
      }
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) }

    // Settings
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } }

    // Expense Categories
    case 'ADD_EXPENSE_CATEGORY':
      return { ...state, expenseCategories: [...state.expenseCategories, action.payload].sort((a, b) => a.name.localeCompare(b.name)) }
    case 'DELETE_EXPENSE_CATEGORY':
      return { ...state, expenseCategories: state.expenseCategories.filter(c => c.id !== action.payload) }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  loading: boolean
  error: string
  refreshData: () => Promise<void>
  t: (key: string) => string
  changeLanguage: (lang: Language) => void
  // Helper mutations
  addAuditLog: (user: string, action: string, entity: string, details: string, entityId?: string) => void
  addNotification: (type: Notification['type'], title: string, message: string) => void
  createUser: (data: { name: string; username: string; email: string; role: User['role']; password?: string }) => Promise<User>
  updateUser: (id: string, data: Partial<Pick<User, 'name' | 'email' | 'role' | 'status'>>) => Promise<User>
  createParty: (data: Omit<Party, 'id' | 'balance' | 'createdAt'>) => Promise<Party>
  updateParty: (id: string, data: Partial<Omit<Party, 'id' | 'balance' | 'createdAt'>>) => Promise<Party>
  createTransaction: (data: Omit<Transaction, 'id' | 'voucherNo' | 'partyName' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<Transaction>
  updateTransaction: (id: string, data: Partial<Omit<Transaction, 'id' | 'voucherNo' | 'partyName' | 'createdBy' | 'createdAt' | 'updatedAt'>>) => Promise<Transaction>
  deleteTransaction: (id: string) => Promise<void>
  createAccountingYear: (data: { name: string; startDate: string; endDate: string; openingBalance: number; notes: string; status: 'active' | 'inactive' }) => Promise<void>
  updateAccountingYear: (id: string, data: Partial<Pick<AccountingYear, 'name' | 'startDate' | 'endDate' | 'openingBalance' | 'notes' | 'status'>>) => Promise<void>
  deleteAccountingYear: (id: string) => Promise<void>
  setSelectedYearId: (id: string | null) => void
  updateSettings: (settings: Partial<CompanySettings>) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  clearNotifications: () => Promise<void>
  exportBackup: () => void
  importBackup: (file: File) => Promise<void>
  createExpenseCategory: (name: string) => Promise<void>
  deleteExpenseCategory: (id: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, getInitialState)
  const [loading, setLoading] = useReducer((_state: boolean, next: boolean) => next, false)
  const [error, setError] = useReducer((_state: string, next: string) => next, '')

  const changeLanguage = (lang: Language) => {
    setLanguage(lang)
    dispatch({ type: 'SET_LANGUAGE', payload: lang })
  }

  const t = (key: string) => {
    return translate(key, state.language)
  }

  const refreshData = async () => {
    setLoading(true)
    setError('')
    try {
      const [parties, transactions, accountingYears, settings, notifications, rawCategories] = await Promise.all([
        api.parties.list(),
        api.transactions.list(),
        api.accountingYears.list(),
        api.settings.get(),
        api.notifications.list(),
        api.expenseCategories.list(),
      ])

      let expenseCategories = rawCategories
      if (expenseCategories.length === 0) {
        const defaults = ['Travel', 'Visa', 'Ticket', 'Hotel', 'Logistic', 'Consulting', 'Other']
        try {
          await Promise.all(defaults.map(cat => api.expenseCategories.create(cat)))
          expenseCategories = await api.expenseCategories.list()
        } catch (e) {
          console.error('Failed to seed default categories', e)
        }
      }

      const [usersResult, auditLogsResult] = await Promise.allSettled([
        api.users.list(),
        api.auditLogs.list(),
      ])

      dispatch({
        type: 'SET_STATE',
        payload: {
          users: usersResult.status === 'fulfilled' ? usersResult.value : [],
          parties,
          transactions,
          accountingYears,
          selectedYearId: state.selectedYearId || (accountingYears.find(y => y.status === 'active')?.id || accountingYears[0]?.id || null),
          language: state.language || getLanguage(),
          auditLogs: auditLogsResult.status === 'fulfilled' ? auditLogsResult.value : [],
          notifications,
          settings,
          expenseCategories,
        },
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Backend data load failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), 5000)
    return () => window.clearTimeout(timer)
  }, [error])

  const addAuditLog = (user: string, action: string, entity: string, details: string, entityId?: string) => {
    const log: AuditLog = {
      id: uid(),
      user,
      action,
      entity,
      details,
      timestamp: nowStr(),
      entityId,
    }
    dispatch({ type: 'ADD_AUDIT_LOG', payload: log })
  }

  const addNotification = (type: Notification['type'], title: string, message: string) => {
    const notif: Notification = {
      id: uid(),
      type,
      title,
      message,
      read: false,
      createdAt: nowStr(),
    }
    dispatch({ type: 'ADD_NOTIFICATION', payload: notif })
  }

  const createUser = async (data: { name: string; username: string; email: string; role: User['role']; password?: string }) => {
    const user = await api.users.create(data)
    dispatch({ type: 'ADD_USER', payload: user })
    return user
  }

  const updateUser = async (id: string, data: Partial<Pick<User, 'name' | 'email' | 'role' | 'status'>>) => {
    const user = await api.users.update(id, data)
    dispatch({ type: 'UPDATE_USER', payload: user })
    return user
  }

  const createParty = async (data: Omit<Party, 'id' | 'balance' | 'createdAt'>) => {
    const party = await api.parties.create(data)
    dispatch({ type: 'ADD_PARTY', payload: party })
    return party
  }

  const updateParty = async (id: string, data: Partial<Omit<Party, 'id' | 'balance' | 'createdAt'>>) => {
    const party = await api.parties.update(id, data)
    dispatch({ type: 'UPDATE_PARTY', payload: party })
    return party
  }

  const createTransaction = async (data: Omit<Transaction, 'id' | 'voucherNo' | 'partyName' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    const transaction = await api.transactions.create(data)
    dispatch({ type: 'ADD_TRANSACTION', payload: transaction })
    await refreshData()
    return transaction
  }

  const updateTransaction = async (id: string, data: Partial<Omit<Transaction, 'id' | 'voucherNo' | 'partyName' | 'createdBy' | 'createdAt' | 'updatedAt'>>) => {
    const transaction = await api.transactions.update(id, data)
    dispatch({ type: 'UPDATE_TRANSACTION', payload: transaction })
    await refreshData()
    return transaction
  }

  const deleteTransaction = async (id: string) => {
    await api.transactions.delete(id)
    dispatch({ type: 'DELETE_TRANSACTION', payload: id })
    await refreshData()
  }

  const createAccountingYear = async (data: { name: string; startDate: string; endDate: string; openingBalance: number; notes: string; status: 'active' | 'inactive' }) => {
    const year = await api.accountingYears.create(data)
    dispatch({ type: 'ADD_ACCOUNTING_YEAR', payload: year })
    await refreshData()
  }

  const updateAccountingYear = async (id: string, data: Partial<Pick<AccountingYear, 'name' | 'startDate' | 'endDate' | 'openingBalance' | 'notes' | 'status'>>) => {
    const year = await api.accountingYears.update(id, data)
    dispatch({ type: 'UPDATE_ACCOUNTING_YEAR', payload: year })
    await refreshData()
  }

  const deleteAccountingYear = async (id: string) => {
    await api.accountingYears.delete(id)
    dispatch({ type: 'DELETE_ACCOUNTING_YEAR', payload: id })
    if (state.selectedYearId === id) {
      dispatch({ type: 'SET_SELECTED_YEAR', payload: null })
    }
    await refreshData()
  }

  const setSelectedYearId = (id: string | null) => {
    dispatch({ type: 'SET_SELECTED_YEAR', payload: id })
  }

  const updateSettings = async (settings: Partial<CompanySettings>) => {
    const updated = await api.settings.update(settings)
    dispatch({ type: 'UPDATE_SETTINGS', payload: updated })
  }

  const markNotificationRead = async (id: string) => {
    await api.notifications.markRead(id)
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id })
  }

  const clearNotifications = async () => {
    await api.notifications.markAllRead()
    dispatch({ type: 'CLEAR_NOTIFICATIONS' })
  }

  const exportBackup = () => {
    const backup = JSON.stringify(state, null, 2)
    const blob = new Blob([backup], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jikadara-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    dispatch({ type: 'UPDATE_SETTINGS', payload: { lastBackup: nowStr() } })
    void updateSettings({ lastBackup: nowStr() })
    addNotification('success', 'બેકઅપ સફળ', 'ડેટા JSON ફાઇલ તરીકે ડાઉનલોડ થઈ ગઈ')
  }

  const importBackup = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as AppState
          dispatch({ type: 'SET_STATE', payload: data })
          addNotification('success', 'પુનઃસ્થાપિત સફળ', 'ડેટા પુનઃ ઉઘડ્યો')
          resolve()
        } catch {
          reject(new Error('Invalid backup file'))
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const createExpenseCategory = async (name: string) => {
    const category = await api.expenseCategories.create(name)
    dispatch({ type: 'ADD_EXPENSE_CATEGORY', payload: category })
  }

  const deleteExpenseCategory = async (id: string) => {
    await api.expenseCategories.delete(id)
    dispatch({ type: 'DELETE_EXPENSE_CATEGORY', payload: id })
  }

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      loading,
      error,
      refreshData,
      t,
      changeLanguage,
      addAuditLog,
      addNotification,
      createUser,
      updateUser,
      createParty,
      updateParty,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      createAccountingYear,
      updateAccountingYear,
      deleteAccountingYear,
      setSelectedYearId,
      updateSettings,
      markNotificationRead,
      clearNotifications,
      exportBackup,
      importBackup,
      createExpenseCategory,
      deleteExpenseCategory,
    }}>
      {children}
    </AppContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
