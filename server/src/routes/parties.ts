import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin, requireManager } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createAuditLog } from '../services/audit'
import { createError } from '../middleware/errorHandler'

const router = Router()
router.use(authenticate)

// ─── Schemas ──────────────────────────────────────────────────────────────────
const partySchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  contactPerson: z.string().default(''),
  mobile: z.string().default(''),
  email: z.string().default(''),
  gst: z.string().default(''),
  address: z.string().default(''),
  notes: z.string().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
})

// ─── GET /api/parties ─────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, category, status } = req.query as Record<string, string>
    const parties = await prisma.party.findMany({
      where: {
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { contactPerson: { contains: search, mode: 'insensitive' } },
            { mobile: { contains: search } },
          ],
        }),
        ...(category && { category }),
        ...(status && { status: status as 'active' | 'inactive' }),
      },
      include: {
        _count: { select: { transactions: true } },
        transactions: {
          select: { type: true, amount: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Compute live balance from transactions
    const data = parties.map(p => {
      const credit = p.transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const debit = p.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      const { transactions, ...rest } = p
      return { ...rest, balance: credit - debit }
    })

    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// ─── GET /api/parties/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await prisma.party.findUnique({
      where: { id: req.params.id },
      include: { transactions: { orderBy: { date: 'desc' }, take: 20 } },
    })
    if (!party) throw createError('Party not found', 404)
    res.json({ success: true, data: party })
  } catch (err) { next(err) }
})

// ─── POST /api/parties ────────────────────────────────────────────────────────
router.post('/', requireManager, validateBody(partySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await prisma.party.create({ data: req.body })
    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'ઉમેર્યો',
      entity: 'પાર્ટી',
      details: `${party.name} — ${party.category}`,
      entityId: party.id,
    })
    res.status(201).json({ success: true, data: party })
  } catch (err) { next(err) }
})

// ─── PUT /api/parties/:id ─────────────────────────────────────────────────────
router.put('/:id', requireManager, validateBody(partySchema.partial()), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await prisma.party.update({
      where: { id: req.params.id },
      data: req.body,
    })
    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'સુધાર્યો',
      entity: 'પાર્ટી',
      details: `${party.name} — ${party.status}`,
      entityId: party.id,
    })
    res.json({ success: true, data: party })
  } catch (err) { next(err) }
})

// ─── DELETE /api/parties/:id ──────────────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await prisma.party.findUnique({ where: { id: req.params.id } })
    if (!party) throw createError('Party not found', 404)

    await prisma.party.delete({ where: { id: req.params.id } })
    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'કાઢ્યો',
      entity: 'પાર્ટી',
      details: `${party.name}`,
      entityId: party.id,
    })
    res.json({ success: true, message: 'Party deleted' })
  } catch (err) { next(err) }
})

export default router
