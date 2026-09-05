import { Router, Request, Response, NextFunction } from 'express'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { z } from 'zod'
import { generateSecret, verify as verifyTotp, generateURI } from 'otplib'
import * as QRCode from 'qrcode'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { authenticate } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createAuditLog } from '../services/audit'
import { createError } from '../middleware/errorHandler'

const router = Router()

// ─── Schemas ──────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const login2FASchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().min(6).max(6),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
})

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
})

const changePinSchema = z.object({
  currentPin: z.string().optional(),
  password: z.string().optional(),
  newPin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
}).refine(data => data.currentPin || data.password, {
  message: 'Either current PIN or password is required',
})

const resetPinSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  newPin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
})

const verify2FASetupSchema = z.object({
  secret: z.string().min(1, 'Secret is required'),
  code: z.string().min(6).max(6, 'Code must be 6 digits'),
})

const disable2FASchema = z.object({
  password: z.string().optional(),
  code: z.string().optional(),
}).refine(data => data.password || data.code, {
  message: 'Password or 2FA code is required to disable 2FA',
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

    // If Two-Factor Authentication is enabled, return 2FA pending response with short-lived temp token
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempPayload = { userId: user.id, is2faPending: true }
      const tempToken = jwt.sign(tempPayload, env.JWT_SECRET, { expiresIn: '5m' })
      return res.json({
        success: true,
        require2FA: true,
        tempToken,
        user: {
          username: user.username,
          name: user.name,
        },
      })
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
        hasPin: !!user.pinHash,
        twoFactorEnabled: !!user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/login/2fa ─────────────────────────────────────────────────
router.post('/login/2fa', validateBody(login2FASchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tempToken, code } = req.body as z.infer<typeof login2FASchema>
    let payload: any
    try {
      payload = jwt.verify(tempToken, env.JWT_SECRET)
    } catch {
      throw createError('2FA verification session expired. Please login again.', 401)
    }

    if (!payload || !payload.userId || !payload.is2faPending) {
      throw createError('Invalid 2FA session token', 401)
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || user.status === 'inactive' || !user.twoFactorSecret || !user.twoFactorEnabled) {
      throw createError('Invalid 2FA request', 401)
    }

    const checkResult = await verifyTotp({ secret: user.twoFactorSecret, token: code })
    if (!checkResult.valid) {
      throw createError('Invalid 6-digit authenticator code. Please try again.', 400)
    }

    const authPayload = { userId: user.id, username: user.username, role: user.role }
    const token = jwt.sign(authPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })

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
        hasPin: !!user.pinHash,
        twoFactorEnabled: true,
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
      select: { id: true, name: true, username: true, role: true, email: true, status: true, pinHash: true, twoFactorEnabled: true, createdAt: true },
    })
    if (!user) throw createError('User not found', 404)
    const { pinHash, ...safeUser } = user
    res.json({ success: true, user: { ...safeUser, hasPin: !!pinHash } })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/auth/profile ───────────────────────────────────────────────────
router.put('/profile', authenticate, validateBody(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email } = req.body as z.infer<typeof updateProfileSchema>

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      },
      select: { id: true, name: true, username: true, role: true, email: true, status: true, pinHash: true, twoFactorEnabled: true, createdAt: true },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'સુધાર્યો',
      entity: 'પ્રોફાઇલ',
      details: `${updatedUser.name} (${updatedUser.username})`,
      entityId: updatedUser.id,
    })

    const { pinHash, ...safeUser } = updatedUser
    res.json({ success: true, user: { ...safeUser, hasPin: !!pinHash } })
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

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'પાસવર્ડ બદલ્યો',
      entity: 'સુરક્ષા',
      details: `${user.name} (${user.username})`,
      entityId: user.id,
    })

    res.json({ success: true, message: 'Password changed successfully' })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/pin/verify ────────────────────────────────────────────────
router.post('/pin/verify', authenticate, validateBody(pinSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin } = req.body as z.infer<typeof pinSchema>
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw createError('User not found', 404)

    if (!user.pinHash) {
      throw createError('Security PIN is not set up yet', 400)
    }

    const valid = await bcrypt.compare(pin, user.pinHash)
    if (!valid) {
      throw createError('Incorrect Security PIN', 400)
    }

    res.json({ success: true, verified: true })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/pin/setup ─────────────────────────────────────────────────
router.post('/pin/setup', authenticate, validateBody(pinSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin } = req.body as z.infer<typeof pinSchema>
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw createError('User not found', 404)

    const pinHash = await bcrypt.hash(pin, env.BCRYPT_ROUNDS)
    await prisma.user.update({ where: { id: user.id }, data: { pinHash } })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'PIN સેટ કર્યો',
      entity: 'સુરક્ષા',
      details: `${user.name} (${user.username})`,
      entityId: user.id,
    })

    res.json({ success: true, message: 'Security PIN set up successfully', hasPin: true })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/pin/change ────────────────────────────────────────────────
router.post('/pin/change', authenticate, validateBody(changePinSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPin, password, newPin } = req.body as z.infer<typeof changePinSchema>
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw createError('User not found', 404)

    if (currentPin) {
      if (!user.pinHash) throw createError('No PIN configured. Please set up a new PIN.', 400)
      const valid = await bcrypt.compare(currentPin, user.pinHash)
      if (!valid) throw createError('Current PIN is incorrect', 400)
    } else if (password) {
      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) throw createError('Current account password is incorrect', 400)
    }

    const pinHash = await bcrypt.hash(newPin, env.BCRYPT_ROUNDS)
    await prisma.user.update({ where: { id: user.id }, data: { pinHash } })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'PIN બદલ્યો',
      entity: 'સુરક્ષા',
      details: `${user.name} (${user.username})`,
      entityId: user.id,
    })

    res.json({ success: true, message: 'Security PIN changed successfully', hasPin: true })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/pin/reset ─────────────────────────────────────────────────
router.post('/pin/reset', authenticate, validateBody(resetPinSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, newPin } = req.body as z.infer<typeof resetPinSchema>
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw createError('User not found', 404)

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw createError('Account password is incorrect', 400)

    const pinHash = await bcrypt.hash(newPin, env.BCRYPT_ROUNDS)
    await prisma.user.update({ where: { id: user.id }, data: { pinHash } })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'PIN રીસેટ કર્યો',
      entity: 'સુરક્ષા',
      details: `${user.name} (${user.username})`,
      entityId: user.id,
    })

    res.json({ success: true, message: 'Security PIN reset successfully', hasPin: true })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/auth/2fa/setup ───────────────────────────────────────────────────
router.get('/2fa/setup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw createError('User not found', 404)

    const secret = generateSecret()
    const otpauthUrl = generateURI({
      issuer: 'Gopinathji Gems',
      label: user.username,
      secret,
    })
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl)

    res.json({
      success: true,
      secret,
      qrCodeUrl,
      otpauthUrl,
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/2fa/verify-setup ──────────────────────────────────────────
router.post('/2fa/verify-setup', authenticate, validateBody(verify2FASetupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { secret, code } = req.body as z.infer<typeof verify2FASetupSchema>
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw createError('User not found', 404)

    const checkResult = await verifyTotp({ secret, token: code })
    if (!checkResult.valid) {
      throw createError('Invalid 6-digit authenticator code. Please check your authenticator app and try again.', 400)
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
      },
      select: { id: true, name: true, username: true, role: true, email: true, status: true, pinHash: true, twoFactorEnabled: true, createdAt: true },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: '2FA સક્રિય કર્યું',
      entity: 'સુરક્ષા',
      details: `${user.name} (${user.username})`,
      entityId: user.id,
    })

    const { pinHash, ...safeUser } = updatedUser
    res.json({
      success: true,
      message: 'Two-Factor Authentication enabled successfully',
      user: { ...safeUser, hasPin: !!pinHash },
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/auth/2fa/disable ───────────────────────────────────────────────
router.post('/2fa/disable', authenticate, validateBody(disable2FASchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, code } = req.body as z.infer<typeof disable2FASchema>
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) throw createError('User not found', 404)

    if (password) {
      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) throw createError('Current account password is incorrect', 400)
    } else if (code && user.twoFactorSecret) {
      const checkResult = await verifyTotp({ secret: user.twoFactorSecret, token: code })
      if (!checkResult.valid) throw createError('Invalid 6-digit authenticator code', 400)
    } else {
      throw createError('Verification failed', 400)
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
      },
      select: { id: true, name: true, username: true, role: true, email: true, status: true, pinHash: true, twoFactorEnabled: true, createdAt: true },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: '2FA નિષ્ક્રિય કર્યું',
      entity: 'સુરક્ષા',
      details: `${user.name} (${user.username})`,
      entityId: user.id,
    })

    const { pinHash, ...safeUser } = updatedUser
    res.json({
      success: true,
      message: 'Two-Factor Authentication disabled successfully',
      user: { ...safeUser, hasPin: !!pinHash },
    })
  } catch (err) {
    next(err)
  }
})

export default router

