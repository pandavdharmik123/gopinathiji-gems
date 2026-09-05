import { useState, useMemo } from 'react'
import {
  Select,
  Input,
  Button,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Typography,
  DatePicker
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  Printer,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Search,
  RotateCcw,
  Scale,
  FileSpreadsheet,
  Filter,
  Coins,
  Landmark,
  Smartphone,
  CreditCard,
  Phone,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { EXPENSE_CATEGORIES, formatCurrency, todayStr } from '../data/mockData'
import { exportComprehensiveReportsPDF } from '../lib/pdfReportGenerator'
import { getGujaratiTithi } from '../lib/gujaratiCalendar'
import TransliteratedInput from './TransliteratedInput'
import type { Transaction } from '../types'
import dayjs, { type Dayjs } from 'dayjs'

type DatePreset = 'all' | 'month' | 'today' | 'custom'

interface OutstandingReportRow {
  id: string
  name: string
  category: string
  mobile?: string
  credit: number
  debit: number
  net: number
}

export default function Reports() {
  const { state, t } = useApp()
  const { transactions, accountingYears, selectedYearId, parties } = state

  // Active accounting year
  const selectedYear = accountingYears.find(y => y.id === selectedYearId)
  const isGu = state.language === 'gu'

  // Header Filters State
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [search, setSearch] = useState('')
  const [selectedParty, setSelectedParty] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('all')

  // Base scope: transactions within the active accounting year
  const yearTxns = useMemo(() => {
    return transactions.filter(t => {
      if (!selectedYear) return true
      return t.date >= selectedYear.startDate && t.date <= selectedYear.endDate
    })
  }, [transactions, selectedYear])

  // Filtered transactions based on header controls
  const filteredTxns = useMemo(() => {
    const term = search.trim().toLowerCase()
    const today = todayStr()
    const currentMonth = today.slice(0, 7)

    return yearTxns.filter(txn => {
      // Search filter (trimmed)
      if (term) {
        const matchSearch =
          txn.voucherNo.toLowerCase().includes(term) ||
          txn.partyName.toLowerCase().includes(term) ||
          txn.description.toLowerCase().includes(term) ||
          txn.category.toLowerCase().includes(term)
        if (!matchSearch) return false
      }

      // Date Preset / Range filter
      if (datePreset === 'today') {
        if (txn.date !== today) return false
      } else if (datePreset === 'month') {
        if (!txn.date.startsWith(currentMonth)) return false
      } else if (datePreset === 'custom' && customRange && customRange[0] && customRange[1]) {
        const fromStr = customRange[0].format('YYYY-MM-DD')
        const toStr = customRange[1].format('YYYY-MM-DD')
        if (txn.date < fromStr || txn.date > toStr) return false
      }

      // Party filter
      if (selectedParty !== 'all' && txn.partyId !== selectedParty) {
        return false
      }

      // Category filter
      if (selectedCategory !== 'all' && txn.category !== selectedCategory) {
        return false
      }

      // Payment Mode filter
      if (selectedPaymentMode !== 'all' && txn.paymentMode !== selectedPaymentMode) {
        return false
      }

      return true
    })
  }, [yearTxns, search, datePreset, customRange, selectedParty, selectedCategory, selectedPaymentMode])

  // High-level Metrics (Calculated dynamically on filtered transactions)
  const metrics = useMemo(() => {
    const totalIncome = filteredTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const totalExpense = filteredTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const netProfit = totalIncome - totalExpense
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0

    const cashIncome = filteredTxns.filter(t => t.type === 'income' && t.paymentMode === 'cash').reduce((s, t) => s + t.amount, 0)
    const cashExpense = filteredTxns.filter(t => t.type === 'expense' && t.paymentMode === 'cash').reduce((s, t) => s + t.amount, 0)
    const bankIncome = filteredTxns.filter(t => t.type === 'income' && t.paymentMode === 'bank').reduce((s, t) => s + t.amount, 0)
    const bankExpense = filteredTxns.filter(t => t.type === 'expense' && t.paymentMode === 'bank').reduce((s, t) => s + t.amount, 0)

    return {
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin,
      cashIncome,
      cashExpense,
      bankIncome,
      bankExpense,
      txnCount: filteredTxns.length
    }
  }, [filteredTxns])

  // Reset all filters
  const handleResetFilters = () => {
    setDatePreset('all')
    setCustomRange(null)
    setSearch('')
    setSelectedParty('all')
    setSelectedCategory('all')
    setSelectedPaymentMode('all')
  }

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (datePreset !== 'all') count++
    if (search.trim()) count++
    if (selectedParty !== 'all') count++
    if (selectedCategory !== 'all') count++
    if (selectedPaymentMode !== 'all') count++
    return count
  }, [datePreset, search, selectedParty, selectedCategory, selectedPaymentMode])



  // Outstanding Balances Generator
  const outstandingData = useMemo<OutstandingReportRow[]>(() => {
    return parties.map(p => {
      const pTxns = filteredTxns.filter(t => t.partyId === p.id)
      const credit = pTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const debit = pTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      const net = credit - debit
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        mobile: p.mobile,
        credit,
        debit,
        net
      }
    }).filter(p => p.credit > 0 || p.debit > 0).sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  }, [parties, filteredTxns])

  // Total Receivables & Payables for filtered scope
  const outstandingTotals = useMemo(() => {
    let totalReceivable = 0
    let totalPayable = 0
    outstandingData.forEach(p => {
      if (p.net > 0) totalReceivable += p.net
      if (p.net < 0) totalPayable += Math.abs(p.net)
    })
    return { totalReceivable, totalPayable }
  }, [outstandingData])

  // Render Table Columns
  const transactionColumns: ColumnsType<Transaction> = [
    {
      title: t('general.voucher'),
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 110,
      render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--secondary)', fontSize: '0.82rem' }}>{v}</span>
    },
    {
      title: t('general.date'),
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (v: string) => {
        const tithi = getGujaratiTithi(v)
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{v}</div>
            {tithi && <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>{tithi}</div>}
          </div>
        )
      }
    },
    {
      title: isGu ? 'પ્રકાર' : 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 95,
      render: (type: string) => (
        <Tag color={type === 'income' ? 'success' : 'error'} style={{ fontWeight: 600, borderRadius: 6 }}>
          {type === 'income' ? (isGu ? 'આવક' : 'Income') : (isGu ? 'ખર્ચ' : 'Expense')}
        </Tag>
      )
    },
    {
      title: t('general.party'),
      dataIndex: 'partyName',
      key: 'partyName',
      render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{v || '—'}</span>
    },
    {
      title: t('general.category'),
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => v ? <Tag color="processing" style={{ borderRadius: 6 }}>{v}</Tag> : '—'
    },
    {
      title: t('general.payment'),
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      width: 130,
      render: (mode: string) => {
        if (mode === 'cash') {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
              <Coins size={14} color="#15803d" />
              <span>{isGu ? 'રોકડા' : 'Cash'}</span>
            </span>
          )
        }
        if (mode === 'bank') {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#0369a1', fontWeight: 600 }}>
              <Landmark size={14} color="#0369a1" />
              <span>{isGu ? 'બેંક' : 'Bank'}</span>
            </span>
          )
        }
        if (mode === 'upi') {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#7e22ce', fontWeight: 600 }}>
              <Smartphone size={14} color="#7e22ce" />
              <span>{isGu ? 'યુ.પી.આઈ' : 'UPI'}</span>
            </span>
          )
        }
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: '#c2410c', fontWeight: 600 }}>
            <CreditCard size={14} color="#c2410c" />
            <span>{isGu ? 'ચેક' : 'Cheque'}</span>
          </span>
        )
      }
    },
    {
      title: t('general.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => <span style={{ color: 'var(--secondary)', fontSize: '0.82rem' }}>{v || '—'}</span>
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 130,
      render: (v: number, record: Transaction) => (
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: record.type === 'income' ? '#16a34a' : '#dc2626' }}>
          {record.type === 'income' ? '+' : '-'}{formatCurrency(v)}
        </span>
      )
    }
  ]

  const outstandingColumns: ColumnsType<OutstandingReportRow> = [
    {
      title: t('general.party'),
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record) => (
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v}</span>
          {record.mobile && (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Phone size={12} />
              <span>{record.mobile}</span>
            </div>
          )}
        </div>
      )
    },
    {
      title: t('general.category'),
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <Tag color="blue" style={{ borderRadius: 6 }}>{v || 'Party'}</Tag>
    },
    {
      title: t('ledger.credit'),
      dataIndex: 'credit',
      key: 'credit',
      align: 'right',
      render: (v: number) => <span style={{ color: '#16a34a', fontWeight: 700 }}>{formatCurrency(v)}</span>
    },
    {
      title: t('ledger.debit'),
      dataIndex: 'debit',
      key: 'debit',
      align: 'right',
      render: (v: number) => <span style={{ color: '#dc2626', fontWeight: 700 }}>{formatCurrency(v)}</span>
    },
    {
      title: t('reports.outstanding_net'),
      dataIndex: 'net',
      key: 'net',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 800, fontSize: '1rem', color: v >= 0 ? '#16a34a' : '#dc2626' }}>
          {v >= 0 ? '+' : ''}{formatCurrency(v)}
        </span>
      )
    },
    {
      title: t('reports.outstanding_status'),
      dataIndex: 'net',
      key: 'status',
      align: 'center',
      render: (v: number) => (
        <Tag
          color={v >= 0 ? 'success' : 'error'}
          style={{
            fontWeight: 700,
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: '0.8rem',
            border: 'none',
            background: v >= 0 ? '#dcfce7' : '#fee2e2',
            color: v >= 0 ? '#15803d' : '#b91c1c'
          }}
        >
          {v >= 0 ? (isGu ? 'લેવાના (Receivable)' : 'Receivable') : (isGu ? 'આપવાના (Payable)' : 'Payable')}
        </Tag>
      )
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── Modern Page Header ────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          padding: '20px 24px',
          borderRadius: 16,
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--foreground)' }}>
              {t('reports.title')}
            </h1>
            {selectedYear && (
              <Tag color="cyan" style={{ borderRadius: 12, fontWeight: 600, padding: '2px 10px' }}>
                {selectedYear.name} ({selectedYear.startDate} ~ {selectedYear.endDate})
              </Tag>
            )}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: '0.82rem', marginTop: 4, display: 'block' }}>
            {isGu ? 'તમામ નાણાકીય વ્યવહારો, આવક-ખર્ચ, અને ખાતાવહીનું જીવંત વિશ્લેષણ' : 'Real-time financial analytics, cash flow, and party ledgers'}
          </Typography.Text>
        </div>

        {/* Global Header Actions */}
        <Space size="small" wrap>
          <Button
            type="primary"
            icon={<FileText size={15} />}
            onClick={() => exportComprehensiveReportsPDF(filteredTxns, state.parties, state.settings, selectedYear, datePreset !== 'all' ? `${dateFrom} ~ ${dateTo}` : undefined, state.language === 'gu')}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            {t('reports.print_pdf')}
          </Button>
          {activeFiltersCount > 0 && (
            <Button
              icon={<RotateCcw size={14} />}
              onClick={handleResetFilters}
              danger
              style={{ borderRadius: 8 }}
            >
              {t('reports.reset_filters')} ({activeFiltersCount})
            </Button>
          )}
        </Space>
      </div>

      {/* ─── Sleek Header Filter Controls ─────────────────────────────────── */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
          background: '#ffffff'
        }}
        styles={{ body: { padding: '18px 20px' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--primary)" />
            <Typography.Text strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>
              {t('reports.filter_title')}
            </Typography.Text>
          </div>

          {/* Filter Controls Grid */}
          <Row gutter={[12, 12]} align="middle">
            {/* Search Input (auto-trimmed with Gujarati transliteration) */}
            <Col xs={24} sm={12} md={6}>
              <TransliteratedInput
                placeholder={t('general.search')}
                prefix={<Search size={15} color="var(--muted-foreground)" />}
                value={search}
                onChange={v => setSearch(v)}
                allowClear
                style={{ borderRadius: 8, width: '100%' }}
              />
            </Col>

            {/* Date Preset Selector */}
            <Col xs={24} sm={12} md={6}>
              <Select
                style={{ width: '100%' }}
                value={datePreset}
                onChange={v => setDatePreset(v as DatePreset)}
                options={[
                  { value: 'all', label: `🗓️ ${t('reports.this_year')}` },
                  { value: 'month', label: `📆 ${t('reports.this_month')}` },
                  { value: 'today', label: `⚡ ${t('reports.today')}` },
                  { value: 'custom', label: `🔍 ${t('reports.custom_range')}` },
                ]}
              />
            </Col>

            {/* Custom Range Picker (conditionally active) */}
            {datePreset === 'custom' && (
              <Col xs={24} sm={12} md={6}>
                <DatePicker.RangePicker
                  style={{ width: '100%', borderRadius: 8 }}
                  value={customRange}
                  onChange={dates => setCustomRange(dates)}
                  disabledDate={current => {
                    if (!selectedYear) return false
                    const start = dayjs(selectedYear.startDate)
                    const end = dayjs(selectedYear.endDate)
                    return current && (current.isBefore(start, 'day') || current.isAfter(end, 'day'))
                  }}
                />
              </Col>
            )}

            {/* Party Selector */}
            <Col xs={24} sm={12} md={datePreset === 'custom' ? 6 : 4}>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder={t('reports.all_parties')}
                value={selectedParty}
                onChange={v => setSelectedParty(v)}
                optionFilterProp="label"
                options={[
                  { value: 'all', label: `👥 ${t('reports.all_parties')}` },
                  ...parties.map(p => ({ value: p.id, label: p.name })),
                ]}
              />
            </Col>

            {/* Category Selector */}
            <Col xs={24} sm={12} md={datePreset === 'custom' ? 6 : 4}>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder={t('reports.all_categories')}
                value={selectedCategory}
                onChange={v => setSelectedCategory(v)}
                optionFilterProp="label"
                options={[
                  { value: 'all', label: `🏷️ ${t('reports.all_categories')}` },
                  ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c })),
                ]}
              />
            </Col>

            {/* Payment Mode Selector */}
            <Col xs={24} sm={12} md={datePreset === 'custom' ? 6 : 4}>
              <Select
                style={{ width: '100%' }}
                placeholder={t('reports.all_modes')}
                value={selectedPaymentMode}
                onChange={v => setSelectedPaymentMode(v)}
                options={[
                  { value: 'all', label: `💳 ${t('reports.all_modes')}` },
                  { value: 'cash', label: '💵 ' + (isGu ? 'રોકડા (Cash)' : 'Cash') },
                  { value: 'bank', label: '🏦 ' + (isGu ? 'બેંક (Bank)' : 'Bank') },
                ]}
              />
            </Col>
          </Row>
        </div>
      </Card>

      {/* ─── Modern Dynamic Summary Metric Cards ───────────────────────────── */}
      <Row gutter={[16, 16]}>
        {/* Income Card */}
        <Col xs={24} sm={12} lg={6}>
          <div
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
              border: '1.5px solid #bbf7d0',
              borderRadius: 14,
              padding: '18px 20px',
              position: 'relative',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Typography.Text strong style={{ fontSize: '0.78rem', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('dash.total_income')}
                </Typography.Text>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: 4 }}>
                  {formatCurrency(metrics.totalIncome)}
                </div>
              </div>
              <div style={{ background: '#dcfce7', padding: 8, borderRadius: 10, color: '#16a34a' }}>
                <TrendingUp size={20} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#16a34a', display: 'flex', gap: 8 }}>
              <span>💵 {formatCurrency(metrics.cashIncome)}</span>
              <span>•</span>
              <span>🏦 {formatCurrency(metrics.bankIncome)}</span>
            </div>
          </div>
        </Col>

        {/* Expense Card */}
        <Col xs={24} sm={12} lg={6}>
          <div
            style={{
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)',
              border: '1.5px solid #fed7aa',
              borderRadius: 14,
              padding: '18px 20px',
              position: 'relative',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Typography.Text strong style={{ fontSize: '0.78rem', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('dash.total_expense')}
                </Typography.Text>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c2410c', marginTop: 4 }}>
                  {formatCurrency(metrics.totalExpense)}
                </div>
              </div>
              <div style={{ background: '#ffedd5', padding: 8, borderRadius: 10, color: '#ea580c' }}>
                <TrendingDown size={20} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#ea580c', display: 'flex', gap: 8 }}>
              <span>💵 {formatCurrency(metrics.cashExpense)}</span>
              <span>•</span>
              <span>🏦 {formatCurrency(metrics.bankExpense)}</span>
            </div>
          </div>
        </Col>

        {/* Net Profit Card */}
        <Col xs={24} sm={12} lg={6}>
          <div
            style={{
              background: metrics.netProfit >= 0
                ? 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)'
                : 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)',
              border: `1.5px solid ${metrics.netProfit >= 0 ? '#bfdbfe' : '#fecaca'}`,
              borderRadius: 14,
              padding: '18px 20px',
              position: 'relative',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Typography.Text strong style={{ fontSize: '0.78rem', color: metrics.netProfit >= 0 ? '#1d4ed8' : '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('dash.net_profit')}
                </Typography.Text>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: metrics.netProfit >= 0 ? '#1d4ed8' : '#b91c1c', marginTop: 4 }}>
                  {metrics.netProfit >= 0 ? '+' : ''}{formatCurrency(metrics.netProfit)}
                </div>
              </div>
              <div style={{ background: metrics.netProfit >= 0 ? '#dbeafe' : '#fee2e2', padding: 8, borderRadius: 10, color: metrics.netProfit >= 0 ? '#2563eb' : '#dc2626' }}>
                <DollarSign size={20} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: metrics.netProfit >= 0 ? '#2563eb' : '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{t('reports.margin')}:</span>
              <strong>{metrics.profitMargin.toFixed(1)}%</strong>
            </div>
          </div>
        </Col>

        {/* Outstanding / Volume Summary Card */}
        <Col xs={24} sm={12} lg={6}>
          <div
            style={{
              background: 'linear-gradient(135deg, #fdf4ff 0%, #ffffff 100%)',
              border: '1.5px solid #f5d0fe',
              borderRadius: 14,
              padding: '18px 20px',
              position: 'relative',
              boxShadow: '0 2px 8px rgba(168, 85, 247, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Typography.Text strong style={{ fontSize: '0.78rem', color: '#86198f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {isGu ? 'બાકી લેણાં / દેવાં' : 'Outstanding Balances'}
                </Typography.Text>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#86198f', marginTop: 4, display: 'flex', gap: 10 }}>
                  <span style={{ color: '#16a34a' }}>+{formatCurrency(outstandingTotals.totalReceivable)}</span>
                  <span style={{ color: '#dc2626' }}>-{formatCurrency(outstandingTotals.totalPayable)}</span>
                </div>
              </div>
              <div style={{ background: '#fae8ff', padding: 8, borderRadius: 10, color: '#a855f7' }}>
                <Scale size={20} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#9333ea', display: 'flex', justifyContent: 'space-between' }}>
              <span>{isGu ? 'ફિલ્ટર વ્યવહાર' : 'Filtered Records'}: <strong>{metrics.txnCount}</strong></span>
              <span>{isGu ? 'પાર્ટીઓ' : 'Parties'}: <strong>{parties.length}</strong></span>
            </div>
          </div>
        </Col>
      </Row>



      {/* ─── Filtered Transactions List ────────────────────────────────────────── */}
      <Card
        bordered={false}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <FileSpreadsheet size={18} color="var(--primary)" />
              <span style={{ fontWeight: 700 }}>{isGu ? 'ફિલ્ટર કરેલા વ્યવહારો' : 'Filtered Transactions'}</span>
            </Space>
            <Tag color="blue" style={{ borderRadius: 8, fontWeight: 600 }}>
              {filteredTxns.length} {t('general.records')}
            </Tag>
          </div>
        }
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}
      >
        <Table<Transaction>
          columns={transactionColumns}
          dataSource={filteredTxns}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], style: { margin: '16px 20px' } }}
          locale={{ emptyText: t('general.no_data') }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* ─── Party Outstanding Balances (Filtered Scope) ───────────────────────── */}
      {outstandingData.length > 0 && (
        <Card
          bordered={false}
          title={
            <Space>
              <Scale size={18} color="var(--primary)" />
              <span style={{ fontWeight: 700 }}>{t('reports.outstanding_title')}</span>
            </Space>
          }
          extra={
            <Tag color="purple" style={{ borderRadius: 8, fontWeight: 600 }}>
              {outstandingData.length} {isGu ? 'પાર્ટીઓ' : 'Parties'}
            </Tag>
          }
          styles={{ body: { padding: 0 } }}
          style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}
        >
          <Table<OutstandingReportRow>
            columns={outstandingColumns}
            dataSource={outstandingData}
            rowKey="id"
            size="middle"
            pagination={{ pageSize: 10, showSizeChanger: true, style: { margin: '16px 20px' } }}
            locale={{ emptyText: t('reports.all_settled') }}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}
    </div>
  )
}
