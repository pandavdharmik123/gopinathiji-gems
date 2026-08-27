import ExcelJS from 'exceljs'
import officeCrypto from 'officecrypto-tool'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'

export interface BackupData {
  version: string
  exportedAt: string
  companySettings: any
  parties: any[]
  transactions: any[]
  accountingYears: any[]
  expenseCategories: any[]
  users: any[]
  auditLogs: any[]
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF102A83' }
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' }
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 26
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0D216B' } },
      bottom: { style: 'medium', color: { argb: 'FF0D216B' } },
      left: { style: 'thin', color: { argb: 'FF2A449E' } },
      right: { style: 'thin', color: { argb: 'FF2A449E' } },
    }
  })
}

function autoFitColumns(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 10
    if (column.header) {
      maxLength = String(column.header).length + 4
    }
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? String(cell.value) : ''
      if (cellValue.length + 3 > maxLength) {
        maxLength = Math.min(cellValue.length + 3, 50)
      }
    })
    column.width = Math.max(maxLength, 12)
  })
}

/**
 * Fetch all data from database for backup
 */
export async function getAllBackupData(): Promise<BackupData> {
  const [
    companySettings,
    parties,
    transactions,
    accountingYears,
    expenseCategories,
    users,
    auditLogs
  ] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 'singleton' } }),
    prisma.party.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.transaction.findMany({
      include: { party: { select: { name: true } } },
      orderBy: { date: 'desc' }
    }),
    prisma.accountingYear.findMany({ orderBy: { startDate: 'desc' } }),
    prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } })
  ])

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    companySettings: companySettings || {
      name: 'Gopinathji Gems',
      gst: '',
      address: '',
      phone: '',
      email: '',
      currency: 'INR',
      dateFormat: 'DD/MM/YYYY',
      language: 'gu',
      lastBackup: ''
    },
    parties,
    transactions: transactions.map(t => ({
      ...t,
      partyName: t.party?.name || ''
    })),
    accountingYears,
    expenseCategories,
    users,
    auditLogs
  }
}

/**
 * Export data to an ExcelJS workbook buffer and optionally encrypt with password
 */
export async function exportDataToExcel(password?: string): Promise<Buffer> {
  const data = await getAllBackupData()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Gopinathji Gems ERP'
  workbook.lastModifiedBy = 'Gopinathji Gems ERP'
  workbook.created = new Date()
  workbook.modified = new Date()

  // 1. Overview Sheet
  const overviewSheet = workbook.addWorksheet('Overview', { views: [{ showGridLines: true }] })
  overviewSheet.columns = [
    { header: 'System Property', key: 'prop', width: 30 },
    { header: 'Value', key: 'val', width: 45 }
  ]
  styleHeaderRow(overviewSheet.getRow(1))
  overviewSheet.addRow({ prop: 'Company / Firm Name', val: data.companySettings.name })
  overviewSheet.addRow({ prop: 'GST Number', val: data.companySettings.gst || 'N/A' })
  overviewSheet.addRow({ prop: 'Phone Number', val: data.companySettings.phone || 'N/A' })
  overviewSheet.addRow({ prop: 'Email', val: data.companySettings.email || 'N/A' })
  overviewSheet.addRow({ prop: 'Export Date & Time', val: new Date(data.exportedAt).toLocaleString('en-IN') })
  overviewSheet.addRow({ prop: 'Backup Version', val: data.version })
  overviewSheet.addRow({ prop: 'Password Protected', val: password ? 'YES (Encrypted)' : 'NO' })
  overviewSheet.addRow({ prop: 'Total Registered Parties', val: data.parties.length })
  overviewSheet.addRow({ prop: 'Total Transactions', val: data.transactions.length })
  overviewSheet.addRow({ prop: 'Total Accounting Years', val: data.accountingYears.length })
  overviewSheet.addRow({ prop: 'Total Expense Categories', val: data.expenseCategories.length })
  overviewSheet.addRow({ prop: 'Total Users', val: data.users.length })
  overviewSheet.addRow({ prop: 'Total Audit Logs', val: data.auditLogs.length })
  autoFitColumns(overviewSheet)

  // 2. Company Settings Sheet
  const settingsSheet = workbook.addWorksheet('CompanySettings', { views: [{ showGridLines: true }] })
  settingsSheet.columns = [
    { header: 'Field', key: 'key', width: 25 },
    { header: 'Value', key: 'val', width: 45 }
  ]
  styleHeaderRow(settingsSheet.getRow(1))
  Object.entries(data.companySettings).forEach(([k, v]) => {
    settingsSheet.addRow({ key: k, val: v !== null && v !== undefined ? String(v) : '' })
  })
  autoFitColumns(settingsSheet)

  // 3. Parties Sheet
  const partiesSheet = workbook.addWorksheet('Parties', { views: [{ showGridLines: true }] })
  partiesSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Party Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Contact Person', key: 'contactPerson', width: 22 },
    { header: 'Mobile', key: 'mobile', width: 18 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'GST', key: 'gst', width: 20 },
    { header: 'Address', key: 'address', width: 35 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Created At', key: 'createdAt', width: 24 }
  ]
  styleHeaderRow(partiesSheet.getRow(1))
  data.parties.forEach((p) => {
    partiesSheet.addRow({
      id: p.id,
      name: p.name,
      category: p.category,
      contactPerson: p.contactPerson || '',
      mobile: p.mobile || '',
      email: p.email || '',
      gst: p.gst || '',
      address: p.address || '',
      notes: p.notes || '',
      status: p.status,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : ''
    })
  })
  autoFitColumns(partiesSheet)

  // 4. Transactions Sheet
  const txnSheet = workbook.addWorksheet('Transactions', { views: [{ showGridLines: true }] })
  txnSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Voucher No', key: 'voucherNo', width: 18 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Party ID', key: 'partyId', width: 30 },
    { header: 'Party Name', key: 'partyName', width: 28 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Amount', key: 'amount', width: 16 },
    { header: 'Payment Mode', key: 'paymentMode', width: 16 },
    { header: 'Description', key: 'description', width: 35 },
    { header: 'Created By', key: 'createdBy', width: 20 },
    { header: 'Created At', key: 'createdAt', width: 24 }
  ]
  styleHeaderRow(txnSheet.getRow(1))
  data.transactions.forEach((t) => {
    txnSheet.addRow({
      id: t.id,
      voucherNo: t.voucherNo,
      date: t.date ? new Date(t.date).toISOString().split('T')[0] : '',
      type: t.type,
      partyId: t.partyId || '',
      partyName: t.partyName || '',
      category: t.category || '',
      amount: Number(t.amount),
      paymentMode: t.paymentMode,
      description: t.description || '',
      createdBy: t.createdBy,
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : ''
    })
  })
  autoFitColumns(txnSheet)

  // 5. Accounting Years Sheet
  const yearSheet = workbook.addWorksheet('AccountingYears', { views: [{ showGridLines: true }] })
  yearSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Year Name', key: 'name', width: 20 },
    { header: 'Start Date', key: 'startDate', width: 15 },
    { header: 'End Date', key: 'endDate', width: 15 },
    { header: 'Opening Balance', key: 'openingBalance', width: 18 },
    { header: 'Opening Bank Balance', key: 'openingBankBalance', width: 22 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Created At', key: 'createdAt', width: 24 }
  ]
  styleHeaderRow(yearSheet.getRow(1))
  data.accountingYears.forEach((y) => {
    yearSheet.addRow({
      id: y.id,
      name: y.name,
      startDate: y.startDate ? new Date(y.startDate).toISOString().split('T')[0] : '',
      endDate: y.endDate ? new Date(y.endDate).toISOString().split('T')[0] : '',
      openingBalance: Number(y.openingBalance),
      openingBankBalance: Number(y.openingBankBalance),
      notes: y.notes || '',
      status: y.status,
      createdAt: y.createdAt ? new Date(y.createdAt).toISOString() : ''
    })
  })
  autoFitColumns(yearSheet)

  // 6. Expense Categories Sheet
  const catSheet = workbook.addWorksheet('ExpenseCategories', { views: [{ showGridLines: true }] })
  catSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Category Name', key: 'name', width: 25 },
    { header: 'Created At', key: 'createdAt', width: 24 }
  ]
  styleHeaderRow(catSheet.getRow(1))
  data.expenseCategories.forEach((c) => {
    catSheet.addRow({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : ''
    })
  })
  autoFitColumns(catSheet)

  // 7. Users Sheet
  const userSheet = workbook.addWorksheet('Users', { views: [{ showGridLines: true }] })
  userSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Username', key: 'username', width: 20 },
    { header: 'Password Hash', key: 'passwordHash', width: 65 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Created At', key: 'createdAt', width: 24 }
  ]
  styleHeaderRow(userSheet.getRow(1))
  data.users.forEach((u) => {
    userSheet.addRow({
      id: u.id,
      name: u.name,
      username: u.username,
      passwordHash: u.passwordHash,
      role: u.role,
      email: u.email,
      status: u.status,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : ''
    })
  })
  autoFitColumns(userSheet)

  // 8. Audit Logs Sheet
  const auditSheet = workbook.addWorksheet('AuditLogs', { views: [{ showGridLines: true }] })
  auditSheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'User ID', key: 'userId', width: 30 },
    { header: 'User Name', key: 'userName', width: 20 },
    { header: 'Action', key: 'action', width: 18 },
    { header: 'Entity', key: 'entity', width: 20 },
    { header: 'Details', key: 'details', width: 45 },
    { header: 'Entity ID', key: 'entityId', width: 30 },
    { header: 'Created At', key: 'createdAt', width: 24 }
  ]
  styleHeaderRow(auditSheet.getRow(1))
  data.auditLogs.forEach((l) => {
    auditSheet.addRow({
      id: l.id,
      userId: l.userId || '',
      userName: l.userName,
      action: l.action,
      entity: l.entity,
      details: l.details,
      entityId: l.entityId || '',
      createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : ''
    })
  })
  autoFitColumns(auditSheet)

  // 9. _Metadata Sheet (Full JSON Payload for 100% loss-less fidelity recovery)
  const metaSheet = workbook.addWorksheet('_Metadata', { state: 'veryHidden' })
  metaSheet.columns = [
    { header: 'Key', key: 'k' },
    { header: 'Payload', key: 'p' }
  ]
  // Chunk JSON payload if large
  const jsonPayload = JSON.stringify(data)
  const chunkSize = 30000
  for (let i = 0; i < jsonPayload.length; i += chunkSize) {
    metaSheet.addRow({ k: `chunk_${i / chunkSize}`, p: jsonPayload.substring(i, i + chunkSize) })
  }

  const rawBuffer = Buffer.from(await workbook.xlsx.writeBuffer())

  // If password provided, encrypt workbook using officecrypto-tool
  if (password && password.trim().length > 0) {
    const encrypted = officeCrypto.encrypt(rawBuffer, { password: password.trim() })
    return Buffer.from(encrypted)
  }

  return rawBuffer
}

/**
 * Decrypt file buffer if encrypted and load into an ExcelJS workbook
 */
export async function parseExcelBuffer(fileBuffer: Buffer, password?: string): Promise<{ workbook: ExcelJS.Workbook; rawData?: BackupData }> {
  let decryptedBuffer = fileBuffer

  const isEncrypted = officeCrypto.isEncrypted(fileBuffer)
  if (isEncrypted) {
    if (!password || password.trim().length === 0) {
      throw new Error('This Excel file is password-protected. Please enter the password.')
    }
    try {
      decryptedBuffer = Buffer.from(await officeCrypto.decrypt(fileBuffer, { password: password.trim() }))
    } catch {
      throw new Error('Incorrect password for this Excel file. Please try again.')
    }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(decryptedBuffer as any)
  } catch (err: any) {
    throw new Error(`Invalid or corrupted Excel file: ${err?.message || err}`)
  }

  // Check if _Metadata sheet exists for instant lossless parse
  let rawData: BackupData | undefined
  const metaSheet = workbook.getWorksheet('_Metadata')
  if (metaSheet) {
    try {
      let combined = ''
      metaSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const chunk = row.getCell(2).value
          if (chunk) combined += String(chunk)
        }
      })
      if (combined) {
        rawData = JSON.parse(combined) as BackupData
      }
    } catch {
      console.warn('Metadata sheet parsing failed, will fallback to table parsing')
    }
  }

  // If rawData not extracted from _Metadata, parse directly from visible worksheets
  if (!rawData) {
    rawData = parseWorksheetData(workbook)
  }

  return { workbook, rawData }
}

/**
 * Fallback table parser from sheet cells
 */
function parseWorksheetData(workbook: ExcelJS.Workbook): BackupData {
  const result: BackupData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    companySettings: {},
    parties: [],
    transactions: [],
    accountingYears: [],
    expenseCategories: [],
    users: [],
    auditLogs: []
  }

  // Parse CompanySettings
  const settingsSheet = workbook.getWorksheet('CompanySettings')
  if (settingsSheet) {
    const settings: any = {}
    settingsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const key = row.getCell(1).value
        const val = row.getCell(2).value
        if (key) settings[String(key)] = val ? String(val) : ''
      }
    })
    result.companySettings = settings
  }

  // Parse Parties
  const partiesSheet = workbook.getWorksheet('Parties')
  if (partiesSheet) {
    partiesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const id = row.getCell(1).value ? String(row.getCell(1).value) : undefined
        const name = row.getCell(2).value ? String(row.getCell(2).value) : ''
        const category = row.getCell(3).value ? String(row.getCell(3).value) : 'General'
        if (name) {
          result.parties.push({
            id,
            name,
            category,
            contactPerson: row.getCell(4).value ? String(row.getCell(4).value) : '',
            mobile: row.getCell(5).value ? String(row.getCell(5).value) : '',
            email: row.getCell(6).value ? String(row.getCell(6).value) : '',
            gst: row.getCell(7).value ? String(row.getCell(7).value) : '',
            address: row.getCell(8).value ? String(row.getCell(8).value) : '',
            notes: row.getCell(9).value ? String(row.getCell(9).value) : '',
            status: row.getCell(10).value === 'inactive' ? 'inactive' : 'active',
            createdAt: row.getCell(11).value ? new Date(String(row.getCell(11).value)) : new Date()
          })
        }
      }
    })
  }

  // Parse Transactions
  const txnSheet = workbook.getWorksheet('Transactions')
  if (txnSheet) {
    txnSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const id = row.getCell(1).value ? String(row.getCell(1).value) : undefined
        const voucherNo = row.getCell(2).value ? String(row.getCell(2).value) : ''
        const dateStr = row.getCell(3).value ? String(row.getCell(3).value) : new Date().toISOString()
        const type = row.getCell(4).value ? String(row.getCell(4).value) : 'expense'
        const partyId = row.getCell(5).value ? String(row.getCell(5).value) : null
        const partyName = row.getCell(6).value ? String(row.getCell(6).value) : ''
        const category = row.getCell(7).value ? String(row.getCell(7).value) : ''
        const amount = Number(row.getCell(8).value || 0)
        const paymentMode = row.getCell(9).value ? String(row.getCell(9).value) : 'cash'
        const description = row.getCell(10).value ? String(row.getCell(10).value) : ''
        const createdBy = row.getCell(11).value ? String(row.getCell(11).value) : 'System'
        const createdAt = row.getCell(12).value ? new Date(String(row.getCell(12).value)) : new Date()

        if (voucherNo) {
          result.transactions.push({
            id,
            voucherNo,
            date: new Date(dateStr),
            type: ['income', 'expense', 'transfer', 'adjustment'].includes(type) ? type : 'expense',
            partyId: partyId || null,
            partyName,
            category,
            amount,
            paymentMode: ['cash', 'bank', 'upi', 'cheque'].includes(paymentMode) ? paymentMode : 'cash',
            description,
            createdBy,
            createdAt
          })
        }
      }
    })
  }

  // Parse AccountingYears
  const yearSheet = workbook.getWorksheet('AccountingYears')
  if (yearSheet) {
    yearSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const id = row.getCell(1).value ? String(row.getCell(1).value) : undefined
        const name = row.getCell(2).value ? String(row.getCell(2).value) : ''
        const startDateStr = row.getCell(3).value ? String(row.getCell(3).value) : ''
        const endDateStr = row.getCell(4).value ? String(row.getCell(4).value) : ''
        if (name && startDateStr && endDateStr) {
          result.accountingYears.push({
            id,
            name,
            startDate: new Date(startDateStr),
            endDate: new Date(endDateStr),
            openingBalance: Number(row.getCell(5).value || 0),
            openingBankBalance: Number(row.getCell(6).value || 0),
            notes: row.getCell(7).value ? String(row.getCell(7).value) : '',
            status: row.getCell(8).value === 'inactive' ? 'inactive' : 'active'
          })
        }
      }
    })
  }

  // Parse ExpenseCategories
  const catSheet = workbook.getWorksheet('ExpenseCategories')
  if (catSheet) {
    catSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const id = row.getCell(1).value ? String(row.getCell(1).value) : undefined
        const name = row.getCell(2).value ? String(row.getCell(2).value) : ''
        if (name) {
          result.expenseCategories.push({
            id,
            name
          })
        }
      }
    })
  }

  // Parse Users
  const userSheet = workbook.getWorksheet('Users')
  if (userSheet) {
    userSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const id = row.getCell(1).value ? String(row.getCell(1).value) : undefined
        const name = row.getCell(2).value ? String(row.getCell(2).value) : ''
        const username = row.getCell(3).value ? String(row.getCell(3).value) : ''
        const passwordHash = row.getCell(4).value ? String(row.getCell(4).value) : ''
        const role = row.getCell(5).value ? String(row.getCell(5).value) : 'employee'
        const email = row.getCell(6).value ? String(row.getCell(6).value) : ''
        const status = row.getCell(7).value === 'inactive' ? 'inactive' : 'active'

        if (username && email) {
          result.users.push({
            id,
            name,
            username,
            passwordHash,
            role: ['admin', 'manager', 'employee'].includes(role) ? role : 'employee',
            email,
            status
          })
        }
      }
    })
  }

  // Parse AuditLogs
  const auditSheet = workbook.getWorksheet('AuditLogs')
  if (auditSheet) {
    auditSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const id = row.getCell(1).value ? String(row.getCell(1).value) : undefined
        const userId = row.getCell(2).value ? String(row.getCell(2).value) : null
        const userName = row.getCell(3).value ? String(row.getCell(3).value) : ''
        const action = row.getCell(4).value ? String(row.getCell(4).value) : ''
        const entity = row.getCell(5).value ? String(row.getCell(5).value) : ''
        const details = row.getCell(6).value ? String(row.getCell(6).value) : ''
        const entityId = row.getCell(7).value ? String(row.getCell(7).value) : null
        const createdAt = row.getCell(8).value ? new Date(String(row.getCell(8).value)) : new Date()

        if (action && entity) {
          result.auditLogs.push({
            id,
            userId,
            userName,
            action,
            entity,
            details,
            entityId,
            createdAt
          })
        }
      }
    })
  }

  return result
}

/**
 * Preview summary stats of an Excel backup file
 */
export async function previewExcelBackup(fileBuffer: Buffer, password?: string) {
  const { rawData } = await parseExcelBuffer(fileBuffer, password)
  if (!rawData) throw new Error('Could not parse Excel data')

  return {
    version: rawData.version || '1.0.0',
    exportedAt: rawData.exportedAt || new Date().toISOString(),
    companyName: rawData.companySettings?.name || 'Unknown',
    counts: {
      parties: rawData.parties?.length || 0,
      transactions: rawData.transactions?.length || 0,
      accountingYears: rawData.accountingYears?.length || 0,
      expenseCategories: rawData.expenseCategories?.length || 0,
      users: rawData.users?.length || 0,
      auditLogs: rawData.auditLogs?.length || 0
    }
  }
}

/**
 * Restore all data from Excel parsed data into PostgreSQL transactionally
 */
export async function restoreDataFromExcel(fileBuffer: Buffer, password?: string, currentUserName: string = 'Admin') {
  const { rawData } = await parseExcelBuffer(fileBuffer, password)
  if (!rawData) throw new Error('Could not parse Excel backup data')

  const nowFormatted = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })

  // Execute restore in a Prisma Transaction
  await prisma.$transaction(async (tx) => {
    // 1. Restore Company Settings
    if (rawData.companySettings) {
      await tx.companySettings.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          name: rawData.companySettings.name || 'Gopinathji Gems',
          gst: rawData.companySettings.gst || '',
          address: rawData.companySettings.address || '',
          phone: rawData.companySettings.phone || '',
          email: rawData.companySettings.email || '',
          currency: rawData.companySettings.currency || 'INR',
          dateFormat: rawData.companySettings.dateFormat || 'DD/MM/YYYY',
          language: rawData.companySettings.language || 'gu',
          lastBackup: `Excel Restored on ${nowFormatted}`
        },
        update: {
          name: rawData.companySettings.name || 'Gopinathji Gems',
          gst: rawData.companySettings.gst || '',
          address: rawData.companySettings.address || '',
          phone: rawData.companySettings.phone || '',
          email: rawData.companySettings.email || '',
          currency: rawData.companySettings.currency || 'INR',
          dateFormat: rawData.companySettings.dateFormat || 'DD/MM/YYYY',
          language: rawData.companySettings.language || 'gu',
          lastBackup: `Excel Restored on ${nowFormatted}`
        }
      })
    }

    // 2. Restore Expense Categories
    if (Array.isArray(rawData.expenseCategories) && rawData.expenseCategories.length > 0) {
      for (const cat of rawData.expenseCategories) {
        if (!cat.name) continue
        await tx.expenseCategory.upsert({
          where: { name: cat.name },
          create: {
            id: cat.id || undefined,
            name: cat.name,
            createdAt: cat.createdAt ? new Date(cat.createdAt) : new Date()
          },
          update: {}
        })
      }
    }

    // 3. Restore Accounting Years
    if (Array.isArray(rawData.accountingYears) && rawData.accountingYears.length > 0) {
      for (const yr of rawData.accountingYears) {
        if (!yr.name || !yr.startDate || !yr.endDate) continue
        await tx.accountingYear.upsert({
          where: { name: yr.name },
          create: {
            id: yr.id || undefined,
            name: yr.name,
            startDate: new Date(yr.startDate),
            endDate: new Date(yr.endDate),
            openingBalance: new Prisma.Decimal(yr.openingBalance || 0),
            openingBankBalance: new Prisma.Decimal(yr.openingBankBalance || 0),
            notes: yr.notes || '',
            status: yr.status === 'inactive' ? 'inactive' : 'active',
            createdAt: yr.createdAt ? new Date(yr.createdAt) : new Date()
          },
          update: {
            startDate: new Date(yr.startDate),
            endDate: new Date(yr.endDate),
            openingBalance: new Prisma.Decimal(yr.openingBalance || 0),
            openingBankBalance: new Prisma.Decimal(yr.openingBankBalance || 0),
            notes: yr.notes || '',
            status: yr.status === 'inactive' ? 'inactive' : 'active'
          }
        })
      }
    }

    // 4. Restore Users (preserve existing admin passwords if passwordHash is missing)
    if (Array.isArray(rawData.users) && rawData.users.length > 0) {
      for (const u of rawData.users) {
        if (!u.username || !u.email) continue
        await tx.user.upsert({
          where: { username: u.username },
          create: {
            id: u.id || undefined,
            name: u.name || u.username,
            username: u.username,
            passwordHash: u.passwordHash || '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // default hash if empty
            role: ['admin', 'manager', 'employee'].includes(u.role) ? u.role : 'employee',
            email: u.email,
            status: u.status === 'inactive' ? 'inactive' : 'active',
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
          },
          update: {
            name: u.name || u.username,
            role: ['admin', 'manager', 'employee'].includes(u.role) ? u.role : 'employee',
            email: u.email,
            status: u.status === 'inactive' ? 'inactive' : 'active'
          }
        })
      }
    }

    // 5. Restore Parties
    if (Array.isArray(rawData.parties) && rawData.parties.length > 0) {
      for (const p of rawData.parties) {
        if (!p.name) continue
        const partyId = p.id || undefined
        if (partyId) {
          await tx.party.upsert({
            where: { id: partyId },
            create: {
              id: partyId,
              name: p.name,
              category: p.category || 'General',
              contactPerson: p.contactPerson || '',
              mobile: p.mobile || '',
              email: p.email || '',
              gst: p.gst || '',
              address: p.address || '',
              notes: p.notes || '',
              status: p.status === 'inactive' ? 'inactive' : 'active',
              createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
            },
            update: {
              name: p.name,
              category: p.category || 'General',
              contactPerson: p.contactPerson || '',
              mobile: p.mobile || '',
              email: p.email || '',
              gst: p.gst || '',
              address: p.address || '',
              notes: p.notes || '',
              status: p.status === 'inactive' ? 'inactive' : 'active'
            }
          })
        } else {
          await tx.party.create({
            data: {
              name: p.name,
              category: p.category || 'General',
              contactPerson: p.contactPerson || '',
              mobile: p.mobile || '',
              email: p.email || '',
              gst: p.gst || '',
              address: p.address || '',
              notes: p.notes || '',
              status: p.status === 'inactive' ? 'inactive' : 'active',
              createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
            }
          })
        }
      }
    }

    // 6. Restore Transactions
    if (Array.isArray(rawData.transactions) && rawData.transactions.length > 0) {
      for (const t of rawData.transactions) {
        if (!t.voucherNo || !t.amount) continue
        
        // Find or link partyId
        let linkedPartyId = t.partyId || null
        if (!linkedPartyId && t.partyName) {
          const matchedParty = await tx.party.findFirst({ where: { name: t.partyName } })
          if (matchedParty) linkedPartyId = matchedParty.id
        }

        // Verify party exists if partyId is set
        if (linkedPartyId) {
          const partyExists = await tx.party.findUnique({ where: { id: linkedPartyId } })
          if (!partyExists) linkedPartyId = null
        }

        await tx.transaction.upsert({
          where: { voucherNo: t.voucherNo },
          create: {
            id: t.id || undefined,
            voucherNo: t.voucherNo,
            date: new Date(t.date),
            type: ['income', 'expense', 'transfer', 'adjustment'].includes(t.type) ? t.type : 'expense',
            partyId: linkedPartyId,
            category: t.category || '',
            amount: new Prisma.Decimal(t.amount),
            paymentMode: ['cash', 'bank', 'upi', 'cheque'].includes(t.paymentMode) ? t.paymentMode : 'cash',
            description: t.description || '',
            createdBy: t.createdBy || currentUserName,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date()
          },
          update: {
            date: new Date(t.date),
            type: ['income', 'expense', 'transfer', 'adjustment'].includes(t.type) ? t.type : 'expense',
            partyId: linkedPartyId,
            category: t.category || '',
            amount: new Prisma.Decimal(t.amount),
            paymentMode: ['cash', 'bank', 'upi', 'cheque'].includes(t.paymentMode) ? t.paymentMode : 'cash',
            description: t.description || '',
            createdBy: t.createdBy || currentUserName
          }
        })
      }
    }

    // 7. Add Audit Log for this Restore Action
    await tx.auditLog.create({
      data: {
        userName: currentUserName,
        action: 'RESTORE_EXCEL',
        entity: 'System Backup',
        details: `Restored database from password-protected Excel backup (${rawData.parties?.length || 0} parties, ${rawData.transactions?.length || 0} transactions, ${rawData.accountingYears?.length || 0} years)`
      }
    })
  }, {
    timeout: 30000 // Allow up to 30 seconds for complete database restoration
  })

  // Return fresh snapshot
  return getAllBackupData()
}
