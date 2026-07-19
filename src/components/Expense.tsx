import { useState } from 'react'
import { Button, Input, Modal, Select, Table, Tag, Typography, DatePicker } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { PAYMENT_MODES, EXPENSE_CATEGORIES, formatCurrency, todayStr } from '../data/mockData'
import type { Transaction, User } from '../types'
import dayjs from 'dayjs'
import TransliteratedInput from './TransliteratedInput'

interface ExpenseProps { currentUser: User }

const emptyForm = { date: todayStr(), partyId: '', category: '', amount: '', paymentMode: 'cash', description: '' }

export default function Expense({ currentUser }: ExpenseProps) {
  const { state, createTransaction, updateTransaction, deleteTransaction, t } = useApp()
  
  const categoriesList = state.expenseCategories.map(c => c.name)

  const selectedYear = state.accountingYears.find(y => y.id === state.selectedYearId)
  
  // Filter expense list to selected year
  const expenseList = state.transactions
    .filter(t => t.type === 'expense')
    .filter(t => {
      if (!selectedYear) return true
      return t.date >= selectedYear.startDate && t.date <= selectedYear.endDate
    })

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = expenseList.filter(t => {
    const matchSearch = t.voucherNo.toLowerCase().includes(search.toLowerCase()) ||
      t.partyName.includes(search) || t.description.includes(search)
    const matchCat = filterCategory ? t.category === filterCategory : true
    const matchDate = filterDate ? t.date === filterDate : true
    return matchSearch && matchCat && matchDate
  })

  const handleSave = async () => {
    if (!form.amount || !form.date || !form.category) return

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
        type: 'expense' as const,
        partyId: form.partyId,
        category: form.category,
        amount: Number(form.amount),
        paymentMode: form.paymentMode as Transaction['paymentMode'],
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
    setForm({ date: t.date, partyId: t.partyId, category: t.category, amount: String(t.amount), paymentMode: t.paymentMode, description: t.description })
    setEditId(t.id)
    setShowModal(true)
  }

  const handleDelete = async (t: Transaction) => {
    if (currentUser.role !== 'admin') return
    const msg = state.language === 'gu'
      ? `શું આ ખર્ચ (${t.voucherNo} — ${formatCurrency(t.amount)}) કાઢી નાખવો છે?`
      : `Are you sure you want to delete this expense (${t.voucherNo} — ${formatCurrency(t.amount)})?`
    if (confirm(msg)) {
      try {
        await deleteTransaction(t.id)
      } catch (err) {
        alert(err instanceof Error ? err.message : t('general.delete_error'))
      }
    }
  }

  // Category breakdown
  const categoryTotals = categoriesList.map(cat => ({
    cat, total: expenseList.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const totalExpense = filtered.reduce((s, t) => s + t.amount, 0)

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
      title: state.language === 'gu' ? 'ખર્ચ પ્રકાર' : 'Expense Category',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => <Tag color="error">{v}</Tag>,
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
      render: (v: string) => <span style={{ fontSize: '0.8rem' }}>{PAYMENT_MODES.find(m => m.value === v)?.label}</span>,
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
      render: (v: number) => <span style={{ fontWeight: 700, color: '#dc2626' }}>-{formatCurrency(v)}</span>,
    },
    {
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
    },
  ]

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('expense.title')}</h1>
          <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
            {t('general.total')} {filtered.length} {t('general.records')} —{' '}
            <span style={{ color: '#dc2626', fontWeight: 700 }}>{formatCurrency(totalExpense)}</span>
            {selectedYear && <span style={{ marginLeft: 8 }}>({selectedYear.name})</span>}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <TransliteratedInput
            prefix={<Search size={14} color="var(--muted-foreground)" />}
            placeholder={t('general.search')}
            style={{ width: 180 }}
            value={search}
            onChange={v => setSearch(v)}
            allowClear
          />
          <Select
            style={{ width: 150 }}
            value={filterCategory || undefined}
            placeholder={t('income.category_placeholder')}
            allowClear
            onChange={v => setFilterCategory(v || '')}
            options={categoriesList.map(c => ({ value: c, label: c }))}
          />
          <DatePicker
            placeholder={state.language === 'gu' ? 'તારીખ પસંદ કરો' : 'Select Date'}
            style={{ width: 160 }}
            value={filterDate ? dayjs(filterDate) : null}
            onChange={(date) => setFilterDate(date ? date.format('YYYY-MM-DD') : '')}
          />
          <Button
            type="primary"
            icon={<Plus size={14} />}
            danger
            onClick={() => { setForm({ ...emptyForm }); setEditId(null); setShowModal(true) }}
          >
            {t('expense.add')}
          </Button>
        </div>
      </div>

      {/* Category pills */}
      {categoryTotals.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {categoryTotals.slice(0, 6).map(c => (
            <Tag
              key={c.cat}
              style={{
                cursor: 'pointer',
                padding: '4px 12px',
                fontSize: '0.78rem',
                borderRadius: 999,
                boxShadow: filterCategory === c.cat ? '0 0 0 2px var(--accent)' : 'none',
              }}
              color={filterCategory === c.cat ? 'blue' : 'default'}
              onClick={() => setFilterCategory(filterCategory === c.cat ? '' : c.cat)}
            >
              <span style={{ fontWeight: 600 }}>{c.cat}</span>{' '}
              <span style={{ color: '#dc2626', fontWeight: 700 }}>{formatCurrency(c.total)}</span>
            </Tag>
          ))}
        </div>
      )}

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
        title={<span style={{ color: 'var(--primary)' }}>{editId ? t('expense.edit') : t('expense.add')}</span>}
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
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.category')} *</label>
              <Select
                style={{ width: '100%' }}
                value={form.category || undefined}
                placeholder={`-- ${t('general.category')} --`}
                onChange={v => setForm(f => ({ ...f, category: v }))}
                options={categoriesList.map(c => ({ value: c, label: c }))}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.payment')}</label>
              <Select
                style={{ width: '100%' }}
                value={form.paymentMode}
                onChange={v => setForm(f => ({ ...f, paymentMode: v }))}
                options={PAYMENT_MODES.map(m => ({ value: m.value, label: m.label }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.amount')} (₹) *</label>
              <Input type="number" min="0" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
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
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.description')}</label>
            <TransliteratedInput textArea rows={2} placeholder="..." value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} style={{ resize: 'none' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
