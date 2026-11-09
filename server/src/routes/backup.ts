import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { authenticate, requireAdmin } from '../middleware/auth'
import {
  exportDataToExcel,
  restoreDataFromExcel,
  previewExcelBackup,
  getAllBackupData
} from '../services/excelService'
import { getSchedulerStatus } from '../services/backup/scheduler'
import { backupConfig, isBackupConfigured } from '../services/backup/config'
import { runBackup } from '../services/backup/runner'
import { initDriveClient, ensureBackupFolder, listBackupFiles } from '../services/backup/drive'
import { google } from 'googleapis'
import { prisma } from '../lib/prisma'
import { createAuditLog } from '../services/audit'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
})

// ─── POST /api/backup/export-excel ────────────────────────────────────────────
// Export all database tables into password-protected Excel file
router.post('/export-excel', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body
    // Credentials are only included in an encrypted (password-protected) backup.
    const excelBuffer = await exportDataToExcel(password, Boolean(password))

    const dateStr = new Date().toISOString().split('T')[0]
    const fileName = `gopinathji-gems-backup-${dateStr}.xlsx`

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'EXPORT_BACKUP',
      entity: 'System Backup',
      details: `Excel backup exported (${excelBuffer.length} bytes${password ? ', encrypted, credentials included' : ''})`,
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', excelBuffer.length)
    res.send(excelBuffer)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/backup/preview-excel ───────────────────────────────────────────
// Preview stats / summary of an uploaded Excel backup file before restore
router.post('/preview-excel', authenticate, requireAdmin, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Please upload an Excel (.xlsx) file' })
      return
    }

    const password = req.body.password || undefined
    const summary = await previewExcelBackup(req.file.buffer, password)

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'PREVIEW_BACKUP',
      entity: 'System Backup',
      details: 'Excel backup previewed before restore',
    })

    res.json({
      success: true,
      data: summary
    })
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err?.message || 'Failed to read Excel file'
    })
  }
})

// ─── POST /api/backup/import-excel ────────────────────────────────────────────
// Restore all database tables from uploaded password-protected Excel file
router.post('/import-excel', authenticate, requireAdmin, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Please upload an Excel (.xlsx) file' })
      return
    }

    const password = req.body.password || undefined
    const userName = req.user?.username || 'Admin'

    // A restore replaces every table, so require an explicit confirmation
    // flag in addition to the admin role. The UI asks the user to preview and
    // then confirm before sending this.
    if (req.body.confirm !== 'RESTORE') {
      res.status(400).json({
        success: false,
        message: 'Restore confirmation required. Re-send with confirm="RESTORE" after previewing the backup.',
      })
      return
    }

    const restoredData = await restoreDataFromExcel(req.file.buffer, password, userName)

    res.json({
      success: true,
      message: 'Database restored successfully from Excel backup',
      data: restoredData
    })
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err?.message || 'Failed to restore database from Excel file'
    })
  }
})

// ─── GET /api/backup/json ─────────────────────────────────────────────────────
// Quick JSON backup export for legacy support
router.get('/json', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // JSON exports never include credential material.
    const data = await getAllBackupData(false)

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'EXPORT_BACKUP',
      entity: 'System Backup',
      details: 'JSON backup exported (credentials excluded)',
    })

    res.json({
      success: true,
      data
    })
  } catch (err) {
    next(err)
  }
})

// ─── Google Drive Backup Routes ───────────────────────────────────────────────

// GET /api/backup/drive-status
router.get('/drive-status', authenticate, requireAdmin, (_req: Request, res: Response) => {
  const status = getSchedulerStatus()
  res.json({
    success: true,
    data: {
      enabled: backupConfig.GOOGLE_DRIVE_BACKUP_ENABLED === 'true',
      configured: isBackupConfigured(),
      nextRun: status.nextRun,
      cronExpression: status.cronExpression,
      timezone: status.timezone,
      accountEmail: backupConfig.GOOGLE_DRIVE_ACCOUNT_EMAIL || null,
      folderId: backupConfig.GOOGLE_DRIVE_BACKUP_FOLDER_ID || null,
    }
  })
})

// GET /api/backup/drive-history
router.get('/drive-history', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10)
    const limit = parseInt((req.query.limit as string) || '20', 10)
    const skip = (page - 1) * limit

    const [total, runs] = await Promise.all([
      prisma.backupRun.count(),
      prisma.backupRun.findMany({
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    res.json({
      success: true,
      data: {
        // Prisma returns BigInt for fileSizeBytes; JSON cannot serialise BigInt.
        runs: runs.map(run => ({
          ...run,
          fileSizeBytes: run.fileSizeBytes != null ? Number(run.fileSizeBytes) : null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      }
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/backup/drive-trigger
router.post('/drive-trigger', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dryRun = false } = req.body as { dryRun?: boolean }

    // Create a placeholder DB record first to get a runId to return
    const pendingRun = await prisma.backupRun.create({
      data: {
        status: 'RUNNING',
        trigger: 'MANUAL',
      },
    })

    // Fire and forget — do NOT await
    runBackup('MANUAL', { dryRun }).catch((err) => {
      console.error('Manual backup trigger failed:', err)
    })

    res.status(202).json({
      success: true,
      message: 'Backup started',
      runId: pendingRun.id,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/backup/drive-files
router.get('/drive-files', authenticate, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isBackupConfigured()) {
      res.status(503).json({ success: false, message: 'Google Drive backup is not configured' })
      return
    }

    const auth = initDriveClient()
    const drive = google.drive({ version: 'v3', auth })
    const folderId = await ensureBackupFolder(drive, auth)
    const files = await listBackupFiles(drive, folderId)

    res.json({
      success: true,
      data: { files, folderId }
    })
  } catch (err) {
    next(err)
  }
})

export default router
