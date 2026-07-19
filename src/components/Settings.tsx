import { useEffect, useState } from 'react'
import { Button, Card, Col, Input, Row, Select, Typography, Alert, Space } from 'antd'
import { Save, Download, Upload, Building, Settings as SettingsIcon, Database, HardDrive, Check, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../store/AppContext'
import type { User } from '../types'
import TransliteratedInput from './TransliteratedInput'

interface SettingsProps { currentUser: User }

export default function Settings({ currentUser: _currentUser }: SettingsProps) {
  const { state, updateSettings, exportBackup, importBackup, changeLanguage, createExpenseCategory, deleteExpenseCategory, t } = useApp()
  const [form, setForm] = useState({ ...state.settings })
  const [saved, setSaved] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newCat, setNewCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  useEffect(() => {
    setForm({ ...state.settings })
  }, [state.settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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
      alert(state.language === 'gu' ? 'ફાઇલ વાંચી ન શકાઈ' : 'Could not read backup file')
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
    if (confirm(t('general.confirm_delete'))) {
      try {
        await deleteExpenseCategory(id)
      } catch (err) {
        alert(err instanceof Error ? err.message : t('general.delete_error'))
      }
    }
  }

  const allIncome = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const allExpense = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">{t('settings.title')}</h1>
        <Button
          type="primary"
          icon={saved ? <Check size={14} /> : <Save size={14} />}
          onClick={handleSave}
          loading={saving}
        >
          {saving ? t('general.saving') : saved ? (state.language === 'gu' ? 'સચવાઈ ગઈ!' : 'Saved!') : t('general.save')}
        </Button>
      </div>

      <Row gutter={[20, 20]}>
        {/* Company Settings */}
        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <Space>
                <Building size={16} color="var(--primary)" />
                <span>{t('settings.company_settings')}</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('settings.company_name')}</label>
                <TransliteratedInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('parties.gst')}</label>
                <Input value={form.gst} onChange={e => setForm(f => ({ ...f, gst: e.target.value }))} style={{  }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{state.language === 'gu' ? 'ફોન' : 'Phone'}</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('parties.email')}</label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('parties.address')}</label>
                <TransliteratedInput textArea rows={2} value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} style={{ resize: 'none' }} />
              </div>
            </div>
          </Card>
        </Col>

        {/* System Settings */}
        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <Space>
                <SettingsIcon size={16} color="var(--primary)" />
                <span>{t('settings.system_settings')}</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('settings.currency')}</label>
                <Select
                  style={{ width: '100%' }}
                  value={form.currency}
                  onChange={v => setForm(f => ({ ...f, currency: v }))}
                  options={[
                    { value: 'INR', label: 'INR — ₹ Indian Rupee' },
                    { value: 'USD', label: 'USD — $ US Dollar' },
                    { value: 'EUR', label: 'EUR — € Euro' },
                  ]}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('settings.date_format')}</label>
                <Select
                  style={{ width: '100%' }}
                  value={form.dateFormat}
                  onChange={v => setForm(f => ({ ...f, dateFormat: v }))}
                  options={[
                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                  ]}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{t('settings.language')}</label>
                <Select
                  style={{ width: '100%' }}
                  value={form.language}
                  onChange={v => {
                    setForm(f => ({ ...f, language: v }))
                    changeLanguage(v as 'en' | 'gu')
                  }}
                  options={[
                    { value: 'gu', label: 'ગુજરાતી' },
                    { value: 'en', label: 'English' }
                  ]}
                />
              </div>
            </div>
          </Card>
        </Col>

        {/* Data Summary */}
        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <Space>
                <Database size={16} color="var(--primary)" />
                <span>{t('settings.data_summary')}</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: state.language === 'gu' ? 'કુલ વ્યવહાર' : 'Total Transactions', value: state.transactions.length },
                { label: state.language === 'gu' ? 'કુલ પાર્ટી' : 'Total Parties', value: state.parties.length },
                { label: state.language === 'gu' ? 'કુલ વ્યક્તિ' : 'Total Users', value: state.users.length },
                { label: state.language === 'gu' ? 'ઓડિટ ઘટના' : 'Audit Logs', value: state.auditLogs.length },
                { label: t('nav.accountingYears'), value: state.accountingYears.length },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: '#dcfce7', marginTop: 4 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>{t('dash.net_profit')}</span>
                <span style={{ fontWeight: 700, color: (allIncome - allExpense) >= 0 ? '#16a34a' : '#dc2626' }}>
                  ₹{(allIncome - allExpense).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </Card>
        </Col>

        {/* Backup & Restore */}
        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <Space>
                <HardDrive size={16} color="var(--primary)" />
                <span>{t('settings.backup_restore')}</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '12px', background: 'var(--muted)', borderRadius: 8 }}>
                <Typography.Text strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 4 }}>
                  {t('settings.last_backup')}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: '0.78rem' }}>
                  {state.settings.lastBackup || (state.language === 'gu' ? 'ક્યારેય નહીં' : 'Never')}
                </Typography.Text>
              </div>

              <Button
                type="primary"
                icon={<Download size={14} />}
                onClick={exportBackup}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {t('settings.download_backup')}
              </Button>

              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
                <Typography.Text strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 8 }}>
                  {t('settings.restore_data')}
                </Typography.Text>
                <Alert
                  type="error"
                  showIcon
                  message={t('settings.restore_warning')}
                  style={{ marginBottom: 12, padding: '8px 12px' }}
                />
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 8, background: 'var(--muted)',
                  border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: '0.875rem',
                  fontFamily: 'inherit', fontWeight: 500, color: 'var(--primary)',
                }}>
                  <Upload size={14} />
                  <span>{restoring ? 'Loading...' : t('settings.select_file')}</span>
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestore} />
                </label>
              </div>
            </div>
          </Card>
        </Col>

        {/* Expense Categories Manager */}
        <Col xs={24} md={12} lg={6}>
          <Card
            title={
              <Space>
                <Database size={16} color="var(--primary)" />
                <span>{state.language === 'gu' ? 'ખર્ચ શ્રેણીઓ' : 'Expense Categories'}</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Input to Add Category */}
              <div style={{ display: 'flex', gap: 8 }}>
                <TransliteratedInput
                  value={newCat}
                  onChange={v => setNewCat(v)}
                  placeholder={state.language === 'gu' ? 'નવી શ્રેણી...' : 'New category...'}
                  onPressEnter={handleAddCategory}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  icon={<Plus size={14} />}
                  onClick={handleAddCategory}
                  loading={addingCat}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
              </div>

              {/* List of Categories */}
              <div style={{
                maxHeight: 220,
                overflowY: 'auto',
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                padding: '6px'
              }}>
                {state.expenseCategories.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>
                    {state.language === 'gu' ? 'કોઈ કેટેગરી નથી' : 'No categories found'}
                  </div>
                ) : (
                  state.expenseCategories.map(cat => (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--muted)',
                        marginBottom: 4,
                        border: '1px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Typography.Text style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {cat.name}
                      </Typography.Text>
                      <Button
                        type="text"
                        danger
                        icon={<Trash2 size={13} />}
                        onClick={() => handleDeleteCategory(cat.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          minWidth: 24,
                          padding: 0
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
