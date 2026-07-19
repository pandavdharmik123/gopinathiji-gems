import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createAuditLog } from '../services/audit'

const router = Router()
router.use(authenticate)

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
})

// ─── GET /api/expense-categories ──────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    })
    res.json({ success: true, data: categories })
  } catch (err) { next(err) }
})

// ─── POST /api/expense-categories ─────────────────────────────────────────────
router.post('/', requireAdmin, validateBody(categorySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body

    // Check if category already exists
    const existing = await prisma.expenseCategory.findUnique({
      where: { name },
    })
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists' })
    }

    const category = await prisma.expenseCategory.create({
      data: { name },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'ઉમેર્યો',
      entity: 'ExpenseCategory',
      details: `Expense category "${name}" added`,
      entityId: category.id,
    })

    res.status(211).json({ success: true, data: category })
  } catch (err) { next(err) }
})

// ─── DELETE /api/expense-categories/:id ──────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    const existing = await prisma.expenseCategory.findUnique({
      where: { id },
    })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found' })
    }

    await prisma.expenseCategory.delete({
      where: { id },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'નીકળ્યો',
      entity: 'ExpenseCategory',
      details: `Expense category "${existing.name}" deleted`,
      entityId: id,
    })

    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
