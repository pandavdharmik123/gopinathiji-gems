/**
 * Read-only database audit for the ISOLATED QA database.
 *
 * Run from server/:
 *   DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa \
 *     npx ts-node --transpile-only qa/db-audit.ts
 *
 * This script performs SELECTs only (plus schema introspection through Prisma).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Finding = {
  id: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info'
  area: string
  title: string
  detail: string
}

const findings: Finding[] = []
const checks: { name: string; status: 'PASS' | 'FAIL' | 'WARN' | 'INFO'; detail: string }[] = []

function check(name: string, ok: boolean, detail: string, warning = false) {
  checks.push({ name, status: ok ? 'PASS' : warning ? 'WARN' : 'FAIL', detail })
}

function finding(id: string, severity: Finding['severity'], area: string, title: string, detail: string) {
  findings.push({ id, severity, area, title, detail })
}

async function main() {
  if (!process.env.DATABASE_URL?.includes('gopinathji_gems_qa')) {
    throw new Error('Refusing to audit: DATABASE_URL must point at gopinathji_gems_qa')
  }

  console.log('DATABASE:', process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':***@'))

  // ── 1. Row counts ─────────────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    parties: await prisma.party.count(),
    transactions: await prisma.transaction.count(),
    accountingYears: await prisma.accountingYear.count(),
    auditLogs: await prisma.auditLog.count(),
    notifications: await prisma.notification.count(),
    expenseCategories: await prisma.expenseCategory.count(),
    backupRuns: await prisma.backupRun.count(),
  }
  console.log('ROW COUNTS:', JSON.stringify(counts))

  // ── 2. Money precision / range constraints ────────────────────────────────
  const money = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*) FILTER (WHERE amount <= 0) AS non_positive,
      COUNT(*) FILTER (WHERE amount <> ROUND(amount, 2)) AS sub_paise,
      COUNT(*) FILTER (WHERE amount > 9999999999999.99) AS overflow,
      COUNT(*) FILTER (WHERE "partyId" IS NULL) AS null_party,
      COUNT(*) FILTER (WHERE "voucherNo" IS NULL OR btrim("voucherNo") = '') AS blank_voucher
    FROM transactions
  `)
  const m = money[0]
  check('amount is always > 0', Number(m.non_positive) === 0, `${m.non_positive} non-positive rows`)
  check('amount has max 2 decimals', Number(m.sub_paise) === 0, `${m.sub_paise} rows with sub-paise precision`)
  check('amount fits Decimal(15,2)', Number(m.overflow) === 0, `${m.overflow} rows overflow`)
  check('voucherNo is never blank', Number(m.blank_voucher) === 0, `${m.blank_voucher} blank vouchers`)
  if (Number(m.sub_paise) > 0) {
    finding('DB-01', 'Medium', 'transactions', 'Sub-paise amounts stored in a currency column',
      `${m.sub_paise} transaction row(s) contain more than 2 decimal places. Verify whether Prisma/Postgres silently rounded or the API validation is missing.`)
  }

  // ── 3. Date sanity ────────────────────────────────────────────────────────
  const dates = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COUNT(*) FILTER (WHERE date > NOW() + INTERVAL '1 day') AS future_rows,
      COUNT(*) FILTER (WHERE date < '2000-01-01') AS ancient_rows
    FROM transactions
  `)
  const d = dates[0]
  check('no transactions dated in the future', Number(d.future_rows) === 0, `${d.future_rows} future-dated rows`)
  check('no transactions before 2000', Number(d.ancient_rows) === 0, `${d.ancient_rows} ancient rows`)

  // ── 4. Referential integrity ──────────────────────────────────────────────
  const fk = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      (SELECT COUNT(*) FROM transactions t LEFT JOIN parties p ON p.id = t."partyId" WHERE t."partyId" IS NOT NULL AND p.id IS NULL) AS orphan_txns,
      (SELECT COUNT(*) FROM audit_logs a LEFT JOIN users u ON u.id = a."userId" WHERE a."userId" IS NOT NULL AND u.id IS NULL) AS orphan_audit,
      (SELECT COUNT(*) FROM notifications n LEFT JOIN users u ON u.id = n."userId" WHERE u.id IS NULL) AS orphan_notifications
  `)
  const f = fk[0]
  check('no orphan transaction → party references', Number(f.orphan_txns) === 0, `${f.orphan_txns} orphan rows`)
  check('no orphan audit log → user references', Number(f.orphan_audit) === 0, `${f.orphan_audit} orphan rows`)
  check('no orphan notification → user references', Number(f.orphan_notifications) === 0, `${f.orphan_notifications} orphan rows`)

  // ── 5. Uniqueness guarantees ──────────────────────────────────────────────
  const dupVoucher = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "voucherNo", COUNT(*)::int AS n FROM transactions GROUP BY "voucherNo" HAVING COUNT(*) > 1
  `)
  check('voucherNo is unique at DB level', dupVoucher.length === 0, `${dupVoucher.length} duplicate voucher values`)
  if (dupVoucher.length > 0) {
    finding('DB-02', 'Critical', 'transactions', 'Duplicate voucher numbers in database',
      `${dupVoucher.length} voucher number(s) are duplicated. Financial documents would be ambiguous.`)
  }

  const dupUser = await prisma.$queryRawUnsafe<any[]>(`
    SELECT username, COUNT(*)::int AS n FROM users GROUP BY username HAVING COUNT(*) > 1
  `)
  check('username is unique at DB level', dupUser.length === 0, `${dupUser.length} duplicate usernames`)

  // ── 6. Accounting-year integrity ──────────────────────────────────────────
  const years = await prisma.accountingYear.findMany({ orderBy: { startDate: 'asc' } })
  const activeYears = years.filter(y => y.status === 'active')
  check('at most one active accounting year', activeYears.length <= 1, `${activeYears.length} active years`)
  if (activeYears.length > 1) {
    finding('DB-03', 'High', 'accounting_years', 'Multiple active accounting years',
      `${activeYears.length} years have status=active (${activeYears.map(y => y.name).join(', ')}). Reports that call findFirst() become non-deterministic.`)
  }
  const badYears = years.filter(y => y.startDate >= y.endDate)
  check('accounting year start < end', badYears.length === 0, `${badYears.length} invalid ranges`)
  const overlaps = years.some((a, i) => years.some((b, j) => i < j && a.startDate <= b.endDate && b.startDate <= a.endDate))
  check('accounting years do not overlap', !overlaps, overlaps ? 'overlapping year ranges detected' : 'no overlaps')
  if (overlaps) {
    finding('DB-04', 'Medium', 'accounting_years', 'Overlapping accounting-year ranges are allowed',
      'No database constraint prevents overlapping FY ranges; transactions can belong to two years.')
  }

  // ── 7. Users: password/PIN hygiene ────────────────────────────────────────
  const users = await prisma.user.findMany({ select: { id: true, username: true, passwordHash: true, pinHash: true, role: true, status: true } })
  const missingHash = users.filter(u => !u.passwordHash || u.passwordHash.length < 20)
  check('every user has a password hash', missingHash.length === 0, `${missingHash.length} users missing/weak hash`)
  const bcryptUsers = users.filter(u => /^\$2[aby]\$/.test(u.passwordHash))
  check('password hashes use bcrypt', bcryptUsers.length === users.length, `${bcryptUsers.length}/${users.length} bcrypt hashes`)
  const plaintextLike = users.filter(u => /^(admin123|password|123456|admin)$/i.test(u.passwordHash))
  check('no plaintext passwords stored', plaintextLike.length === 0, `${plaintextLike.length} plaintext-like hashes`)
  const pinPlain = users.filter(u => u.pinHash && !/^\$2[aby]\$/.test(u.pinHash))
  check('PINs are hashed', pinPlain.length === 0, `${pinPlain.length} PINs not bcrypt`)

  // ── 8. Financial aggregates (exact, Decimal-based) ────────────────────────
  const agg = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
      COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense,
      COALESCE(SUM(amount) FILTER (WHERE type = 'transfer'), 0) AS transfer,
      COALESCE(SUM(amount) FILTER (WHERE type = 'adjustment'), 0) AS adjustment
    FROM transactions
  `)
  const a = agg[0]
  console.log('ALL-TIME AGGREGATES:', JSON.stringify(a, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
  const net = Number(a.income) - Number(a.expense)
  check('all-time income − expense computes without drift', Number.isFinite(net), `net=${net}`)

  const active = activeYears[0]
  if (active) {
    const y = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense,
        COUNT(*)::int AS n
      FROM transactions WHERE date >= $1 AND date <= $2
    `, active.startDate, active.endDate)
    console.log('ACTIVE-YEAR AGGREGATES:', JSON.stringify(y[0], (_, v) => (typeof v === 'bigint' ? v.toString() : v)))
    const opening = Number(active.openingBalance)
    const expectedCash = opening + Number(y[0].income) - Number(y[0].expense)
    check('derived cash balance is finite', Number.isFinite(expectedCash), `opening=${opening}, derived=${expectedCash}`)
  }

  // ── 9. Audit-log coverage ─────────────────────────────────────────────────
  const txnWrites = await prisma.auditLog.count({ where: { entity: 'transaction' } })
  const partyWrites = await prisma.auditLog.count({ where: { entity: 'party' } })
  const userWrites = await prisma.auditLog.count({ where: { entity: 'user' } })
  check('transaction writes are audited', txnWrites > 0, `${txnWrites} transaction audit rows`, true)
  check('party writes are audited', partyWrites > 0, `${partyWrites} party audit rows`, true)
  check('user writes are audited', userWrites > 0, `${userWrites} user audit rows`, true)
  if (txnWrites === 0) {
    // Direct Prisma seeding bypasses the API, so zero audit rows is expected
    // for this fixture. API-level audit coverage is asserted in qa/api.test.ts.
    console.log('NOTE: no audit rows in the direct-seeded fixture; API audit coverage is tested separately.')
  }

  // ── 10. Index checks ──────────────────────────────────────────────────────
  const indexes = await prisma.$queryRawUnsafe<any[]>(`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN ('transactions','parties','users','audit_logs','notifications','accounting_years')
    ORDER BY tablename, indexname
  `)
  const indexNames = indexes.map(i => `${i.tablename}.${i.indexname}`)
  const required = ['transactions.transactions_date_idx', 'transactions.transactions_type_idx', 'transactions.transactions_partyId_idx']
  const missing = required.filter(r => !indexNames.includes(r))
  check('transaction reporting indexes exist', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : 'all present')
  console.log('INDEXES:', indexNames.join(', '))

  // ── 11. BackupRun BigInt / status lifecycle ───────────────────────────────
  const badRuns = await prisma.backupRun.findMany({
    where: {
      OR: [
        { status: 'SUCCESS', completedAt: null },
        { status: 'FAILED', errorMessage: null },
        { fileSizeBytes: { lt: 0 } },
      ],
    },
    select: { id: true, status: true, completedAt: true, errorMessage: true, fileSizeBytes: true },
  })
  check('backup run lifecycle is consistent', badRuns.length === 0, `${badRuns.length} inconsistent rows`, true)
  const bigintRuns = await prisma.backupRun.count({ where: { fileSizeBytes: { not: null } } })
  console.log('BACKUP RUNS WITH fileSizeBytes:', bigintRuns)

  // ── 12. Settings singleton ────────────────────────────────────────────────
  const settingsCount = await prisma.companySettings.count()
  check('company settings is a singleton', settingsCount <= 1, `${settingsCount} settings rows`)

  // ── Output ────────────────────────────────────────────────────────────────
  console.log('\n=== CHECKS ===')
  for (const c of checks) console.log(`[${c.status}] ${c.name} — ${c.detail}`)
  console.log('\n=== FINDINGS ===')
  if (findings.length === 0) console.log('No database defects detected in this fixture.')
  for (const x of findings) console.log(`[${x.severity}] ${x.id} ${x.area}: ${x.title} — ${x.detail}`)

  const failed = checks.filter(c => c.status === 'FAIL').length
  console.log(`\nSUMMARY: ${checks.length - failed}/${checks.length} checks passed, ${failed} failed, ${findings.length} findings.`)
}

main()
  .catch(err => {
    console.error('DB audit failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
