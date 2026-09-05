import { useState, useEffect } from 'react'
import { Modal, Input, Button, Typography, Alert, message, Spin, Tooltip } from 'antd'
import { ShieldCheck, Smartphone, Copy, Check, Lock, AlertTriangle } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useApp } from '../store/AppContext'
import type { User } from '../types'

interface TwoFactorModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  currentUser: User
  onUserUpdate?: (user: User) => void
  mode?: 'setup' | 'disable'
}

export default function TwoFactorModal({
  open,
  onClose,
  onSuccess,
  currentUser,
  onUserUpdate,
  mode = 'setup',
}: TwoFactorModalProps) {
  const { t, state } = useApp()
  const isGu = state.language === 'gu'

  // Setup state
  const [loadingSetup, setLoadingSetup] = useState(false)
  const [secret, setSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)

  // Disable state
  const [password, setPassword] = useState('')
  const [disableCode, setDisableCode] = useState('')

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setCode('')
      setPassword('')
      setDisableCode('')
      setErrorMsg(null)
      setCopied(false)

      if (mode === 'setup') {
        fetchSetupData()
      }

      // Auto-focus the input field on open
      const timer = window.setTimeout(() => {
        const inputEl = document.querySelector('.two-factor-modal input') as HTMLInputElement | null
        if (inputEl) {
          inputEl.focus()
        }
      }, 150)
      return () => window.clearTimeout(timer)
    }
  }, [open, mode])

  const fetchSetupData = async () => {
    setLoadingSetup(true)
    setErrorMsg(null)
    try {
      const res = await api.auth.get2FASetup()
      if (res.secret && res.qrCodeUrl) {
        setSecret(res.secret)
        setQrCodeUrl(res.qrCodeUrl)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('general.save_error')
      setErrorMsg(msg)
    } finally {
      setLoadingSetup(false)
    }
  }

  const handleCopySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      message.success(t('2fa.copied'))
      setTimeout(() => setCopied(false), 3000)
    } catch {
      message.info(secret)
    }
  }

  const handleVerifyAndEnable = async (codeToVerify?: string) => {
    const val = codeToVerify ?? code
    if (!val || val.length < 6) {
      setErrorMsg(isGu ? 'કૃપા કરીને ૬-અંકનો કોડ દાખલ કરો' : 'Please enter the 6-digit code')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)
    try {
      const updatedUser = await api.auth.verify2FASetup(secret, val)
      if (onUserUpdate) {
        onUserUpdate(updatedUser)
      }
      message.success(t('2fa.enable_success'))
      onSuccess()
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('2fa.invalid_code')
      setErrorMsg(msg)
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!password && !disableCode) {
      setErrorMsg(isGu ? 'પાસવર્ડ અથવા ૬-અંકનો કોડ દાખલ કરો' : 'Please enter your password or 6-digit code')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)
    try {
      const updatedUser = await api.auth.disable2FA({
        password: password || undefined,
        code: disableCode || undefined,
      })
      if (onUserUpdate) {
        onUserUpdate(updatedUser)
      }
      message.success(t('2fa.disable_success'))
      onSuccess()
      onClose()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('general.save_error')
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={mode === 'setup' ? 480 : 420}
      wrapClassName="two-factor-modal"
      styles={{
        content: {
          borderRadius: 20,
          padding: '28px 24px',
          boxShadow: '0 20px 40px rgba(15, 89, 92, 0.22)',
        },
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: mode === 'setup'
              ? 'linear-gradient(135deg, #0f595c 0%, #158084 100%)'
              : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: mode === 'setup'
              ? '0 8px 20px rgba(15, 89, 92, 0.25)'
              : '0 8px 20px rgba(220, 38, 38, 0.25)',
          }}
        >
          {mode === 'setup' ? <Smartphone size={28} /> : <AlertTriangle size={28} />}
        </div>

        <Typography.Title level={4} style={{ margin: 0, fontWeight: 800, color: 'var(--foreground)' }}>
          {mode === 'setup' ? t('2fa.modal_setup_title') : t('2fa.modal_disable_title')}
        </Typography.Title>

        <Typography.Text type="secondary" style={{ fontSize: '0.84rem', marginTop: 6, display: 'block' }}>
          {mode === 'setup' ? t('2fa.modal_setup_desc') : t('2fa.modal_disable_desc')}
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

      {/* ─── Mode: Setup 2FA ─────────────────────────────────────────────────── */}
      {mode === 'setup' && (
        <div>
          {loadingSetup ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: '0.86rem' }}>
                {t('general.loading')}
              </Typography.Text>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Step 1: QR Code & Key */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: 16,
                  textAlign: 'center',
                }}
              >
                <Typography.Text strong style={{ fontSize: '0.84rem', display: 'block', marginBottom: 12, color: '#334155' }}>
                  {t('2fa.scan_step')}
                </Typography.Text>

                {qrCodeUrl && (
                  <div
                    style={{
                      display: 'inline-block',
                      padding: 10,
                      background: '#ffffff',
                      borderRadius: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      border: '1px solid #e2e8f0',
                      marginBottom: 12,
                    }}
                  >
                    <img
                      src={qrCodeUrl}
                      alt="2FA QR Code"
                      style={{ width: 170, height: 170, display: 'block' }}
                    />
                  </div>
                )}

                <div>
                  <Typography.Text type="secondary" style={{ fontSize: '0.78rem', display: 'block', marginBottom: 6 }}>
                    {t('2fa.manual_entry')}
                  </Typography.Text>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      background: '#ffffff',
                      border: '1px dashed #cbd5e1',
                      borderRadius: 8,
                      padding: '6px 12px',
                      maxWidth: 320,
                      margin: '0 auto',
                    }}
                  >
                    <code style={{ fontSize: '0.86rem', letterSpacing: 1.5, fontWeight: 700, color: '#0f595c' }}>
                      {secret}
                    </code>
                    <Tooltip title={copied ? t('2fa.copied') : t('2fa.copy_key')}>
                      <Button
                        type="text"
                        size="small"
                        icon={copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                        onClick={handleCopySecret}
                        style={{ color: '#0f595c' }}
                      />
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Step 2: 6-Digit OTP Verification */}
              <div style={{ textAlign: 'center' }}>
                <Typography.Text strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 10, color: '#1e293b' }}>
                  {t('2fa.verify_step')}
                </Typography.Text>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <Input.OTP
                    autoFocus
                    length={6}
                    size="large"
                    value={code}
                    onChange={val => {
                      setCode(val)
                      setErrorMsg(null)
                      if (val.length === 6) {
                        void handleVerifyAndEnable(val)
                      }
                    }}
                    style={{ gap: 8 }}
                  />
                </div>

                <Button
                  type="primary"
                  icon={<ShieldCheck size={16} />}
                  loading={submitting}
                  disabled={code.length < 6}
                  onClick={() => handleVerifyAndEnable()}
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
                  {t('2fa.verify_and_enable')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Mode: Disable 2FA ──────────────────────────────────────────────── */}
      {mode === 'disable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Typography.Text strong style={{ fontSize: '0.84rem', display: 'block', marginBottom: 6 }}>
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
              placeholder={isGu ? 'લૉગિન પાસવર્ડ દાખલ કરો' : 'Enter account password'}
              style={{ height: 40, borderRadius: 8 }}
            />
          </div>

          <div style={{ textAlign: 'center', margin: '4px 0' }}>
            <Typography.Text type="secondary" style={{ fontSize: '0.78rem' }}>
              {isGu ? '— અથવા —' : '— OR —'}
            </Typography.Text>
          </div>

          <div>
            <Typography.Text strong style={{ fontSize: '0.84rem', display: 'block', marginBottom: 6, textAlign: 'center' }}>
              {isGu ? 'હાલનો ૬-અંકનો ઓથેન્ટિકેટર કોડ' : 'Current 6-Digit Authenticator Code'}
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Input.OTP
                length={6}
                size="large"
                value={disableCode}
                onChange={val => {
                  setDisableCode(val)
                  setErrorMsg(null)
                }}
                style={{ gap: 8 }}
              />
            </div>
          </div>

          <Button
            type="primary"
            danger
            loading={submitting}
            disabled={!password && disableCode.length < 6}
            onClick={handleDisable2FA}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.92rem',
              marginTop: 6,
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.25)',
            }}
          >
            {t('2fa.disable_confirm_btn')}
          </Button>
        </div>
      )}
    </Modal>
  )
}
