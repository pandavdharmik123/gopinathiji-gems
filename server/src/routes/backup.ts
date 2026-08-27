import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth'
import {
  exportDataToExcel,
  restoreDataFromExcel,
  previewExcelBackup,
  getAllBackupData
} from '../services/excelService'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB limit
})

// ─── POST /api/backup/export-excel ────────────────────────────────────────────
// Export all database tables into password-protected Excel file
router.post('/export-excel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body
    const excelBuffer = await exportDataToExcel(password)

    const dateStr = new Date().toISOString().split('T')[0]
    const fileName = `gopinathji-gems-backup-${dateStr}.xlsx`

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
router.post('/preview-excel', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Please upload an Excel (.xlsx) file' })
      return
    }

    const password = req.body.password || undefined
    const summary = await previewExcelBackup(req.file.buffer, password)

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
router.post('/import-excel', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Please upload an Excel (.xlsx) file' })
      return
    }

    const password = req.body.password || undefined
    const userName = req.user?.username || 'Admin'

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
router.get('/json', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getAllBackupData()
    res.json({
      success: true,
      data
    })
  } catch (err) {
    next(err)
  }
})

export default router
