import { useState } from 'react'
import { Select, Input, Button, Card, Table, Tag, Typography, Row, Col, Space, DatePicker } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Download, Printer, X, BookOpen } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { formatCurrency } from '../data/mockData'
import dayjs from 'dayjs'

interface LedgerRow {
  id: string
  voucherNo: string
  date: string
  type: 'income' | 'expense' | 'transfer' | 'adjustment'
  description: string
  category: string
  credit: number
  debit: number
  balance: number
}

export default function Ledger() {
  const { state, t } = useApp()
  const [selectedPartyId, setSelectedPartyId] = useState(state.parties[0]?.id || '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const selectedYear = state.accountingYears.find(y => y.id === state.selectedYearId)
  const party = state.parties.find(p => p.id === selectedPartyId)

  // Scope transactions to the active financial year
  const yearTxns = state.transactions.filter(t => {
    if (!selectedYear) return true
    return t.date >= selectedYear.startDate && t.date <= selectedYear.endDate
  })

  // Filter party transactions
  const partyTxns = yearTxns.filter(t => t.partyId === selectedPartyId)

  // Calculate opening balance for the ledger range
  const getOpeningBalanceForRange = (): number => {
    if (!selectedYear || !party) return 0
    let bal = selectedYear.openingBalance // Or party base opening balance if available
    
    // Sum transactions before the range start date
    if (dateFrom) {
      const priorTxns = partyTxns.filter(t => t.date < dateFrom)
      const credit = priorTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const debit = priorTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      bal += credit - debit
    }
    return bal
  }
  const rangeOpeningBalance = getOpeningBalanceForRange()

  // Generate Ledger rows
  const getLedgerRows = (): LedgerRow[] => {
    const list: LedgerRow[] = []
    let runningBalance = rangeOpeningBalance

    // Filter within range date bounds
    const rangedTxns = partyTxns.filter(t => {
      const matchFrom = dateFrom ? t.date >= dateFrom : true
      const matchTo = dateTo ? t.date <= dateTo : true
      return matchFrom && matchTo
    }).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

    for (const t of rangedTxns) {
      const isCredit = t.type === 'income'
      const credit = isCredit ? t.amount : 0
      const debit = !isCredit ? t.amount : 0
      runningBalance += credit - debit

      list.push({
        id: t.id,
        voucherNo: t.voucherNo,
        date: t.date,
        type: t.type,
        description: t.description,
        category: t.category,
        credit,
        debit,
        balance: runningBalance,
      })
    }
    return list
  }

  const ledgerRows = getLedgerRows()

  const totalCredit = ledgerRows.reduce((s, r) => s + r.credit, 0)
  const totalDebit = ledgerRows.reduce((s, r) => s + r.debit, 0)
  const netBalance = totalCredit - totalDebit

  const exportCSV = () => {
    if (!party) return
    const headers = [t('general.voucher'), t('general.date'), t('general.description'), t('ledger.credit'), t('ledger.debit'), state.language === 'gu' ? 'બેલેન્સ' : 'Balance']
    const rows = ledgerRows.map(r => [r.voucherNo, r.date, r.description, r.credit, r.debit, r.balance].join(','))
    const csv = [
      `${state.language === 'gu' ? 'પાર્ટી લેજર' : 'Party Ledger'}: ${party.name}`,
      headers.join(','),
      ...rows
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger-${party.name.replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: ColumnsType<LedgerRow> = [
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
      render: (v: string) => <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{v}</span>,
    },
    {
      title: t('general.description'),
      dataIndex: 'description',
      key: 'description',
      render: (v: string, record: LedgerRow) => (
        <div>
          <span style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem' }}>{v || '—'}</span>
          {record.category && <Tag style={{ marginTop: 4, fontSize: '0.72rem' }}>{record.category}</Tag>}
        </div>
      ),
    },
    {
      title: t('ledger.credit'),
      dataIndex: 'credit',
      key: 'credit',
      align: 'right',
      render: (v: number) => v > 0 ? <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(v)}</span> : '—',
    },
    {
      title: t('ledger.debit'),
      dataIndex: 'debit',
      key: 'debit',
      align: 'right',
      render: (v: number) => v > 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(v)}</span> : '—',
    },
    {
      title: state.language === 'gu' ? 'બાકી રકમ (Running Balance)' : 'Running Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: v >= 0 ? 'var(--primary)' : '#dc2626' }}>
          {formatCurrency(v)}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('ledger.title')}</h1>
          {selectedYear && (
            <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
              {selectedYear.name} ({selectedYear.startDate} {state.language === 'gu' ? 'થી' : 'to'} {selectedYear.endDate})
            </Typography.Text>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<Download size={14} />} onClick={exportCSV} disabled={!party}>
            CSV
          </Button>
          <Button icon={<Printer size={14} />} onClick={() => window.print()} disabled={!party}>
            {t('reports.print_pdf')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <Select
          style={{ minWidth: 240 }}
          value={selectedPartyId || undefined}
          placeholder={t('ledger.party_select')}
          onChange={v => setSelectedPartyId(v || '')}
          showSearch
          filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
          options={state.parties.map(p => ({
            value: p.id,
            label: `${p.name} (${p.category})`
          }))}
        />
        <DatePicker
          placeholder={state.language === 'gu' ? 'શરૂઆત' : 'Start'}
          style={{ width: 150 }}
          value={dateFrom ? dayjs(dateFrom) : null}
          onChange={(date) => setDateFrom(date ? date.format('YYYY-MM-DD') : '')}
          disabledDate={(current) => {
            if (!selectedYear) return false
            const start = dayjs(selectedYear.startDate)
            const end = dayjs(selectedYear.endDate)
            return current && (current.isBefore(start, 'day') || current.isAfter(end, 'day'))
          }}
        />
        <DatePicker
          placeholder={state.language === 'gu' ? 'અંત' : 'End'}
          style={{ width: 150 }}
          value={dateTo ? dayjs(dateTo) : null}
          onChange={(date) => setDateTo(date ? date.format('YYYY-MM-DD') : '')}
          disabledDate={(current) => {
            if (!selectedYear) return false
            const start = dayjs(selectedYear.startDate)
            const end = dayjs(selectedYear.endDate)
            return current && (current.isBefore(start, 'day') || current.isAfter(end, 'day'))
          }}
        />
        {(dateFrom || dateTo) && (
          <Button icon={<X size={14} />} onClick={() => { setDateFrom(''); setDateTo('') }}>{t('general.clear')}</Button>
        )}
      </div>

      {/* Party summary */}
      {party && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          {[
            { label: t('ledger.credit'), value: formatCurrency(totalCredit), color: '#16a34a', bg: '#dcfce7' },
            { label: t('ledger.debit'), value: formatCurrency(totalDebit), color: '#dc2626', bg: '#fee2e2' },
            { label: t('reports.outstanding_net'), value: formatCurrency(netBalance), color: netBalance >= 0 ? '#16a34a' : '#dc2626', bg: netBalance >= 0 ? '#dcfce7' : '#fee2e2' },
            { label: t('general.records'), value: String(ledgerRows.length), color: 'var(--primary)', bg: '#dbeafe' },
          ].map(c => (
            <Col xs={12} sm={6} key={c.label}>
              <div style={{ background: 'white', borderRadius: 10, padding: '14px 18px', border: `2px solid ${c.bg}` }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      <div className="summary-card" style={{ padding: 0, overflow: 'hidden' }}>
        {!selectedPartyId ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--secondary)' }}>
            <BookOpen size={40} style={{ marginBottom: 12, color: 'var(--secondary)', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '0.95rem' }}>{t('ledger.party_select')}</p>
          </div>
        ) : (
          <>
            {party && (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <Typography.Text strong style={{ fontSize: '0.95rem', color: 'var(--primary)', display: 'block' }}>{party.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: '0.8rem' }}>
                  {party.category} | {party.mobile} | {party.address}
                </Typography.Text>
              </div>
            )}
            <Table<LedgerRow>
              columns={columns}
              dataSource={ledgerRows}
              rowKey="id"
              size="middle"
              pagination={false}
              locale={{ emptyText: t('general.no_data') }}
              scroll={{ x: 'max-content' }}
              summary={() => {
                if (ledgerRows.length === 0) return null
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: 'var(--muted)' }}>
                      <Table.Summary.Cell index={0} colSpan={4}>
                        <div style={{ fontWeight: 700, textAlign: 'right', color: 'var(--primary)' }}>{t('general.total')}</div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(totalCredit)}</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatCurrency(totalDebit)}</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <span style={{ fontWeight: 700, color: netBalance >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(netBalance)}</span>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
