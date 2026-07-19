import { Alert, Button, Card, Form, Input, Space } from 'antd'
import { Lock, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { User } from '../types'
import { api } from '../lib/api'
import { useApp } from '../store/AppContext'

interface LoginProps {
  onLogin: (user: User) => void | Promise<void>
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useApp()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const user = await api.login(values.username, values.password)
      await onLogin(user)
    } catch {
      setError(t('login.error'))
    } finally {
      setLoading(false)
    }
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

          <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
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
        </Space>
      </Card>
    </div>
  )
}
