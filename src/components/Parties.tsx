import { useState } from 'react'
import { Card, Button, Input, Select, Modal, Tag, Avatar, Badge, Space, Typography, Row, Col } from 'antd'
import { Plus, Search, Edit2, Check, X, Phone, MapPin, FileText, User } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { PARTY_CATEGORIES, formatCurrency } from '../data/mockData'
import type { Party, User as UserType } from '../types'
import TransliteratedInput from './TransliteratedInput'

interface PartiesProps { currentUser: UserType }

const emptyForm: Omit<Party, 'id' | 'balance' | 'createdAt'> = {
  name: '', category: '', contactPerson: '', mobile: '', email: '', gst: '', address: '', notes: '', status: 'active'
}

export default function Parties({ currentUser }: PartiesProps) {
  const { state, createParty, updateParty, t } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = state.parties.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      p.mobile.includes(search) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat ? p.category === filterCat : true
    return matchSearch && matchCat
  })

  // Compute running balance from transactions
  const partyBalance = (partyId: string) => {
    const txns = state.transactions.filter(t => t.partyId === partyId)
    const credit = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const debit = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return credit - debit
  }

  const handleSave = async () => {
    if (!form.name) return
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
    setForm({ name: p.name, category: p.category, contactPerson: p.contactPerson, mobile: p.mobile, email: p.email, gst: p.gst, address: p.address, notes: p.notes, status: p.status })
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

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('parties.title')}</h1>
          <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
            {filtered.length} {t('general.records')}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder={state.language === 'gu' ? 'નામ / સંપર્ક / મોબાઇલ...' : 'Search name / contact / mobile...'}
            style={{ width: 200 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            prefix={<Search size={16} style={{ color: '#9ca3af' }} />}
            allowClear
          />
          <Select
            placeholder={t('income.category_placeholder')}
            style={{ width: 150 }}
            value={filterCat || undefined}
            onChange={v => setFilterCat(v || '')}
            allowClear
            options={PARTY_CATEGORIES.map(c => ({ value: c, label: c }))}
          />
          <Button type="primary" icon={<Plus size={16} />} onClick={() => { setForm({ ...emptyForm }); setEditId(null); setShowModal(true) }}>
            {t('parties.add')}
          </Button>
        </div>
      </div>

      {/* Cards grid */}
      <Row gutter={[16, 16]}>
        {filtered.length === 0 && (
          <Col span={24}>
            <Card style={{ textAlign: 'center', padding: 40, color: 'var(--secondary)' }}>
              {t('general.no_data')}
            </Card>
          </Col>
        )}
        {filtered.map(p => {
          const bal = partyBalance(p.id)
          return (
            <Col xs={24} sm={12} lg={8} key={p.id}>
              <Card
                className="card-hover"
                style={{ position: 'relative', height: '100%' }}
                styles={{ body: { padding: 20 } }}
              >
                {/* Status indicator badge */}
                <span style={{ position: 'absolute', top: 16, right: 16 }}>
                  <Badge status={p.status === 'active' ? 'success' : 'default'} />
                </span>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <Avatar
                    shape="square"
                    size={44}
                    style={{
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    {p.name.charAt(0)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text strong ellipsis style={{ display: 'block', fontSize: '0.95rem', color: 'var(--primary)' }}>
                      {p.name}
                    </Typography.Text>
                    <Tag color="blue" style={{ marginTop: 4 }}>{p.category}</Tag>
                  </div>
                </div>

                <div style={{ display: 'flex', flexType: 'column', flexDirection: 'column', gap: 6, fontSize: '0.82rem', marginBottom: 12 }}>
                  {p.contactPerson && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--secondary)', minWidth: 70 }}><User size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />{t('parties.contact_person')}:</span>
                      <span style={{ fontWeight: 500 }}>{p.contactPerson}</span>
                    </div>
                  )}
                  {p.mobile && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--secondary)', minWidth: 70 }}><Phone size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />{t('parties.mobile')}:</span>
                      <span className="mono">{p.mobile}</span>
                    </div>
                  )}
                  {p.gst && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--secondary)', minWidth: 70 }}><FileText size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />{t('parties.gst')}:</span>
                      <span className="mono" style={{ fontSize: '0.78rem' }}>{p.gst}</span>
                    </div>
                  )}
                  {p.address && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--secondary)', minWidth: 70 }}><MapPin size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />{t('parties.address')}:</span>
                      <span>{p.address}</span>
                    </div>
                  )}
                </div>

                {/* Balance */}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: bal >= 0 ? '#dcfce7' : '#fee2e2',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12
                }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--secondary)', fontWeight: 600 }}>{t('parties.balance')}</span>
                  <span className="mono" style={{ fontWeight: 700, color: bal >= 0 ? '#16a34a' : '#dc2626' }}>
                    {bal >= 0 ? '+' : ''}{formatCurrency(bal)}
                  </span>
                </div>

                {p.notes && (
                  <Typography.Text type="secondary" italic style={{ display: 'block', fontSize: '0.78rem', marginBottom: 12 }}>
                    {p.notes}
                  </Typography.Text>
                )}

                <Space style={{ width: '100%', justifyContent: 'stretch' }} size={6}>
                  <Button icon={<Edit2 size={14} />} onClick={() => handleEdit(p)} style={{ flex: 1 }}>
                    {t('general.edit')}
                  </Button>
                  {currentUser.role === 'admin' && (
                    <Button
                      type={p.status === 'active' ? 'default' : 'primary'}
                      danger={p.status === 'active'}
                      icon={p.status === 'active' ? <X size={14} /> : <Check size={14} />}
                      onClick={() => handleToggleStatus(p)}
                      style={{ flex: 1 }}
                    >
                      {p.status === 'active' ? t('parties.deactivate') : t('parties.activate')}
                    </Button>
                  )}
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Modal
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        title={<span style={{ color: 'var(--primary)' }}>{editId ? t('parties.edit') : t('parties.add')}</span>}
        okText={saving ? t('general.saving') : t('general.save')}
        cancelText={t('general.cancel')}
        width={560}
        destroyOnClose
      >
        <div style={{ display: 'grid', gap: 14, paddingTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{t('parties.name')} *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="..." />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{t('general.category')} *</label>
              <Select
                style={{ width: '100%' }}
                value={form.category || undefined}
                placeholder={`-- ${t('general.category')} --`}
                onChange={v => setForm(f => ({ ...f, category: v }))}
                options={PARTY_CATEGORIES.map(c => ({ value: c, label: c }))}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{t('parties.contact_person')}</label>
              <Input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Name" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{t('parties.mobile')}</label>
              <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="9XXXXXXXXX" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{t('parties.email')}</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@email.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{t('parties.gst')}</label>
              <Input value={form.gst} onChange={e => setForm(f => ({ ...f, gst: e.target.value }))} placeholder="24XXXXX..." style={{  }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{t('parties.address')}</label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="City, State" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{t('general.notes')}</label>
            <Input.TextArea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'none' }} placeholder="..." />
          </div>
        </div>
      </Modal>
    </div>
  )
}
