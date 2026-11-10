import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from '../../src/components/Login'
import { ToastProvider } from '../../src/components/Toast'

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }))

vi.mock('../../src/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/api')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      login: loginMock,
    },
  }
})

vi.mock('../../src/store/AppContext', () => ({
  useApp: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

beforeEach(() => {
  loginMock.mockReset()
})

describe('Login screen', () => {
  it('renders username, password and submit controls', () => {
    render(<ToastProvider><Login onLogin={vi.fn()} /></ToastProvider>)
    expect(screen.getByPlaceholderText('login.username_placeholder')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('login.password_placeholder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login\.button/i })).toBeInTheDocument()
  })

  it('submits credentials and calls onLogin with the returned user', async () => {
    const user = { id: 'u1', name: 'QA Admin', username: 'qa_admin', role: 'admin', email: 'qa@example.test', status: 'active', createdAt: '2026-01-01' }
    loginMock.mockResolvedValue({ require2FA: false, user })
    const onLogin = vi.fn()
    const u = userEvent.setup()

    render(<ToastProvider><Login onLogin={onLogin} /></ToastProvider>)
    await u.type(screen.getByPlaceholderText('login.username_placeholder'), 'qa_admin')
    await u.type(screen.getByPlaceholderText('login.password_placeholder'), 'Admin#12345')
    await u.click(screen.getByRole('button', { name: /login\.button/i }))

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('qa_admin', 'Admin#12345'))
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(user))
  })

  it('shows the API error message when credentials fail', async () => {
    const { ApiError } = await import('../../src/lib/api')
    loginMock.mockRejectedValue(new ApiError('Invalid username or password', 401))
    const u = userEvent.setup()

    render(<ToastProvider><Login onLogin={vi.fn()} /></ToastProvider>)
    await u.type(screen.getByPlaceholderText('login.username_placeholder'), 'qa_admin')
    await u.type(screen.getByPlaceholderText('login.password_placeholder'), 'wrong')
    await u.click(screen.getByRole('button', { name: /login\.button/i }))

    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument()
  })

  it('validates required fields without calling the API', async () => {
    const u = userEvent.setup()
    render(<ToastProvider><Login onLogin={vi.fn()} /></ToastProvider>)
    await u.click(screen.getByRole('button', { name: /login\.button/i }))
    expect(loginMock).not.toHaveBeenCalled()
  })
})
