import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { Button, Modal } from 'antd'
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react'

export type ConfirmTone = 'danger' | 'primary'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  /** `danger` renders a destructive red action (delete / deactivate). */
  tone?: ConfirmTone
  /** Replace the default icon. */
  icon?: 'trash' | 'alert' | 'question'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const close = useCallback(
    (value: boolean) => {
      setPending((current) => {
        current?.resolve(value)
        return null
      })
    },
    []
  )

  const tone: ConfirmTone = pending?.tone ?? 'primary'
  const isDanger = tone === 'danger'
  const iconKind = pending?.icon ?? (isDanger ? 'trash' : 'question')

  const accent = isDanger ? '#dc2626' : '#102a83'
  const tint = isDanger ? '#fef2f2' : '#eef4ff'

  const api = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal
        open={pending !== null}
        onCancel={() => close(false)}
        footer={null}
        centered
        width={432}
        closable={false}
        mask={{ closable: false }}
        styles={{ body: { padding: 22 } }}
        style={{ borderRadius: 18 }}
      >
        {pending ? (
          <div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span
                aria-hidden="true"
                style={{
                  flex: '0 0 auto',
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  display: 'grid',
                  placeItems: 'center',
                  background: tint,
                  color: accent,
                }}
              >
                {iconKind === 'trash' ? (
                  <Trash2 size={19} strokeWidth={2.3} />
                ) : iconKind === 'alert' ? (
                  <AlertTriangle size={19} strokeWidth={2.3} />
                ) : (
                  <HelpCircle size={19} strokeWidth={2.3} />
                )}
              </span>

              <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                <div
                  style={{
                    fontSize: 15.5,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    color: 'var(--foreground)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {pending.title}
                </div>
                {pending.description ? (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {pending.description}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 22,
              }}
            >
              <Button
                onClick={() => close(false)}
                autoFocus={isDanger}
                style={{ height: 38, borderRadius: 10, minWidth: 88, fontWeight: 600 }}
              >
                {pending.cancelText ?? 'Cancel'}
              </Button>
              <Button
                type="primary"
                danger={isDanger}
                onClick={() => close(true)}
                autoFocus={!isDanger}
                style={{ height: 38, borderRadius: 10, minWidth: 96, fontWeight: 600 }}
              >
                {pending.confirmText ?? 'Confirm'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </ConfirmContext.Provider>
  )
}

/** Promise-based confirmation dialog: `const ok = await confirm({ ... })` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used inside a <ConfirmProvider>')
  }
  return ctx
}
