import { useState } from 'react'
import { Tabs, Select, Input, Button, Card, Row, Col, Table, Tag, Progress, Statistic, Space, Typography, DatePicker } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Printer, Download, TrendingUp, TrendingDown, Landmark, Users } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { EXPENSE_CATEGORIES, formatCurrency, todayStr } from '../data/mockData'
import type { Transaction } from '../types'
import dayjs from 'dayjs'

type ReportType = 'daily' | 'monthly' | 'yearly' | 'category' | 'party' | 'pl' | 'outstanding'

interface DailyReportRow {
  date: string
  income: number
  expense: number
  profit: number
  balance: number
}

interface MonthlyReportRow {
  id: string
  voucherNo: string
  date: string
  type: 'income' | 'expense' | 'transfer' | 'adjustment'
  partyName: string
  amount: number
}

interface YearlyReportRow {
  month: string
  inc: number
  exp: number
  profit: number
}

interface CategoryReportRow {
  cat: string
  total: number
  count: number
}

interface PartyReportRow {
  id: string
  voucherNo: string
  date: string
  type: 'income' | 'expense' | 'transfer' | 'adjustment'
  description: string
  amount: number
}

interface PLReportItem {
  id: string
  partyName?: string
  category?: string
  description: string
  amount: number
}

interface OutstandingReportRow {
  id: string
  name: string
  category: string
  credit: number
  debit: number
  net: number
}

export default function Reports() {
  const { state, t } = useApp()
  const { transactions, accountingYears, selectedYearId, parties } = state

  const [reportType, setReportType] = useState<ReportType>('monthly')
  const [selectedParty, setSelectedParty] = useState(parties[0]?.id || '')

  const selectedYear = accountingYears.find(y => y.id === selectedYearId)
  
  // Scope all transactions to the selected active year
  const yearTxns = transactions.filter(t => {
    if (!selectedYear) return true
    return t.date >= selectedYear.startDate && t.date <= selectedYear.endDate
  })

  // Date selections default to active year bounds
  const [month, setMonth] = useState(todayStr().slice(0, 7))

  const tabsItems = [
    { key: 'daily', label: t('reports.tab_daily') },
    { key: 'monthly', label: t('reports.tab_monthly') },
    { key: 'yearly', label: t('reports.tab_yearly') },
    { key: 'category', label: t('reports.tab_category') },
    { key: 'party', label: t('reports.tab_party') },
    { key: 'pl', label: t('reports.tab_pl') },
    { key: 'outstanding', label: t('reports.tab_outstanding') },
  ]

  // Monthly
  const monthTxns = yearTxns.filter(t => t.date.startsWith(month))
  const monthIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Daily summary (grouped by dates within active year)
  const getDailyData = (): DailyReportRow[] => {
    if (yearTxns.length === 0) return []
    const dates = [...new Set(yearTxns.map(t => t.date))].sort((a, b) => a.localeCompare(b.date))
    
    let runningBalance = selectedYear ? selectedYear.openingBalance : 0
    const list: DailyReportRow[] = []

    for (const d of dates) {
      const dayTxns = yearTxns.filter(t => t.date === d)
      const inc = dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const exp = dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      runningBalance += inc - exp
      list.push({ date: d, income: inc, expense: exp, profit: inc - exp, balance: runningBalance })
    }
    return list.reverse() // Newest first
  }
  const dailyData = getDailyData()

  // Yearly monthly breakdown based on selected year dates
  const getMonthsInYear = (): YearlyReportRow[] => {
    if (!selectedYear) return []
    const start = new Date(selectedYear.startDate)
    const end = new Date(selectedYear.endDate)
    const list: YearlyReportRow[] = []

    let current = new Date(start.getFullYear(), start.getMonth(), 1)
    while (current <= end) {
      const yearMonth = current.toISOString().slice(0, 7)
      const mTxns = yearTxns.filter(t => t.date.startsWith(yearMonth))
      const inc = mTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const exp = mTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      list.push({ month: yearMonth, inc, exp, profit: inc - exp })
      current.setMonth(current.getMonth() + 1)
    }
    return list.filter(m => m.inc > 0 || m.exp > 0)
  }
  const yearlyMonths = getMonthsInYear()
  const yearIncome = yearTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const yearExpense = yearTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // Category
  const catData: CategoryReportRow[] = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    total: yearTxns.filter(t => t.type === 'expense' && t.category === cat).reduce((s, t) => s + t.amount, 0),
    count: yearTxns.filter(t => t.type === 'expense' && t.category === cat).length,
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
  const totalCatExpense = catData.reduce((s, c) => s + c.total, 0)

  // Party
  const partyTxns = yearTxns.filter(t => t.partyId === selectedParty)
  const partyCredit = partyTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const partyDebit = partyTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // P&L
  const allIncome = yearTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const allExpense = yearTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netProfit = allIncome - allExpense

  // Outstanding (parties with non-zero balance from transactions within year)
  const outstanding: OutstandingReportRow[] = parties.map(p => {
    const pTxns = yearTxns.filter(t => t.partyId === p.id)
    const credit = pTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const debit = pTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const net = credit - debit
    return { id: p.id, name: p.name, category: p.category, credit, debit, net }
  }).filter(p => Math.abs(p.net) > 0).sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  const exportCSV = (rows: string[][], filename: string) => {
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const monthName = (m: string) => {
    const date = new Date(m + '-01')
    return date.toLocaleDateString(state.language === 'gu' ? 'gu-IN' : 'en-IN', { month: 'long', year: 'numeric' })
  }

  // Columns for reports
  const dailyColumns: ColumnsType<DailyReportRow> = [
    {
      title: t('general.date'),
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{v}</span>,
    },
    {
      title: t('nav.income'),
      dataIndex: 'income',
      key: 'income',
      align: 'right',
      render: (v: number) => <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(v)}</span>,
    },
    {
      title: t('nav.expense'),
      dataIndex: 'expense',
      key: 'expense',
      align: 'right',
      render: (v: number) => <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(v)}</span>,
    },
    {
      title: t('dash.net_profit'),
      dataIndex: 'profit',
      key: 'profit',
      align: 'right',
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
          {v >= 0 ? '+' : ''}{formatCurrency(v)}
        </span>
      ),
    },
    {
      title: state.language === 'gu' ? 'રોકડ સરવૈયું' : 'Running Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(v)}</span>,
    },
  ]

  const monthlyColumns: ColumnsType<MonthlyReportRow> = [
    {
      title: t('general.voucher'),
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      render: (v: string) => <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary)' }}>{v}</span>,
    },
    {
      title: t('general.date'),
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => <span style={{ fontSize: '0.82rem' }}>{v}</span>,
    },
    {
      title: state.language === 'gu' ? 'પ્રકાર' : 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color={v === 'income' ? 'success' : 'error'}>{v === 'income' ? t('nav.income') : t('nav.expense')}</Tag>,
    },
    {
      title: t('general.party'),
      dataIndex: 'partyName',
      key: 'partyName',
      render: (v: string) => <span style={{ fontSize: '0.85rem' }}>{v || '—'}</span>,
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number, record: MonthlyReportRow) => (
        <span style={{ fontWeight: 700, color: record.type === 'income' ? '#16a34a' : '#dc2626' }}>
          {record.type === 'income' ? '+' : '-'}{formatCurrency(v)}
        </span>
      ),
    },
  ]

  const yearlyColumns: ColumnsType<YearlyReportRow> = [
    {
      title: state.language === 'gu' ? 'મહિનો' : 'Month',
      dataIndex: 'month',
      key: 'month',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{monthName(v)}</span>,
    },
    {
      title: t('nav.income'),
      dataIndex: 'inc',
      key: 'inc',
      align: 'right',
      render: (v: number) => <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(v)}</span>,
    },
    {
      title: t('nav.expense'),
      dataIndex: 'exp',
      key: 'exp',
      align: 'right',
      render: (v: number) => <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(v)}</span>,
    },
    {
      title: t('dash.net_profit'),
      dataIndex: 'profit',
      key: 'profit',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: v >= 0 ? '#16a34a' : '#dc2626' }}>
          {v >= 0 ? '+' : ''}{formatCurrency(v)}
        </span>
      ),
    },
  ]

  const partyColumns: ColumnsType<PartyReportRow> = [
    {
      title: t('general.voucher'),
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      render: (v: string) => <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary)' }}>{v}</span>,
    },
    {
      title: t('general.date'),
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => <span style={{ fontSize: '0.82rem' }}>{v}</span>,
    },
    {
      title: state.language === 'gu' ? 'પ્રકાર' : 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color={v === 'income' ? 'success' : 'error'}>{v === 'income' ? t('nav.income') : t('nav.expense')}</Tag>,
    },
    {
      title: t('general.description'),
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => <span style={{ fontSize: '0.82rem', color: 'var(--secondary)' }}>{v || '—'}</span>,
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number, record: PartyReportRow) => (
        <span style={{ fontWeight: 700, color: record.type === 'income' ? '#16a34a' : '#dc2626' }}>
          {record.type === 'income' ? '+' : '-'}{formatCurrency(v)}
        </span>
      ),
    },
  ]

  const outstandingColumns: ColumnsType<OutstandingReportRow> = [
    {
      title: t('general.party'),
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: t('general.category'),
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('ledger.credit'),
      dataIndex: 'credit',
      key: 'credit',
      align: 'right',
      render: (v: number) => <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(v)}</span>,
    },
    {
      title: t('ledger.debit'),
      dataIndex: 'debit',
      key: 'debit',
      align: 'right',
      render: (v: number) => <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(v)}</span>,
    },
    {
      title: t('reports.outstanding_net'),
      dataIndex: 'net',
      key: 'net',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: v >= 0 ? '#16a34a' : '#dc2626' }}>
          {v >= 0 ? '+' : ''}{formatCurrency(v)}
        </span>
      ),
    },
    {
      title: t('reports.outstanding_status'),
      dataIndex: 'net',
      key: 'status',
      render: (v: number) => (
        <Tag color={v > 0 ? 'success' : 'error'}>
          {v > 0 ? t('reports.outstanding_receivable') : t('reports.outstanding_payable')}
        </Tag>
      ),
    },
  ]

  const plIncomeColumns: ColumnsType<PLReportItem> = [
    {
      title: t('reports.income_list'),
      key: 'detail',
      render: (_: unknown, record: PLReportItem) => (
        <span style={{ fontSize: '0.82rem' }}>
          {record.partyName} — {record.description}
        </span>
      ),
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 600, color: '#16a34a' }}>{formatCurrency(v)}</span>,
    },
  ]

  const plExpenseColumns: ColumnsType<PLReportItem> = [
    {
      title: t('reports.expense_list'),
      key: 'detail',
      render: (_: unknown, record: PLReportItem) => (
        <span style={{ fontSize: '0.82rem' }}>
          {record.category} — {record.description}
        </span>
      ),
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatCurrency(v)}</span>,
    },
  ]

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('reports.title')}</h1>
          {selectedYear && (
            <Typography.Text type="secondary" style={{ fontSize: '0.85rem' }}>
              {t('nav.accountingYears')}: {selectedYear.name} ({selectedYear.startDate} {state.language === 'gu' ? 'થી' : 'to'} {selectedYear.endDate})
            </Typography.Text>
          )}
        </div>
        <Button icon={<Printer size={14} />} onClick={() => window.print()}>
          {t('reports.print_pdf')}
        </Button>
      </div>

      {/* Report Type Tabs */}
      <Tabs
        activeKey={reportType}
        onChange={k => setReportType(k as ReportType)}
        items={tabsItems}
        style={{ marginBottom: 20 }}
      />

      {/* Daily Report */}
      {reportType === 'daily' && (
        <div className="summary-card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <Typography.Text strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>
              {t('reports.tab_daily')} ({selectedYear?.name})
            </Typography.Text>
            <Button size="small" icon={<Download size={12} />} onClick={() =>
              exportCSV([[t('general.date'), t('nav.income'), t('nav.expense'), t('dash.net_profit'), state.language === 'gu' ? 'બેલેન્સ' : 'Balance'], ...dailyData.map(d => [d.date, String(d.income), String(d.expense), String(d.profit), String(d.balance)])], 'daily-cashflow-report.csv')
            }>
              CSV
            </Button>
          </div>
          <Table<DailyReportRow>
            columns={dailyColumns}
            dataSource={dailyData}
            rowKey="date"
            size="middle"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{ emptyText: t('general.no_data') }}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}

      {/* Monthly Report */}
      {reportType === 'monthly' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <DatePicker 
              picker="month"
              style={{ width: 180 }} 
              value={month ? dayjs(month + '-01') : null} 
              onChange={(date) => setMonth(date ? date.format('YYYY-MM') : '')} 
              disabledDate={(current) => {
                if (!selectedYear) return false
                const start = dayjs(selectedYear.startDate).startOf('month')
                const end = dayjs(selectedYear.endDate).endOf('month')
                return current && (current.isBefore(start) || current.isAfter(end))
              }}
            />
          </div>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {[
              { label: t('dash.total_income'), value: formatCurrency(monthIncome), color: '#16a34a', bg: '#dcfce7', icon: <TrendingUp size={20} /> },
              { label: t('dash.total_expense'), value: formatCurrency(monthExpense), color: '#dc2626', bg: '#fee2e2', icon: <TrendingDown size={20} /> },
              { label: t('dash.net_profit'), value: formatCurrency(monthIncome - monthExpense), color: '#d4a843', bg: '#fef9c3', icon: <Landmark size={20} /> },
              { label: state.language === 'gu' ? 'કુલ વ્યવહાર' : 'Total Transactions', value: String(monthTxns.length), color: 'var(--primary)', bg: '#dbeafe', icon: <Users size={20} /> },
            ].map(c => (
              <Col xs={24} sm={12} md={6} key={c.label}>
                <Card styles={{ body: { padding: '16px 20px' } }} style={{ border: `2px solid ${c.bg}`, height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>{c.label}</span>
                    <span style={{ color: c.color }}>{c.icon}</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                </Card>
              </Col>
            ))}
          </Row>
          <div className="summary-card" style={{ padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <Typography.Text strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>
                {monthName(month)}
              </Typography.Text>
              <Button size="small" icon={<Download size={12} />} onClick={() =>
                exportCSV([[t('general.voucher'), t('general.date'), state.language === 'gu' ? 'પ્રકાર' : 'Type', t('general.party'), t('general.amount')], ...monthTxns.map(t => [t.voucherNo, t.date, t.type, t.partyName, String(t.amount)])], `monthly-${month}.csv`)
              }>
                CSV
              </Button>
            </div>
            <Table<MonthlyReportRow>
              columns={monthlyColumns}
              dataSource={monthTxns as unknown as MonthlyReportRow[]}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 15, showSizeChanger: false }}
              locale={{ emptyText: t('general.no_data') }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      )}

      {/* Yearly Report (Months Breakdown) */}
      {reportType === 'yearly' && (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {[
              { label: t('dash.total_income'), value: formatCurrency(yearIncome), color: '#16a34a', bg: '#dcfce7', icon: <TrendingUp size={20} /> },
              { label: t('dash.total_expense'), value: formatCurrency(yearExpense), color: '#dc2626', bg: '#fee2e2', icon: <TrendingDown size={20} /> },
              { label: t('dash.net_profit'), value: formatCurrency(yearIncome - yearExpense), color: '#d4a843', bg: '#fef9c3', icon: <Landmark size={20} /> },
              { label: state.language === 'gu' ? 'કુલ વ્યવહાર' : 'Total Transactions', value: String(yearTxns.length), color: 'var(--primary)', bg: '#dbeafe', icon: <Users size={20} /> },
            ].map(c => (
              <Col xs={24} sm={12} md={6} key={c.label}>
                <Card styles={{ body: { padding: '16px 20px' } }} style={{ border: `2px solid ${c.bg}`, height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>{c.label}</span>
                    <span style={{ color: c.color }}>{c.icon}</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                </Card>
              </Col>
            ))}
          </Row>
          <div className="summary-card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <Typography.Text strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>
                {t('reports.tab_yearly')} ({selectedYear?.name})
              </Typography.Text>
            </div>
            <Table<YearlyReportRow>
              columns={yearlyColumns}
              dataSource={yearlyMonths}
              rowKey="month"
              size="middle"
              pagination={false}
              locale={{ emptyText: t('general.no_data') }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      )}

      {/* Category Report */}
      {reportType === 'category' && (
        <div className="summary-card">
          <Typography.Text strong style={{ color: 'var(--primary)', fontSize: '0.95rem', display: 'block', marginBottom: 16 }}>
            {t('reports.tab_category')} ({selectedYear?.name})
          </Typography.Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {catData.map(c => {
              const pct = totalCatExpense > 0 ? (c.total / totalCatExpense) * 100 : 0
              return (
                <div key={c.cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{c.cat} <span style={{ color: 'var(--secondary)', fontSize: '0.78rem', fontWeight: 400 }}>({c.count} {t('general.records')})</span></span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>
                      {formatCurrency(c.total)} <span style={{ color: 'var(--secondary)', fontWeight: 400, fontSize: '0.75rem' }}>({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <Progress percent={pct} strokeColor="linear-gradient(90deg, var(--primary), var(--secondary))" showInfo={false} size={['100%', 8]} style={{ margin: 0 }} />
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid var(--border)', marginTop: 4 }}>
              <Typography.Text strong>{t('dash.total_expense')}</Typography.Text>
              <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '1.05rem' }}>{formatCurrency(totalCatExpense)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Party Report */}
      {reportType === 'party' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Select
              style={{ width: '100%', maxWidth: 280 }}
              value={selectedParty}
              onChange={v => setSelectedParty(v)}
              options={parties.map(p => ({ value: p.id, label: p.name }))}
            />
          </div>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {[
              { label: t('ledger.credit'), value: formatCurrency(partyCredit), color: '#16a34a' },
              { label: t('ledger.debit'), value: formatCurrency(partyDebit), color: '#dc2626' },
              { label: t('reports.outstanding_net'), value: formatCurrency(partyCredit - partyDebit), color: 'var(--primary)' },
              { label: t('general.records'), value: String(partyTxns.length), color: 'var(--secondary)' },
            ].map(c => (
              <Col xs={12} sm={6} key={c.label}>
                <div style={{ background: 'white', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--border)', height: '100%' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: c.color }}>{c.value}</div>
                </div>
              </Col>
            ))}
          </Row>
          <div className="summary-card" style={{ padding: 0 }}>
            <Table<PartyReportRow>
              columns={partyColumns}
              dataSource={partyTxns as unknown as PartyReportRow[]}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 15, showSizeChanger: false }}
              locale={{ emptyText: t('general.no_data') }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      )}

      {/* P&L Report */}
      {reportType === 'pl' && (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div className="summary-card" style={{ padding: 0 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <Typography.Text strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>
                  {t('reports.income_list')}
                </Typography.Text>
              </div>
              <Table<PLReportItem>
                columns={plIncomeColumns}
                dataSource={yearTxns.filter(t => t.type === 'income').slice(0, 8) as unknown as PLReportItem[]}
                rowKey="id"
                size="middle"
                pagination={false}
                summary={() => (
                  <Table.Summary.Row style={{ background: 'var(--muted)' }}>
                    <Table.Summary.Cell index={0}><Typography.Text strong>{t('dash.total_income')}</Typography.Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span style={{ color: '#16a34a', fontSize: '1.05rem', fontWeight: 700 }}>{formatCurrency(allIncome)}</span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div className="summary-card" style={{ padding: 0 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <Typography.Text strong style={{ color: '#dc2626', fontSize: '0.95rem' }}>
                  {t('reports.expense_list')}
                </Typography.Text>
              </div>
              <Table<PLReportItem>
                columns={plExpenseColumns}
                dataSource={yearTxns.filter(t => t.type === 'expense').slice(0, 8) as unknown as PLReportItem[]}
                rowKey="id"
                size="middle"
                pagination={false}
                summary={() => (
                  <Table.Summary.Row style={{ background: 'var(--muted)' }}>
                    <Table.Summary.Cell index={0}><Typography.Text strong>{t('dash.total_expense')}</Typography.Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span style={{ color: '#dc2626', fontSize: '1.05rem', fontWeight: 700 }}>{formatCurrency(allExpense)}</span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </div>
          </Col>
          <Col span={24}>
            <Card
              style={{
                background: netProfit >= 0 ? 'linear-gradient(135deg, #052e16, #166534)' : 'linear-gradient(135deg, #450a0a, #991b1b)',
                borderRadius: 12,
                border: 'none'
              }}
              styles={{ body: { padding: '20px 24px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>{state.language === 'gu' ? 'ચોખ્ખો નફો / નુકસાન' : 'Net Profit / Loss'}</Typography.Text>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>
                    {formatCurrency(allIncome)} − {formatCurrency(allExpense)}
                  </Typography.Text>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d4a843' }}>
                  {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Outstanding Report */}
      {reportType === 'outstanding' && (
        <div className="summary-card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <Typography.Text strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>
              {t('reports.outstanding_title')}
            </Typography.Text>
          </div>
          <Table<OutstandingReportRow>
            columns={outstandingColumns}
            dataSource={outstanding}
            rowKey="id"
            size="middle"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{ emptyText: t('reports.all_settled') }}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}
    </div>
  )
}
