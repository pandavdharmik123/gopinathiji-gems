import { Router, Request, Response, NextFunction } from 'express'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { authenticate } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createError } from '../middleware/errorHandler'

const router = Router()

// ─── Schemas ──────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body as z.infer<typeof loginSchema>

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || user.status === 'inactive') {
      throw createError('Invalid username or password', 401)
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      throw createError('Invalid username or password', 401)
    }

    const payload = { userId: user.id, username: user.username, role: user.role }
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, username: true, role: true, email: true, status: true, createdAt: true },
    })
    if (!user) throw createError('User not found', 404)
    res.json({ success: true, user })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', authenticate, validateBody(changePasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw createError('User not found', 404)

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw createError('Current password is incorrect', 400)

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    res.json({ success: true, message: 'Password changed successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
