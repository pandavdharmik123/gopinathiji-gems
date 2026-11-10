import { useState } from 'react'
import { Button, Card, Col, Input, Modal, Row, Select, Table, Tag, Typography, Space, DatePicker } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, CheckCircle, Edit, Trash2, FileText } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { formatCurrency } from '../data/mockData'
import { exportCashBookPDF } from '../lib/pdfReportGenerator'
import type { User, AccountingYear } from '../types'
import dayjs from 'dayjs'
import TransliteratedInput from './TransliteratedInput'
import { formatDisplayDate } from '../lib/dateFormat'
import { useToast } from './Toast'
import { useConfirm } from './ConfirmDialog'

interface CashBookProps { currentUser: User }

const emptyForm = { name: '', startDate: '', endDate: '', openingBalance: '', openingBankBalance: '', notes: '', status: 'inactive' as 'active' | 'inactive' }

export default function CashBook({ currentUser }: CashBookProps) {
  const { state, createAccountingYear, updateAccountingYear, deleteAccountingYear, setSelectedYearId, t } = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const years = state.accountingYears

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.name || !form.startDate || !form.endDate) return
    const isGu = state.language === 'gu'
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        openingBalance: Number(form.openingBalance) || 0,
        openingBankBalance: Number(form.openingBankBalance) || 0,
        notes: form.notes,
        status: form.status,
      }
      if (editId) {
        await updateAccountingYear(editId, payload)
      } else {
        await createAccountingYear(payload)
      }

      toast.success(
        editId
          ? isGu ? 'નાણાકીય વર્ષ અપડેટ થયું' : 'Financial year updated'
          : isGu ? 'નાણાકીય વર્ષ બન્યું' : 'Financial year created',
        `${form.name} · ${formatDisplayDate(form.startDate)} – ${formatDisplayDate(form.endDate)}`
      )

      setShowModal(false)
      setForm({ ...emptyForm })
      setEditId(null)
    } catch (err) {
      toast.error(
        isGu ? 'નાણાકીય વર્ષ સાચવી શકાયું નથી' : 'Could not save financial year',
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (y: AccountingYear) => {
    setForm({
      name: y.name,
      startDate: y.startDate,
      endDate: y.endDate,
      openingBalance: String(y.openingBalance ?? 0),
      openingBankBalance: String(y.openingBankBalance ?? 0),
      notes: y.notes,
      status: y.status
    })
    setEditId(y.id)
    setShowModal(true)
  }

  const handleDelete = async (y: AccountingYear) => {
    if (currentUser.role !== 'admin') return
    const isGu = state.language === 'gu'
    const ok = await confirm({
      title: isGu ? 'નાણાકીય વર્ષ કાઢી નાખવું?' : 'Delete this financial year?',
      description: `${y.name} · ${formatDisplayDate(y.startDate)} – ${formatDisplayDate(y.endDate)}`,
      confirmText: isGu ? 'કાઢી નાખો' : 'Delete',
      cancelText: isGu ? 'રદ કરો' : 'Cancel',
      tone: 'danger',
    })
    if (!ok) return

    try {
      await deleteAccountingYear(y.id)
      toast.success(isGu ? 'નાણાકીય વર્ષ કાઢી નાખ્યું' : 'Financial year deleted', y.name)
    } catch (err) {
      toast.error(
        isGu ? 'નાણાકીય વર્ષ કાઢી શકાયું નથી' : 'Could not delete financial year',
        err instanceof Error ? err.message : undefined
      )
    }
  }

  const handleSetActive = async (y: AccountingYear) => {
    const isGu = state.language === 'gu'
    try {
      await updateAccountingYear(y.id, { status: 'active' })
      toast.success(
        isGu ? 'સક્રિય નાણાકીય વર્ષ બદલાયું' : 'Active financial year changed',
        y.name
      )
    } catch (err) {
      toast.error(
        isGu ? 'સક્રિય વર્ષ બદલી શકાયું નથી' : 'Could not change active year',
        err instanceof Error ? err.message : undefined
      )
    }
  }

  const selectedYear = years.find(y => y.id === state.selectedYearId)

  const columns: ColumnsType<AccountingYear> = [
    {
      title: t('year.name'),
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: t('year.start'),
      dataIndex: 'startDate',
      key: 'startDate',
      render: (v: string) => <span>{formatDisplayDate(v)}</span>,
    },
    {
      title: t('year.end'),
      dataIndex: 'endDate',
      key: 'endDate',
      render: (v: string) => <span>{formatDisplayDate(v)}</span>,
    },
    {
      title: t('year.opening_cash_balance'),
      dataIndex: 'openingBalance',
      key: 'openingBalance',
      align: 'right',
      render: (v: number) => <span style={{  }}>{formatCurrency(v)}</span>,
    },
    {
      title: t('year.opening_bank_balance'),
      dataIndex: 'openingBankBalance',
      key: 'openingBankBalance',
      align: 'right',
      render: (v: number) => <span style={{ color: '#2563eb', fontWeight: 600 }}>{formatCurrency(v || 0)}</span>,
    },
    {
      title: t('general.notes'),
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string) => <span style={{ fontSize: '0.82rem', color: 'var(--secondary)' }}>{v || '—'}</span>,
    },
    {
      title: t('general.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string, record) => (
        <Space>
          <Tag color={v === 'active' ? 'success' : 'default'}>
            {v === 'active' ? t('general.active') : t('general.inactive')}
          </Tag>
          {record.id === state.selectedYearId && (
            <Tag color="blue">{state.language === 'gu' ? 'હાલ પસંદ કરેલ' : 'Current Selection'}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('general.action'),
      key: 'action',
      fixed: 'right',
      width: 280,
      render: (_: unknown, record: AccountingYear) => (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
          {record.status !== 'active' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle size={13} />}
              onClick={() => handleSetActive(record)}
            >
              {t('year.set_active_btn')}
            </Button>
          )}
          {record.id !== state.selectedYearId && (
            <Button
              size="small"
              onClick={() => setSelectedYearId(record.id)}
            >
              {t('year.select_btn')}
            </Button>
          )}
          <Button
            size="small"
            icon={<Edit size={13} />}
            onClick={() => handleEdit(record)}
          >
            {t('general.edit')}
          </Button>
          {currentUser.role === 'admin' && (
            <Button
              size="small"
              danger
              icon={<Trash2 size={13} />}
              onClick={() => handleDelete(record)}
            >
              {t('general.delete')}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('year.title')}</h1>
          <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
            {years.length} {t('year.records_count')}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<FileText size={14} />}
            onClick={() => exportCashBookPDF(years, selectedYear, state.settings, state.language === 'gu')}
            style={{ fontWeight: 600 }}
          >
            PDF
          </Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => { setForm({ ...emptyForm }); setEditId(null); setShowModal(true) }}>
            {t('year.add')}
          </Button>
        </div>
      </div>

      {selectedYear && (
        <Card style={{ marginBottom: 20, background: 'var(--primary)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: '16px 24px' } }}>
          <Row gutter={[16, 12]} align="middle" justify="space-between">
            <Col>
              <Typography.Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                {t('year.active_card_title')}
              </Typography.Text>
              <Typography.Text style={{ color: 'white', fontSize: '1.25rem', fontWeight: 700 }}>
                {selectedYear.name}
              </Typography.Text>
            </Col>
            <Col>
              <Row gutter={24}>
                <Col>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', display: 'block' }}>{t('year.start')}</Typography.Text>
                  <Typography.Text style={{ color: 'white', fontWeight: 600 }}>{formatDisplayDate(selectedYear.startDate)}</Typography.Text>
                </Col>
                <Col>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', display: 'block' }}>{t('year.end')}</Typography.Text>
                  <Typography.Text style={{ color: 'white', fontWeight: 600 }}>{formatDisplayDate(selectedYear.endDate)}</Typography.Text>
                </Col>
                <Col>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', display: 'block' }}>{t('year.opening_cash_balance')}</Typography.Text>
                  <Typography.Text style={{ color: '#86efac', fontWeight: 700 }}>{formatCurrency(selectedYear.openingBalance)}</Typography.Text>
                </Col>
                <Col>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', display: 'block' }}>{t('year.opening_bank_balance')}</Typography.Text>
                  <Typography.Text style={{ color: '#93c5fd', fontWeight: 700 }}>{formatCurrency(selectedYear.openingBankBalance || 0)}</Typography.Text>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>
      )}

      <div className="summary-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table<AccountingYear>
          columns={columns}
          dataSource={years}
          rowKey="id"
          size="middle"
          pagination={{
            defaultPageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50', '100'],
            showTotal: (total) => `${t('general.total')} ${total} ${t('general.records')}`,
            style: { margin: '16px 20px' }
          }}
          locale={{ emptyText: t('general.no_data') }}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        title={<span style={{ color: 'var(--primary)' }}>{editId ? t('year.edit') : t('year.add')}</span>}
        okText={saving ? t('general.saving') : t('general.save')}
        cancelText={t('general.cancel')}
        width={480}
        destroyOnHidden
      >
        <div style={{ display: 'grid', gap: 14, paddingTop: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('year.name')} *</label>
            <TransliteratedInput placeholder="e.g. FY 2026-27" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('year.start')} *</label>
              <DatePicker format="DD-MM-YYYY"
                value={form.startDate ? dayjs(form.startDate) : null}
                onChange={(date) => setForm(f => ({ ...f, startDate: date ? date.format('YYYY-MM-DD') : '' }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('year.end')} *</label>
              <DatePicker format="DD-MM-YYYY"
                value={form.endDate ? dayjs(form.endDate) : null}
                onChange={(date) => setForm(f => ({ ...f, endDate: date ? date.format('YYYY-MM-DD') : '' }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('year.opening_cash_balance')} (₹)</label>
              <Input type="number" placeholder="0" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('year.opening_bank_balance')} (₹)</label>
              <Input type="number" placeholder="0" value={form.openingBankBalance} onChange={e => setForm(f => ({ ...f, openingBankBalance: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.status')}</label>
            <Select
              style={{ width: '100%' }}
              value={form.status}
              onChange={v => setForm(f => ({ ...f, status: v }))}
              options={[
                { value: 'active', label: t('general.active') },
                { value: 'inactive', label: t('general.inactive') }
              ]}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('general.notes')}</label>
            <TransliteratedInput textArea rows={2} placeholder="..." value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} style={{ resize: 'none' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
