import type React from 'react'
import { Avatar, Button, Drawer, Menu, Space, Tag, Typography } from 'antd'
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import type { User } from '../types'
import { useApp } from '../store/AppContext'

type Page = 'dashboard' | 'income' | 'expense' | 'transactions' | 'cashbook' | 'parties' | 'ledger' | 'reports' | 'users' | 'settings' | 'audit'

interface SidebarProps {
  currentUser: User
  activePage: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

const navItems: { page: Page; label: string; icon: React.ReactNode; roles: string[] }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'manager', 'employee'] },
  { page: 'income', label: 'Income', icon: <TrendingUp size={18} />, roles: ['admin', 'manager', 'employee'] },
  { page: 'expense', label: 'Expense', icon: <TrendingDown size={18} />, roles: ['admin', 'manager', 'employee'] },
  { page: 'transactions', label: 'Transactions', icon: <ReceiptText size={18} />, roles: ['admin', 'manager'] },
  { page: 'parties', label: 'Parties / Companies', icon: <Building2 size={18} />, roles: ['admin', 'manager'] },
  { page: 'ledger', label: 'Ledger', icon: <FileText size={18} />, roles: ['admin', 'manager'] },
  { page: 'reports', label: 'Reports', icon: <BarChart3 size={18} />, roles: ['admin', 'manager'] },
  { page: 'audit', label: 'Audit Logs', icon: <Activity size={18} />, roles: ['admin'] },
  { page: 'users', label: 'Users', icon: <UserCheck size={18} />, roles: ['admin'] },
  { page: 'settings', label: 'Settings', icon: <Settings size={18} />, roles: ['admin'] },
  { page: 'cashbook', label: 'Financial Years', icon: <BookOpen size={18} />, roles: ['admin', 'manager'] },

]

function SidebarContent({ currentUser, activePage, onNavigate, onLogout, onMobileClose }: Omit<SidebarProps, 'mobileOpen'>) {
  const { state, t } = useApp()
  const companyName = state.settings.name
  const visible = navItems.filter(item => item.roles.includes(currentUser.role))

  const getNavLabel = (item: typeof navItems[number]) => {
    if (item.page === 'cashbook') return t('nav.accountingYears')
    if (item.page === 'audit') return t('nav.auditLogs')
    return t('nav.' + item.page)
  }

  return (
    <div className="app-sidebar-content">
      <div className="app-brand" style={{ flexShrink: 0 }}>
        <img src="/logoTwo.png" alt="Gopinathji Gems Logo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Typography.Text strong ellipsis style={{ display: 'block', color: '#0f595c', fontSize: '1.25rem' }}>{companyName}</Typography.Text>
          {/* <Typography.Text type="secondary" style={{ fontSize: 11 }}>{t('brand.subtitle')}</Typography.Text> */}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Typography.Text className="app-sidebar-kicker">{t('nav.menu_title')}</Typography.Text>
        <Menu
          mode="inline"
          selectedKeys={[activePage]}
          items={visible.map(item => ({
            key: item.page,
            icon: item.icon,
            label: getNavLabel(item),
            onClick: () => {
              onNavigate(item.page)
              onMobileClose()
            },
          }))}
          style={{ borderInlineEnd: 0, flex: 1, background: 'transparent' }}
        />
      </div>

      <div className="app-sidebar-user" style={{ flexShrink: 0 }}>
        <Space>
          <Avatar style={{ background: 'var(--muted)', color: 'var(--primary)', fontWeight: 700 }}>
            {currentUser.name.charAt(0)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis style={{ display: 'block', maxWidth: 142 }}>{currentUser.name}</Typography.Text>
            <Tag color="cyan" style={{ margin: 0 }}>{t('role.' + currentUser.role)}</Tag>
          </div>
        </Space>
        <Button icon={<LogOut size={16} />} onClick={onLogout} block danger style={{ marginTop: 12 }}>
          {t('nav.logout')}
        </Button>
      </div>
    </div>
  )
}

export default function Sidebar(props: SidebarProps) {
  return (
    <>
      <aside className="app-sidebar">
        <SidebarContent {...props} />
      </aside>
      <Drawer
        placement="left"
        open={props.mobileOpen}
        onClose={props.onMobileClose}
        width={280}
        closable={false}
        styles={{ body: { padding: 0, overflow: 'hidden' } }}
      >
        <SidebarContent {...props} />
      </Drawer>
    </>
  )
}

export type { Page }
