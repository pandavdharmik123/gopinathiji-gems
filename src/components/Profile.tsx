import { useState } from 'react'
import {
  Card,
  Row,
  Col,
  Input,
  Button,
  Avatar,
  Tag,
  Typography,
  Tabs,
  Alert,
  Divider,
  Space,
  Badge,
  message
} from 'antd'
import {
  User as UserIcon,
  Lock,
  Mail,
  ShieldCheck,
  Calendar,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  Check,
  UserCheck,
  Sparkles,
  Smartphone
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { api, ApiError } from '../lib/api'
import type { User } from '../types'
import TransliteratedInput from './TransliteratedInput'
import PinVerificationModal from './PinVerificationModal'
import TwoFactorModal from './TwoFactorModal'

interface ProfileProps {
  currentUser: User
  onUserUpdate: (user: User) => void
}

export default function Profile({ currentUser, onUserUpdate }: ProfileProps) {
  const { state, t } = useApp()
  const isGu = state.language === 'gu'
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'reset'>('setup')

  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false)
  const [twoFactorModalMode, setTwoFactorModalMode] = useState<'setup' | 'disable'>('setup')

  // Personal Info Form State
  const [name, setName] = useState(currentUser.name)
  const [email, setEmail] = useState(currentUser.email || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Handle Profile Update
  const handleUpdateProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!name.trim()) {
      setProfileError(isGu ? 'કૃપા કરીને પૂરું નામ દાખલ કરો' : 'Please enter your full name')
      return
    }

    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(false)

    try {
      const updatedUser = await api.auth.updateProfile({
        name: name.trim(),
        email: email.trim() || undefined,
      })
      onUserUpdate(updatedUser)
      setProfileSuccess(true)
      message.success(t('profile.save_success'))
      setTimeout(() => setProfileSuccess(false), 4000)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('general.save_error')
      setProfileError(msg)
      message.error(msg)
    } finally {
      setProfileSaving(false)
    }
  }

  // Handle Password Change
  const handleChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (!currentPassword) {
      setPasswordError(t('profile.current_pwd_placeholder'))
      return
    }
    if (newPassword.length < 6) {
      setPasswordError(t('profile.pwd_min_length'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.pwd_mismatch'))
      return
    }

    setPasswordSaving(true)
    try {
      await api.auth.changePassword(currentPassword, newPassword)
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      message.success(t('profile.pwd_change_success'))
      setTimeout(() => setPasswordSuccess(false), 5000)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('profile.pwd_change_error')
      setPasswordError(msg)
      message.error(msg)
    } finally {
      setPasswordSaving(false)
    }
  }

  const roleColor: Record<string, string> = {
    admin: '#7c3aed',
    manager: '#0284c7',
    employee: '#16a34a'
  }

  const roleLabel = t('role.' + currentUser.role)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* ─── Profile Header Card ────────────────────────────────────────────── */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          marginBottom: 24,
          background: 'linear-gradient(135deg, #0d383b 0%, #0f595c 100%)',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(15, 89, 92, 0.15)',
          overflow: 'hidden',
          position: 'relative'
        }}
        styles={{ body: { padding: '28px 32px' } }}
      >
        <div style={{
          position: 'absolute',
          right: -20,
          top: -20,
          opacity: 0.08,
          pointerEvents: 'none'
        }}>
          <Sparkles size={220} />
        </div>

        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} sm="auto">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                size={84}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: 34,
                  fontWeight: 800,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  border: '3px solid rgba(255,255,255,0.3)'
                }}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </Avatar>
              <div style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                background: '#10b981',
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2.5px solid #0f595c'
              }} />
            </div>
          </Col>

          <Col xs={24} sm={16} md={18}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Typography.Title level={2} style={{ margin: 0, color: '#ffffff', fontWeight: 800 }}>
                {currentUser.name}
              </Typography.Title>
              <Tag
                color={roleColor[currentUser.role] || 'cyan'}
                style={{
                  borderRadius: 12,
                  padding: '2px 12px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  border: 'none',
                  color: '#ffffff',
                  background: 'rgba(255,255,255,0.2)'
                }}
              >
                {roleLabel}
              </Tag>
              <Tag
                color="success"
                style={{
                  borderRadius: 12,
                  padding: '2px 10px',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: 'none',
                  background: 'rgba(16, 185, 129, 0.25)',
                  color: '#a7f3d0'
                }}
              >
                ● {isGu ? 'સક્રિય ખાતું' : 'Active Account'}
              </Tag>
            </div>

            <div style={{
              display: 'flex',
              gap: 20,
              flexWrap: 'wrap',
              marginTop: 10,
              fontSize: '0.86rem',
              color: 'rgba(255,255,255,0.85)'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserIcon size={15} style={{ opacity: 0.8 }} />
                @{currentUser.username}
              </span>
              {currentUser.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={15} style={{ opacity: 0.8 }} />
                  {currentUser.email}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={15} style={{ opacity: 0.8 }} />
                {isGu ? 'ખાતું બન્યું' : 'Joined'}: {currentUser.createdAt || '2026-08-01'}
              </span>
            </div>
          </Col>
        </Row>
      </Card>

      {/* ─── Profile Content Grid ───────────────────────────────────────────── */}
      <Row gutter={[24, 24]}>
        {/* Left Column: Personal Information */}
        <Col xs={24} md={12}>
          <Card
            bordered={false}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                <div style={{
                  background: '#eff6ff',
                  color: '#2563eb',
                  padding: 7,
                  borderRadius: 8,
                  display: 'flex'
                }}>
                  <UserCheck size={18} />
                </div>
                <div>
                  <Typography.Text strong style={{ fontSize: '1rem', display: 'block' }}>
                    {t('profile.tab_personal')}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: '0.76rem' }}>
                    {isGu ? 'તમારું પૂરું નામ અને ઇમેઇલ અપડેટ કરો' : 'Update your personal name & email'}
                  </Typography.Text>
                </div>
              </div>
            }
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              border: '1px solid var(--border)',
              height: '100%'
            }}
            styles={{ body: { padding: '24px 26px' } }}
          >
            {profileSuccess && (
              <Alert
                type="success"
                showIcon
                message={t('profile.save_success')}
                style={{ marginBottom: 18, borderRadius: 8 }}
              />
            )}
            {profileError && (
              <Alert
                type="error"
                showIcon
                message={profileError}
                style={{ marginBottom: 18, borderRadius: 8 }}
              />
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem' }}>
                  {t('profile.name')} <span style={{ color: '#dc2626' }}>*</span>
                </Typography.Text>
                <TransliteratedInput
                  value={name}
                  onChange={v => setName(v)}
                  placeholder={t('profile.name')}
                  style={{ height: 40, borderRadius: 8 }}
                />
              </div>

              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem' }}>
                  {t('profile.email')}
                </Typography.Text>
                <Input
                  prefix={<Mail size={15} color="var(--muted-foreground)" />}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{ height: 40, borderRadius: 8 }}
                />
              </div>

              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem' }}>
                      {t('profile.username')}
                    </Typography.Text>
                    <Input
                      disabled
                      value={currentUser.username}
                      style={{ height: 38, borderRadius: 8, background: '#f8fafc', color: '#475569' }}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem' }}>
                      {t('profile.role')}
                    </Typography.Text>
                    <Input
                      disabled
                      value={roleLabel}
                      style={{ height: 38, borderRadius: 8, background: '#f8fafc', color: '#475569', fontWeight: 600 }}
                    />
                  </div>
                </Col>
              </Row>

              <Divider style={{ margin: '8px 0' }} />

              <Button
                type="primary"
                icon={<Save size={16} />}
                loading={profileSaving}
                onClick={() => handleUpdateProfile()}
                style={{
                  height: 42,
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 12px rgba(15, 89, 92, 0.2)'
                }}
              >
                {t('profile.save_btn')}
              </Button>
            </form>
          </Card>
        </Col>

        {/* Right Column: Change Password */}
        <Col xs={24} md={12}>
          <Card
            bordered={false}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                <div style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  padding: 7,
                  borderRadius: 8,
                  display: 'flex'
                }}>
                  <KeyRound size={18} />
                </div>
                <div>
                  <Typography.Text strong style={{ fontSize: '1rem', display: 'block' }}>
                    {t('profile.change_pwd_title')}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: '0.76rem' }}>
                    {t('profile.change_pwd_subtitle')}
                  </Typography.Text>
                </div>
              </div>
            }
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              border: '1px solid var(--border)',
              height: '100%'
            }}
            styles={{ body: { padding: '24px 26px' } }}
          >
            {passwordSuccess && (
              <Alert
                type="success"
                showIcon
                message={t('profile.pwd_change_success')}
                style={{ marginBottom: 18, borderRadius: 8 }}
              />
            )}
            {passwordError && (
              <Alert
                type="error"
                showIcon
                message={passwordError}
                style={{ marginBottom: 18, borderRadius: 8 }}
              />
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Current Password */}
              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem' }}>
                  {t('profile.current_pwd')} <span style={{ color: '#dc2626' }}>*</span>
                </Typography.Text>
                <Input.Password
                  prefix={<Lock size={15} color="var(--muted-foreground)" />}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder={t('profile.current_pwd_placeholder')}
                  style={{ height: 40, borderRadius: 8 }}
                />
              </div>

              {/* New Password */}
              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem' }}>
                  {t('profile.new_pwd')} <span style={{ color: '#dc2626' }}>*</span>
                </Typography.Text>
                <Input.Password
                  prefix={<KeyRound size={15} color="var(--muted-foreground)" />}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={t('profile.new_pwd_placeholder')}
                  style={{ height: 40, borderRadius: 8 }}
                />
              </div>

              {/* Confirm New Password */}
              <div>
                <Typography.Text strong style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem' }}>
                  {t('profile.confirm_pwd')} <span style={{ color: '#dc2626' }}>*</span>
                </Typography.Text>
                <Input.Password
                  prefix={<ShieldCheck size={15} color="var(--muted-foreground)" />}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t('profile.confirm_pwd_placeholder')}
                  style={{ height: 40, borderRadius: 8 }}
                />
              </div>

              {/* Password Requirements Guide */}
              <div style={{
                background: '#f8fafc',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: '0.78rem',
                color: '#64748b'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Check size={13} color={newPassword.length >= 6 ? '#16a34a' : '#94a3b8'} />
                  <span style={{ color: newPassword.length >= 6 ? '#16a34a' : 'inherit', fontWeight: newPassword.length >= 6 ? 600 : 'normal' }}>
                    {isGu ? 'ઓછામાં ઓછા ૬ અક્ષરો' : 'Minimum 6 characters'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={13} color={newPassword && confirmPassword && newPassword === confirmPassword ? '#16a34a' : '#94a3b8'} />
                  <span style={{ color: newPassword && confirmPassword && newPassword === confirmPassword ? '#16a34a' : 'inherit', fontWeight: newPassword && confirmPassword && newPassword === confirmPassword ? 600 : 'normal' }}>
                    {isGu ? 'પાસવર્ડ અને કન્ફર્મ પાસવર્ડ મેળ ખાય છે' : 'Passwords match'}
                  </span>
                </div>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <Button
                type="primary"
                danger
                icon={<Lock size={16} />}
                loading={passwordSaving}
                onClick={() => handleChangePassword()}
                style={{
                  height: 42,
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.15)'
                }}
              >
                {t('profile.change_pwd_btn')}
              </Button>
            </form>
          </Card>
        </Col>
      </Row>

      {/* ─── PIN Security Management Card ───────────────────────────────────── */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          marginTop: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: '#ecfeff',
              color: '#0891b2',
              padding: 8,
              borderRadius: 10,
              display: 'flex',
            }}>
              <KeyRound size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text strong style={{ fontSize: '0.95rem' }}>
                  {t('profile.pin_protection')}
                </Typography.Text>
                <Tag color={currentUser.hasPin ? 'success' : 'default'} style={{ borderRadius: 10, fontSize: '0.72rem', fontWeight: 600 }}>
                  {currentUser.hasPin ? t('profile.pin_active') : t('profile.pin_inactive')}
                </Tag>
              </div>
              <Typography.Text type="secondary" style={{ fontSize: '0.8rem', display: 'block', marginTop: 2 }}>
                {isGu
                  ? 'ડેશબોર્ડના આંકડા અને બેલેન્સ છુપાવવા અને જોવા માટે ૪-અંકનો સુરક્ષા PIN વાપરો.'
                  : 'Protect and mask sensitive financial numbers on the dashboard behind a 4-digit PIN.'}
              </Typography.Text>
            </div>
          </div>

          <Button
            type="primary"
            icon={<KeyRound size={15} />}
            onClick={() => {
              setPinModalMode(currentUser.hasPin ? 'reset' : 'setup')
              setPinModalOpen(true)
            }}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0f595c 0%, #11686c 100%)',
              borderColor: '#0f595c',
            }}
          >
            {currentUser.hasPin ? t('profile.change_pin') : t('profile.setup_pin')}
          </Button>
        </div>
      </Card>

      {/* ─── Two-Factor Authentication (2FA) Management Card ─────────────────── */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          marginTop: 18,
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          border: '1px solid var(--border)',
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: currentUser.twoFactorEnabled ? '#ecfdf5' : '#f8fafc',
              color: currentUser.twoFactorEnabled ? '#10b981' : '#64748b',
              padding: 8,
              borderRadius: 10,
              display: 'flex',
            }}>
              <Smartphone size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text strong style={{ fontSize: '0.95rem' }}>
                  {t('2fa.title')}
                </Typography.Text>
                <Tag color={currentUser.twoFactorEnabled ? 'success' : 'default'} style={{ borderRadius: 10, fontSize: '0.72rem', fontWeight: 600 }}>
                  {currentUser.twoFactorEnabled ? t('2fa.active') : t('2fa.inactive')}
                </Tag>
              </div>
              <Typography.Text type="secondary" style={{ fontSize: '0.8rem', display: 'block', marginTop: 2 }}>
                {t('2fa.desc')}
              </Typography.Text>
            </div>
          </div>

          <Button
            type={currentUser.twoFactorEnabled ? 'default' : 'primary'}
            danger={currentUser.twoFactorEnabled}
            icon={<Smartphone size={15} />}
            onClick={() => {
              setTwoFactorModalMode(currentUser.twoFactorEnabled ? 'disable' : 'setup')
              setTwoFactorModalOpen(true)
            }}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              ...(!currentUser.twoFactorEnabled ? {
                background: 'linear-gradient(135deg, #0f595c 0%, #11686c 100%)',
                borderColor: '#0f595c',
                color: '#ffffff',
              } : {}),
            }}
          >
            {currentUser.twoFactorEnabled ? t('2fa.disable_btn') : t('2fa.setup_btn')}
          </Button>
        </div>
      </Card>

      {/* PIN Verification / Setup / Reset Modal */}
      <PinVerificationModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={() => { }}
        currentUser={currentUser}
        onUserUpdate={onUserUpdate}
        initialMode={pinModalMode}
      />

      {/* Two-Factor Authentication Modal */}
      <TwoFactorModal
        open={twoFactorModalOpen}
        onClose={() => setTwoFactorModalOpen(false)}
        onSuccess={() => { }}
        currentUser={currentUser}
        onUserUpdate={onUserUpdate}
        mode={twoFactorModalMode}
      />
    </div>
  )
}
