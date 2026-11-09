import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_DIR = path.join(ROOT, 'server')

const BACKEND_PORT = Number(process.env.QA_BACKEND_PORT || 3911)
const FRONTEND_PORT = Number(process.env.QA_FRONTEND_PORT || 9443)
const QA_DB =
  process.env.QA_DATABASE_URL || 'postgresql://dbpandav@localhost:5432/gopinathji_gems_qa'

if (!QA_DB.includes('gopinathji_gems_qa')) throw new Error('QA database guard failed')

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'e2e-results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /responsive\.spec\.ts/ },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: [
    {
      command:
        `cd "${SERVER_DIR}" && env DATABASE_URL='${QA_DB}' NODE_ENV=test PORT=${BACKEND_PORT} ` +
        `JWT_SECRET='qa-only-jwt-secret-key-do-not-use-in-prod' JWT_EXPIRES_IN='2h' ` +
        `CORS_ORIGIN='http://127.0.0.1:${FRONTEND_PORT}' BCRYPT_ROUNDS=10 ` +
        `GOOGLE_DRIVE_BACKUP_ENABLED=false SERVER_URL='http://127.0.0.1:${BACKEND_PORT}' ` +
        `RENDER_EXTERNAL_URL='http://127.0.0.1:${BACKEND_PORT}' ` +
        `node -r ts-node/register/transpile-only src/index.ts`,
      url: `http://127.0.0.1:${BACKEND_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        `cd "${ROOT}" && env VITE_API_LINK='http://127.0.0.1:${BACKEND_PORT}/api' PORT=${FRONTEND_PORT} ` +
        `npx vite --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
