import { describe, expect, it } from 'vitest'
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '../../src/lib/dateFormat'

describe('formatDisplayDate', () => {
  it('converts ISO calendar dates to DD-MM-YYYY', () => {
    expect(formatDisplayDate('2026-11-10')).toBe('10-11-2026')
    expect(formatDisplayDate('2026-01-05')).toBe('05-01-2026')
  })

  it('converts ISO timestamps without shifting the day', () => {
    expect(formatDisplayDate('2026-11-10T23:59:00.000Z')).toBe('10-11-2026')
  })

  it('keeps day-first values and normalises separators', () => {
    expect(formatDisplayDate('10/11/2026')).toBe('10-11-2026')
    expect(formatDisplayDate('1/5/2026')).toBe('01-05-2026')
    expect(formatDisplayDate('10-11-2026, 11:15 am')).toBe('10-11-2026')
  })

  it('formats Date objects in local time', () => {
    expect(formatDisplayDate(new Date(2026, 10, 10))).toBe('10-11-2026')
  })

  it('returns an empty string for empty input and passes through junk', () => {
    expect(formatDisplayDate('')).toBe('')
    expect(formatDisplayDate(null)).toBe('')
    expect(formatDisplayDate(undefined)).toBe('')
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date')
  })
})

describe('formatDisplayDateTime', () => {
  it('formats a Date with DD-MM-YYYY and a 12-hour clock', () => {
    expect(formatDisplayDateTime(new Date(2026, 10, 10, 14, 5))).toBe(
      '10-11-2026, 02:05 pm'
    )
  })

  it('round-trips the strings produced by nowStr()', () => {
    expect(formatDisplayDateTime('10-11-2026, 11:15 am')).toBe(
      '10-11-2026, 11:15 am'
    )
    expect(formatDisplayDateTime('10-11-2026, 12:05 am')).toBe(
      '10-11-2026, 12:05 am'
    )
  })

  it('formats ISO timestamps', () => {
    const value = new Date(2026, 0, 5, 9, 7)
    expect(formatDisplayDateTime(value.toISOString())).toBe(
      '05-01-2026, 09:07 am'
    )
  })

  it('returns an empty string for empty input', () => {
    expect(formatDisplayDateTime('')).toBe('')
    expect(formatDisplayDateTime(null)).toBe('')
  })
})
