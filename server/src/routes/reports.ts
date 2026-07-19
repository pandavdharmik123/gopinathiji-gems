import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// ─── Helper: date range ───────────────────────────────────────────────────────
function monthRange(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return { start, end }
}

function yearRange(yearStr: string) {
  const year = parseInt(yearStr)
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59) }
}

// ─── GET /api/reports/summary ─────────────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const { start: monthStart, end: monthEnd } = monthRange(currentMonthStr)

    const [todayTxns, monthTxns, totalParties, activeYear] = await Promise.all([
      prisma.transaction.findMany({ where: { date: { gte: today, lte: todayEnd } } }),
      prisma.transaction.findMany({ where: { date: { gte: monthStart, lte: monthEnd } } }),
      prisma.party.count({ where: { status: 'active' } }),
      prisma.accountingYear.findFirst({ where: { status: 'active' } }),
    ])

    let cashBalance = Number(activeYear?.openingBalance ?? 0)
    if (activeYear) {
      const yearTxns = await prisma.transaction.findMany({
        where: {
          date: {
            gte: activeYear.startDate,
            lte: activeYear.endDate,
          }
        },
        select: { type: true, amount: true }
      })
      const inc = yearTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const exp = yearTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      cashBalance += inc - exp
    }

    const sum = (txns: any[], type: string): number =>
      txns.filter(t => t.type === type).reduce((s: number, t: any) => s + Number(t.amount), 0)

    res.json({
      success: true,
      data: {
        today: {
          income: sum(todayTxns, 'income'),
          expense: sum(todayTxns, 'expense'),
          profit: sum(todayTxns, 'income') - sum(todayTxns, 'expense'),
          transactions: todayTxns.length,
        },
        month: {
          income: sum(monthTxns, 'income'),
          expense: sum(monthTxns, 'expense'),
          profit: sum(monthTxns, 'income') - sum(monthTxns, 'expense'),
          transactions: monthTxns.length,
        },
        cashBalance,
        totalParties,
      },
    })
  } catch (err) { next(err) }
})

// ─── GET /api/reports/monthly?month=2026-07 ───────────────────────────────────
router.get('/monthly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const monthStr = (req.query.month as string) ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const { start, end } = monthRange(monthStr)

    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      include: { party: { select: { name: true } } },
      orderBy: { date: 'asc' },
    })

    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    res.json({
      success: true,
      data: { month: monthStr, income, expense, profit: income - expense, transactions },
    })
  } catch (err) { next(err) }
})

// ─── GET /api/reports/yearly?year=2026 ───────────────────────────────────────
router.get('/yearly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearStr = (req.query.year as string) ?? String(new Date().getFullYear())
    const { start, end } = yearRange(yearStr)

    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: start, lte: end } },
      select: { type: true, amount: true, date: true },
    })

    // Group by month
    const months: Record<string, { income: number; expense: number }> = {}
    for (let m = 1; m <= 12; m++) {
      const key = `${yearStr}-${String(m).padStart(2, '0')}`
      months[key] = { income: 0, expense: 0 }
    }
    transactions.forEach(t => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`
      if (months[key]) {
        if (t.type === 'income') months[key].income += Number(t.amount)
        if (t.type === 'expense') months[key].expense += Number(t.amount)
      }
    })

    const monthlyData = Object.entries(months).map(([month, data]) => ({
      month,
      ...data,
      profit: data.income - data.expense,
    }))

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

    res.json({
      success: true,
      data: { year: yearStr, totalIncome, totalExpense, netProfit: totalIncome - totalExpense, monthly: monthlyData },
    })
  } catch (err) { next(err) }
})

// ─── GET /api/reports/by-category ────────────────────────────────────────────
router.get('/by-category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type = 'expense' } = req.query as { type?: string }

    const grouped = await prisma.transaction.groupBy({
      by: ['category'],
      where: { type: type as any },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    })

    res.json({
      success: true,
      data: grouped.map(g => ({
        category: g.category,
        total: Number(g._sum.amount ?? 0),
        count: g._count.id,
      })),
    })
  } catch (err) { next(err) }
})

// ─── GET /api/reports/party/:id ───────────────────────────────────────────────
router.get('/party/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string>

    const transactions = await prisma.transaction.findMany({
      where: {
        partyId: req.params.id,
        ...(dateFrom || dateTo ? {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo + 'T23:59:59') }),
          },
        } : {}),
      },
      orderBy: { date: 'asc' },
    })

    const party = await prisma.party.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, category: true, mobile: true, address: true },
    })

    // Build ledger with running balance
    let runningBalance = 0
    const ledger = transactions.map(t => {
      const credit = t.type === 'income' ? Number(t.amount) : 0
      const debit = t.type === 'expense' ? Number(t.amount) : 0
      runningBalance += credit - debit
      return { ...t, credit, debit, balance: runningBalance }
    })

    const totalCredit = ledger.reduce((s, r) => s + r.credit, 0)
    const totalDebit = ledger.reduce((s, r) => s + r.debit, 0)

    res.json({
      success: true,
      data: { party, ledger, totalCredit, totalDebit, netBalance: totalCredit - totalDebit },
    })
  } catch (err) { next(err) }
})

// ─── GET /api/reports/outstanding ────────────────────────────────────────────
router.get('/outstanding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parties = await prisma.party.findMany({
      include: { transactions: { select: { type: true, amount: true } } },
    })

    const outstanding = parties
      .map(p => {
        const credit = p.transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
        const debit = p.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
        const net = credit - debit
        const { transactions, ...rest } = p
        return { ...rest, credit, debit, net }
      })
      .filter(p => Math.abs(p.net) > 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

    res.json({ success: true, data: outstanding })
  } catch (err) { next(err) }
})

// ─── GET /api/reports/pl ─────────────────────────────────────────────────────
router.get('/pl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string>
    const where: any = dateFrom || dateTo ? {
      date: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo + 'T23:59:59') }),
      },
    } : {}

    const [incomeRows, expenseRows] = await Promise.all([
      prisma.transaction.findMany({ where: { ...where, type: 'income' }, include: { party: { select: { name: true } } }, orderBy: { date: 'desc' } }),
      prisma.transaction.findMany({ where: { ...where, type: 'expense' }, include: { party: { select: { name: true } } }, orderBy: { date: 'desc' } }),
    ])

    const totalIncome = incomeRows.reduce((s, t) => s + Number(t.amount), 0)
    const totalExpense = expenseRows.reduce((s, t) => s + Number(t.amount), 0)

    res.json({
      success: true,
      data: {
        income: { rows: incomeRows, total: totalIncome },
        expense: { rows: expenseRows, total: totalExpense },
        netProfit: totalIncome - totalExpense,
      },
    })
  } catch (err) { next(err) }
})

export default router
