import { useState } from 'react'
import { Button, Input, Modal, Select, Table, Tag, Typography, DatePicker } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Search, Pencil, Trash2, Download, X } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { PAYMENT_MODES, INCOME_CATEGORIES, EXPENSE_CATEGORIES, formatCurrency, todayStr } from '../data/mockData'
import type { Transaction, User } from '../types'
import dayjs from 'dayjs'
import TransliteratedInput from './TransliteratedInput'

interface TransactionsProps { currentUser: User }

const emptyForm = {
  date: todayStr(), type: 'income' as Transaction['type'],
  partyId: '', category: '', amount: '', paymentMode: 'bank' as Transaction['paymentMode'], description: ''
}

export default function Transactions({ currentUser }: TransactionsProps) {
  const { state, createTransaction, updateTransaction, deleteTransaction, t } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedYear = state.accountingYears.find(y => y.id === state.selectedYearId)

  // Scope transactions to current accounting year
  const all = [...state.transactions]
    .filter(t => {
      if (!selectedYear) return true
      return t.date >= selectedYear.startDate && t.date <= selectedYear.endDate
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const filtered = all.filter(t => {
    const matchSearch = t.voucherNo.toLowerCase().includes(search.toLowerCase()) ||
      t.partyName.includes(search) || t.description.includes(search) || t.category.includes(search)
    const matchType = filterType ? t.type === filterType : true
    const matchMode = filterMode ? t.paymentMode === filterMode : true
    const matchFrom = filterDateFrom ? t.date >= filterDateFrom : true
    const matchTo = filterDateTo ? t.date <= filterDateTo : true
    return matchSearch && matchType && matchMode && matchFrom && matchTo
  })

  const txnTypeLabel: Record<string, string> = {
    income: t('nav.income'),
    expense: t('nav.expense'),
    transfer: state.language === 'gu' ? 'ટ્રાન્સફર' : 'Transfer',
    adjustment: state.language === 'gu' ? 'ગોઠવણ' : 'Adjustment'
  }

  const txnTypeColor: Record<string, string> = {
    income: 'success', expense: 'error', transfer: 'processing', adjustment: 'warning'
  }

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const handleSave = async () => {
    if (!form.amount || !form.date) return

    // Validate date falls within selected accounting year
    if (selectedYear) {
      if (form.date < selectedYear.startDate || form.date > selectedYear.endDate) {
        alert(`${t('general.date_validation_error')} (${selectedYear.startDate} - ${selectedYear.endDate})`)
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        date: form.date,
        type: form.type,
        partyId: form.partyId,
        category: form.category,
        amount: Number(form.amount),
        paymentMode: form.paymentMode,
        description: form.description,
      }
      if (editId) {
        await updateTransaction(editId, payload)
      } else {
        await createTransaction(payload)
      }
      setShowModal(false)
      setForm({ ...emptyForm })
      setEditId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('general.save_error'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (t: Transaction) => {
    setForm({ date: t.date, type: t.type, partyId: t.partyId, category: t.category, amount: String(t.amount), paymentMode: t.paymentMode, description: t.description })
    setEditId(t.id)
    setShowModal(true)
  }

  const handleDelete = async (t: Transaction) => {
    if (currentUser.role !== 'admin') return
    const msg = state.language === 'gu'
      ? `શું આ વ્યવહાર (${t.voucherNo}) કાઢી નાખવો છે?`
      : `Are you sure you want to delete transaction ${t.voucherNo}?`
    if (confirm(msg)) {
      try {
        await deleteTransaction(t.id)
      } catch (err) {
        alert(err instanceof Error ? err.message : t('general.delete_error'))
      }
    }
  }

  const exportCSV = () => {
    const headers = [t('general.voucher'), t('general.date'), state.language === 'gu' ? 'પ્રકાર' : 'Type', t('general.party'), t('general.category'), t('general.payment'), t('general.description'), t('general.amount')]
    const rows = filtered.map(t => [t.voucherNo, t.date, txnTypeLabel[t.type], t.partyName, t.category, t.paymentMode, t.description, t.amount].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `transactions-${todayStr()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const hasFilters = search || filterType || filterMode || filterDateFrom || filterDateTo
  const categories = state.expenseCategories.map(c => c.name)

  const actionColumn: ColumnsType<Transaction>[number] = {
    title: t('general.action'),
    key: 'action',
    render: (_: unknown, record: Transaction) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="small" icon={<Pencil size={13} />} onClick={() => handleEdit(record)}>{t('general.edit')}</Button>
        {currentUser.role === 'admin' && (
          <Button size="small" danger icon={<Trash2 size={13} />} onClick={() => handleDelete(record)}>{t('general.delete')}</Button>
        )}
      </div>
    ),
  }

  const columns: ColumnsType<Transaction> = [
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
      title: state.language === 'gu' ? 'પ્રકાર' : 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag color={txnTypeColor[v]}>{txnTypeLabel[v]}</Tag>,
    },
    {
      title: t('general.party'),
      dataIndex: 'partyName',
      key: 'partyName',
      ellipsis: true,
      render: (v: string) => <span style={{ fontWeight: 500 }}>{v || '—'}</span>,
    },
    {
      title: t('general.category'),
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <span style={{ fontSize: '0.8rem' }}>{v || '—'}</span>,
    },
    {
      title: t('general.payment'),
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      render: (v: string) => <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>{PAYMENT_MODES.find(m => m.value === v)?.label}</span>,
    },
    {
      title: t('general.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>{v || '—'}</span>,
    },
    {
      title: t('general.amount'),
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number, record: Transaction) => (
        <span style={{ fontWeight: 700, color: record.type === 'income' ? '#16a34a' : record.type === 'expense' ? '#dc2626' : 'var(--primary)' }}>
          {record.type === 'income' ? '+' : record.type === 'expense' ? '-' : ''}{formatCurrency(v)}
        </span>
      ),
    },
    ...(currentUser.role !== 'employee' ? [actionColumn] : []),
  ]

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('txn.title')}</h1>
          <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
            {filtered.length} {t('general.records')} &nbsp;|&nbsp;
            <span style={{ color: '#16a34a', fontWeight: 700 }}>+{formatCurrency(totalIncome)}</span>
            &nbsp;/&nbsp;
            <span style={{ color: '#dc2626', fontWeight: 700 }}>-{formatCurrency(totalExpense)}</span>
            {selectedYear && <span style={{ marginLeft: 8 }}>({selectedYear.name})</span>}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<Download size={14} />} onClick={exportCSV}>CSV</Button>
          {currentUser.role !== 'employee' && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => { setForm({ ...emptyForm }); setEditId(null); setShowModal(true) }}>
              {t('txn.add')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <TransliteratedInput
          prefix={<Search size={14} color="var(--muted-foreground)" />}
          placeholder={t('general.search')}
          style={{ width: 200 }}
          value={search}
          onChange={v => setSearch(v)}
          allowClear
        />
        <Select
          style={{ width: 130 }}
          value={filterType || undefined}
          placeholder={state.language === 'gu' ? 'બધા પ્રકાર' : 'All Types'}
          allowClear
          onChange={v => setFilterType(v || '')}
          options={[
            { value: 'income', label: t('nav.income') },
            { value: 'expense', label: t('nav.expense') },
            { value: 'transfer', label: state.language === 'gu' ? 'ટ્રાન્સફર' : 'Transfer' },
            { value: 'adjustment', label: state.language === 'gu' ? 'ગોઠવણ' : 'Adjustment' },
          ]}
        />
        <Select
          style={{ width: 140 }}
          value={filterMode || undefined}
          placeholder={state.language === 'gu' ? 'બધી ચુકવણી' : 'All Payments'}
          allowClear
          onChange={v => setFilterMode(v || '')}
          options={PAYMENT_MODES.map(m => ({ value: m.value, label: m.label }))}
        />
        <DatePicker
          placeholder={state.language === 'gu' ? 'શરૂઆત' : 'Start'}
          style={{ width: 150 }}
          value={filterDateFrom ? dayjs(filterDateFrom) : null}
          onChange={(date) => setFilterDateFrom(date ? date.format('YYYY-MM-DD') : '')}
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
          value={filterDateTo ? dayjs(filterDateTo) : null}
          onChange={(date) => setFilterDateTo(date ? date.format('YYYY-MM-DD') : '')}
          disabledDate={(current) => {
            if (!selectedYear) return false
            const start = dayjs(selectedYear.startDate)
            const end = dayjs(selectedYear.endDate)
            return current && (current.isBefore(start, 'day') || current.isAfter(end, 'day'))
          }}
        />
        {hasFilters && (
          <Button icon={<X size={14} />} onClick={() => { setSearch(''); setFilterType(''); setFilterMode(''); setFilterDateFrom(''); setFilterDateTo('') }}>
            {t('general.clear')}
          </Button>
        )}
      </div>

      <div className="summary-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table<Transaction>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="middle"
          pagination={{ pageSize: 15, showSizeChanger: false, showTotal: (total) => `${t('general.total')} ${total} ${t('general.records')}` }}
          locale={{ emptyText: t('general.no_data') }}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        title={<span style={{ color: 'var(--primary)' }}>{editId ? t('txn.edit') : t('txn.add')}</span>}
        okText={saving ? t('general.saving') : t('general.save')}
        cancelText={t('general.cancel')}
        width={560}
        destroyOnClose
      >
        <div style={{ display: 'grid', gap: 14, paddingTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.date')} *</label>
              <DatePicker 
                value={form.date ? dayjs(form.date) : null} 
                onChange={(date) => setForm(f => ({ ...f, date: date ? date.format('YYYY-MM-DD') : '' }))}
                disabledDate={(current) => {
                  if (!selectedYear) return false
                  const start = dayjs(selectedYear.startDate)
                  const end = dayjs(selectedYear.endDate)
                  return current && (current.isBefore(start, 'day') || current.isAfter(end, 'day'))
                }}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{state.language === 'gu' ? 'વ્યવહારનો પ્રકાર *' : 'Transaction Type *'}</label>
              <Select
                style={{ width: '100%' }}
                value={form.type}
                onChange={v => setForm(f => ({ ...f, type: v as Transaction['type'], category: '' }))}
                options={[
                  { value: 'income', label: t('nav.income') },
                  { value: 'expense', label: t('nav.expense') },
                  { value: 'transfer', label: state.language === 'gu' ? 'ટ્રાન્સફર' : 'Transfer' },
                  { value: 'adjustment', label: state.language === 'gu' ? 'ગોઠવણ' : 'Adjustment' },
                ]}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.category')}</label>
              <Select
                style={{ width: '100%' }}
                value={form.category || undefined}
                placeholder={`-- ${t('general.category')} --`}
                allowClear
                onChange={v => setForm(f => ({ ...f, category: v || '' }))}
                options={categories.map(c => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.payment')}</label>
              <Select
                style={{ width: '100%' }}
                value={form.paymentMode}
                onChange={v => setForm(f => ({ ...f, paymentMode: v as Transaction['paymentMode'] }))}
                options={PAYMENT_MODES.map(m => ({ value: m.value, label: m.label }))}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.party')}</label>
              <Select
                style={{ width: '100%' }}
                value={form.partyId || undefined}
                placeholder={t('ledger.party_select')}
                allowClear
                onChange={v => setForm(f => ({ ...f, partyId: v || '' }))}
                options={state.parties.filter(p => p.status === 'active').map(p => ({ value: p.id, label: p.name }))}
                showSearch
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.amount')} (₹) *</label>
              <Input type="number" min="0" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.description')}</label>
            <TransliteratedInput textArea rows={2} placeholder="..." value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} style={{ resize: 'none' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
