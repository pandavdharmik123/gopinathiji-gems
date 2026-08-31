import type React from 'react'
import { Card, Col, Row, Table, Tag, Typography, Space, Alert, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { TrendingUp, TrendingDown, DollarSign, Wallet, CalendarDays, BookOpen, Clock, CheckCircle, Landmark, Coins, FileText } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { formatCurrency, todayStr } from '../data/mockData'
import { getGujaratiTithi } from '../lib/gujaratiCalendar'
import { exportDashboardPDF } from '../lib/pdfReportGenerator'
import type { User } from '../types'
import type { Page } from './Sidebar'

interface DashboardProps {
  currentUser: User
  onNavigate: (page: Page) => void
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  color: string
  bgColor: string
  iconBg: string
  icon: React.ReactNode
  trend?: { value: string; up: boolean }
}

function StatCard({ label, value, sub, color, bgColor, iconBg, icon, trend }: StatCardProps) {
  return (
    <Card 
      bordered={false}
      styles={{ body: { padding: '20px 18px' } }}
      style={{ 
        height: '100%', 
        background: bgColor, 
        border: `1.5px solid ${color}18`, 
        borderRadius: 14,
        boxShadow: 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Typography.Text style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 6, color: color }}>
            {label}
          </Typography.Text>
          <Typography.Title level={3} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1e293b', fontSize: '1.45rem' }}>
            {value}
          </Typography.Title>
          {sub && (
            <Typography.Text style={{ fontSize: '0.76rem', display: 'block', marginTop: 4, color: `${color}cc`, fontWeight: 500 }}>
              {sub}
            </Typography.Text>
          )}
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Typography.Text style={{ fontSize: '0.75rem', color: trend.up ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {trend.up ? '↑' : '↓'} {trend.value}
              </Typography.Text>
            </div>
          )}
        </div>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: iconBg,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const { state, t } = useApp()
  const { transactions, accountingYears, selectedYearId } = state

  const today = todayStr()

  // Find currently selected Accounting Year
  const selectedYear = accountingYears.find(y => y.id === selectedYearId)

  // Scope transactions to the selected year
  const yearTxns = transactions.filter(t => {
    if (!selectedYear) return true
    return t.date >= selectedYear.startDate && t.date <= selectedYear.endDate
  })

  // Overall calculations scoped to the year
  const yearIncome = yearTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const yearExpense = yearTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const yearProfit = yearIncome - yearExpense

  // Cash calculations (રોકડા)
  const cashIncome = yearTxns.filter(t => t.type === 'income' && t.paymentMode === 'cash').reduce((s, t) => s + t.amount, 0)
  const cashExpense = yearTxns.filter(t => t.type === 'expense' && t.paymentMode === 'cash').reduce((s, t) => s + t.amount, 0)
  const cashProfit = cashIncome - cashExpense
  const openingCashBalance = selectedYear ? Number(selectedYear.openingBalance || 0) : 0
  const cashBalance = openingCashBalance + cashIncome - cashExpense

  // Bank calculations (બેંક)
  const bankIncome = yearTxns.filter(t => t.type === 'income' && t.paymentMode === 'bank').reduce((s, t) => s + t.amount, 0)
  const bankExpense = yearTxns.filter(t => t.type === 'expense' && t.paymentMode === 'bank').reduce((s, t) => s + t.amount, 0)
  const bankProfit = bankIncome - bankExpense
  const openingBankBalance = selectedYear ? Number(selectedYear.openingBankBalance || 0) : 0
  const bankBalance = openingBankBalance + bankIncome - bankExpense

  // Party Receivables & Payables scoped to year
  let totalReceivable = 0
  let totalPayable = 0
  state.parties.forEach(p => {
    const partyTxns = yearTxns.filter(t => t.partyId === p.id || t.partyName === p.name)
    const inc = partyTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = partyTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const bal = inc - exp
    if (bal > 0) totalReceivable += bal
    if (bal < 0) totalPayable += Math.abs(bal)
  })

  // Recent transactions scoped to the active year
  const recentTxns = [...yearTxns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  // Highlight large expenses (> 20000) scoped to year
  const largeExpenses = yearTxns.filter(t => t.type === 'expense' && t.amount > 20000).slice(0, 3)

  const dateLocale = state.language === 'gu' ? 'gu-IN' : 'en-IN'
  const gujaratiDate = new Date().toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const gujaratiTithi = getGujaratiTithi(new Date())

  const paymentModeIcon = (mode: string) => {
    if (mode === 'cash') return '💵'
    if (mode === 'bank') return '🏦'
    if (mode === 'upi') return '📱'
    return '📄'
  }

  const txnTypeColor = (type: string): string => {
    if (type === 'income') return 'success'
    if (type === 'expense') return 'error'
    if (type === 'transfer') return 'processing'
    return 'warning'
  }

  const txnTypeLabel = (type: string): string => {
    if (type === 'income') return t('nav.income')
    if (type === 'expense') return t('nav.expense')
    if (type === 'transfer') return state.language === 'gu' ? 'ટ્રાન્સ.' : 'Transfer'
    return state.language === 'gu' ? 'ગોઠ.' : 'Adj.'
  }

  const columns: ColumnsType<typeof transactions[number]> = [
    {
      title: t('general.voucher'),
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      render: (v: string) => <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: t('general.date'),
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => {
        const tithi = getGujaratiTithi(v)
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.82rem' }}>{v}</span>
            {tithi && <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>{tithi}</span>}
          </div>
        )
      },
    },
    {
      title: state.language === 'gu' ? 'પ્રકાર' : 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color={txnTypeColor(v)}>{txnTypeLabel(v)}</Tag>,
    },
    {
      title: t('general.party'),
      dataIndex: 'partyName',
      key: 'partyName',
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v || '—'}</span>,
    },
    {
      title: t('general.payment'),
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      render: (v: string) => <span>{paymentModeIcon(v)} <span style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>{v.toUpperCase()}</span></span>,
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number, record) => (
        <span style={{ fontWeight: 700, color: record.type === 'income' ? '#16a34a' : '#dc2626' }}>
          {record.type === 'income' ? '+' : '-'}{formatCurrency(v)}
        </span>
      ),
    },
  ]

  // Monthly summary values
  const currentYearMonths = () => {
    if (!selectedYear) return []
    const [sYear, sMonth] = selectedYear.startDate.split('-').map(Number)
    const [eYear, eMonth] = selectedYear.endDate.split('-').map(Number)
    const monthList: { label: string; yearMonth: string }[] = []
    
    let y = sYear
    let m = sMonth
    while (y < eYear || (y === eYear && m <= eMonth)) {
      const yearMonth = `${y}-${String(m).padStart(2, '0')}`
      const dateObj = new Date(y, m - 1, 1)
      const label = dateObj.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })
      monthList.push({ label, yearMonth })
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
    return monthList
  }

  const activeMonths = currentYearMonths()
  const currentMonthYM = today.slice(0, 7)
  const currentMonthObj = activeMonths.find(m => m.yearMonth === currentMonthYM)
  const latestMonth = currentMonthObj || activeMonths[activeMonths.length - 1] || { 
    label: new Date().toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }), 
    yearMonth: currentMonthYM 
  }
  const monthTxnsOnly = yearTxns.filter(t => t.date.startsWith(latestMonth.yearMonth))
  const monthIncome = monthTxnsOnly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTxnsOnly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthProfit = monthIncome - monthExpense

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0, fontWeight: 700, color: 'var(--foreground)' }}>
            {t('nav.dashboard')}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>
            {t('dash.welcome')}, {currentUser.name} — {gujaratiDate}
            {gujaratiTithi && (
              <span style={{ marginLeft: 8, color: 'var(--primary)', fontWeight: 600 }}>
                ({gujaratiTithi})
              </span>
            )}
          </Typography.Text>
        </div>

        <Button
          icon={<FileText size={15} />}
          onClick={() => exportDashboardPDF({
            yearIncome,
            yearExpense,
            yearProfit,
            cashBalance,
            bankBalance,
            totalReceivable,
            totalPayable
          }, recentTxns, state.settings, selectedYear, state.language === 'gu')}
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          {state.language === 'gu' ? 'પીડીએફ સારાંશ' : 'PDF Summary'}
        </Button>
      </div>

      {/* Alerts */}
      {largeExpenses.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col span={24}>
            <Alert
              type="warning"
              showIcon
              message={`${t('dash.large_expense_alert')} ${largeExpenses[0].description} — ${formatCurrency(largeExpenses[0].amount)}`}
            />
          </Col>
        </Row>
      )}

      {/* Stats Section - 3 Overview Cards */}
      <div style={{ marginBottom: 24 }}>
        <Typography.Text strong style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 12 }}>
          {selectedYear ? `${selectedYear.name} ${state.language === 'gu' ? 'નું સરવૈયું' : 'Overview'}` : (state.language === 'gu' ? 'સરવૈયું' : 'Overview')}
        </Typography.Text>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <StatCard 
              label={t('dash.total_income')} 
              value={formatCurrency(yearIncome)} 
              sub={`${t('dash.cash_income')}: ${formatCurrency(cashIncome)} | ${t('dash.bank_income')}: ${formatCurrency(bankIncome)}`}
              color="#15803d" 
              bgColor="#f0fdf4"
              iconBg="#ffffff"
              icon={<TrendingUp size={20} />} 
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <StatCard 
              label={t('dash.total_expense')} 
              value={formatCurrency(yearExpense)} 
              sub={`${t('dash.cash_expense')}: ${formatCurrency(cashExpense)} | ${t('dash.bank_expense')}: ${formatCurrency(bankExpense)}`}
              color="#ea580c" 
              bgColor="#fff7ed"
              iconBg="#ffffff"
              icon={<TrendingDown size={20} />} 
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <StatCard 
              label={t('dash.net_profit')} 
              value={formatCurrency(yearProfit)} 
              color="#db2777" 
              bgColor="#fdf2f8"
              iconBg="#ffffff"
              icon={<DollarSign size={20} />} 
            />
          </Col>
        </Row>
      </div>

      {/* Cash Account vs Bank Account Breakdown Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Cash Account */}
        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            title={
              <Space>
                <Coins size={18} color="#2563eb" />
                <span style={{ fontWeight: 700, color: '#1e3a8a' }}>{t('dash.cash_overview')}</span>
              </Space>
            }
            extra={<Tag color="blue" style={{ fontWeight: 600 }}>{t('dash.cash_balance')}: {formatCurrency(cashBalance)}</Tag>}
            style={{ height: '100%', borderRadius: 14, border: '1.5px solid #2563eb20', boxShadow: 'none' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('year.opening_cash_balance')}</Typography.Text>
                <Typography.Text style={{ fontWeight: 600, color: 'var(--foreground)' }}>{formatCurrency(openingCashBalance)}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('dash.cash_income')}</Typography.Text>
                <Typography.Text style={{ fontWeight: 700, color: '#16a34a' }}>+{formatCurrency(cashIncome)}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('dash.cash_expense')}</Typography.Text>
                <Typography.Text style={{ fontWeight: 700, color: '#dc2626' }}>-{formatCurrency(cashExpense)}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('dash.cash_profit')}</Typography.Text>
                <Typography.Text style={{ fontWeight: 700, color: cashProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(cashProfit)}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#eff6ff', borderRadius: 10, marginTop: 4, border: '1px solid #bfdbfe' }}>
                <div>
                  <Typography.Text strong style={{ fontSize: '0.9rem', color: '#1e40af', display: 'block' }}>{t('dash.cash_balance')}</Typography.Text>
                  <Typography.Text style={{ fontSize: '0.72rem', color: '#3b82f6' }}>
                    {formatCurrency(openingCashBalance)} + {formatCurrency(cashIncome)} - {formatCurrency(cashExpense)}
                  </Typography.Text>
                </div>
                <Typography.Text strong style={{ fontSize: '1.2rem', color: '#1e40af', fontWeight: 800 }}>{formatCurrency(cashBalance)}</Typography.Text>
              </div>
            </div>
          </Card>
        </Col>

        {/* Bank Account */}
        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            title={
              <Space>
                <Landmark size={18} color="#0891b2" />
                <span style={{ fontWeight: 700, color: '#155e75' }}>{t('dash.bank_overview')}</span>
              </Space>
            }
            extra={<Tag color="cyan" style={{ fontWeight: 600 }}>{t('dash.bank_balance')}: {formatCurrency(bankBalance)}</Tag>}
            style={{ height: '100%', borderRadius: 14, border: '1.5px solid #0891b220', boxShadow: 'none' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('year.opening_bank_balance')}</Typography.Text>
                <Typography.Text style={{ fontWeight: 600, color: 'var(--foreground)' }}>{formatCurrency(openingBankBalance)}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('dash.bank_income')}</Typography.Text>
                <Typography.Text style={{ fontWeight: 700, color: '#16a34a' }}>+{formatCurrency(bankIncome)}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('dash.bank_expense')}</Typography.Text>
                <Typography.Text style={{ fontWeight: 700, color: '#dc2626' }}>-{formatCurrency(bankExpense)}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('dash.bank_profit')}</Typography.Text>
                <Typography.Text style={{ fontWeight: 700, color: bankProfit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(bankProfit)}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#ecfeff', borderRadius: 10, marginTop: 4, border: '1px solid #a5f3fc' }}>
                <div>
                  <Typography.Text strong style={{ fontSize: '0.9rem', color: '#0e7490', display: 'block' }}>{t('dash.bank_balance')}</Typography.Text>
                  <Typography.Text style={{ fontSize: '0.72rem', color: '#06b6d4' }}>
                    {formatCurrency(openingBankBalance)} + {formatCurrency(bankIncome)} - {formatCurrency(bankExpense)}
                  </Typography.Text>
                </div>
                <Typography.Text strong style={{ fontSize: '1.2rem', color: '#0e7490', fontWeight: 800 }}>{formatCurrency(bankBalance)}</Typography.Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Monthly + Accounting Year Details Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CalendarDays size={16} color="var(--primary)" />
                <span>{t('dash.monthly_summary')} — {latestMonth.label}</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: state.language === 'gu' ? 'આ મહિનાની આવક' : 'Monthly Income', value: formatCurrency(monthIncome), color: '#16a34a' },
                { label: state.language === 'gu' ? 'આ મહિનાનો ખર્ચ' : 'Monthly Expense', value: formatCurrency(monthExpense), color: '#dc2626' },
                { label: state.language === 'gu' ? 'મહિનાનો નફો' : 'Monthly Profit', value: formatCurrency(monthProfit), color: monthProfit >= 0 ? '#16a34a' : '#dc2626' },
              ].map((item, idx) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: idx !== 2 ? 12 : 0, borderBottom: idx !== 2 ? '1px solid var(--border)' : 'none' }}>
                  <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{item.label}</Typography.Text>
                  <Typography.Text strong style={{ color: item.color, fontSize: '1rem' }}>{item.value}</Typography.Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BookOpen size={16} color="var(--primary)" />
                <span>{t('dash.year_details')}</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            {selectedYear ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: t('dash.year_name'), value: selectedYear.name },
                  { label: t('dash.start_date'), value: selectedYear.startDate },
                  { label: t('dash.end_date'), value: selectedYear.endDate },
                  { label: t('year.opening_cash_balance'), value: formatCurrency(selectedYear.openingBalance) },
                  { label: t('year.opening_bank_balance'), value: formatCurrency(selectedYear.openingBankBalance || 0) },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{item.label}</Typography.Text>
                    <Typography.Text style={{ fontWeight: 600, color: 'var(--foreground)' }}>{item.value}</Typography.Text>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--hover)', borderRadius: 8, marginTop: 4 }}>
                  <Typography.Text strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{t('general.status')}</Typography.Text>
                  <Tag color="success" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={12} />
                    <span>{selectedYear.status === 'active' ? t('dash.active_year') : t('dash.inactive_year')}</span>
                  </Tag>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>{t('general.no_data')}</Typography.Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Transactions Table */}
      <Card
        title={
          <Space>
            <Clock size={16} color="var(--primary)" />
            <span>{t('dash.recent_txns')}</span>
          </Space>
        }
        extra={<Tag color="blue">{t('dash.recent_limit')}</Tag>}
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}
      >
        <Table<typeof transactions[number]>
          columns={columns}
          dataSource={recentTxns}
          rowKey="id"
          size="middle"
          pagination={false}
          locale={{ emptyText: t('general.no_data') }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  )
}
