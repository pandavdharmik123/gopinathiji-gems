import { useEffect, useState, useMemo } from 'react'
import {
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Typography,
  Alert,
  Space,
  Tag,
  Popconfirm
} from 'antd'
import {
  Save,
  Download,
  Upload,
  Building2,
  Settings as SettingsIcon,
  Database,
  HardDrive,
  Check,
  Plus,
  Trash2,
  Phone,
  Mail,
  FileText,
  DollarSign,
  CheckCircle2,
  Search
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import type { User } from '../types'
import TransliteratedInput from './TransliteratedInput'

interface SettingsProps {
  currentUser: User
}

export default function Settings({ currentUser: _currentUser }: SettingsProps) {
  const {
    state,
    updateSettings,
    exportBackup,
    importBackup,
    changeLanguage,
    createExpenseCategory,
    deleteExpenseCategory,
    t
  } = useApp()

  const [form, setForm] = useState({ ...state.settings })
  const [saved, setSaved] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [saving, setSaving] = useState(false)

  // Expense Categories State
  const [newCat, setNewCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [catSearch, setCatSearch] = useState('')

  const isGu = state.language === 'gu'

  useEffect(() => {
    setForm({ ...state.settings })
  }, [state.settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('general.save_error'))
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoring(true)
    try {
      await importBackup(file)
    } catch {
      alert(isGu ? 'ફાઇલ વાંચી ન શકાઈ' : 'Could not read backup file')
    }
    setRestoring(false)
    e.target.value = ''
  }

  const handleAddCategory = async () => {
    if (!newCat.trim()) return
    setAddingCat(true)
    try {
      await createExpenseCategory(newCat.trim())
      setNewCat('')
    } catch (err) {
      alert(err instanceof Error ? err.message : t('general.save_error'))
    } finally {
      setAddingCat(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteExpenseCategory(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('general.delete_error'))
    }
  }

  // Filtered Expense Categories
  const filteredCategories = useMemo(() => {
    const term = catSearch.trim().toLowerCase()
    if (!term) return state.expenseCategories
    return state.expenseCategories.filter(c => c.name.toLowerCase().includes(term))
  }, [state.expenseCategories, catSearch])

  // Overall Financial Metric
  const allIncome = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const allExpense = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netProfit = allIncome - allExpense

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
              {t('settings.title')}
            </h1>
            {/* <Tag color="success" style={{ borderRadius: 12, fontWeight: 600, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} />
              <span>{t('settings.db_connected')}</span>
            </Tag> */}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: '0.82rem', marginTop: 4, display: 'block' }}>
            {t('settings.subtitle')}
          </Typography.Text>
        </div>

        {/* Global Save Action */}
        <Space size="middle">
          <Button
            type="primary"
            size="large"
            icon={saved ? <Check size={16} /> : <Save size={16} />}
            onClick={handleSave}
            loading={saving}
            style={{
              borderRadius: 10,
              fontWeight: 700,
              background: saved ? '#16a34a' : undefined,
              borderColor: saved ? '#16a34a' : undefined,
              padding: '0 24px',
              height: 42,
              boxShadow: '0 4px 12px rgba(16, 42, 131, 0.15)'
            }}
          >
            {saving ? t('general.saving') : saved ? (isGu ? 'સફળતાપૂર્વક સચવાયું!' : 'Saved Successfully!') : t('general.save')}
          </Button>
        </Space>
      </div>

      {/* ─── Top System Health & Data KPI Summary ─────────────────────────── */}
      <Row gutter={[16, 16]}>
        {[
          { label: isGu ? 'કુલ વ્યવહારો' : 'Total Transactions', value: state.transactions.length, icon: <FileText size={18} color="#2563eb" />, bg: '#eff6ff', border: '#bfdbfe' },
          { label: isGu ? 'કુલ પાર્ટીઓ' : 'Registered Parties', value: state.parties.length, icon: <Building2 size={18} color="#0891b2" />, bg: '#ecfeff', border: '#a5f3fc' },
          { label: isGu ? 'સક્રિય શ્રેણીઓ' : 'Active Categories', value: state.expenseCategories.length, icon: <Database size={18} color="#9333ea" />, bg: '#faf5ff', border: '#e9d5ff' },
          { label: isGu ? 'કુલ ચોખ્ખો નફો' : 'Lifetime Net Profit', value: `₹${netProfit.toLocaleString('en-IN')}`, icon: <DollarSign size={18} color={netProfit >= 0 ? '#16a34a' : '#dc2626'} />, bg: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', border: netProfit >= 0 ? '#bbf7d0' : '#fecaca', isAmount: true, color: netProfit >= 0 ? '#15803d' : '#b91c1c' },
        ].map(item => (
          <Col xs={12} sm={6} key={item.label}>
            <div
              style={{
                background: item.bg,
                border: `1.5px solid ${item.border}`,
                borderRadius: 14,
                padding: '14px 18px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: item.color || 'var(--foreground)', marginTop: 2, display: 'block' }}>
                  {item.value}
                </span>
              </div>
              <div style={{ background: '#ffffff', padding: 8, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                {item.icon}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ─── Main Settings Sections (Organized Cards Grid) ─────────────────── */}
      <Row gutter={[20, 20]}>
        {/* 1. Company Profile & Tax Information */}
        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            title={
              <Space>
                <Building2 size={18} color="var(--primary)" />
                <span style={{ fontWeight: 700 }}>{t('settings.company_settings')}</span>
              </Space>
            }
            style={{ borderRadius: 16, border: '1px solid var(--border)', height: '100%', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
            styles={{ body: { padding: '22px 24px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Company Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                  {t('settings.company_name')} *
                </label>
                <TransliteratedInput
                  value={form.name}
                  onChange={v => setForm(f => ({ ...f, name: v }))}
                  placeholder={isGu ? 'પેઢીનું નામ લખો...' : 'Company Name...'}
                  style={{ borderRadius: 8 }}
                />
              </div>

              {/* GSTIN & Phone (2 columns) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                    {t('parties.gst')} (GSTIN)
                  </label>
                  <Input
                    prefix={<FileText size={15} color="var(--muted-foreground)" />}
                    placeholder="24AAAAA0000A1Z5"
                    value={form.gst}
                    onChange={e => setForm(f => ({ ...f, gst: e.target.value.toUpperCase() }))}
                    style={{ borderRadius: 8 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                    {isGu ? 'ફોન / મોબાઈલ' : 'Phone / Mobile'}
                  </label>
                  <Input
                    prefix={<Phone size={15} color="var(--muted-foreground)" />}
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={{ borderRadius: 8 }}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                  {t('parties.email')}
                </label>
                <Input
                  type="email"
                  prefix={<Mail size={15} color="var(--muted-foreground)" />}
                  placeholder="contact@gopinathjigems.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{ borderRadius: 8 }}
                />
              </div>

              {/* Registered Address */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                  {t('parties.address')}
                </label>
                <TransliteratedInput
                  textArea
                  rows={3}
                  value={form.address}
                  onChange={v => setForm(f => ({ ...f, address: v }))}
                  placeholder={isGu ? 'સરનામું લખો...' : 'Registered Office Address...'}
                  style={{ resize: 'none', borderRadius: 8 }}
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* 2. System Preferences & Regional Settings */}
        <Col xs={24} lg={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* System Preferences Card */}
            <Card
              bordered={false}
              title={
                <Space>
                  <SettingsIcon size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 700 }}>{t('settings.system_settings')}</span>
                </Space>
              }
              style={{ borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
              styles={{ body: { padding: '22px 24px' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {/* Currency */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                      {t('settings.currency')}
                    </label>
                    <Select
                      style={{ width: '100%' }}
                      value={form.currency}
                      onChange={v => setForm(f => ({ ...f, currency: v }))}
                      options={[
                        { value: 'INR', label: '₹ INR (Indian Rupee)' },
                        { value: 'USD', label: '$ USD (US Dollar)' },
                        { value: 'EUR', label: '€ EUR (Euro)' },
                      ]}
                    />
                  </div>

                  {/* Date Format */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                      {t('settings.date_format')}
                    </label>
                    <Select
                      style={{ width: '100%' }}
                      value={form.dateFormat}
                      onChange={v => setForm(f => ({ ...f, dateFormat: v }))}
                      options={[
                        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (Standard)' },
                        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
                        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
                      ]}
                    />
                  </div>
                </div>

                {/* System Language */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
                    {t('settings.language')}
                  </label>
                  <Select
                    style={{ width: '100%' }}
                    value={form.language}
                    onChange={v => {
                      setForm(f => ({ ...f, language: v }))
                      changeLanguage(v as 'en' | 'gu')
                    }}
                    options={[
                      { value: 'gu', label: '🇮🇳 ગુજરાતી (Gujarati)' },
                      { value: 'en', label: '🌐 English (English)' },
                    ]}
                  />
                </div>
              </div>
            </Card>

            {/* Backup & Restore Center */}
            <Card
              bordered={false}
              title={
                <Space>
                  <HardDrive size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 700 }}>{t('settings.backup_restore')}</span>
                </Space>
              }
              style={{ borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
              styles={{ body: { padding: '22px 24px' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Last Backup Pill */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: 10,
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <Typography.Text strong style={{ fontSize: '0.82rem', display: 'block', color: 'var(--foreground)' }}>
                      {t('settings.last_backup')}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: '0.78rem' }}>
                      {state.settings.lastBackup || (isGu ? 'ક્યારેય નહીં' : 'Never')}
                    </Typography.Text>
                  </div>
                  <Tag color="cyan" style={{ borderRadius: 8, fontWeight: 600, margin: 0 }}>
                    JSON Format
                  </Tag>
                </div>

                {/* Download Backup Button */}
                <Button
                  type="primary"
                  icon={<Download size={15} />}
                  onClick={exportBackup}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    fontWeight: 600,
                    height: 38,
                    background: 'linear-gradient(135deg, #102a83 0%, #00a8ff 100%)'
                  }}
                >
                  {t('settings.download_backup')}
                </Button>

                {/* Restore Section */}
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginTop: 4 }}>
                  <Typography.Text strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>
                    {t('settings.restore_data')}
                  </Typography.Text>
                  <Alert
                    type="warning"
                    showIcon
                    message={t('settings.restore_warning')}
                    style={{ marginBottom: 12, padding: '8px 12px', fontSize: '0.78rem', borderRadius: 8 }}
                  />
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 20px',
                      borderRadius: 8,
                      background: '#ffffff',
                      border: '1.5px dashed var(--primary)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--primary)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Upload size={16} />
                    <span>{restoring ? (isGu ? 'પુનઃસ્થાપિત થાય છે...' : 'Restoring...') : t('settings.select_file')}</span>
                    <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestore} />
                  </label>
                </div>
              </div>
            </Card>
          </div>
        </Col>
      </Row>

      {/* ─── 3. Modern Expense Categories Hub ──────────────────────────────── */}
      <Card
        bordered={false}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <Space>
              <Database size={18} color="var(--primary)" />
              <span style={{ fontWeight: 700 }}>{isGu ? 'ખર્ચ શ્રેણીઓનું સંચાલન' : 'Expense Categories Management'}</span>
            </Space>
            <Tag color="purple" style={{ borderRadius: 8, fontWeight: 600 }}>
              {state.expenseCategories.length} {t('settings.categories_count')}
            </Tag>
          </div>
        }
        style={{ borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
        styles={{ body: { padding: '22px 24px' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Add Category Bar */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <TransliteratedInput
                value={newCat}
                onChange={v => setNewCat(v)}
                placeholder={t('settings.category_placeholder')}
                onPressEnter={handleAddCategory}
                style={{ borderRadius: 8 }}
              />
            </div>
            <Button
              type="primary"
              icon={<Plus size={15} />}
              onClick={handleAddCategory}
              loading={addingCat}
              style={{
                borderRadius: 8,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {t('settings.add_category')}
            </Button>
            <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />
            <div style={{ width: 220 }}>
              <TransliteratedInput
                value={catSearch}
                onChange={v => setCatSearch(v)}
                placeholder={t('general.search')}
                prefix={<Search size={14} color="var(--muted-foreground)" />}
                allowClear
                style={{ borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Categories Grid (Interactive Chips) */}
          {filteredCategories.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
              {isGu ? 'કોઈ કેટેગરી મળી નથી' : 'No matching categories found'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {filteredCategories.map(cat => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1.5px solid var(--border)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />
                    <Typography.Text strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }} ellipsis>
                      {cat.name}
                    </Typography.Text>
                  </div>

                  <Popconfirm
                    title={t('general.confirm_delete')}
                    onConfirm={() => handleDeleteCategory(cat.id)}
                    okText={isGu ? 'હા, કાઢી નાખો' : 'Yes, Delete'}
                    cancelText={t('general.cancel')}
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<Trash2 size={14} />}
                      style={{
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6
                      }}
                    />
                  </Popconfirm>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
