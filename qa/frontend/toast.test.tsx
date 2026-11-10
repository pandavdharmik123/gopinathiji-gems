import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider, useToast } from '../../src/components/Toast'

function Harness() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Backup saved', 'INC-013 created')}>
        fire-success
      </button>
      <button onClick={() => toast.error('Import failed', 'Wrong password')}>
        fire-error
      </button>
      <button
        onClick={() => toast.info('Excel file verified', undefined, 0)}
      >
        fire-info
      </button>
    </div>
  )
}

function renderHarness() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>
  )
}

describe('Toast', () => {
  it('renders a success toast with title and description', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('fire-success'))

    expect(await screen.findByText('Backup saved')).toBeInTheDocument()
    expect(screen.getByText('INC-013 created')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Backup saved')
  })

  it('uses an assertive alert for errors', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('fire-error'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(alert).toHaveTextContent('Import failed')
  })

  it('dismisses when the close button is clicked', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('fire-success'))

    await screen.findByText('Backup saved')
    fireEvent.click(screen.getByLabelText('Dismiss notification'))

    await waitFor(() =>
      expect(screen.queryByText('Backup saved')).not.toBeInTheDocument()
    )
  })

  it('keeps persistent toasts (duration 0) on screen', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('fire-info'))

    expect(await screen.findByText('Excel file verified')).toBeInTheDocument()
    expect(document.querySelector('.gg-toast__progress')).toBeNull()
  })

  it('renders no undo action', async () => {
    renderHarness()
    fireEvent.click(screen.getByText('fire-success'))
    await screen.findByText('Backup saved')

    expect(screen.queryByText(/undo/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })
})
