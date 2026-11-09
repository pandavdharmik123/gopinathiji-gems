#!/usr/bin/env node
/**
 * HTTP load / latency probe against a real API server on the isolated QA DB.
 *
 * Usage (from server/):
 *   node qa/load-test.mjs
 *
 * Spawns its own server on port 3912 (so it can run beside the API suite),
 * performs a warm-up, sequential latency probes, a concurrency burst and a
 * mixed workload, then prints percentile statistics.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '..')
const PORT = Number(process.env.QA_LOAD_PORT || 3912)
const BASE = `http://127.0.0.1:${PORT}`
const DB = 'postgresql://dbpandav@localhost:5432/gopinathji_gems_qa'

if (!DB.includes('gopinathji_gems_qa')) throw new Error('Refusing to run against non-QA database')

const child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/index.ts'], {
  cwd: serverRoot,
  env: {
    ...process.env,
    DATABASE_URL: DB,
    NODE_ENV: 'test',
    PORT: String(PORT),
    JWT_SECRET: 'qa-only-jwt-secret-key-do-not-use-in-prod',
    JWT_EXPIRES_IN: '2h',
    CORS_ORIGIN: 'http://localhost:8443,http://127.0.0.1:8443',
    BCRYPT_ROUNDS: '10',
    GOOGLE_DRIVE_BACKUP_ENABLED: 'false',
    SERVER_URL: BASE,
    RENDER_EXTERNAL_URL: BASE,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let logs = ''
child.stdout.on('data', d => { logs += String(d) })
child.stderr.on('data', d => { logs += String(d) })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitHealthy() {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early (${child.exitCode})\n${logs}`)
    try {
      const res = await fetch(`${BASE}/health`)
      if (res.ok) return
    } catch { /* not up */ }
    await sleep(400)
  }
  throw new Error(`server did not become healthy\n${logs}`)
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

function stats(samples, failures, wallMs) {
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    n: samples.length,
    failures,
    p50: +percentile(sorted, 50).toFixed(1),
    p90: +percentile(sorted, 90).toFixed(1),
    p95: +percentile(sorted, 95).toFixed(1),
    p99: +percentile(sorted, 99).toFixed(1),
    max: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
    rps: +(samples.length / (wallMs / 1000)).toFixed(1),
  }
}

async function timed(url, token) {
  const t0 = performance.now()
  let status = 0
  let bytes = 0
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    status = res.status
    bytes = (await res.arrayBuffer()).byteLength
  } catch {
    status = -1
  }
  return { ms: performance.now() - t0, status, bytes }
}

async function runSequential(route, token, n) {
  const samples = []
  let failures = 0
  let bytes = 0
  const t0 = performance.now()
  for (let i = 0; i < n; i++) {
    const r = await timed(`${BASE}${route}`, token)
    samples.push(r.ms); bytes += r.bytes
    if (r.status < 200 || r.status >= 400) failures++
  }
  return { ...stats(samples, failures, performance.now() - t0), avgBytes: Math.round(bytes / n), route }
}

async function runBurst(route, token, concurrency, rounds) {
  const samples = []
  let failures = 0
  const t0 = performance.now()
  for (let r = 0; r < rounds; r++) {
    const out = await Promise.all(Array.from({ length: concurrency }, () => timed(`${BASE}${route}`, token)))
    for (const x of out) { samples.push(x.ms); if (x.status < 200 || x.status >= 400) failures++ }
  }
  return { ...stats(samples, failures, performance.now() - t0), route, concurrency }
}

async function runMixed(routes, token, total, concurrency) {
  const samples = []
  let failures = 0
  let i = 0
  const t0 = performance.now()
  async function worker() {
    while (true) {
      const idx = i++
      if (idx >= total) return
      const route = routes[idx % routes.length]
      const r = await timed(`${BASE}${route}`, token)
      samples.push(r.ms)
      if (r.status < 200 || r.status >= 400) failures++
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return { ...stats(samples, failures, performance.now() - t0), routes }
}

async function main() {
  await waitHealthy()

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'qa_admin', password: 'Admin#12345' }),
  })
  const loginJson = await login.json()
  if (!loginJson.token) throw new Error(`login failed: ${JSON.stringify(loginJson)}`)
  const token = loginJson.token

  const endpoints = [
    '/api/transactions?limit=50',
    '/api/transactions?limit=50&page=2',
    '/api/parties',
    '/api/reports/summary',
    '/api/reports/yearly?year=2026',
    '/api/reports/outstanding',
  ]

  console.log(`Load probe target: ${BASE} (QA DB: gopinathji_gems_qa)`)
  console.log('Warm-up: 5 sequential requests per endpoint')
  for (const e of endpoints) for (let i = 0; i < 5; i++) await timed(`${BASE}${e}`, token)

  const results = []
  for (const e of endpoints) results.push(await runSequential(e, token, 20))
  console.log('\nSEQUENTIAL (20 requests each):')
  console.table(results)

  const burst = await runBurst('/api/transactions?limit=50', token, 20, 5)
  console.log('\nCONCURRENT BURST (20 users × 5 rounds):')
  console.table([burst])

  const mixed = await runMixed(endpoints, token, 100, 10)
  console.log('\nMIXED WORKLOAD (100 requests, concurrency 10):')
  console.table([mixed])

  // Oversized page requested by a client — demonstrates why the unbounded limit matters.
  const huge = await timed(`${BASE}/api/transactions?limit=100000`, token)
  console.log(`\nUNBOUNDED LIMIT PROBE: status=${huge.status} latency=${huge.ms.toFixed(1)}ms bytes=${huge.bytes}`)

  const totalFailures = [...results, burst, mixed].reduce((s, r) => s + r.failures, 0)
  console.log(`\nTOTAL PROBED REQUESTS: ${results.reduce((s, r) => s + r.n, 0) + burst.n + mixed.n}`)
  console.log(`TOTAL FAILURES: ${totalFailures}`)

  // Machine-readable summary for the report
  const summary = {
    base: BASE,
    database: 'gopinathji_gems_qa',
    sequential: results,
    burst,
    mixed,
    unboundedLimit: { status: huge.status, ms: +huge.ms.toFixed(1), bytes: huge.bytes },
    totalFailures,
  }
  console.log('\nJSON_SUMMARY=' + JSON.stringify(summary))

  if (totalFailures > 0) process.exitCode = 2
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => {
    child.kill('SIGTERM')
  })
