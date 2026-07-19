import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin, requireManager } from '../middleware/auth'
import { validateBody, validateQuery } from '../middleware/validate'
import { createAuditLog } from '../services/audit'
import { createError } from '../middleware/errorHandler'

const router = Router()
router.use(authenticate)

// ─── Schemas ──────────────────────────────────────────────────────────────────
const transactionSchema = z.object({
  voucherNo: z.string().optional(), // auto-generated if omitted
  date: z.string().min(1),          // ISO date string "YYYY-MM-DD"
  type: z.enum(['income', 'expense', 'transfer', 'adjustment']),
  partyId: z.string().optional().nullable(),
  category: z.string().default(''),
  amount: z.number().positive(),
  paymentMode: z.enum(['cash', 'bank', 'upi', 'cheque']).default('cash'),
  description: z.string().default(''),
})

const querySchema = z.object({
  type: z.enum(['income', 'expense', 'transfer', 'adjustment']).optional(),
  paymentMode: z.enum(['cash', 'bank', 'upi', 'cheque']).optional(),
  partyId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
})

// ─── Auto voucher number generator ────────────────────────────────────────────
async function nextVoucherNo(type: string): Promise<string> {
  const prefix = type === 'income' ? 'INC' : type === 'expense' ? 'EXP' : type === 'transfer' ? 'TRF' : 'ADJ'
  const count = await prisma.transaction.count({ where: { type: type as any } })
  return `${prefix}-${String(count + 1).padStart(3, '0')}`
}

// ─── GET /api/transactions ────────────────────────────────────────────────────
router.get('/', validateQuery(querySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, paymentMode, partyId, dateFrom, dateTo, search, page, limit } = req.query as unknown as z.infer<typeof querySchema>
    const skip = (page - 1) * limit

    const where: any = {
      ...(type && { type }),
      ...(paymentMode && { paymentMode }),
      ...(partyId && { partyId }),
      ...(dateFrom || dateTo ? {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo + 'T23:59:59') }),
        },
      } : {}),
      ...(search && {
        OR: [
          { voucherNo: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { party: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    }

    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: { party: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
    ])

    res.json({
      success: true,
      data: transactions,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (err) { next(err) }
})

// ─── GET /api/transactions/export/csv ─────────────────────────────────────────
router.get('/export/csv', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { party: { select: { name: true } } },
      orderBy: { date: 'desc' },
    })

    const headers = ['Voucher', 'Date', 'Type', 'Party', 'Category', 'Payment Mode', 'Description', 'Amount']
    const rows = transactions.map(t => [
      t.voucherNo,
      t.date.toISOString().split('T')[0],
      t.type,
      t.party?.name ?? '',
      t.category,
      t.paymentMode,
      `"${t.description.replace(/"/g, '""')}"`,
      Number(t.amount).toFixed(2),
    ])

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\uFEFF' + csv) // BOM for Excel UTF-8 support
  } catch (err) { next(err) }
})

// ─── GET /api/transactions/:id ────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const txn = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { party: true },
    })
    if (!txn) throw createError('Transaction not found', 404)
    res.json({ success: true, data: txn })
  } catch (err) { next(err) }
})

// ─── POST /api/transactions ───────────────────────────────────────────────────
router.post('/', validateBody(transactionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { voucherNo, date, amount, partyId, ...rest } = req.body as z.infer<typeof transactionSchema>
    const autoVoucher = voucherNo ?? await nextVoucherNo(rest.type)

    const txn = await prisma.transaction.create({
      data: {
        ...rest,
        voucherNo: autoVoucher,
        date: new Date(date),
        amount,
        partyId: partyId ?? null,
        createdBy: req.user!.username,
      },
      include: { party: { select: { name: true } } },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'ઉમેર્યો',
      entity: txn.type === 'income' ? 'આવક' : txn.type === 'expense' ? 'ખર્ચ' : 'વ્યવહાર',
      details: `${txn.voucherNo} — ₹${Number(txn.amount).toLocaleString('en-IN')} — ${txn.party?.name ?? txn.category}`,
      entityId: txn.id,
    })

    res.status(201).json({ success: true, data: txn })
  } catch (err) { next(err) }
})

// ─── PUT /api/transactions/:id ────────────────────────────────────────────────
router.put('/:id', requireManager, validateBody(transactionSchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, amount, partyId, ...rest } = req.body as Partial<z.infer<typeof transactionSchema>>
    const txn = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(date && { date: new Date(date) }),
        ...(amount !== undefined && { amount }),
        ...(partyId !== undefined && { partyId: partyId ?? null }),
      },
      include: { party: { select: { name: true } } },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'સુધાર્યો',
      entity: 'વ્યવહાર',
      details: `${txn.voucherNo} — ₹${Number(txn.amount).toLocaleString('en-IN')}`,
      entityId: txn.id,
    })

    res.json({ success: true, data: txn })
  } catch (err) { next(err) }
})

// ─── DELETE /api/transactions/:id ─────────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const txn = await prisma.transaction.findUnique({ where: { id: req.params.id } })
    if (!txn) throw createError('Transaction not found', 404)

    await prisma.transaction.delete({ where: { id: req.params.id } })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'કાઢ્યો',
      entity: 'વ્યવહાર',
      details: `${txn.voucherNo} — ₹${Number(txn.amount).toLocaleString('en-IN')}`,
      entityId: txn.id,
    })

    res.json({ success: true, message: 'Transaction deleted' })
  } catch (err) { next(err) }
})

export default router
