import { useState, useMemo } from 'react'
import {
  Card,
  Button,
  Select,
  Modal,
  Tag,
  Avatar,
  Space,
  Typography,
  Table,
  Popconfirm,
  Tooltip
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  Plus,
  Search,
  Edit2,
  Check,
  X,
  Phone,
  MapPin,
  FileText,
  User as UserIcon,
  Building2,
  RotateCcw
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { PARTY_CATEGORIES, formatCurrency } from '../data/mockData'
import type { Party, User as UserType } from '../types'
import TransliteratedInput from './TransliteratedInput'

interface PartiesProps {
  currentUser: UserType
}

const emptyForm: Omit<Party, 'id' | 'balance' | 'createdAt'> = {
  name: '',
  category: '',
  contactPerson: '',
  mobile: '',
  email: '',
  gst: '',
  address: '',
  notes: '',
  status: 'active'
}

export default function Parties({ currentUser }: PartiesProps) {
  const { state, createParty, updateParty, t } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isGu = state.language === 'gu'

  // Compute running balance from transactions
  const partyBalance = (partyId: string) => {
    const txns = state.transactions.filter(t => t.partyId === partyId)
    const credit = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const debit = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return credit - debit
  }

  // Filtered Parties list
  const filtered = useMemo(() => {
    return state.parties.filter(p => {
      const term = search.trim().toLowerCase()
      const matchSearch = !term ||
        p.name.toLowerCase().includes(term) ||
        p.contactPerson.toLowerCase().includes(term) ||
        p.mobile.includes(term) ||
        p.email.toLowerCase().includes(term) ||
        p.address.toLowerCase().includes(term) ||
        p.gst.toLowerCase().includes(term)

      const matchCat = filterCat ? p.category === filterCat : true
      const matchStatus = filterStatus === 'all' ? true : p.status === filterStatus

      return matchSearch && matchCat && matchStatus
    })
  }, [state.parties, search, filterCat, filterStatus])

  // Aggregate balance totals for filtered parties
  const { totalReceivable, totalPayable } = useMemo(() => {
    let rec = 0
    let pay = 0
    filtered.forEach(p => {
      const bal = partyBalance(p.id)
      if (bal > 0) rec += bal
      if (bal < 0) pay += Math.abs(bal)
    })
    return { totalReceivable: rec, totalPayable: pay }
  }, [filtered, state.transactions])

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await updateParty(editId, form)
      } else {
        await createParty(form)
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

  const handleEdit = (p: Party) => {
    setForm({
      name: p.name,
      category: p.category,
      contactPerson: p.contactPerson,
      mobile: p.mobile,
      email: p.email,
      gst: p.gst,
      address: p.address,
      notes: p.notes,
      status: p.status
    })
    setEditId(p.id)
    setShowModal(true)
  }

  const handleToggleStatus = async (p: Party) => {
    if (currentUser.role !== 'admin') return
    try {
      await updateParty(p.id, { status: p.status === 'active' ? 'inactive' : 'active' })
    } catch (err) {
      alert(err instanceof Error ? err.message : t('general.save_error'))
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setFilterCat('')
    setFilterStatus('all')
  }

  // Table Columns Definition
  const columns: ColumnsType<Party> = [
    {
      title: '#',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_val, _rec, idx) => (
        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', fontWeight: 600 }}>
          {idx + 1}
        </span>
      )
    },
    {
      title: t('general.party'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, p: Party) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            shape="square"
            size={36}
            style={{
              background: 'linear-gradient(135deg, var(--primary), #00a8ff)',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: 'white',
              borderRadius: 8,
              flexShrink: 0
            }}
          >
            {name.charAt(0)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--foreground)', display: 'block' }}>
              {name}
            </span>
            {p.notes && (
              <Typography.Text type="secondary" italic ellipsis style={{ fontSize: '0.75rem', display: 'block', maxWidth: 220 }}>
                {p.notes}
              </Typography.Text>
            )}
          </div>
        </div>
      )
    },
    {
      title: t('general.category'),
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (cat: string) => cat ? (
        <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}>
          {cat}
        </Tag>
      ) : '—'
    },
    {
      title: t('parties.contact_person'),
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      render: (contact: string) => contact ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserIcon size={14} color="var(--muted-foreground)" />
          <span style={{ fontWeight: 500, fontSize: '0.88rem' }}>{contact}</span>
        </div>
      ) : '—'
    },
    {
      title: t('parties.mobile'),
      dataIndex: 'mobile',
      key: 'mobile',
      width: 140,
      render: (mob: string) => mob ? (
        <a href={`tel:${mob}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: '0.88rem' }}>
          <Phone size={13} />
          <span className="mono">{mob}</span>
        </a>
      ) : '—'
    },
    {
      title: isGu ? 'જીએસટી / સરનામું' : 'GST / Address',
      key: 'gst_address',
      render: (_val, p: Party) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {p.gst && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
              <FileText size={12} color="var(--muted-foreground)" />
              <span className="mono" style={{ fontWeight: 600, color: 'var(--foreground)' }}>{p.gst}</span>
            </div>
          )}
          {p.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--secondary)' }}>
              <MapPin size={12} />
              <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</span>
            </div>
          )}
          {!p.gst && !p.address && <span style={{ color: 'var(--muted-foreground)' }}>—</span>}
        </div>
      )
    },
    {
      title: isGu ? 'સ્થિતિ' : 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'success' : 'default'} style={{ borderRadius: 6, fontWeight: 600 }}>
          {status === 'active' ? (isGu ? 'સક્રિય' : 'Active') : (isGu ? 'નિષ્ક્રિય' : 'Inactive')}
        </Tag>
      )
    },
    {
      title: t('parties.balance'),
      key: 'balance',
      align: 'right',
      width: 150,
      fixed: 'right',
      render: (_val, p: Party) => {
        const bal = partyBalance(p.id)
        return (
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.95rem',
                color: bal > 0 ? '#16a34a' : bal < 0 ? '#dc2626' : 'var(--muted-foreground)'
              }}
            >
              {bal > 0 ? '+' : ''}{formatCurrency(bal)}
            </span>
            <div style={{ fontSize: '0.72rem', color: 'var(--secondary)', fontWeight: 500 }}>
              {bal > 0 ? (isGu ? 'લેવાના' : 'Receivable') : bal < 0 ? (isGu ? 'આપવાના' : 'Payable') : (isGu ? 'ચૂકતે' : 'Settled')}
            </div>
          </div>
        )
      }
    },
    {
      title: t('general.action'),
      key: 'actions',
      width: 110,
      align: 'center',
      fixed: 'right',
      render: (_val, p: Party) => (
        <Space size={4}>
          <Tooltip title={t('general.edit')}>
            <Button
              type="text"
              icon={<Edit2 size={15} color="var(--primary)" />}
              onClick={() => handleEdit(p)}
              style={{ borderRadius: 6, width: 32, height: 32, padding: 0 }}
            />
          </Tooltip>
          {currentUser.role === 'admin' && (
            <Popconfirm
              title={p.status === 'active' ? (isGu ? 'શું તમે આ પાર્ટીને નિષ્ક્રિય કરવા માંગો છો?' : 'Deactivate this party?') : (isGu ? 'શું તમે આ પાર્ટીને સક્રિય કરવા માંગો છો?' : 'Activate this party?')}
              onConfirm={() => handleToggleStatus(p)}
              okText={t('general.save')}
              cancelText={t('general.cancel')}
            >
              <Tooltip title={p.status === 'active' ? t('parties.deactivate') : t('parties.activate')}>
                <Button
                  type="text"
                  danger={p.status === 'active'}
                  icon={p.status === 'active' ? <X size={15} /> : <Check size={15} color="#16a34a" />}
                  style={{ borderRadius: 6, width: 32, height: 32, padding: 0 }}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── Header & Top Stats Banner ─────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          padding: '18px 24px',
          borderRadius: 16,
          border: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--primary) 0%, #00a8ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(16, 42, 131, 0.15)'
            }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--foreground)' }}>
                {t('parties.title')}
              </h1>
              <Tag color="blue" style={{ borderRadius: 10, fontWeight: 700, padding: '1px 8px' }}>
                {filtered.length} {t('general.records')}
              </Tag>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: '0.8rem' }}>
              {isGu ? 'ગ્રાહકો અને વેપારીઓની યાદી અને ખાતાવહી સંચાલન' : 'Manage customers, vendors, contacts and balances'}
            </Typography.Text>
          </div>
        </div>

        {/* Action Button & Balance Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              gap: 12,
              background: '#f8fafc',
              padding: '6px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              fontSize: '0.82rem'
            }}
          >
            <div>
              <span style={{ color: 'var(--secondary)', fontSize: '0.72rem', display: 'block', fontWeight: 600 }}>
                {isGu ? 'કુલ લેવાના' : 'Receivables'}
              </span>
              <strong style={{ color: '#16a34a', fontSize: '0.9rem' }}>+{formatCurrency(totalReceivable)}</strong>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div>
              <span style={{ color: 'var(--secondary)', fontSize: '0.72rem', display: 'block', fontWeight: 600 }}>
                {isGu ? 'કુલ આપવાના' : 'Payables'}
              </span>
              <strong style={{ color: '#dc2626', fontSize: '0.9rem' }}>-{formatCurrency(totalPayable)}</strong>
            </div>
          </div>

          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setForm({ ...emptyForm })
              setEditId(null)
              setShowModal(true)
            }}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              height: 38,
              padding: '0 18px',
              boxShadow: '0 4px 12px rgba(16, 42, 131, 0.15)'
            }}
          >
            {t('parties.add')}
          </Button>
        </div>
      </div>

      {/* ─── Filter Bar Card ──────────────────────────────────────────────── */}
      <Card
        bordered={false}
        style={{ borderRadius: 14, border: '1px solid var(--border)' }}
        styles={{ body: { padding: '12px 18px' } }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Gujarati Search with auto-trim */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <TransliteratedInput
              placeholder={isGu ? 'નામ / સંપર્ક / મોબાઇલ / GST...' : 'Search name, contact, mobile, GST...'}
              value={search}
              onChange={v => setSearch(v)}
              prefix={<Search size={15} color="var(--muted-foreground)" />}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </div>

          {/* Category Filter */}
          <Select
            placeholder={`🏷️ ${t('income.category_placeholder')}`}
            style={{ width: 160 }}
            value={filterCat || undefined}
            onChange={v => setFilterCat(v || '')}
            allowClear
            options={PARTY_CATEGORIES.map(c => ({ value: c, label: `🏷️ ${c}` }))}
          />

          {/* Status Filter */}
          <Select
            style={{ width: 130 }}
            value={filterStatus}
            onChange={v => setFilterStatus(v)}
            options={[
              { value: 'all', label: isGu ? 'બધી સ્થિતિ' : 'All Status' },
              { value: 'active', label: `🟢 ${isGu ? 'સક્રિય' : 'Active'}` },
              { value: 'inactive', label: `⚪ ${isGu ? 'નિષ્ક્રિય' : 'Inactive'}` },
            ]}
          />

          {/* Reset Filters */}
          {(search.trim() || filterCat || filterStatus !== 'all') && (
            <Button
              icon={<RotateCcw size={14} />}
              onClick={handleResetFilters}
              style={{ borderRadius: 8 }}
            >
              {isGu ? 'રીસેટ' : 'Reset'}
            </Button>
          )}
        </div>
      </Card>

      {/* ─── Main Parties Table Card ──────────────────────────────────────── */}
      <Card
        bordered={false}
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}
      >
        <Table<Party>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="middle"
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50', '100'],
            style: { margin: '16px 20px' },
            showTotal: (total) => `${t('general.total')} ${total} ${t('general.records')}`
          }}
          locale={{ emptyText: t('general.no_data') }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* ─── Party Add / Edit Modal ───────────────────────────────────────── */}
      <Modal
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        title={
          <Space>
            <Building2 size={18} color="var(--primary)" />
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
              {editId ? t('parties.edit') : t('parties.add')}
            </span>
          </Space>
        }
        okText={saving ? t('general.saving') : t('general.save')}
        cancelText={t('general.cancel')}
        width={580}
        destroyOnClose
      >
        <div style={{ display: 'grid', gap: 14, paddingTop: 10 }}>
          {/* Party Name & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                {t('parties.name')} *
              </label>
              <TransliteratedInput
                value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v }))}
                placeholder={isGu ? 'પાર્ટીનું નામ...' : 'Party / Firm Name...'}
                style={{ borderRadius: 8 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                {t('general.category')} *
              </label>
              <Select
                style={{ width: '100%' }}
                value={form.category || undefined}
                placeholder={`-- ${t('general.category')} --`}
                onChange={v => setForm(f => ({ ...f, category: v }))}
                options={PARTY_CATEGORIES.map(c => ({ value: c, label: c }))}
              />
            </div>
          </div>

          {/* Contact Person & Mobile */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                {t('parties.contact_person')}
              </label>
              <TransliteratedInput
                value={form.contactPerson}
                onChange={v => setForm(f => ({ ...f, contactPerson: v }))}
                placeholder={isGu ? 'સંપર્ક વ્યક્તિ...' : 'Contact Person...'}
                style={{ borderRadius: 8 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                {t('parties.mobile')}
              </label>
              <TransliteratedInput
                value={form.mobile}
                onChange={v => setForm(f => ({ ...f, mobile: v }))}
                placeholder="9876543210"
                style={{ borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Email & GST */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                {t('parties.email')}
              </label>
              <TransliteratedInput
                type="email"
                value={form.email}
                onChange={v => setForm(f => ({ ...f, email: v }))}
                placeholder="example@email.com"
                style={{ borderRadius: 8 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                {t('parties.gst')} (GSTIN)
              </label>
              <TransliteratedInput
                value={form.gst}
                onChange={v => setForm(f => ({ ...f, gst: v.toUpperCase() }))}
                placeholder="24AAAAA0000A1Z5"
                style={{ borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
              {t('parties.address')}
            </label>
            <TransliteratedInput
              value={form.address}
              onChange={v => setForm(f => ({ ...f, address: v }))}
              placeholder={isGu ? 'સરનામું લખો...' : 'City, State, Address...'}
              style={{ borderRadius: 8 }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
              {t('general.notes')}
            </label>
            <TransliteratedInput
              textArea
              rows={2}
              value={form.notes}
              onChange={v => setForm(f => ({ ...f, notes: v }))}
              placeholder={isGu ? 'ખાસ નોંધ...' : 'Notes / Remarks...'}
              style={{ resize: 'none', borderRadius: 8 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
