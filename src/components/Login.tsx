import { Alert, Button, Card, Form, Input, Space, Tag, Typography, message } from 'antd'
import {
  Lock,
  UserRound,
  Smartphone,
  ShieldCheck,
  ArrowLeft,
  Mail,
  KeyRound,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import type { User } from '../types'
import { api, ApiError } from '../lib/api'
import { useApp } from '../store/AppContext'
import logoOne from '../assets/logoOne.png'

interface LoginProps {
  onLogin: (user: User) => void | Promise<void>
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useApp()
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials')
  const [twoFactorMode, setTwoFactorMode] = useState<'authenticator' | 'email' | 'choose_method'>('authenticator')
  const [tempToken, setTempToken] = useState('')
  const [hasEmail, setHasEmail] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)

  // Code states
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [emailCode, setEmailCode] = useState('')

  // UI & Loading states
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Resend cooldown timer cleanup
  useEffect(() => {
    if (resendCooldown > 0) {
      timerRef.current = setTimeout(() => {
        setResendCooldown(prev => prev - 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resendCooldown])

  // Focus input when step or mode changes
  useEffect(() => {
    if (step === '2fa') {
      const timer = window.setTimeout(() => {
        const inputEl = document.querySelector('.login-2fa-input input') as HTMLInputElement | null
        if (inputEl) {
          inputEl.focus()
        }
      }, 150)
      return () => window.clearTimeout(timer)
    }
  }, [step, twoFactorMode])

  const handleCredentialsSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.login(values.username, values.password)
      if (res.require2FA && res.tempToken) {
        setTempToken(res.tempToken)
        setHasEmail(Boolean(res.hasEmail))
        setMaskedEmail(res.maskedEmail || null)
        setTwoFactorMode('authenticator')
        setTwoFactorCode('')
        setEmailCode('')
        setOtpSent(false)
        setResendCooldown(0)
        setStep('2fa')
      } else if (!res.require2FA && res.user) {
        await onLogin(res.user)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('login.error')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // Submit Authenticator App Code
  const handle2FASubmit = async (codeToVerify?: string) => {
    const code = codeToVerify ?? twoFactorCode
    if (!code || code.length < 6) {
      setError(t('2fa.invalid_code'))
      return
    }

    setLoading(true)
    setError('')
    try {
      const user = await api.login2FA(tempToken, code)
      await onLogin(user)
    } catch (err) {
      const msg =
        err instanceof ApiError &&
        err.message &&
        err.message !== 'Internal server error' &&
        err.message !== 'Request failed'
          ? err.message
          : t('2fa.invalid_code')
      setError(msg)
      setTwoFactorCode('')
    } finally {
      setLoading(false)
    }
  }

  // Request Email OTP
  const handleSendEmailOTP = async () => {
    if (!tempToken) return
    if (!hasEmail) {
      setError(t('2fa.no_email_configured'))
      return
    }

    setSendingOtp(true)
    setError('')
    try {
      const res = await api.sendLoginEmailOTP(tempToken)
      setOtpSent(true)
      setResendCooldown(60)
      if (res.maskedEmail) {
        setMaskedEmail(res.maskedEmail)
      }
      message.success(t('2fa.otp_sent_success'))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to send verification email'
      setError(msg)
    } finally {
      setSendingOtp(false)
    }
  }

  // Submit Email OTP Code
  const handleEmailOTPSubmit = async (codeToVerify?: string) => {
    const code = codeToVerify ?? emailCode
    if (!code || code.length < 6) {
      setError(t('2fa.invalid_code'))
      return
    }

    setLoading(true)
    setError('')
    try {
      const user = await api.verifyLoginEmailOTP(tempToken, code)
      await onLogin(user)
    } catch (err) {
      const msg =
        err instanceof ApiError &&
        err.message &&
        err.message !== 'Internal server error' &&
        err.message !== 'Request failed'
          ? err.message
          : t('2fa.invalid_code')
      setError(msg)
      setEmailCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectMethod = (mode: 'authenticator' | 'email') => {
    setError('')
    setTwoFactorMode(mode)

    if (mode === 'email') {
      setEmailCode('')
      if (!otpSent && resendCooldown === 0) {
        void handleSendEmailOTP()
      }
    } else {
      setTwoFactorCode('')
    }
  }

  const handleBackToLogin = () => {
    setStep('credentials')
    setTwoFactorMode('authenticator')
    setTempToken('')
    setTwoFactorCode('')
    setEmailCode('')
    setError('')
    setOtpSent(false)
    setResendCooldown(0)
  }

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <img
              src={logoOne}
              alt="Gopinathji Gems Logo"
              style={{ width: 190, height: 110, objectFit: 'contain', display: 'inline-block' }}
            />
          </div>

          {error && <Alert type="error" showIcon message={error} style={{ borderRadius: 8 }} />}

          {step === 'credentials' ? (
            <Form layout="vertical" onFinish={handleCredentialsSubmit} requiredMark={false}>
              <Form.Item
                label={<span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary)' }}>{t('login.username')}</span>}
                name="username"
                rules={[{ required: true, message: t('login.username_required') }]}
                style={{ marginBottom: 16 }}
              >
                <Input
                  size="large"
                  prefix={<UserRound size={16} style={{ color: 'var(--muted-foreground)', marginRight: 4 }} />}
                  placeholder={t('login.username_placeholder')}
                  autoComplete="username"
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--secondary)' }}>{t('login.password')}</span>}
                name="password"
                rules={[{ required: true, message: t('login.password_required') }]}
                style={{ marginBottom: 24 }}
              >
                <Input.Password
                  size="large"
                  prefix={<Lock size={16} style={{ color: 'var(--muted-foreground)', marginRight: 4 }} />}
                  placeholder={t('login.password_placeholder')}
                  autoComplete="current-password"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                size="large"
                style={{
                  height: 44,
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 12px rgba(16, 42, 131, 0.15)'
                }}
              >
                {t('login.button')}
              </Button>
            </Form>
          ) : twoFactorMode === 'authenticator' ? (
            /* ─── Mode 1: Authenticator App ─── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0f595c 0%, #158084 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    boxShadow: '0 6px 16px rgba(15, 89, 92, 0.25)',
                  }}
                >
                  <Smartphone size={26} />
                </div>

                <Typography.Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                  {t('2fa.login_title')}
                </Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: '0.82rem', marginTop: 4, display: 'block' }}>
                  {t('2fa.login_desc')}
                </Typography.Text>
              </div>

              <div className="login-2fa-input" style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                <Input.OTP
                  autoFocus
                  length={6}
                  size="large"
                  value={twoFactorCode}
                  onChange={val => {
                    setTwoFactorCode(val)
                    setError('')
                    if (val.length === 6) {
                      void handle2FASubmit(val)
                    }
                  }}
                  style={{ gap: 8 }}
                />
              </div>

              <Button
                type="primary"
                icon={<ShieldCheck size={16} />}
                loading={loading}
                disabled={twoFactorCode.length < 6}
                onClick={() => handle2FASubmit()}
                block
                size="large"
                style={{
                  height: 44,
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  background: 'linear-gradient(135deg, #0f595c 0%, #11686c 100%)',
                  borderColor: '#0f595c',
                  boxShadow: '0 4px 12px rgba(15, 89, 92, 0.25)',
                }}
              >
                {t('2fa.login_btn')}
              </Button>

              {/* Try Another Way Option */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', marginTop: 4 }}>
                <Button
                  type="link"
                  icon={<KeyRound size={15} />}
                  onClick={() => {
                    setError('')
                    setTwoFactorMode('choose_method')
                  }}
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: '#0f595c',
                    padding: 0,
                    height: 'auto',
                  }}
                >
                  {t('2fa.try_another_way')}
                </Button>

                <Button
                  type="link"
                  icon={<ArrowLeft size={14} />}
                  onClick={handleBackToLogin}
                  style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', padding: 0, height: 'auto', marginTop: 4 }}
                >
                  {t('2fa.back_to_login')}
                </Button>
              </div>
            </div>
          ) : twoFactorMode === 'email' ? (
            /* ─── Mode 2: Email OTP ─── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    boxShadow: '0 6px 16px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <Mail size={26} />
                </div>

                <Typography.Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                  {t('2fa.email_login_title')}
                </Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: '0.82rem', marginTop: 4, display: 'block' }}>
                  {t('2fa.email_login_desc')}
                </Typography.Text>
                {maskedEmail && (
                  <Tag color="cyan" style={{ marginTop: 6, padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: '0.82rem' }}>
                    {maskedEmail}
                  </Tag>
                )}
              </div>

              {!hasEmail ? (
                <Alert
                  type="warning"
                  showIcon
                  icon={<AlertCircle size={16} />}
                  message={t('2fa.no_email_configured')}
                  style={{ borderRadius: 8, fontSize: '0.82rem' }}
                />
              ) : (
                <>
                  <div className="login-2fa-input" style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                    <Input.OTP
                      autoFocus
                      length={6}
                      size="large"
                      value={emailCode}
                      onChange={val => {
                        setEmailCode(val)
                        setError('')
                        if (val.length === 6) {
                          void handleEmailOTPSubmit(val)
                        }
                      }}
                      style={{ gap: 8 }}
                    />
                  </div>

                  <Button
                    type="primary"
                    icon={<ShieldCheck size={16} />}
                    loading={loading}
                    disabled={emailCode.length < 6}
                    onClick={() => handleEmailOTPSubmit()}
                    block
                    size="large"
                    style={{
                      height: 44,
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      borderColor: '#0284c7',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                    }}
                  >
                    {t('2fa.login_btn')}
                  </Button>

                  {/* Resend OTP button with cooldown */}
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    {resendCooldown > 0 ? (
                      <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
                        {t('2fa.resend_in').replace('{sec}', String(resendCooldown))}
                      </Typography.Text>
                    ) : (
                      <Button
                        type="link"
                        icon={<RefreshCw size={14} className={sendingOtp ? 'animate-spin' : ''} />}
                        loading={sendingOtp}
                        onClick={() => handleSendEmailOTP()}
                        style={{ fontSize: '0.82rem', color: '#0284c7', padding: 0, height: 'auto' }}
                      >
                        {t('2fa.resend_otp_btn')}
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* Navigation Links */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', marginTop: 4 }}>
                <Button
                  type="link"
                  icon={<KeyRound size={15} />}
                  onClick={() => {
                    setError('')
                    setTwoFactorMode('choose_method')
                  }}
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: '#0f595c',
                    padding: 0,
                    height: 'auto',
                  }}
                >
                  {t('2fa.try_another_way')}
                </Button>

                <Button
                  type="link"
                  icon={<ArrowLeft size={14} />}
                  onClick={handleBackToLogin}
                  style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', padding: 0, height: 'auto', marginTop: 4 }}
                >
                  {t('2fa.back_to_login')}
                </Button>
              </div>
            </div>
          ) : (
            /* ─── Mode 3: Choose Verification Method (in-card) ─── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0f595c 0%, #158084 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    boxShadow: '0 6px 16px rgba(15, 89, 92, 0.25)',
                  }}
                >
                  <KeyRound size={26} />
                </div>

                <Typography.Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                  {t('2fa.choose_method_title')}
                </Typography.Title>
                <Typography.Text type="secondary" style={{ fontSize: '0.82rem', marginTop: 4, display: 'block' }}>
                  {t('2fa.choose_method_desc')}
                </Typography.Text>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginTop: 4 }}>
                {/* Method 1: Authenticator App */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectMethod('authenticator')}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSelectMethod('authenticator')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1.5px solid #0f595c',
                    background: '#f0fdf4',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(15, 89, 92, 0.08)',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: '#e6fffa',
                        color: '#0f595c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Smartphone size={22} />
                    </div>
                    <div>
                      <Typography.Text strong style={{ display: 'block', fontSize: '0.92rem', color: '#0f595c' }}>
                        {t('2fa.method_authenticator')}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: '0.78rem', lineHeight: 1.3, display: 'block' }}>
                        {t('2fa.method_authenticator_desc')}
                      </Typography.Text>
                    </div>
                  </div>
                  <CheckCircle2 size={18} color="#0f595c" style={{ flexShrink: 0, marginLeft: 8 }} />
                </div>

                {/* Method 2: Email OTP */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectMethod('email')}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSelectMethod('email')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: '#e0f2fe',
                        color: '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Mail size={22} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Typography.Text strong style={{ display: 'block', fontSize: '0.92rem' }}>
                          {t('2fa.method_email')}
                        </Typography.Text>
                        {maskedEmail && (
                          <Tag color="cyan" style={{ fontSize: '0.72rem', borderRadius: 8, padding: '0 6px', margin: 0 }}>
                            {maskedEmail}
                          </Tag>
                        )}
                      </div>
                      <Typography.Text type="secondary" style={{ fontSize: '0.78rem', lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                        {hasEmail ? t('2fa.method_email_desc') : t('2fa.no_email_configured')}
                      </Typography.Text>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Back */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', marginTop: 4 }}>
                <Button
                  type="link"
                  icon={<Smartphone size={15} />}
                  onClick={() => {
                    setError('')
                    setTwoFactorMode('authenticator')
                  }}
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: '#0f595c',
                    padding: 0,
                    height: 'auto',
                  }}
                >
                  {t('2fa.switch_to_authenticator')}
                </Button>

                <Button
                  type="link"
                  icon={<ArrowLeft size={14} />}
                  onClick={handleBackToLogin}
                  style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', padding: 0, height: 'auto', marginTop: 4 }}
                >
                  {t('2fa.back_to_login')}
                </Button>
              </div>
            </div>
          )}
        </Space>
      </Card>
    </div>
  )
}

