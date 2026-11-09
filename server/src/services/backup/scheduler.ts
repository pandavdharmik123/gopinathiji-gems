import cron, { ScheduledTask } from 'node-cron'
import { backupConfig, isBackupConfigured } from './config'
import { runBackup } from './runner'

interface SchedulerStatus {
  enabled: boolean
  nextRun: string | null
  cronExpression: string
  timezone: string
}

let scheduledTask: ScheduledTask | null = null
let nextRunTime: string | null = null

export function initBackupScheduler(): void {
  if (backupConfig.GOOGLE_DRIVE_BACKUP_ENABLED !== 'true') {
    console.log('ℹ️  BackupScheduler: Google Drive backup is disabled (GOOGLE_DRIVE_BACKUP_ENABLED != "true")')
    return
  }

  if (!isBackupConfigured()) {
    console.warn('⚠️  BackupScheduler: Google Drive credentials not fully configured — scheduler not started')
    return
  }

  const { DB_BACKUP_SCHEDULE: schedule, DB_BACKUP_TIMEZONE: timezone } = backupConfig

  if (!cron.validate(schedule)) {
    console.error(`❌ BackupScheduler: Invalid cron expression "${schedule}" — scheduler not started`)
    return
  }

  scheduledTask = cron.schedule(
    schedule,
    async () => {
      console.log(`⏰ BackupScheduler: Scheduled backup triggered at ${new Date().toISOString()}`)
      try {
        const run = await runBackup('SCHEDULED')
        console.log(`✅ BackupScheduler: Scheduled backup finished. RunId: ${run.id}`)
      } catch (err) {
        console.error('❌ BackupScheduler: Scheduled backup failed:', err)
      }
    },
    {
      timezone,
    }
  )

  // Approximate next run time by looking at the next scheduled firing
  nextRunTime = computeNextRun(schedule, timezone)

  console.log(`✅ BackupScheduler: Started. Schedule="${schedule}" Timezone="${timezone}" NextRun≈${nextRunTime}`)
}

export function getSchedulerStatus(): SchedulerStatus {
  return {
    enabled: scheduledTask !== null,
    nextRun: nextRunTime,
    cronExpression: backupConfig.DB_BACKUP_SCHEDULE,
    timezone: backupConfig.DB_BACKUP_TIMEZONE,
  }
}

/** Best-effort: compute an approximate next-run ISO string */
function computeNextRun(expression: string, timezone: string): string | null {
  try {
    // node-cron doesn't expose nextDate() directly, so we give an approximation
    // by formatting the cron expression description
    return `cron(${expression}) in tz ${timezone}`
  } catch {
    return null
  }
}
