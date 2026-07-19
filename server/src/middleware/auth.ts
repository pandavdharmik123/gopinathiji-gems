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
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
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
