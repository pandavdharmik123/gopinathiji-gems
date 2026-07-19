import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { z } from 'zod'

const router = Router()
router.use(authenticate)

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ success: true, data: notifications })
  } catch (err) { next(err) }
})

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { read: true },
    })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ─── PATCH /api/notifications/mark-all-read ───────────────────────────────────
router.patch('/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, read: false },
      data: { read: true },
    })
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
