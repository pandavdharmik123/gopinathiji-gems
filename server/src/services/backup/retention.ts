import { backupConfig } from './config'

export interface DriveFile {
  id: string
  name: string
  size: string
  createdTime: string
}

export interface RetentionResult {
  keep: string[]
  prune: string[]
}

/**
 * Apply retention policy to a list of backup files sorted newest-first.
 *
 * Rules:
 *  - Daily:   keep the most recent DB_BACKUP_KEEP_DAILY files
 *  - Weekly:  among remaining, keep one per ISO calendar week (most recent) up to DB_BACKUP_KEEP_WEEKLY
 *  - Monthly: among remaining, keep one per calendar month up to DB_BACKUP_KEEP_MONTHLY
 *  - Everything else: prune
 */
export function applyRetention(
  files: DriveFile[],
  config: {
    DB_BACKUP_KEEP_DAILY: number
    DB_BACKUP_KEEP_WEEKLY: number
    DB_BACKUP_KEEP_MONTHLY: number
  } = backupConfig
): RetentionResult {
  const keepIds = new Set<string>()

  // Sort newest-first (defensive)
  const sorted = [...files].sort(
    (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
  )

  // --- Daily: keep first N ---
  const dailyCount = config.DB_BACKUP_KEEP_DAILY
  const afterDaily = sorted.slice(dailyCount)
  sorted.slice(0, dailyCount).forEach((f) => keepIds.add(f.id))

  // --- Weekly: one per ISO week, up to N weeks ---
  const weekMap = new Map<string, DriveFile>() // key: "YYYY-Www"
  for (const f of afterDaily) {
    if (weekMap.size >= config.DB_BACKUP_KEEP_WEEKLY) break
    const d = new Date(f.createdTime)
    const weekKey = getISOWeekKey(d)
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, f)
      keepIds.add(f.id)
    }
  }

  const afterWeekly = afterDaily.filter((f) => !keepIds.has(f.id))

  // --- Monthly: one per calendar month, up to N months ---
  const monthMap = new Map<string, DriveFile>() // key: "YYYY-MM"
  for (const f of afterWeekly) {
    if (monthMap.size >= config.DB_BACKUP_KEEP_MONTHLY) break
    const d = new Date(f.createdTime)
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, f)
      keepIds.add(f.id)
    }
  }

  const keep = sorted.filter((f) => keepIds.has(f.id)).map((f) => f.id)
  const prune = sorted.filter((f) => !keepIds.has(f.id)).map((f) => f.id)

  return { keep, prune }
}

/** Returns ISO week key like "2024-W03" */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

