import { useState, useEffect } from 'react'
import { Modal, Input, Button, Typography, Alert, message } from 'antd'
import { ShieldCheck, Lock, KeyRound, Check, RefreshCw } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useApp } from '../store/AppContext'
import type { User } from '../types'

interface PinVerificationModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  currentUser: User
  onUserUpdate?: (user: User) => void
  initialMode?: 'verify' | 'setup' | 'reset'
}

export default function PinVerificationModal({
  open,
  onClose,
  onSuccess,
  currentUser,
  onUserUpdate,
  initialMode = 'verify'
}: PinVerificationModalProps) {
  const { t, state } = useApp()
  const isGu = state.language === 'gu'

  const hasPin = Boolean(currentUser.hasPin)
  const [mode, setMode] = useState<'verify' | 'setup' | 'reset'>(
    !hasPin ? 'setup' : initialMode
  )

  // Verify PIN state
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Setup PIN state
  const [setupPin, setSetupPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  // Reset PIN state
  const [password, setPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')

  useEffect(() => {
    if (open) {
      setMode(!currentUser.hasPin ? 'setup' : initialMode)
      setPin('')
      setSetupPin('')
      setConfirmPin('')
      setPassword('')
      setNewPin('')
      setConfirmNewPin('')
      setErrorMsg(null)

      // Ensure keyboard focus goes directly to the input on open
      const timer = window.setTimeout(() => {
        const inputEl = document.querySelector('.ant-modal input') as HTMLInputElement | null
        if (inputEl) {
          inputEl.focus()
        }
      }, 120)
      return () => window.clearTimeout(timer)
    }
  }, [open, currentUser.hasPin, initialMode, mode])

  const handleVerify = async (pinToVerify?: string) => {
    const value = pinToVerify ?? pin
    if (!value || value.length < 4) {
      setErrorMsg(t('pin.digits_required'))
      return
    }

    setLoading(true)
    setErrorMsg(null)
    try {
      await api.auth.verifyPin(value)
      message.success(t('pin.unlock_success'))
      onSuccess()
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('pin.invalid_pin')
      setErrorMsg(msg)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async () => {
    if (!setupPin || setupPin.length < 4) {
      setErrorMsg(t('pin.digits_required'))
      return
    }
    if (setupPin !== confirmPin) {
      setErrorMsg(t('pin.mismatch'))
      return
    }

    setLoading(true)
    setErrorMsg(null)
    try {
      await api.auth.setupPin(setupPin)
      if (onUserUpdate) {
        onUserUpdate({ ...currentUser, hasPin: true })
      }
      message.success(t('pin.unlock_success'))
      onSuccess()
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('general.save_error')
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!password) {
      setErrorMsg(t('pin.password_placeholder'))
      return
    }
    if (!newPin || newPin.length < 4) {
      setErrorMsg(t('pin.digits_required'))
      return
    }
    if (newPin !== confirmNewPin) {
      setErrorMsg(t('pin.mismatch'))
      return
    }

    setLoading(true)
    setErrorMsg(null)
    try {
      await api.auth.resetPin(password, newPin)
      if (onUserUpdate) {
        onUserUpdate({ ...currentUser, hasPin: true })
      }
      message.success(t('pin.reset_success'))
      onSuccess()
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('general.save_error')
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
      styles={{
        content: {
          borderRadius: 20,
          padding: '28px 24px',
          boxShadow: '0 20px 40px rgba(15, 89, 92, 0.22)',
        }
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0f595c 0%, #158084 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 20px rgba(15, 89, 92, 0.25)',
          }}
        >
          {mode === 'verify' ? <ShieldCheck size={28} /> : mode === 'setup' ? <KeyRound size={28} /> : <RefreshCw size={28} />}
        </div>

        <Typography.Title level={4} style={{ margin: 0, fontWeight: 800, color: 'var(--foreground)' }}>
          {mode === 'verify'
            ? t('pin.enter_pin_title')
            : mode === 'setup'
            ? t('pin.setup_pin_title')
            : t('pin.reset_title')}
        </Typography.Title>

        <Typography.Text type="secondary" style={{ fontSize: '0.84rem', marginTop: 6, display: 'block' }}>
          {mode === 'verify'
            ? t('pin.enter_pin_desc')
            : mode === 'setup'
            ? t('pin.setup_pin_desc')
            : (isGu ? 'તમારો લૉગિન પાસવર્ડ દાખલ કરીને નવો PIN સેટ કરો.' : 'Enter your account password to reset your security PIN.')}
        </Typography.Text>
      </div>

      {errorMsg && (
        <Alert
          type="error"
          showIcon
          message={errorMsg}
          style={{ marginBottom: 18, borderRadius: 10, fontSize: '0.84rem' }}
        />
      )}

      {/* ─── Mode: Verify PIN ──────────────────────────────────────────────── */}
      {mode === 'verify' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Input.OTP
              autoFocus
              length={4}
              mask="•"
              size="large"
              value={pin}
              onChange={val => {
                setPin(val)
                setErrorMsg(null)
                if (val.length === 4) {
                  void handleVerify(val)
                }
              }}
              style={{
                gap: 12,
              }}
            />
          </div>

          <Button
            type="primary"
            icon={<Lock size={16} />}
            loading={loading}
            disabled={pin.length < 4}
            onClick={() => handleVerify()}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.92rem',
              background: 'linear-gradient(135deg, #0f595c 0%, #11686c 100%)',
              borderColor: '#0f595c',
              boxShadow: '0 4px 14px rgba(15, 89, 92, 0.25)',
            }}
          >
            {t('pin.verify_btn')}
          </Button>

          <Button
            type="link"
            onClick={() => {
              setMode('reset')
              setErrorMsg(null)
            }}
            style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', padding: 0 }}
          >
            {t('pin.forgot_pin')}
          </Button>
        </div>
      )}

      {/* ─── Mode: Setup PIN ───────────────────────────────────────────────── */}
      {mode === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Typography.Text strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 8, textAlign: 'center' }}>
              {t('pin.pin_label')}
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Input.OTP
                autoFocus
                length={4}
                mask="•"
                size="large"
                value={setupPin}
                onChange={val => {
                  setSetupPin(val)
                  setErrorMsg(null)
                }}
              />
            </div>
          </div>

          <div>
            <Typography.Text strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 8, textAlign: 'center' }}>
              {t('pin.confirm_pin_label')}
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Input.OTP
                length={4}
                mask="•"
                size="large"
                value={confirmPin}
                onChange={val => {
                  setConfirmPin(val)
                  setErrorMsg(null)
                }}
              />
            </div>
          </div>

          <Button
            type="primary"
            icon={<Check size={16} />}
            loading={loading}
            disabled={setupPin.length < 4 || confirmPin.length < 4}
            onClick={handleSetup}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.92rem',
              marginTop: 4,
              background: 'linear-gradient(135deg, #0f595c 0%, #11686c 100%)',
              boxShadow: '0 4px 14px rgba(15, 89, 92, 0.25)',
            }}
          >
            {t('pin.setup_btn')}
          </Button>
        </div>
      )}

      {/* ─── Mode: Reset PIN ───────────────────────────────────────────────── */}
      {mode === 'reset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Typography.Text strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 4 }}>
              {isGu ? 'ખાતાનો પાસવર્ડ' : 'Account Password'}
            </Typography.Text>
            <Input.Password
              autoFocus
              prefix={<Lock size={15} color="var(--muted-foreground)" />}
              value={password}
              onChange={e => {
                setPassword(e.target.value)
                setErrorMsg(null)
              }}
              placeholder={t('pin.password_placeholder')}
              style={{ height: 40, borderRadius: 8 }}
            />
          </div>

          <div>
            <Typography.Text strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 6, textAlign: 'center' }}>
              {t('pin.new_pin')}
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Input.OTP
                length={4}
                mask="•"
                size="large"
                value={newPin}
                onChange={val => {
                  setNewPin(val)
                  setErrorMsg(null)
                }}
              />
            </div>
          </div>

          <div>
            <Typography.Text strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: 6, textAlign: 'center' }}>
              {t('pin.confirm_pin_label')}
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Input.OTP
                length={4}
                mask="•"
                size="large"
                value={confirmNewPin}
                onChange={val => {
                  setConfirmNewPin(val)
                  setErrorMsg(null)
                }}
              />
            </div>
          </div>

          <Button
            type="primary"
            loading={loading}
            disabled={!password || newPin.length < 4 || confirmNewPin.length < 4}
            onClick={handleReset}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.92rem',
              marginTop: 6,
              background: 'linear-gradient(135deg, #0f595c 0%, #11686c 100%)',
              boxShadow: '0 4px 14px rgba(15, 89, 92, 0.25)',
            }}
          >
            {t('pin.reset_btn')}
          </Button>

          {hasPin && (
            <Button
              type="link"
              onClick={() => {
                setMode('verify')
                setErrorMsg(null)
              }}
              style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', padding: 0, textAlign: 'center' }}
            >
              {isGu ? '← PIN દાખલ કરવા પાછા જાઓ' : '← Back to PIN entry'}
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}
