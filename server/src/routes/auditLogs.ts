import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin } from '../middleware/auth'

const router = Router()
router.use(authenticate, requireAdmin)

// ─── GET /api/audit-logs ──────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity, user: userName, search, page = '1', limit = '50' } = req.query as Record<string, string>
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    const where: any = {
      ...(entity && { entity }),
      ...(userName && { userName: { contains: userName, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { details: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ])

    res.json({
      success: true,
      data: logs,
      meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    })
  } catch (err) { next(err) }
})

export default router
