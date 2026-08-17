import { useEffect, useState } from 'react'
import { Alert, Avatar, Breadcrumb, Button, Layout, Space, Typography, Select } from 'antd'
import { Menu as MenuIcon, Languages } from 'lucide-react'
import { AppProvider, useApp } from './store/AppContext'
import type { User } from './types'
import { api, clearToken, getToken } from './lib/api'
import Login from './components/Login'
import Sidebar, { type Page } from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Income from './components/Income'
import Expense from './components/Expense'
import CashBook from './components/CashBook'
import Parties from './components/Parties'
import Ledger from './components/Ledger'
import Reports from './components/Reports'
import Users from './components/Users'
import AuditLog from './components/AuditLog'
import Settings from './components/Settings'
import Transactions from './components/Transactions'
import CalendarView from './components/CalendarView'
import LoadingScreen from './components/LoadingScreen'

const PAGE_TO_ROUTE: Record<Page, string> = {
  dashboard: '/dashboard',
  calendar: '/calendar',
  income: '/income',
  expense: '/expense',
  transactions: '/transactions',
  cashbook: '/cashbook',
  parties: '/parties',
  ledger: '/ledger',
  reports: '/reports',
  users: '/users',
  settings: '/settings',
  audit: '/audit',
}

const ROUTE_TO_PAGE: Record<string, Page> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/calendar': 'calendar',
  '/income': 'income',
  '/expense': 'expense',
  '/transactions': 'transactions',
  '/cashbook': 'cashbook',
  '/parties': 'parties',
  '/ledger': 'ledger',
  '/reports': 'reports',
  '/users': 'users',
  '/settings': 'settings',
  '/audit': 'audit',
}

function getPageFromPath(pathname: string): Page {
  const cleanPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname
  return ROUTE_TO_PAGE[cleanPath] || 'dashboard'
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}

function AppInner() {
  const { state, refreshData, loading, dataLoaded, resetDataLoaded, error, setSelectedYearId, changeLanguage, t } = useApp()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activePage, setActivePageInternal] = useState<Page>(() => getPageFromPath(window.location.pathname))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleNavigate = (page: Page, replace = false) => {
    setActivePageInternal(page)
    const targetPath = PAGE_TO_ROUTE[page] || '/dashboard'
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({}, '', targetPath)
      } else {
        window.history.pushState({}, '', targetPath)
      }
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      const page = getPageFromPath(window.location.pathname)
      setActivePageInternal(page)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  // Restore session
  useEffect(() => {
    let mounted = true
    async function restoreSession() {
      if (!getToken()) {
        setAuthLoading(false)
        return
      }
      try {
        const user = await api.me()
        if (mounted) setCurrentUser(user)
      } catch {
        clearToken()
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }
    void restoreSession()
    return () => { mounted = false }
  }, [])

  // Fetch initial data once user is authenticated
  useEffect(() => {
    if (currentUser && !dataLoaded && !loading) {
      void refreshData()
    }
  }, [currentUser, dataLoaded, loading, refreshData])

  if (authLoading) {
    return <LoadingScreen fullScreen />
  }

  if (!currentUser) {
    return (
      <Login
        onLogin={user => {
          setCurrentUser(user)
          const currentPage = getPageFromPath(window.location.pathname)
          handleNavigate(currentPage, true)
        }}
      />
    )
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard currentUser={currentUser} onNavigate={handleNavigate} />
      case 'income': return <Income currentUser={currentUser} />
      case 'expense': return <Expense currentUser={currentUser} />
      case 'transactions': return <Transactions currentUser={currentUser} />
      case 'cashbook': return <CashBook currentUser={currentUser} />
      case 'parties': return <Parties currentUser={currentUser} />
      case 'ledger': return <Ledger />
      case 'reports': return <Reports />
      case 'audit': return <AuditLog />
      case 'users': return <Users currentUser={currentUser} />
      case 'settings': return <Settings currentUser={currentUser} />
      case 'calendar': return <CalendarView />
      default: return <Dashboard currentUser={currentUser} onNavigate={handleNavigate} />
    }
  }

  const now = new Date()
  const dateDisplay = now.toLocaleDateString(state.language === 'gu' ? 'gu-IN' : 'en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const getPageTitle = (page: Page): string => {
    if (page === 'cashbook') return t('nav.accountingYears')
    if (page === 'audit') return t('nav.auditLogs')
    return t('nav.' + page)
  }

  return (
    <Layout className="app-layout">
      <Sidebar
        currentUser={currentUser}
        activePage={activePage}
        onNavigate={handleNavigate}
        onLogout={() => { clearToken(); setCurrentUser(null); resetDataLoaded() }}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <Layout className="main-content">
        <Layout.Header className="app-header">
          <Space size={12}>
            <Button
              className="mobile-menu-btn"
              type="text"
              icon={<MenuIcon size={20} />}
              onClick={() => setMobileMenuOpen(true)}
            />
            <Breadcrumb className="app-breadcrumb" items={[{ title: state.settings.name }, { title: getPageTitle(activePage) }]} />
          </Space>

          <Space size={16}>
            <Select
              className="year-select"
              placeholder={t('nav.accountingYears')}
              value={state.selectedYearId}
              onChange={v => setSelectedYearId(v)}
              options={state.accountingYears.map(y => ({
                value: y.id,
                label: y.name + (y.status === 'active' ? ` (${t('dash.active_year')})` : '')
              }))}
            />

            <Button
              type="text"
              icon={<Languages size={17} />}
              onClick={() => changeLanguage(state.language === 'en' ? 'gu' : 'en')}
              style={{ fontWeight: 600, fontSize: '0.8rem' }}
            >
              {state.language === 'en' ? 'GU' : 'EN'}
            </Button>

            <Typography.Text type="secondary" className="date-pill">{dateDisplay}</Typography.Text>
            <Space size={8}>
              <Avatar style={{ background: 'var(--muted)', color: 'var(--primary)', fontWeight: 700 }}>
                {currentUser.name.charAt(0)}
              </Avatar>
              <Typography.Text strong className="user-name">{currentUser.name}</Typography.Text>
            </Space>
          </Space>
        </Layout.Header>

        <Layout.Content className="app-content">
          {(loading && !dataLoaded) ? (
            <LoadingScreen />
          ) : (
            <>
              {(loading || error) && (
                <Alert type={error ? 'error' : 'info'} showIcon message={error || t('general.saving')} style={{ marginBottom: 16 }} />
              )}
              {renderPage()}
            </>
          )}
        </Layout.Content>

        {/*<Layout.Footer className="app-footer">*/}
        {/*  <span>© 2026 {state.settings.name}</span>*/}
        {/*  <span>v1.0.0 — {state.language === 'gu' ? 'ગુજરાતી ERP લાઇટ' : 'Multi-language ERP'}</span>*/}
        {/*</Layout.Footer>*/}
      </Layout>
    </Layout>
  )
}
