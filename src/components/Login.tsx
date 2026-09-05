import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd'
import { Lock, UserRound, Smartphone, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { User } from '../types'
import { api, ApiError } from '../lib/api'
import { useApp } from '../store/AppContext'

interface LoginProps {
  onLogin: (user: User) => void | Promise<void>
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useApp()
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials')
  const [tempToken, setTempToken] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
  }, [step])

  const handleCredentialsSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.login(values.username, values.password)
      if (res.require2FA && res.tempToken) {
        setTempToken(res.tempToken)
        setStep('2fa')
        setTwoFactorCode('')
      } else if (res.user) {
        await onLogin(res.user)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('login.error')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

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
      const msg = err instanceof ApiError ? err.message : t('2fa.invalid_code')
      setError(msg)
      setTwoFactorCode('')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToLogin = () => {
    setStep('credentials')
    setTempToken('')
    setTwoFactorCode('')
    setError('')
  }

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <img
              src="/logoOne.png"
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
          ) : (
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

              <Button
                type="link"
                icon={<ArrowLeft size={14} />}
                onClick={handleBackToLogin}
                style={{ fontSize: '0.84rem', color: 'var(--muted-foreground)' }}
              >
                {t('2fa.back_to_login')}
              </Button>
            </div>
          )}
        </Space>
      </Card>
    </div>
  )
}

