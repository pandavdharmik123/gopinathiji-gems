import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createAuditLog } from '../services/audit'

const router = Router()
router.use(authenticate)

const settingsSchema = z.object({
  name: z.string().optional(),
  gst: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  currency: z.string().optional(),
  dateFormat: z.string().optional(),
  language: z.string().optional(),
  lastBackup: z.string().optional(),
  expenseCategories: z.string().optional(),
})

// ─── GET /api/settings ────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    })
    res.json({ success: true, data: settings })
  } catch (err) { next(err) }
})

// ─── PUT /api/settings ────────────────────────────────────────────────────────
router.put('/', requireAdmin, validateBody(settingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.companySettings.upsert({
      where: { id: 'singleton' },
      update: req.body,
      create: { id: 'singleton', ...req.body },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'સુધાર્યો',
      entity: 'Settings',
      details: 'Company settings updated',
    })

    res.json({ success: true, data: settings })
  } catch (err) { next(err) }
})

export default router
