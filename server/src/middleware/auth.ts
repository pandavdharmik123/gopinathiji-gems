import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'

export interface JwtPayload {
  userId: string
  username: string
  role: 'admin' | 'manager' | 'employee'
}

// Extend Express request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

// ─── Verify JWT token ─────────────────────────────────────────────────────────
// The token only proves identity at issue time. We re-read the user on every
// request so role changes and deactivations take effect immediately instead of
// waiting for the token to expire.
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' })
    return
  }

  const token = authHeader.split(' ')[1]

  let payload: JwtPayload
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, role: true, status: true },
    })

    if (!user || user.status !== 'active') {
      res.status(401).json({ success: false, message: 'Account is inactive or no longer exists' })
      return
    }

    // Always trust the current database role, never the stale token claim.
    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role as JwtPayload['role'],
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Role guard factory ───────────────────────────────────────────────────────
export function requireRole(...roles: Array<'admin' | 'manager' | 'employee'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      })
      return
    }
    next()
  }
}

// Convenience helpers
export const requireAdmin = requireRole('admin')
export const requireManager = requireRole('admin', 'manager')
export const requireEmployee = requireRole('admin', 'manager', 'employee')
