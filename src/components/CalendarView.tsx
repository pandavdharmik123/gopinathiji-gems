import { useState, useMemo } from 'react'
import { Modal, Button, Tag, Table, Typography, Space, Card, Row, Col } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { getGujaratiTithi } from '../lib/gujaratiCalendar'
import { formatCurrency } from '../data/mockData'
import type { Transaction } from '../types'

export default function CalendarView() {
  const { state, t } = useApp()
  const { transactions, accountingYears, selectedYearId } = state
  const isGu = state.language === 'gu'

  // Currently displayed Month & Year (defaults to today)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  // Modal State
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  // Scope transactions to selected accounting year
  const selectedYear = accountingYears.find(y => y.id === selectedYearId)
  const yearTxns = useMemo(() => {
    return transactions.filter(t => {
      if (!selectedYear) return true
      return t.date >= selectedYear.startDate && t.date <= selectedYear.endDate
    })
  }, [transactions, selectedYear])

  // Map transactions by YYYY-MM-DD
  const txnsByDate = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; list: Transaction[] }>()
    yearTxns.forEach(txn => {
      const dateKey = txn.date.split('T')[0]
      if (!map.has(dateKey)) {
        map.set(dateKey, { income: 0, expense: 0, list: [] })
      }
      const item = map.get(dateKey)!
      item.list.push(txn)
      if (txn.type === 'income') {
        item.income += txn.amount
      } else if (txn.type === 'expense') {
        item.expense += txn.amount
      }
    })
    return map
  }, [yearTxns])

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }
  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }
  const resetToToday = () => {
    setCurrentDate(new Date())
  }

  // Calculate calendar grid days
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const { gridDays, monthSummary } = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Sun
    const totalDaysInMonth = lastDayOfMonth.getDate()

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; dateObj: Date }[] = []

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i)
      const dateStr = prevDate.toISOString().split('T')[0]
      days.push({ dateStr, dayNum: prevDate.getDate(), isCurrentMonth: false, dateObj: prevDate })
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const currDate = new Date(year, month, d)
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ dateStr, dayNum: d, isCurrentMonth: true, dateObj: currDate })
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i)
      const dateStr = nextDate.toISOString().split('T')[0]
      days.push({ dateStr, dayNum: i, isCurrentMonth: false, dateObj: nextDate })
    }

    // Monthly summary calculation
    let mIncome = 0
    let mExpense = 0
    txnsByDate.forEach((data, dStr) => {
      const dObj = new Date(dStr)
      if (dObj.getFullYear() === year && dObj.getMonth() === month) {
        mIncome += data.income
        mExpense += data.expense
      }
    })

    return { gridDays: days, monthSummary: { income: mIncome, expense: mExpense } }
  }, [year, month, txnsByDate])

  // Weekday names and pastel color themes
  const weekdayThemes = [
    { nameGu: 'રવિ', nameEn: 'Sun', bg: '#ffe4e6', color: '#e11d48', border: '#fecdd3', cellBg: '#fff5f5' },
    { nameGu: 'સોમ', nameEn: 'Mon', bg: '#e0f2fe', color: '#0284c7', border: '#bae6fd', cellBg: '#f0f9ff' },
    { nameGu: 'મંગળ', nameEn: 'Tue', bg: '#f3e8ff', color: '#9333ea', border: '#e9d5ff', cellBg: '#faf5ff' },
    { nameGu: 'બુધ', nameEn: 'Wed', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', cellBg: '#f0fdf4' },
    { nameGu: 'ગુરુ', nameEn: 'Thu', bg: '#fef3c7', color: '#b45309', border: '#fde68a', cellBg: '#fffbeb' },
    { nameGu: 'શુક્ર', nameEn: 'Fri', bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4', cellBg: '#f0fdfa' },
    { nameGu: 'શનિ', nameEn: 'Sat', bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe', cellBg: '#eef2ff' },
  ]

  const isToday = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0]
    return dateStr === todayStr
  }

  // Handle cell click
  const handleDateClick = (dateStr: string) => {
    setSelectedDateStr(dateStr)
    setIsModalOpen(true)
  }

  // Modal Transaction List for selected date
  const selectedDayData = useMemo(() => {
    if (!selectedDateStr) return { income: 0, expense: 0, list: [] }
    return txnsByDate.get(selectedDateStr) || { income: 0, expense: 0, list: [] }
  }, [selectedDateStr, txnsByDate])

  // Opening and Closing balance calculation for selected day
  const { dayOpeningBalance, dayClosingBalance } = useMemo(() => {
    if (!selectedDateStr) return { dayOpeningBalance: 0, dayClosingBalance: 0 }

    const baseOpening = selectedYear?.openingBalance || 0

    // Sum up all transactions prior to selectedDateStr within active year
    const priorTxns = yearTxns.filter(t => {
      const dateKey = t.date.split('T')[0]
      return dateKey < selectedDateStr
    })

    const priorIncome = priorTxns
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const priorExpense = priorTxns
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const openBal = baseOpening + priorIncome - priorExpense
    const closeBal = openBal + selectedDayData.income - selectedDayData.expense

    return { dayOpeningBalance: openBal, dayClosingBalance: closeBal }
  }, [selectedDateStr, selectedYear, yearTxns, selectedDayData])

  // Separate Income & Expense lists
  const incomeList = useMemo(() => {
    return selectedDayData.list.filter(t => t.type === 'income')
  }, [selectedDayData.list])

  const expenseList = useMemo(() => {
    return selectedDayData.list.filter(t => t.type === 'expense')
  }, [selectedDayData.list])

  const selectedGujaratiDateStr = useMemo(() => {
    if (!selectedDateStr) return ''
    return getGujaratiTithi(selectedDateStr)
  }, [selectedDateStr])

  const formattedMonthHeader = useMemo(() => {
    const dateLocale = state.language === 'gu' ? 'gu-IN' : 'en-IN'
    return currentDate.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })
  }, [currentDate, state.language])

  // Table Columns for Income
  const incomeColumns: ColumnsType<Transaction> = [
    {
      title: t('general.voucher'),
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 90,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: t('general.party'),
      dataIndex: 'partyName',
      key: 'partyName',
      render: (v: string, r) => <span>{v || r.description || '—'}</span>,
    },
    {
      title: t('general.category'),
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <span style={{ fontSize: '0.82rem' }}>{v || '—'}</span>,
    },
    {
      title: t('general.payment'),
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      render: (v: string) => <Tag style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>{v}</Tag>,
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#16a34a' }}>
          {formatCurrency(v)}
        </span>
      ),
    },
  ]

  // Table Columns for Expense
  const expenseColumns: ColumnsType<Transaction> = [
    {
      title: t('general.voucher'),
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 90,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: t('general.party'),
      dataIndex: 'partyName',
      key: 'partyName',
      render: (v: string, r) => <span>{v || r.description || '—'}</span>,
    },
    {
      title: t('general.category'),
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <span style={{ fontSize: '0.82rem' }}>{v || '—'}</span>,
    },
    {
      title: t('general.payment'),
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      render: (v: string) => <Tag style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>{v}</Tag>,
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#dc2626' }}>
          {formatCurrency(v)}
        </span>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', gap: 16 }}>
      {/* Calendar Header / Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography.Title level={3} style={{ margin: 0, fontWeight: 700, textTransform: 'capitalize' }}>
            {formattedMonthHeader}
          </Typography.Title>
          <Space>
            <Button icon={<ChevronLeft size={16} />} onClick={prevMonth} />
            <Button icon={<ChevronRight size={16} />} onClick={nextMonth} />
            <Button icon={<CalendarIcon size={14} />} onClick={resetToToday}>
              {state.language === 'gu' ? 'આજે' : 'Today'}
            </Button>
          </Space>
        </div>

        {/* Monthly Total Summary */}
        <Space size={16}>
          <div style={{ background: '#ecfdf5', padding: '6px 14px', borderRadius: 8, border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} color="#10b981" />
            <span style={{ fontSize: '0.82rem', color: '#065f46', fontWeight: 600 }}>
              {t('nav.income')}: +{formatCurrency(monthSummary.income)}
            </span>
          </div>
          <div style={{ background: '#fef2f2', padding: '6px 14px', borderRadius: 8, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={16} color="#ef4444" />
            <span style={{ fontSize: '0.82rem', color: '#991b1b', fontWeight: 600 }}>
              {t('nav.expense')}: -{formatCurrency(monthSummary.expense)}
            </span>
          </div>
        </Space>
      </div>

      {/* Main Grid Container */}
      <Card
        styles={{ body: { padding: 12, overflowX: 'auto' } }}
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}
      >
        <div style={{ minWidth: 620, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Weekday Column Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', fontWeight: 700, paddingBottom: 4 }}>
          {weekdayThemes.map((theme, idx) => (
            <div
              key={idx}
              style={{
                background: theme.bg,
                color: theme.color,
                border: `1px solid ${theme.border}`,
                borderRadius: 6,
                padding: '6px 0',
                fontSize: '0.88rem',
                fontWeight: 700,
              }}
            >
              {state.language === 'gu' ? theme.nameGu : theme.nameEn}
            </div>
          ))}
        </div>

        {/* Calendar Day Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 4 }}>
          {gridDays.map((cell, idx) => {
            const dayData = txnsByDate.get(cell.dateStr)
            const tithiStr = getGujaratiTithi(cell.dateObj)
            const shortTithi = tithiStr ? tithiStr.split(',')[0] : ''
            const today = isToday(cell.dateStr)

            const colIdx = idx % 7
            const theme = weekdayThemes[colIdx]

            // Dynamic light pastel background & border based on activity
            let cellBg = cell.isCurrentMonth ? theme.cellBg : '#f8fafc'
            let cellBorder = cell.isCurrentMonth ? theme.border : '#e2e8f0'

            if (cell.isCurrentMonth && dayData) {
              if (dayData.income > 0 && dayData.expense > 0) {
                cellBg = '#fefce8' // Light pastel yellow
                cellBorder = '#fde047'
              } else if (dayData.income > 0) {
                cellBg = '#f0fdf4' // Light pastel green
                cellBorder = '#86efac'
              } else if (dayData.expense > 0) {
                cellBg = '#fff1f2' // Light pastel red/pink
                cellBorder = '#fda4af'
              }
            }

            if (today) {
              cellBg = '#eff6ff' // Vibrant light blue
              cellBorder = '#2563eb'
            }

            return (
              <div
                key={idx}
                onClick={() => handleDateClick(cell.dateStr)}
                style={{
                  border: today ? '2px solid #2563eb' : `1px solid ${cellBorder}`,
                  borderRadius: 8,
                  padding: '6px 8px',
                  background: cellBg,
                  opacity: cell.isCurrentMonth ? 1 : 0.4,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.18s ease',
                  minHeight: 85,
                  boxShadow: today
                    ? '0 4px 12px rgba(37,99,235,0.18)'
                    : dayData?.list.length
                    ? '0 3px 8px rgba(0,0,0,0.05)'
                    : '0 1px 3px rgba(0,0,0,0.02)',
                }}
                className="calendar-day-cell"
              >
                {/* Cell Header: Date Number & Gujarati Tithi */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      color: today ? '#1d4ed8' : '#1e293b',
                      background: today ? '#dbeafe' : 'transparent',
                      borderRadius: 4,
                      padding: today ? '0 5px' : 0,
                    }}
                  >
                    {cell.dayNum}
                  </span>
                  {shortTithi && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        color: cell.isCurrentMonth ? '#475569' : '#94a3b8',
                        fontWeight: 600,
                        textAlign: 'right',
                        lineHeight: 1.1,
                        background: '#ffffffd0',
                        padding: '1px 4px',
                        borderRadius: 4,
                        border: '1px solid rgba(0,0,0,0.04)',
                      }}
                    >
                      {shortTithi}
                    </span>
                  )}
                </div>

                {/* Daily Financial Badges */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {dayData && dayData.income > 0 && (
                    <div
                      style={{
                        background: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      +{formatCurrency(dayData.income)}
                    </div>
                  )}
                  {dayData && dayData.expense > 0 && (
                    <div
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fda4af',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      -{formatCurrency(dayData.expense)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      </Card>

      {/* Date Details Modal */}
      <Modal
        title={
          <div style={{ paddingRight: 24 }}>
            <Typography.Title level={4} style={{ margin: 0, color: 'var(--primary)' }}>
              {selectedDateStr}
            </Typography.Title>
            {selectedGujaratiDateStr && (
              <Typography.Text style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 600 }}>
                {selectedGujaratiDateStr}
              </Typography.Text>
            )}
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsModalOpen(false)}>
            {t('general.ok')}
          </Button>,
        ]}
        width={920}
        style={{ maxWidth: '95vw', top: 20 }}
      >
        <div style={{ marginTop: 16 }}>
          {/* Day Balances & Totals Banner */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', fontWeight: 600 }}>
                  {isGu ? 'શરૂઆત બેલેન્સ' : 'Balance Before Day Start'}
                </span>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
                  {formatCurrency(dayOpeningBalance)}
                </span>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', color: '#166534', display: 'block', fontWeight: 600 }}>
                  {t('nav.income')}
                </span>
                <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '1rem' }}>
                  +{formatCurrency(selectedDayData.income)}
                </span>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 12px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', color: '#991b1b', display: 'block', fontWeight: 600 }}>
                  {t('nav.expense')}
                </span>
                <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '1rem' }}>
                  -{formatCurrency(selectedDayData.expense)}
                </span>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 12px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.75rem', color: '#1e40af', display: 'block', fontWeight: 600 }}>
                  {isGu ? 'અંત બેલેન્સ' : 'Balance After Day End'}
                </span>
                <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '1rem' }}>
                  {formatCurrency(dayClosingBalance)}
                </span>
              </div>
            </Col>
          </Row>

          {/* Side-by-Side Income & Expense Tables */}
          <Row gutter={[16, 16]}>
            {/* Left Column: Income */}
            <Col xs={24} lg={12}>
              <Card
                size="small"
                styles={{ body: { padding: 0, overflow: 'hidden' } }}
                style={{ border: '1px solid #bbf7d0', borderRadius: 8, height: '100%', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TrendingUp size={16} color="#16a34a" />
                      {isGu ? 'આવક (Income)' : 'Income'}
                    </span>
                    <Tag color="success" style={{ margin: 0, fontWeight: 700 }}>
                      +{formatCurrency(selectedDayData.income)}
                    </Tag>
                  </div>
                }
              >
                {incomeList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '0.88rem' }}>
                    {isGu ? 'કોઈ આવક નથી' : 'No Income recorded'}
                  </div>
                ) : (
                  <Table
                    className="flat-table"
                    dataSource={incomeList}
                    columns={incomeColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    scroll={{ x: true }}
                  />
                )}
              </Card>
            </Col>

            {/* Right Column: Expense */}
            <Col xs={24} lg={12}>
              <Card
                size="small"
                styles={{ body: { padding: 0, overflow: 'hidden' } }}
                style={{ border: '1px solid #fecaca', borderRadius: 8, height: '100%', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#991b1b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TrendingDown size={16} color="#dc2626" />
                      {isGu ? 'ખર્ચ (Expenses)' : 'Expenses'}
                    </span>
                    <Tag color="error" style={{ margin: 0, fontWeight: 700 }}>
                      -{formatCurrency(selectedDayData.expense)}
                    </Tag>
                  </div>
                }
              >
                {expenseList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '0.88rem' }}>
                    {isGu ? 'કોઈ ખર્ચ નથી' : 'No Expenses recorded'}
                  </div>
                ) : (
                  <Table
                    className="flat-table"
                    dataSource={expenseList}
                    columns={expenseColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    scroll={{ x: true }}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </div>
      </Modal>
    </div>
  )
}

