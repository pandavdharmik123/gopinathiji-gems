import { describe, it, expect, beforeEach } from 'vitest'
import {
  getToken,
  setToken,
  clearToken,
  getTokenPayload,
  getTokenExp,
  isTokenExpired,
  notifyAuthExpired,
} from '../../src/lib/api'

function b64url(obj: unknown) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fakeJwt(payload: Record<string, unknown>) {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`
}

beforeEach(() => {
  localStorage.clear()
})

describe('token storage', () => {
  it('stores, reads and clears the token', () => {
    expect(getToken()).toBeNull()
    setToken('abc.def.ghi')
    expect(getToken()).toBe('abc.def.ghi')
    clearToken()
    expect(getToken()).toBeNull()
  })
})

describe('JWT payload decoding', () => {
  it('decodes a well-formed payload', () => {
    const token = fakeJwt({ userId: 'u1', username: 'qa_admin', role: 'admin', exp: 9999999999 })
    expect(getTokenPayload(token)).toMatchObject({ userId: 'u1', username: 'qa_admin', role: 'admin' })
  })

  it('returns null for malformed / missing tokens', () => {
    expect(getTokenPayload(null)).toBeNull()
    expect(getTokenPayload('not-a-jwt')).toBeNull()
    expect(getTokenPayload('a.%%%.c')).toBeNull()
  })

  it('converts exp seconds to milliseconds', () => {
    const token = fakeJwt({ exp: 1_700_000_000 })
    expect(getTokenExp(token)).toBe(1_700_000_000_000)
  })

  it('treats missing exp as expired', () => {
    expect(isTokenExpired(fakeJwt({ sub: 'x' }))).toBe(true)
  })

  it('flags a past exp as expired and a future exp as valid', () => {
    expect(isTokenExpired(fakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 }))).toBe(true)
    expect(isTokenExpired(fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }))).toBe(false)
  })
})

describe('auth-expired notification', () => {
  it('clears the token and emits auth:expired', () => {
    setToken('x.y.z')
    let detail: any = null
    const handler = (e: Event) => { detail = (e as CustomEvent).detail }
    window.addEventListener('auth:expired', handler)
    notifyAuthExpired('session over')
    window.removeEventListener('auth:expired', handler)
    expect(getToken()).toBeNull()
    expect(detail?.message).toBe('session over')
  })
})
