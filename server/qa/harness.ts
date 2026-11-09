import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'

export const QA_PORT = Number(process.env.QA_PORT || 3911)
export const BASE = `http://127.0.0.1:${QA_PORT}`
export const QA_DB_URL =
  process.env.QA_DATABASE_URL || 'postgresql://dbpandav@localhost:5432/gopinathji_gems_qa'

if (!QA_DB_URL.includes('gopinathji_gems_qa')) {
  throw new Error('Refusing to run: QA_DATABASE_URL must point at the isolated QA database')
}

const serverRoot = path.resolve(__dirname, '..')
let child: ChildProcess | null = null
let logs = ''

export function getServerLogs() {
  return logs
}

export async function startServer(): Promise<void> {
  if (child) return
  logs = ''
  child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: serverRoot,
    env: {
      ...process.env,
      DATABASE_URL: QA_DB_URL,
      NODE_ENV: 'test',
      PORT: String(QA_PORT),
      JWT_SECRET: 'qa-only-jwt-secret-key-do-not-use-in-prod',
      JWT_EXPIRES_IN: '2h',
      CORS_ORIGIN: 'http://localhost:8443,http://127.0.0.1:8443',
      BCRYPT_ROUNDS: '10',
      GOOGLE_DRIVE_BACKUP_ENABLED: 'false',
      SERVER_URL: `http://127.0.0.1:${QA_PORT}`,
      RENDER_EXTERNAL_URL: `http://127.0.0.1:${QA_PORT}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout?.on('data', d => { logs += String(d) })
  child.stderr?.on('data', d => { logs += String(d) })

  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early (${child.exitCode}). Logs:\n${logs}`)
    }
    try {
      const res = await fetch(`${BASE}/health`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 400))
  }
  throw new Error(`Server did not become healthy in time. Logs:\n${logs}`)
}

export async function stopServer(): Promise<void> {
  if (!child) return
  const p = child
  child = null
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => resolve(), 5000)
    p.once('exit', () => { clearTimeout(timer); resolve() })
    p.kill('SIGTERM')
  })
}

export type ApiResponse = {
  status: number
  ok: boolean
  json: any
  text: string
  headers: Headers
}

export async function req(
  method: string,
  route: string,
  opts: { token?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> } = {}
): Promise<ApiResponse> {
  const headers: Record<string, string> = { ...(opts.headers || {}) }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let body: BodyInit | undefined
  if (opts.rawBody !== undefined) {
    body = opts.rawBody
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body)
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${BASE}${route}`, { method, headers, body })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers }
}

export async function login(username: string, password: string) {
  const res = await req('POST', '/api/auth/login', { body: { username, password } })
  return res
}
