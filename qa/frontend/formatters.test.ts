import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, todayStr, nowStr, PAYMENT_MODES } from '../../src/data/mockData'

describe('currency formatting', () => {
  it('formats INR in Indian digit grouping without decimals', () => {
    expect(formatCurrency(0)).toBe('₹0')
    expect(formatCurrency(1000)).toBe('₹1,000')
    expect(formatCurrency(100000)).toBe('₹1,00,000')
    expect(formatCurrency(1234567)).toBe('₹12,34,567')
  })

  it('rounds sub-rupee values (documented display rule)', () => {
    expect(formatCurrency(1234.49)).toBe('₹1,234')
    expect(formatCurrency(1234.5)).toBe('₹1,235')
  })

  it('formats negative amounts (expenses / debit balances)', () => {
    expect(formatCurrency(-500)).toBe('-₹500')
  })
})

describe('date helpers', () => {
  it('formats an ISO date as a Gujarati-locale date', () => {
    // Date-only strings are parsed as UTC midnight; the display locale is gu-IN.
    expect(formatDate('2026-04-15')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('todayStr produces a sortable YYYY-MM-DD value', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('nowStr produces a non-empty human timestamp', () => {
    expect(nowStr().length).toBeGreaterThan(10)
  })
})

describe('payment-mode options exposed by the UI', () => {
  it('offers every payment mode supported by the backend', () => {
    // Backend enum (schema.prisma): cash, bank, upi, cheque.
    const values = PAYMENT_MODES.map(m => m.value)
    expect(values).toEqual(expect.arrayContaining(['cash', 'bank', 'upi', 'cheque']))
  })
})
