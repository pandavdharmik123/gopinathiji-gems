import * as dotenv from 'dotenv'
import * as path from 'path'
import { z } from 'zod'

// Load .env from server/ directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('2h'),
  CORS_ORIGIN: z.string().default('http://localhost:8443'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_SECURE: z.preprocess(v => v === 'true' || v === true, z.boolean().default(false)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional().default('Gopinathji Gems <no-reply@gopinathjigems.com>'),
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().optional(),

  // ─── Keep-Alive ────────────────────────────────────────────────────────────
  // Off by default: a self-ping keeps the Render instance awake 24/7 and
  // consumes the free instance-hour allowance.
  KEEP_ALIVE_ENABLED: z.preprocess(
    v => v === 'true' || v === true,
    z.boolean().default(false)
  ),
  SERVER_URL: z.string().url().optional(),
  RENDER_EXTERNAL_URL: z.string().url().optional(),

  // ─── Google Drive Backup ───────────────────────────────────────────────────
  GOOGLE_DRIVE_BACKUP_ENABLED: z.string().optional().default('false'),
  PROJECT_NAME: z.string().optional().default('gopinathji-gems'),
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REDIRECT_URI: z.string().optional().default('http://localhost:5555/oauth2callback'),
  GOOGLE_DRIVE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_BACKUP_FOLDER_ID: z.string().optional(),
  DB_BACKUP_SCHEDULE: z.string().optional().default('0 2 * * *'),
  DB_BACKUP_TIMEZONE: z.string().optional().default('Asia/Kolkata'),
  DB_BACKUP_KEEP_DAILY: z.coerce.number().optional().default(30),
  DB_BACKUP_KEEP_WEEKLY: z.coerce.number().optional().default(12),
  DB_BACKUP_KEEP_MONTHLY: z.coerce.number().optional().default(12),
  DB_BACKUP_ENCRYPTION_KEY: z.string().min(32).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof parsed.data
