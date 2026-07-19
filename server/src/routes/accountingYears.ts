import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireManager } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createAuditLog } from '../services/audit'
import { createError } from '../middleware/errorHandler'

const router = Router()
router.use(authenticate)

// ─── Schema ───────────────────────────────────────────────────────────────────
const createYearSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  openingBalance: z.number().default(0),
  notes: z.string().default(''),
  status: z.enum(['active', 'inactive']).default('active'),
})

const updateYearSchema = createYearSchema.partial()

// ─── GET /api/accounting-years ───────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const years = await prisma.accountingYear.findMany({
      orderBy: { startDate: 'desc' },
    })
    res.json({ success: true, data: years })
  } catch (err) { next(err) }
})

// ─── POST /api/accounting-years ──────────────────────────────────────────────
router.post('/', requireManager, validateBody(createYearSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, startDate, endDate, openingBalance, notes, status } = req.body as z.infer<typeof createYearSchema>
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start >= end) throw createError('શરૂઆતની તારીખ અંતની તારીખ કરતાં વહેલી હોવી જોઈએ', 400)

    // Check if name already exists
    const existing = await prisma.accountingYear.findUnique({ where: { name } })
    if (existing) throw createError('આ નામનું નાણાકીય વર્ષ પહેલેથી અસ્તિત્વમાં છે', 409)

    // If setting to active, deactivate all other years
    if (status === 'active') {
      await prisma.accountingYear.updateMany({
        data: { status: 'inactive' }
      })
    }

    const year = await prisma.accountingYear.create({
      data: {
        name,
        startDate: start,
        endDate: end,
        openingBalance,
        notes,
        status,
      },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'ઉમેર્યો',
      entity: 'ચોપડો',
      details: `નવું નાણાકીય વર્ષ: ${name} (${startDate} થી ${endDate})`,
      entityId: year.id,
    })

    res.status(201).json({ success: true, data: year })
  } catch (err) { next(err) }
})

// ─── PUT /api/accounting-years/:id ───────────────────────────────────────────
router.put('/:id', requireManager, validateBody(updateYearSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, startDate, endDate, openingBalance, notes, status } = req.body as z.infer<typeof updateYearSchema>
    const id = req.params.id

    const existingYear = await prisma.accountingYear.findUnique({ where: { id } })
    if (!existingYear) throw createError('નાણાકીય વર્ષ મળ્યું નથી', 404)

    if (name && name !== existingYear.name) {
      const duplicate = await prisma.accountingYear.findUnique({ where: { name } })
      if (duplicate) throw createError('આ નામનું નાણાકીય વર્ષ પહેલેથી અસ્તિત્વમાં છે', 409)
    }

    const start = startDate ? new Date(startDate) : existingYear.startDate
    const end = endDate ? new Date(endDate) : existingYear.endDate
    if (start >= end) throw createError('શરૂઆતની તારીખ અંતની તારીખ કરતાં વહેલી હોવી જોઈએ', 400)

    // If changing to active, deactivate all other years
    if (status === 'active') {
      await prisma.accountingYear.updateMany({
        where: { id: { not: id } },
        data: { status: 'inactive' }
      })
    }

    const updated = await prisma.accountingYear.update({
      where: { id },
      data: {
        name,
        startDate: startDate ? start : undefined,
        endDate: endDate ? end : undefined,
        openingBalance,
        notes,
        status,
      },
    })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'સુધાર્યો',
      entity: 'Settings',
      details: `સુધારેલ નાણાકીય વર્ષ: ${updated.name} (સ્થિતિ: ${updated.status})`,
      entityId: updated.id,
    })

    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

// ─── DELETE /api/accounting-years/:id ────────────────────────────────────────
router.delete('/:id', requireManager, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id
    const year = await prisma.accountingYear.findUnique({ where: { id } })
    if (!year) throw createError('નાણાકીય વર્ષ મળ્યું નથી', 404)

    // Check if it has transactions
    const txns = await prisma.transaction.findFirst({
      where: {
        date: {
          gte: year.startDate,
          lte: year.endDate,
        }
      }
    })
    if (txns) throw createError('આ વર્ષમાં વ્યવહારો હોવાથી તેને કાઢી શકાશે નહીં', 400)

    await prisma.accountingYear.delete({ where: { id } })

    void createAuditLog({
      userId: req.user!.userId,
      userName: req.user!.username,
      action: 'કાઢ્યો',
      entity: 'Settings',
      details: `કાઢી નાખેલ નાણાકીય વર્ષ: ${year.name}`,
    })

    res.json({ success: true, message: 'નાણાકીય વર્ષ કાઢી નાખવામાં આવ્યું' })
  } catch (err) { next(err) }
})

export default router
