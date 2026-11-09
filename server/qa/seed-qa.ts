/**
 * QA seed for the ISOLATED test database (gopinathji_gems_qa).
 * Never point this at the production/development database.
 *
 * Run from server/:
 *   DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa \
 *     npx ts-node --transpile-only qa/seed-qa.ts
 */
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const BCRYPT_ROUNDS = 10

async function reset() {
  // Child rows first (FK-safe)
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.party.deleteMany()
  await prisma.accountingYear.deleteMany()
  await prisma.expenseCategory.deleteMany()
  await prisma.backupRun.deleteMany()
  await prisma.user.deleteMany()
  await prisma.companySettings.deleteMany()
}

async function main() {
  if (!process.env.DATABASE_URL?.includes('gopinathji_gems_qa')) {
    throw new Error(
      'Refusing to seed: DATABASE_URL must point at the isolated QA database (name must contain "gopinathji_gems_qa").'
    )
  }

  console.log('Resetting QA database…')
  await reset()

  const hash = (p: string) => bcrypt.hash(p, BCRYPT_ROUNDS)

  const [adminHash, managerHash, employeeHash, inactiveHash] = await Promise.all([
    hash('Admin#12345'),
    hash('Manager#12345'),
    hash('Employee#12345'),
    hash('Inactive#12345'),
  ])

  const admin = await prisma.user.create({
    data: {
      name: 'QA Admin',
      username: 'qa_admin',
      email: 'qa_admin@example.test',
      passwordHash: adminHash,
      role: 'admin',
      status: 'active',
    },
  })
  const manager = await prisma.user.create({
    data: {
      name: 'QA Manager',
      username: 'qa_manager',
      email: 'qa_manager@example.test',
      passwordHash: managerHash,
      role: 'manager',
      status: 'active',
    },
  })
  const employee = await prisma.user.create({
    data: {
      name: 'QA Employee',
      username: 'qa_employee',
      email: 'qa_employee@example.test',
      passwordHash: employeeHash,
      role: 'employee',
      status: 'active',
    },
  })
  await prisma.user.create({
    data: {
      name: 'QA Inactive',
      username: 'qa_inactive',
      email: 'qa_inactive@example.test',
      passwordHash: inactiveHash,
      role: 'employee',
      status: 'inactive',
    },
  })

  const setting = await prisma.companySettings.create({
    data: {
      id: 'singleton',
      name: 'Gopinathji Gems QA',
      gst: '24AABCJ1234R1Z5',
      address: 'QA Address, Surat',
      phone: '+91 90000 00000',
      email: 'qa@gopinathjigems.test',
      currency: 'INR',
      dateFormat: 'DD/MM/YYYY',
      language: 'en',
    },
  })

  const categories = ['Travel', 'Visa', 'Ticket', 'Hotel', 'Logistic', 'Consulting', 'Other']
  await prisma.expenseCategory.createMany({
    data: categories.map(name => ({ name })),
  })

  const fy2627 = await prisma.accountingYear.create({
    data: {
      name: 'FY 2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      openingBalance: 100000,
      openingBankBalance: 500000,
      notes: 'QA active year',
      status: 'active',
    },
  })
  await prisma.accountingYear.create({
    data: {
      name: 'FY 2025-26',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      openingBalance: 50000,
      openingBankBalance: 250000,
      notes: 'QA inactive year',
      status: 'inactive',
    },
  })

  const alpha = await prisma.party.create({
    data: {
      name: 'QA Alpha Traders',
      category: 'Customer',
      contactPerson: 'Alpha Contact',
      mobile: '9000000001',
      email: 'alpha@example.test',
      gst: '24AAAAA0000A1Z5',
      address: 'Surat',
      notes: 'QA party alpha',
      status: 'active',
    },
  })
  const beta = await prisma.party.create({
    data: {
      name: 'QA Beta Suppliers',
      category: 'Supplier',
      contactPerson: 'Beta Contact',
      mobile: '9000000002',
      email: 'beta@example.test',
      gst: '24BBBBB0000B1Z5',
      address: 'Ahmedabad',
      notes: 'QA party beta',
      status: 'active',
    },
  })
  const gamma = await prisma.party.create({
    data: {
      name: 'QA Gamma Exports',
      category: 'Customer',
      contactPerson: 'Gamma Contact',
      mobile: '9000000003',
      email: 'gamma@example.test',
      gst: '24CCCCC0000C1Z5',
      address: 'Vadodara',
      notes: 'QA party gamma',
      status: 'active',
    },
  })

  // Deterministic financial fixture (FY 2026-27 only)
  // Income total = 39,000 ; Expense total = 22,000 ; Net = 17,000
  // cash: +15000/-12000 ; bank: +4000/-5000 ; upi: +10000/-3000 ; cheque: +10000/-2000
  const txns = [
    { voucherNo: 'INC-001', date: '2026-04-15', type: 'income', partyId: alpha.id, category: 'Travel', amount: 15000, paymentMode: 'cash', description: 'QA cash income' },
    { voucherNo: 'EXP-001', date: '2026-04-16', type: 'expense', partyId: alpha.id, category: 'Hotel', amount: 5000, paymentMode: 'bank', description: 'QA bank expense' },
    { voucherNo: 'EXP-002', date: '2026-04-17', type: 'expense', partyId: beta.id, category: 'Logistic', amount: 12000, paymentMode: 'cash', description: 'QA cash expense' },
    { voucherNo: 'INC-002', date: '2026-04-18', type: 'income', partyId: gamma.id, category: 'Visa', amount: 10000, paymentMode: 'cheque', description: 'QA cheque income' },
    { voucherNo: 'INC-003', date: '2026-05-01', type: 'income', partyId: alpha.id, category: 'Travel', amount: 10000, paymentMode: 'upi', description: 'QA upi income' },
    { voucherNo: 'INC-004', date: '2026-05-02', type: 'income', partyId: beta.id, category: 'Consulting', amount: 4000, paymentMode: 'bank', description: 'QA bank income' },
    { voucherNo: 'EXP-003', date: '2026-05-03', type: 'expense', partyId: gamma.id, category: 'Ticket', amount: 3000, paymentMode: 'upi', description: 'QA upi expense' },
    { voucherNo: 'EXP-004', date: '2026-05-04', type: 'expense', partyId: alpha.id, category: 'Other', amount: 2000, paymentMode: 'cheque', description: 'QA cheque expense' },
    // Outside the active FY — must be excluded from year-scoped reports/UI
    { voucherNo: 'INC-005', date: '2025-05-01', type: 'income', partyId: gamma.id, category: 'Visa', amount: 99999, paymentMode: 'cash', description: 'QA prior-year income' },
  ] as const

  for (const t of txns) {
    await prisma.transaction.create({
      data: {
        ...t,
        date: new Date(t.date),
        createdBy: admin.username,
      },
    })
  }

  const summary = {
    ok: true,
    database: process.env.DATABASE_URL?.split('/').pop(),
    users: { admin: admin.id, manager: manager.id, employee: employee.id },
    parties: { alpha: alpha.id, beta: beta.id, gamma: gamma.id },
    accountingYear: fy2627.id,
    settingsId: setting.id,
    transactions: txns.length,
    expected: {
      yearIncome: 39000,
      yearExpense: 22000,
      yearProfit: 17000,
      cashIncome: 15000,
      cashExpense: 12000,
      bankIncomeExact: 4000,
      bankExpenseExact: 5000,
      bankInclUpiChequeIncome: 24000,
      bankInclUpiChequeExpense: 10000,
      alphaBalance: 18000,
      betaBalance: -8000,
      gammaBalance: 7000,
    },
  }
  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch(err => {
    console.error('QA seed failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
