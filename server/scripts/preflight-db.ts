/**
 * Pre-flight checks for a production release.
 *
 * The constraints added by the `constraints` migration will refuse to apply if
 * legacy rows violate them. This script reports those rows *before* the
 * migration runs, so a deployment fails fast with an actionable message.
 *
 * Usage (from server/):
 *   DATABASE_URL=... npm run db:preflight
 *
 * Exit code 0 = safe to migrate. Exit code 1 = blockers found.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Blocker = { name: string; count: number; detail?: unknown }

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists
  `
  return Boolean(rows[0]?.exists)
}

async function count(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint | number }>>(sql)
  return Number(rows[0]?.n ?? 0)
}

async function main() {
  const hasTransactions = await tableExists('transactions')
  const hasYears = await tableExists('accounting_years')

  if (!hasTransactions && !hasYears) {
    console.log('✅ Fresh database: no legacy rows to pre-flight. Safe to run migrations.')
    return
  }

  const blockers: Blocker[] = []

  if (hasTransactions) {
    const negativeAmounts = await count('SELECT count(*)::int AS n FROM "transactions" WHERE amount <= 0')
    if (negativeAmounts > 0) {
      blockers.push({
        name: 'transactions with amount <= 0',
        count: negativeAmounts,
        detail: await prisma.$queryRawUnsafe(
          'SELECT id, "voucherNo", amount FROM "transactions" WHERE amount <= 0 ORDER BY "createdAt" LIMIT 10'
        ),
      })
    }

    const duplicateVouchers = await count(
      'SELECT count(*)::int AS n FROM (SELECT "voucherNo" FROM "transactions" GROUP BY "voucherNo" HAVING count(*) > 1) d'
    )
    if (duplicateVouchers > 0) {
      blockers.push({ name: 'duplicate voucher numbers', count: duplicateVouchers })
    }
  }

  if (hasYears) {
    const invertedRanges = await count(
      'SELECT count(*)::int AS n FROM "accounting_years" WHERE "endDate" <= "startDate"'
    )
    if (invertedRanges > 0) {
      blockers.push({
        name: 'accounting years with endDate <= startDate',
        count: invertedRanges,
        detail: await prisma.$queryRawUnsafe(
          'SELECT id, name, "startDate", "endDate" FROM "accounting_years" WHERE "endDate" <= "startDate" LIMIT 10'
        ),
      })
    }

    const activeYears = await count(
      `SELECT count(*)::int AS n FROM "accounting_years" WHERE status = 'active'`
    )
    if (activeYears > 1) {
      blockers.push({ name: 'more than one active accounting year', count: activeYears })
    }

    const overlaps = await count(`
      SELECT count(*)::int AS n
      FROM "accounting_years" a
      JOIN "accounting_years" b
        ON a.id < b.id
       AND daterange(a."startDate"::date, a."endDate"::date, '[]')
        && daterange(b."startDate"::date, b."endDate"::date, '[]')
    `)
    if (overlaps > 0) {
      blockers.push({ name: 'overlapping accounting-year ranges', count: overlaps })
    }
  }

  if (blockers.length > 0) {
    console.error('\n❌ Pre-flight failed. Fix these rows before applying the constraints migration:\n')
    for (const blocker of blockers) {
      console.error(`  • ${blocker.name}: ${blocker.count}`)
      if (blocker.detail) console.error(JSON.stringify(blocker.detail, null, 2))
    }
    console.error('')
    process.exitCode = 1
    return
  }

  console.log('✅ Pre-flight passed: no rows violate the pending database constraints.')
}

main()
  .catch((err) => {
    console.error('❌ Pre-flight could not run:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
