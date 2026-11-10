import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ConfirmProvider, useConfirm } from '../../src/components/ConfirmDialog'

function Harness() {
  const confirm = useConfirm()
  const [result, setResult] = useState('pending')

  const askDelete = async () => {
    const ok = await confirm({
      title: 'Delete this transaction?',
      description: 'INC-013 · ₹500',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    })
    setResult(ok ? 'confirmed' : 'cancelled')
  }

  return (
    <div>
      <button onClick={() => void askDelete()}>ask</button>
      <span data-testid="result">{result}</span>
    </div>
  )
}

function renderHarness() {
  return render(
    <ConfirmProvider>
      <Harness />
    </ConfirmProvider>
  )
}

describe('ConfirmDialog', () => {
  it('opens an in-app modal and resolves true on confirm', async () => {
    const u = userEvent.setup()
    renderHarness()

    await u.click(screen.getByRole('button', { name: 'ask' }))

    expect(await screen.findByText('Delete this transaction?')).toBeInTheDocument()
    expect(screen.getByText('INC-013 · ₹500')).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('confirmed'))
  })

  it('resolves false when the user cancels', async () => {
    const u = userEvent.setup()
    renderHarness()

    await u.click(screen.getByRole('button', { name: 'ask' }))
    await u.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('cancelled'))
  })

  it('never falls back to a native window dialog', async () => {
    const u = userEvent.setup()
    renderHarness()

    // If the provider used window.confirm, the click would block/return false
    // in jsdom. Assert the modal itself is rendered instead.
    await u.click(screen.getByRole('button', { name: 'ask' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
