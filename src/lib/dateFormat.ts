/**
 * Display-only date formatting.
 *
 * The app stores and transports dates as ISO (`YYYY-MM-DD`) because the API,
 * DatePicker and Excel import all depend on that. Everything the user *sees*
 * goes through these helpers and renders as `DD-MM-YYYY`.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Format a date as `DD-MM-YYYY`.
 *
 * Accepts ISO dates (`2026-11-10`), ISO timestamps, `Date` objects, and values
 * that are already `DD-MM-YYYY` / `DD/MM/YYYY`. Returns `''` for empty input
 * and the original string when it cannot be parsed.
 */
export function formatDisplayDate(value?: string | Date | null): string {
  if (value === null || value === undefined) return ''

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()}`
  }

  const str = String(value).trim()
  if (!str) return ''

  // ISO calendar date, optionally with a time component.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(str)
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`

  // Already day-first: 10-11-2026, 10/11/2026 or with a trailing time.
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s].*)?$/.exec(str)
  if (dayFirst) {
    return `${pad(Number(dayFirst[1]))}-${pad(Number(dayFirst[2]))}-${dayFirst[3]}`
  }

  const parsed = new Date(str)
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()}`
  }

  return str
}

/** Format a timestamp as `DD-MM-YYYY, hh:mm am/pm`. */
export function formatDisplayDateTime(value?: string | Date | null): string {
  if (value === null || value === undefined || value === '') return ''

  let date: Date | null = null

  if (value instanceof Date) {
    date = value
  } else {
    const str = String(value).trim()

    // Timestamps produced by `nowStr()`: "10-11-2026, 11:15 am".
    const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i.exec(str)
    if (dayFirst) {
      const datePart = `${pad(Number(dayFirst[1]))}-${pad(Number(dayFirst[2]))}-${dayFirst[3]}`
      if (dayFirst[4] === undefined) return datePart

      let hours = Number(dayFirst[4])
      const suffix = (dayFirst[7] || '').toLowerCase() || (hours >= 12 ? 'pm' : 'am')
      if (suffix === 'pm' && hours < 12) hours += 12
      if (suffix === 'am' && hours === 12) hours = 0
      const displayHours = hours % 12 === 0 ? 12 : hours % 12
      return `${datePart}, ${pad(displayHours)}:${dayFirst[5]} ${suffix}`
    }

    const parsed = new Date(str)
    if (!Number.isNaN(parsed.getTime())) date = parsed
  }

  if (!date || Number.isNaN(date.getTime())) return String(value)

  let hours = date.getHours()
  const suffix = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12 === 0 ? 12 : hours % 12

  return `${formatDisplayDate(date)}, ${pad(hours)}:${pad(date.getMinutes())} ${suffix}`
}

/** Weekday name for the current language, e.g. "Tuesday". */
export function formatWeekday(value: Date | string, locale: string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(locale, { weekday: 'long' })
}
