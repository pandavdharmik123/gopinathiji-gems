import { describe, it, expect, beforeEach } from 'vitest'
import { translate, getLanguage, setLanguage } from '../../src/lib/i18n'

beforeEach(() => {
  localStorage.clear()
})

describe('i18n', () => {
  it('returns English strings', () => {
    expect(translate('login.button', 'en')).toBe('Login')
    expect(translate('login.username_placeholder', 'en')).toBe('Enter your username')
  })

  it('returns Gujarati strings', () => {
    expect(translate('login.button', 'gu')).toBe('લૉગઇન')
  })

  it('falls back to the key for unknown translations', () => {
    expect(translate('missing.key', 'en')).toBe('missing.key')
  })

  it('persists the selected language', () => {
    expect(getLanguage()).toBe('en')
    setLanguage('gu')
    expect(getLanguage()).toBe('gu')
    expect(localStorage.getItem('app_language')).toBe('gu')
  })
})
