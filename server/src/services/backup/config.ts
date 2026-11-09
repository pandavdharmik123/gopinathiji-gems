import { z } from 'zod'

const backupEnvSchema = z.object({
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

const parsed = backupEnvSchema.safeParse(
  // GitHub Actions and some hosts expose unset secrets as empty strings.
  // Treat "" as "not set" so defaults and optional fields still work.
  Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== '')
  )
)

if (!parsed.success) {
  console.error('⚠️  Backup config validation errors:', parsed.error.flatten().fieldErrors)
}

export const backupConfig = parsed.success ? parsed.data : backupEnvSchema.parse({})

/**
 * Returns true if the minimum Google Drive credentials are configured.
 */
export function isBackupConfigured(): boolean {
  return !!(
    backupConfig.GOOGLE_DRIVE_CLIENT_ID &&
    backupConfig.GOOGLE_DRIVE_CLIENT_SECRET &&
    backupConfig.GOOGLE_DRIVE_REFRESH_TOKEN
  )
}

