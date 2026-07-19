import { useState } from 'react'
import { Button, Input, Modal, Select, Table, Tag, Avatar, Typography, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Search, Pencil } from 'lucide-react'
import { useApp } from '../store/AppContext'
import type { User } from '../types'

interface UsersProps { currentUser: User }

const emptyForm = { name: '', username: '', email: '', role: 'employee' as User['role'], password: '' }

export default function Users({ currentUser }: UsersProps) {
  const { state, createUser, updateUser, t } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const ROLES = [
    { value: 'admin', label: t('role.admin') },
    { value: 'manager', label: t('role.manager') },
    { value: 'employee', label: t('role.employee') },
  ]

  const filtered = state.users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async () => {
    if (!form.name || !form.username) return
    setSaving(true)
    try {
      if (editId) {
        await updateUser(editId, {
          name: form.name,
          email: form.email,
          role: form.role,
        })
      } else {
        await createUser({
          name: form.name,
          username: form.username,
          email: form.email,
          role: form.role,
          password: form.password || undefined,
        })
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

  const handleEdit = (u: User) => {
    setForm({ name: u.name, username: u.username, email: u.email, role: u.role, password: '' })
    setEditId(u.id)
    setShowModal(true)
  }

  const handleToggle = async (u: User) => {
    if (u.id === currentUser.id) { 
      alert(state.language === 'gu' ? 'તમે તમારી જાતને નિષ્ક્રિય ન કરી શકો' : 'You cannot deactivate yourself')
      return 
    }
    try {
      await updateUser(u.id, { status: u.status === 'active' ? 'inactive' : 'active' })
    } catch (err) {
      alert(err instanceof Error ? err.message : (state.language === 'gu' ? 'સ્થિતિ બદલી શકાઈ નથી' : 'Could not change status'))
    }
  }

  const roleColor: Record<string, string> = {
    admin: 'warning', manager: 'blue', employee: 'default'
  }

  const columns: ColumnsType<User> = [
    {
      title: state.language === 'gu' ? 'વ્યક્તિ' : 'Name',
      key: 'name',
      render: (_: unknown, record: User) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              fontWeight: 700,
              fontSize: '0.82rem',
              flexShrink: 0
            }}
          >
            {record.name.charAt(0)}
          </Avatar>
          <span style={{ fontWeight: 600 }}>{record.name}</span>
        </div>
      ),
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <span style={{ fontSize: '0.82rem', color: 'var(--secondary)' }}>{v}</span>,
    },
    {
      title: t('parties.email'),
      dataIndex: 'email',
      key: 'email',
      render: (v: string) => <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>{v || '—'}</span>,
    },
    {
      title: state.language === 'gu' ? 'ભૂમિકા' : 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (v: string) => <Tag color={roleColor[v]}>{ROLES.find(r => r.value === v)?.label}</Tag>,
    },
    {
      title: state.language === 'gu' ? 'નોંધ તારીખ' : 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>{v}</span>,
    },
    {
      title: t('general.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={v === 'active' ? 'success' : 'default'}>{v === 'active' ? t('general.active') : t('general.inactive')}</Tag>,
    },
    {
      title: t('general.action'),
      key: 'action',
      render: (_: unknown, record: User) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="small" icon={<Pencil size={13} />} onClick={() => handleEdit(record)}>{t('general.edit')}</Button>
          <Button
            size="small"
            type={record.status === 'active' ? 'default' : 'primary'}
            danger={record.status === 'active'}
            onClick={() => handleToggle(record)}
            style={{ fontSize: '0.78rem' }}
          >
            {record.status === 'active' ? t('general.inactive') : t('general.active')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav.users')}</h1>
          <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
            {filtered.length} {state.language === 'gu' ? 'વપરાશકર્તા' : 'users'}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Input
            placeholder={state.language === 'gu' ? 'નામ / username...' : 'Search name / username...'}
            style={{ width: 200 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            prefix={<Search size={16} style={{ color: '#9ca3af' }} />}
            allowClear
          />
          <Button type="primary" icon={<Plus size={16} />} onClick={() => { setForm({ ...emptyForm }); setEditId(null); setShowModal(true) }}>
            {state.language === 'gu' ? 'ઉમેરો' : 'Add User'}
          </Button>
        </div>
      </div>

      <div className="summary-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table<User>
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="middle"
          pagination={false}
          locale={{ emptyText: t('general.no_data') }}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        confirmLoading={saving}
        title={<span style={{ color: 'var(--primary)' }}>{editId ? (state.language === 'gu' ? 'વ્યક્તિ સુધારો' : 'Edit User') : (state.language === 'gu' ? 'નવો વ્યક્તિ ઉમેરો' : 'Add New User')}</span>}
        okText={saving ? t('general.saving') : t('general.save')}
        cancelText={t('general.cancel')}
        width={480}
        destroyOnClose
      >
        <div style={{ display: 'grid', gap: 14, paddingTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{state.language === 'gu' ? 'પૂરું નામ *' : 'Full Name *'}</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="..." />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>Username *</label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username" style={{  }} disabled={Boolean(editId)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('parties.email')}</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{state.language === 'gu' ? 'ભૂમિકા' : 'Role'}</label>
              <Select
                style={{ width: '100%' }}
                value={form.role}
                onChange={v => setForm(f => ({ ...f, role: v as User['role'] }))}
                options={ROLES.map(r => ({ value: r.value, label: r.label }))}
              />
            </div>
          </div>
          {!editId && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{state.language === 'gu' ? 'પ્રારંભિક પાસવર્ડ' : 'Initial Password'}</label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              <Typography.Text type="secondary" style={{ fontSize: '0.72rem', marginTop: 4, display: 'block' }}>
                {state.language === 'gu' ? 'ડિફૉલ્ટ: admin123' : 'Default: admin123'}
              </Typography.Text>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
