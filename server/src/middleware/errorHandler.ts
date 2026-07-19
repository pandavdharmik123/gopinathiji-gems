import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500
  const isDev = process.env.NODE_ENV === 'development'

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    res.status(409).json({
      success: false,
      message: 'A record with this value already exists',
      ...(isDev && { detail: err.message }),
    })
    return
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    res.status(404).json({
      success: false,
      message: 'Record not found',
    })
    return
  }

  console.error(`[${new Date().toISOString()}] ${err.message}`, isDev ? err.stack : '')

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : err.message,
    ...(isDev && { stack: err.stack }),
  })
}

// Helper to create typed errors
export function createError(message: string, statusCode = 500): AppError {
  const err: AppError = new Error(message)
  err.statusCode = statusCode
  return err
}
