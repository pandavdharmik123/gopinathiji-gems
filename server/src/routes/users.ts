import { Router, Request, Response, NextFunction } from 'express'
import * as bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { authenticate, requireAdmin } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createAuditLog } from '../services/audit'
import { createError } from '../middleware/errorHandler'

const router = Router()
router.use(authenticate, requireAdmin)

// ─── Schemas ──────────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'employee']).default('employee'),
  password: z.string().min(6).default('admin123'),
})

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

// ─── GET /api/users ───────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, username: true, role: true, email: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ success: true, data: users })
  } catch (err) { next(err) }
})

// ─── POST /api/users ──────────────────────────────────────────────────────────
router.post('/', validateBody(createUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, ...rest } = req.body as z.infer<typeof createUserSchema>
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS)

    const user = await prisma.user.create({
      data: { ...rest, passwordHash },
      select: { id: true, name: true, username: true, role: true, email: true, status: true, createdAt: true },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'ઉમેર્યો',
      entity: 'વ્યક્તિ',
      details: `${user.name} — ${user.role}`,
      entityId: user.id,
    })

    res.status(201).json({ success: true, data: user })
  } catch (err) { next(err) }
})

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
router.put('/:id', validateBody(updateUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const user = await prisma.user.update({
      where: { id },
      data: req.body,
      select: { id: true, name: true, username: true, role: true, email: true, status: true, createdAt: true },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'સુધાર્યો',
      entity: 'વ્યક્તિ',
      details: `${user.name} — ${user.role} / ${user.status}`,
      entityId: id,
    })

    res.json({ success: true, data: user })
  } catch (err) { next(err) }
})

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    if (id === req.user!.userId) throw createError('Cannot delete your own account', 400)

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw createError('User not found', 404)

    await prisma.user.delete({ where: { id } })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'કાઢ્યો',
      entity: 'વ્યક્તિ',
      details: `${user.name}`,
      entityId: id,
    })

    res.json({ success: true, message: 'User deleted' })
  } catch (err) { next(err) }
})

export default router
