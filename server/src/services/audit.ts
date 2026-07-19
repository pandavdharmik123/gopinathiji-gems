import { prisma } from '../lib/prisma'

interface AuditParams {
  userId?: string
  userName: string
  action: string
  entity: string
  details: string
  entityId?: string
}

/**
 * Creates an audit log entry. Called from every route that mutates data.
 * Fire-and-forget — does not block the response.
 */
export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params })
  } catch (err) {
    // Audit log failure must never break the main request
    console.error('[AuditLog] Failed to create entry:', err)
  }
}
