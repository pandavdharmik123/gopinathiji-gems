import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, Check, Info, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  /** Short, scannable headline. */
  title: string
  /** Optional supporting line. */
  description?: string
  /**
   * Milliseconds before the toast dismisses itself.
   * Use 0 to keep it on screen until the user closes it.
   */
  duration?: number
}

interface ToastItem {
  id: number
  variant: ToastVariant
  title: string
  description?: string
  duration: number
  leaving: boolean
}

export interface ToastApi {
  show: (variant: ToastVariant, options: ToastOptions) => number
  success: (title: string, description?: string, duration?: number) => number
  error: (title: string, description?: string, duration?: number) => number
  warning: (title: string, description?: string, duration?: number) => number
  info: (title: string, description?: string, duration?: number) => number
  dismiss: (id: number) => void
  dismissAll: () => void
}

const DEFAULT_DURATION = 4200
const EXIT_ANIMATION_MS = 180
const MAX_VISIBLE = 4

const ICONS = {
  success: Check,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const

const ToastContext = createContext<ToastApi | null>(null)

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: number) => void
}) {
  const [paused, setPaused] = useState(false)
  const remainingRef = useRef(item.duration)
  const startedAtRef = useRef(0)

  // Auto-dismiss timer that pauses on hover/focus so a toast never disappears
  // while the user is reading it.
  useEffect(() => {
    if (paused || item.leaving || item.duration <= 0) return

    startedAtRef.current = Date.now()
    const timer = window.setTimeout(
      () => onDismiss(item.id),
      Math.max(0, remainingRef.current)
    )

    return () => {
      window.clearTimeout(timer)
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current)
      )
    }
  }, [paused, item.id, item.duration, item.leaving, onDismiss])

  const Icon = ICONS[item.variant]
  const showProgress = item.duration > 0 && !item.leaving

  return (
    <div
      className={`gg-toast gg-toast--${item.variant}${
        item.leaving ? ' gg-toast--leaving' : ''
      }`}
      role={item.variant === 'error' ? 'alert' : 'status'}
      aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="gg-toast__icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2.4} />
      </span>

      <div className="gg-toast__body">
        <div className="gg-toast__title">{item.title}</div>
        {item.description ? (
          <div className="gg-toast__desc">{item.description}</div>
        ) : null}
      </div>

      <button
        type="button"
        className="gg-toast__close"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
      >
        <X size={14} strokeWidth={2.4} />
      </button>

      {showProgress ? (
        <span
          className="gg-toast__progress"
          style={{
            animationDuration: `${item.duration}ms`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      ) : null}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)
  const nextIdRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && !item.leaving ? { ...item, leaving: true } : item
      )
    )
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }, EXIT_ANIMATION_MS)
  }, [])

  const dismissAll = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, leaving: true })))
    window.setTimeout(() => setItems([]), EXIT_ANIMATION_MS)
  }, [])

  const show = useCallback((variant: ToastVariant, options: ToastOptions) => {
    const id = ++nextIdRef.current
    setItems((prev) =>
      [
        ...prev,
        {
          id,
          variant,
          title: options.title,
          description: options.description,
          duration: options.duration ?? DEFAULT_DURATION,
          leaving: false,
        },
      ].slice(-MAX_VISIBLE)
    )
    return id
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      dismissAll,
      success: (title, description, duration) =>
        show('success', { title, description, duration }),
      error: (title, description, duration) =>
        show('error', { title, description, duration }),
      warning: (title, description, duration) =>
        show('warning', { title, description, duration }),
      info: (title, description, duration) =>
        show('info', { title, description, duration }),
    }),
    [show, dismiss, dismissAll]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted
        ? createPortal(
            <div className="gg-toast-viewport" aria-label="Notifications">
              {items.map((item) => (
                <ToastCard key={item.id} item={item} onDismiss={dismiss} />
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>')
  }
  return ctx
}
