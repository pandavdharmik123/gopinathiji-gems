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
  Popconfirm,
  Modal,
  message
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
  Search,
  FileSpreadsheet,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  RefreshCw
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
    exportExcelBackup,
    previewExcelBackup,
    importExcelBackup,
    changeLanguage,
    createExpenseCategory,
    deleteExpenseCategory,
    t
  } = useApp()

  const [form, setForm] = useState({ ...state.settings })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Excel Export Modal State
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [exportPassword, setExportPassword] = useState('')
  const [showExportPassword, setShowExportPassword] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  // Excel Import Modal State
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const [showImportPassword, setShowImportPassword] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [previewing, setPreviewing] = useState(false)
  const [restoringExcel, setRestoringExcel] = useState(false)

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

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      await exportExcelBackup(exportPassword)
      message.success(isGu ? 'Excel ફાઇલ ડાઉનલોડ થઈ ગઈ!' : 'Excel backup downloaded successfully!')
      setExportModalVisible(false)
      setExportPassword('')
    } catch (err: any) {
      message.error(err?.message || (isGu ? 'Excel નિકાસ નિષ્ફળ ગઈ' : 'Failed to export Excel file'))
    } finally {
      setExportingExcel(false)
    }
  }

  const handleFileSelectForImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      setPreviewData(null)
    }
  }

  const handlePreviewExcel = async () => {
    if (!importFile) return
    setPreviewing(true)
    try {
      const summary = await previewExcelBackup(importFile, importPassword)
      setPreviewData(summary)
      message.info(isGu ? 'Excel ફાઇલ ચકાસવામાં આવી!' : 'Excel file verified!')
    } catch (err: any) {
      message.error(err?.message || (isGu ? 'ફાઇલ ચકાસી શકાઈ નથી' : 'Failed to verify Excel file'))
    } finally {
      setPreviewing(false)
    }
  }

  const handleConfirmImportExcel = async () => {
    if (!importFile) return
    setRestoringExcel(true)
    try {
      await importExcelBackup(importFile, importPassword)
      message.success(t('settings.import_success'))
      setImportModalVisible(false)
      setImportFile(null)
      setImportPassword('')
      setPreviewData(null)
    } catch (err: any) {
      message.error(err?.message || (isGu ? 'ડેટા પુનઃસ્થાપિત નિષ્ફળ' : 'Failed to restore database from Excel'))
    } finally {
      setRestoringExcel(false)
    }
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <Space>
                    <HardDrive size={18} color="var(--primary)" />
                    <span style={{ fontWeight: 700 }}>{t('settings.backup_restore')}</span>
                  </Space>
                  <Tag color="green" style={{ borderRadius: 8, fontWeight: 600 }}>
                    Excel (.xlsx) Protected
                  </Tag>
                </div>
              }
              style={{ borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
              styles={{ body: { padding: '22px 24px' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                    {isGu ? 'સુરક્ષિત બેકઅપ' : 'Secure Backup'}
                  </Tag>
                </div>

                {/* ─── Excel Section ─── */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: 12,
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ background: '#16a34a', color: '#fff', padding: 6, borderRadius: 8, display: 'flex' }}>
                        <FileSpreadsheet size={18} />
                      </div>
                      <div>
                        <Typography.Text strong style={{ fontSize: '0.92rem', color: '#15803d' }}>
                          {t('settings.excel_backup_title')}
                        </Typography.Text>
                        <span style={{ fontSize: '0.74rem', color: '#16a34a', display: 'block' }}>
                          {isGu ? 'માઇક્રોસોફ્ટ એક્સેલ પાસવર્ડ સપોર્ટ સાથે' : 'Office OpenXML standard encryption (.xlsx)'}
                        </span>
                      </div>
                    </div>
                    <Tag color="success" style={{ fontWeight: 600, borderRadius: 6 }}>
                      Standard
                    </Tag>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Button
                      type="primary"
                      icon={<Lock size={15} />}
                      onClick={() => setExportModalVisible(true)}
                      style={{
                        height: 40,
                        borderRadius: 8,
                        fontWeight: 600,
                        background: '#16a34a',
                        borderColor: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      {t('settings.export_excel')}
                    </Button>

                    <Button
                      icon={<Upload size={15} />}
                      onClick={() => setImportModalVisible(true)}
                      style={{
                        height: 40,
                        borderRadius: 8,
                        fontWeight: 600,
                        color: '#15803d',
                        borderColor: '#86efac',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      {t('settings.import_excel')}
                    </Button>
                  </div>
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

      {/* ─── Export Excel Modal ────────────────────────────────────────────── */}
      <Modal
        open={exportModalVisible}
        onCancel={() => {
          if (!exportingExcel) {
            setExportModalVisible(false)
            setExportPassword('')
          }
        }}
        footer={null}
        title={
          <Space>
            <div style={{ background: '#dcfce7', color: '#16a34a', padding: 6, borderRadius: 8 }}>
              <Lock size={18} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{t('settings.export_modal_title')}</span>
          </Space>
        }
        style={{ top: 80 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 10 }}>
          <Alert
            type="info"
            showIcon
            icon={<ShieldCheck size={16} color="#16a34a" />}
            message={
              <span style={{ fontSize: '0.82rem' }}>
                {isGu
                  ? 'તમામ પાર્ટીઓ, વ્યવહારો, નાણાકીય વર્ષો, ખર્ચ શ્રેણીઓ અને સેટિંગ્સ સંપૂર્ણ સુરક્ષા સાથે એક્સેલ ફાઇલમાં સાચવવામાં આવશે.'
                  : 'All parties, transactions, financial years, categories, and settings will be exported with standard Office encryption.'}
              </span>
            }
            style={{ borderRadius: 10 }}
          />

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
              {t('settings.export_password_label')}
            </label>
            <Input
              type={showExportPassword ? 'text' : 'password'}
              placeholder={t('settings.export_password_placeholder')}
              value={exportPassword}
              onChange={e => setExportPassword(e.target.value)}
              prefix={<Lock size={15} color="var(--muted-foreground)" />}
              suffix={
                <Button
                  type="text"
                  size="small"
                  icon={showExportPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  onClick={() => setShowExportPassword(prev => !prev)}
                />
              }
              style={{ borderRadius: 8, height: 40 }}
            />
            <Typography.Text type="secondary" style={{ fontSize: '0.76rem', marginTop: 6, display: 'block' }}>
              💡 {t('settings.export_password_hint')}
            </Typography.Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button
              onClick={() => {
                setExportModalVisible(false)
                setExportPassword('')
              }}
              disabled={exportingExcel}
              style={{ borderRadius: 8 }}
            >
              {t('general.cancel')}
            </Button>
            <Button
              type="primary"
              icon={<Download size={15} />}
              loading={exportingExcel}
              onClick={handleExportExcel}
              style={{
                borderRadius: 8,
                fontWeight: 600,
                background: '#16a34a',
                borderColor: '#16a34a'
              }}
            >
              {exportingExcel ? t('settings.exporting') : t('settings.export_btn')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Import Excel Modal ────────────────────────────────────────────── */}
      <Modal
        open={importModalVisible}
        onCancel={() => {
          if (!restoringExcel) {
            setImportModalVisible(false)
            setImportFile(null)
            setImportPassword('')
            setPreviewData(null)
          }
        }}
        footer={null}
        title={
          <Space>
            <div style={{ background: '#eff6ff', color: '#2563eb', padding: 6, borderRadius: 8 }}>
              <FileSpreadsheet size={18} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{t('settings.import_modal_title')}</span>
          </Space>
        }
        width={560}
        style={{ top: 70 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 10 }}>
          {/* File Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
              {t('settings.import_file_label')} *
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 8,
                padding: '20px',
                borderRadius: 10,
                background: importFile ? '#f0fdf4' : '#f8fafc',
                border: importFile ? '1.5px solid #86efac' : '1.5px dashed var(--border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <FileSpreadsheet size={28} color={importFile ? '#16a34a' : 'var(--muted-foreground)'} />
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: importFile ? '#15803d' : 'var(--foreground)' }}>
                {importFile ? importFile.name : (isGu ? 'અહીં ક્લિક કરી .xlsx બેકઅપ ફાઇલ પસંદ કરો' : 'Click to select .xlsx backup file')}
              </span>
              {importFile && (
                <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>
                  ({(importFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
              <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileSelectForImport} />
            </label>
          </div>

          {/* Password Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>
              {t('settings.import_password_label')}
            </label>
            <Input
              type={showImportPassword ? 'text' : 'password'}
              placeholder={t('settings.import_password_placeholder')}
              value={importPassword}
              onChange={e => setImportPassword(e.target.value)}
              prefix={<Lock size={15} color="var(--muted-foreground)" />}
              suffix={
                <Button
                  type="text"
                  size="small"
                  icon={showImportPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  onClick={() => setShowImportPassword(prev => !prev)}
                />
              }
              style={{ borderRadius: 8, height: 40 }}
            />
          </div>

          {/* Verify / Preview Button */}
          {importFile && !previewData && (
            <Button
              type="default"
              icon={<Search size={15} />}
              loading={previewing}
              onClick={handlePreviewExcel}
              style={{ borderRadius: 8, fontWeight: 600, height: 38 }}
            >
              {isGu ? 'ફાઇલ ચકાસો / પૂર્વાવલોકન કરો' : 'Inspect & Verify Backup'}
            </Button>
          )}

          {/* Preview Details Card */}
          {previewData && (
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography.Text strong style={{ fontSize: '0.85rem', color: 'var(--foreground)' }}>
                  📋 {t('settings.import_preview_title')}
                </Typography.Text>
                <Tag color="blue" style={{ fontWeight: 600, borderRadius: 6, margin: 0 }}>
                  {previewData.companyName || 'ERP Data'}
                </Tag>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>{isGu ? 'પાર્ટીઓ' : 'Parties'}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>{previewData.counts?.parties || 0}</span>
                </div>
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>{isGu ? 'વ્યવહારો' : 'Transactions'}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a' }}>{previewData.counts?.transactions || 0}</span>
                </div>
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>{isGu ? 'વર્ષો' : 'Years'}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#2563eb' }}>{previewData.counts?.accountingYears || 0}</span>
                </div>
              </div>

              <Typography.Text type="secondary" style={{ fontSize: '0.74rem' }}>
                📅 {isGu ? 'બેકઅપ તારીખ' : 'Exported on'}: {new Date(previewData.exportedAt).toLocaleString('en-IN')}
              </Typography.Text>
            </div>
          )}

          {/* Warning Message */}
          <Alert
            type="warning"
            showIcon
            icon={<AlertTriangle size={16} color="#d97706" />}
            message={
              <span style={{ fontSize: '0.8rem' }}>
                {isGu
                  ? 'આ ક્રિયા દ્વારા ડેટાબેઝમાં તમામ પાર્ટીઓ, વ્યવહારો અને ખાતાઓ આ એક્સેલ ફાઇલ મુજબ પુનઃસ્થાપિત (Restore) થશે.'
                  : 'Restoring will merge and synchronize all records with the data inside this Excel workbook.'}
              </span>
            }
            style={{ borderRadius: 10 }}
          />

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <Button
              onClick={() => {
                setImportModalVisible(false)
                setImportFile(null)
                setImportPassword('')
                setPreviewData(null)
              }}
              disabled={restoringExcel}
              style={{ borderRadius: 8 }}
            >
              {t('general.cancel')}
            </Button>
            <Button
              type="primary"
              danger
              icon={<RefreshCw size={15} />}
              loading={restoringExcel}
              disabled={!importFile}
              onClick={handleConfirmImportExcel}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              {restoringExcel ? t('settings.restoring') : t('settings.import_confirm_btn')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
