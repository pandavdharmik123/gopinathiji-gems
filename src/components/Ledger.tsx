import { useState } from 'react'
import { Select, Button, Table, Tag, Typography, Row, Col, DatePicker } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileText, X, BookOpen } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { formatCurrency } from '../data/mockData'
import { exportPartyLedgerPDF } from '../lib/pdfReportGenerator'
import { formatDisplayDate } from '../lib/dateFormat'
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

  // Running balance resets with the visible filter range. It must not include
  // the company's opening cash balance or hidden prior rows, otherwise the
  // last running balance will not match Credit − Debit for the period.
  const rangeOpeningBalance = 0

  // Transactions visible under the current date filters (also used by PDF).
  const rangedPartyTxns = partyTxns
    .filter(t => {
      const matchFrom = dateFrom ? t.date >= dateFrom : true
      const matchTo = dateTo ? t.date <= dateTo : true
      return matchFrom && matchTo
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

  // Generate Ledger rows
  const getLedgerRows = (): LedgerRow[] => {
    const list: LedgerRow[] = []
    let runningBalance = rangeOpeningBalance

    for (const t of rangedPartyTxns) {
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
  const closingBalance = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].balance : rangeOpeningBalance

  const columns: ColumnsType<LedgerRow> = [
    {
      title: t('general.voucher'),
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 120,
      render: (v: string) => <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: t('general.date'),
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (v: string) => <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatDisplayDate(v)}</span>,
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
      width: 140,
      align: 'right',
      render: (v: number) => v > 0 ? <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(v)}</span> : '—',
    },
    {
      title: t('ledger.debit'),
      dataIndex: 'debit',
      key: 'debit',
      width: 140,
      align: 'right',
      render: (v: number) => v > 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(v)}</span> : '—',
    },
    {
      title: state.language === 'gu' ? 'બાકી રકમ (Running Balance)' : 'Running Balance',
      dataIndex: 'balance',
      key: 'balance',
      width: 160,
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
              {selectedYear.name} ({formatDisplayDate(selectedYear.startDate)} {state.language === 'gu' ? 'થી' : 'to'} {formatDisplayDate(selectedYear.endDate)})
            </Typography.Text>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<FileText size={14} />}
            onClick={() => party && exportPartyLedgerPDF(party, rangedPartyTxns, state.settings, selectedYear, state.language === 'gu')}
            disabled={!party}
            style={{ fontWeight: 600 }}
          >
            PDF
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
        <DatePicker format="DD-MM-YYYY"
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
        <DatePicker format="DD-MM-YYYY"
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
              pagination={{
                defaultPageSize: 15,
                showSizeChanger: true,
                pageSizeOptions: ['15', '30', '50', '100'],
                showTotal: (total) => `${t('general.total')} ${total} ${t('general.records')}`,
                style: { margin: '12px 16px' }
              }}
              locale={{ emptyText: t('general.no_data') }}
              scroll={{ x: 'max-content' }}
              summary={() => {
                if (ledgerRows.length === 0) return null
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: 'var(--muted)' }}>
                      <Table.Summary.Cell index={0} colSpan={3}>
                        <div style={{ fontWeight: 700, textAlign: 'right', color: 'var(--primary)' }}>{t('general.total')}</div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(totalCredit)}</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatCurrency(totalDebit)}</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <span style={{ fontWeight: 700, color: closingBalance >= 0 ? 'var(--primary)' : '#dc2626' }}>{formatCurrency(closingBalance)}</span>
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
