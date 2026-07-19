import type { User, Party, Transaction, CashBook, AuditLog, CompanySettings } from '../types'

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const SEED_USERS: User[] = [
  { id: 'u1', name: 'ધર્મિક પંડ્યા', username: 'admin', role: 'admin', email: 'dharmik@jikadara.com', status: 'active', createdAt: '2026-01-01' },
  { id: 'u2', name: 'રવિ જીકાડારા', username: 'ravi', role: 'manager', email: 'ravi@jikadara.com', status: 'active', createdAt: '2026-01-05' },
  { id: 'u3', name: 'નેહા શાહ', username: 'neha', role: 'employee', email: 'neha@jikadara.com', status: 'active', createdAt: '2026-02-10' },
  { id: 'u4', name: 'કિરણ પટેલ', username: 'kiran', role: 'employee', email: 'kiran@jikadara.com', status: 'inactive', createdAt: '2026-03-01' },
]

export const SEED_PARTIES: Party[] = [
  { id: 'p1', name: 'રાધા ટ્રાવેલ્સ', category: 'ટ્રાવેલ', contactPerson: 'સુરેશ પટેલ', mobile: '9876543210', email: 'radha@travels.com', gst: '24AABCU9603R1ZX', address: 'સુરત, ગુજરાત', notes: 'નિયમિત ગ્રાહક', status: 'active', balance: 45000, createdAt: '2026-01-10' },
  { id: 'p2', name: 'હોટલ ગ્રાન્ડ', category: 'હોટલ', contactPerson: 'અમિત મહેતા', mobile: '9898765432', email: 'grand@hotel.com', gst: '24AABCU9603R1ZY', address: 'અમદાવાદ, ગુજરાત', notes: '', status: 'active', balance: -12000, createdAt: '2026-01-15' },
  { id: 'p3', name: 'ક્વિક વિઝા સર્વિસ', category: 'વિઝા', contactPerson: 'પ્રીતિ દેસાઈ', mobile: '9765432109', email: 'quick@visa.com', gst: '24AABCU9603R1ZZ', address: 'વડોદરા, ગુજરાત', notes: 'US/UK વિઝા નિષ્ણાત', status: 'active', balance: 85000, createdAt: '2026-01-20' },
  { id: 'p4', name: 'ફાસ્ટ લોજિસ્ટિક', category: 'લોજિસ્ટિક', contactPerson: 'વિજય ચૌધરી', mobile: '9654321098', email: 'fast@logistics.com', gst: '24AABCU9603R1ZA', address: 'રાજકોટ, ગુજરાત', notes: '', status: 'active', balance: 23000, createdAt: '2026-02-01' },
  { id: 'p5', name: 'સ્ટેટ બેંક ઓફ ઇન્ડિયા', category: 'બેંક', contactPerson: 'N/A', mobile: '1800112211', email: 'sbi@bank.com', gst: '', address: 'સ્ટેટ બ્રાન્ચ, ગુજરાત', notes: 'ચાલુ ખાતું: 123456789', status: 'active', balance: 320000, createdAt: '2026-01-01' },
  { id: 'p6', name: 'ડ્રીમ ટૂર્સ', category: 'ટ્રાવેલ', contactPerson: 'ભૂમિ પંડ્યા', mobile: '9543210987', email: 'dream@tours.com', gst: '24AABCU9603R1ZB', address: 'ભાવનગર, ગુજરાત', notes: '', status: 'inactive', balance: 5000, createdAt: '2026-02-15' },
]

export const SEED_TRANSACTIONS: Transaction[] = [
  { id: 't1', voucherNo: 'INC-001', date: '2026-07-13', type: 'income', partyId: 'p1', partyName: 'રાધા ટ્રાવેલ્સ', category: 'ટ્રાવેલ', amount: 75000, paymentMode: 'bank', description: 'દુબઈ ટૂર પેકેજ', createdBy: 'ધર્મિક પંડ્યા', createdAt: '2026-07-13 09:15 AM' },
  { id: 't2', voucherNo: 'EXP-001', date: '2026-07-13', type: 'expense', partyId: 'p2', partyName: 'હોટલ ગ્રાન્ડ', category: 'હોટલ', amount: 18000, paymentMode: 'bank', description: 'ગ્રૂપ ટૂર - હોટલ ચાર્જ', createdBy: 'ધર્મિક પંડ્યા', createdAt: '2026-07-13 10:30 AM' },
  { id: 't3', voucherNo: 'INC-002', date: '2026-07-12', type: 'income', partyId: 'p3', partyName: 'ક્વિક વિઝા સર્વિસ', category: 'વિઝા', amount: 45000, paymentMode: 'upi', description: 'US વિઝા - 5 અરજી', createdBy: 'રવિ જીકાડારા', createdAt: '2026-07-12 11:00 AM' },
  { id: 't4', voucherNo: 'EXP-002', date: '2026-07-12', type: 'expense', partyId: 'u2', partyName: 'સ્ટાફ', category: 'પગાર', amount: 35000, paymentMode: 'bank', description: 'જુલાઈ પગાર', createdBy: 'ધર્મિક પંડ્યા', createdAt: '2026-07-12 02:00 PM' },
  { id: 't5', voucherNo: 'INC-003', date: '2026-07-11', type: 'income', partyId: 'p4', partyName: 'ફાસ્ટ લોજિસ્ટિક', category: 'લોજિસ્ટિક', amount: 28000, paymentMode: 'cheque', description: 'કાર્ગો ડિલિવરી ચાર્જ', createdBy: 'નેહા શાહ', createdAt: '2026-07-11 03:30 PM' },
  { id: 't6', voucherNo: 'EXP-003', date: '2026-07-11', type: 'expense', partyId: 'p1', partyName: 'ઓફિસ', category: 'ઓફિસ ખર્ચ', amount: 4500, paymentMode: 'cash', description: 'સ્ટેશનરી અને પ્રિન્ટ', createdBy: 'નેહા શાહ', createdAt: '2026-07-11 04:15 PM' },
  { id: 't7', voucherNo: 'INC-004', date: '2026-07-10', type: 'income', partyId: 'p1', partyName: 'રાધા ટ્રાવેલ્સ', category: 'ટ્રાવેલ', amount: 55000, paymentMode: 'bank', description: 'ગ્રૂપ ટ્રિપ - 10 પ્રવાસી', createdBy: 'ધર્મિક પંડ્યા', createdAt: '2026-07-10 09:00 AM' },
  { id: 't8', voucherNo: 'EXP-004', date: '2026-07-10', type: 'expense', partyId: 'p2', partyName: 'હોટલ ગ્રાન્ડ', category: 'હોટલ', amount: 22000, paymentMode: 'bank', description: 'બિઝનેસ ટ્રિપ - 2 રૂમ', createdBy: 'રવિ જીકાડારા', createdAt: '2026-07-10 01:00 PM' },
  { id: 't9', voucherNo: 'INC-005', date: '2026-07-09', type: 'income', partyId: 'p3', partyName: 'ક્વિક વિઝા સર્વિસ', category: 'વિઝા', amount: 32000, paymentMode: 'upi', description: 'UK વિઝા - 4 અરજી', createdBy: 'ધર્મિક પંડ્યા', createdAt: '2026-07-09 10:30 AM' },
  { id: 't10', voucherNo: 'EXP-005', date: '2026-07-09', type: 'expense', partyId: 'p1', partyName: 'ઇ-ઓફિસ', category: 'ઇન્ટરનેટ', amount: 2500, paymentMode: 'upi', description: 'માસિક ઇન્ટરનેટ બિલ', createdBy: 'નેહા શાહ', createdAt: '2026-07-09 11:00 AM' },
  { id: 't11', voucherNo: 'INC-006', date: '2026-07-08', type: 'income', partyId: 'p4', partyName: 'ફાસ્ટ લોજિસ્ટિક', category: 'લોજિસ્ટિક', amount: 18500, paymentMode: 'cheque', description: 'ડ્રાય કાર્ગો - ૫ ટ્રક', createdBy: 'ધર્મિક પંડ્યા', createdAt: '2026-07-08 10:00 AM' },
  { id: 't12', voucherNo: 'EXP-006', date: '2026-07-08', type: 'expense', partyId: 'p2', partyName: 'હોટલ ગ્રાન્ડ', category: 'હોટલ', amount: 8000, paymentMode: 'cash', description: 'ક્લાઇન્ટ ડિનર', createdBy: 'રવિ જીકાડારા', createdAt: '2026-07-08 08:00 PM' },
  { id: 't13', voucherNo: 'EXP-007', date: '2026-07-07', type: 'expense', partyId: '', partyName: 'ઓફિસ', category: 'ભાડું', amount: 25000, paymentMode: 'bank', description: 'ઓફિસ ભાડું - જુલાઈ', createdBy: 'ધર્મિक પંડ્યા', createdAt: '2026-07-07 09:00 AM' },
  { id: 't14', voucherNo: 'INC-007', date: '2026-07-07', type: 'income', partyId: 'p3', partyName: 'ક્વિક વિઝા સર્વિસ', category: 'વિઝા', amount: 60000, paymentMode: 'bank', description: 'Schengen વિઝા - 8 અરજી', createdBy: 'ધર્મિક પંડ્યા', createdAt: '2026-07-07 11:00 AM' },
  { id: 't15', voucherNo: 'EXP-008', date: '2026-07-06', type: 'expense', partyId: '', partyName: 'ઓફિસ', category: 'વીજળી', amount: 3200, paymentMode: 'upi', description: 'વીજળી બિલ - જૂન', createdBy: 'નેહા શાહ', createdAt: '2026-07-06 03:00 PM' },
]

export const SEED_CASH_BOOK: CashBook[] = [
  { id: 'cb1', date: '2026-07-13', openingBalance: 85000, totalIncome: 75000, totalExpense: 18000, closingBalance: 142000, notes: '', status: 'open' },
  { id: 'cb2', date: '2026-07-12', openingBalance: 95000, totalIncome: 45000, totalExpense: 55000, closingBalance: 85000, notes: 'પગાર + આવક', status: 'closed' },
  { id: 'cb3', date: '2026-07-11', openingBalance: 72000, totalIncome: 28000, totalExpense: 5000, closingBalance: 95000, notes: '', status: 'closed' },
  { id: 'cb4', date: '2026-07-10', openingBalance: 39000, totalIncome: 55000, totalExpense: 22000, closingBalance: 72000, notes: 'ગ્રૂપ ટ્રિપ', status: 'closed' },
  { id: 'cb5', date: '2026-07-09', openingBalance: 10000, totalIncome: 32000, totalExpense: 3000, closingBalance: 39000, notes: '', status: 'closed' },
]

export const SEED_AUDIT_LOGS: AuditLog[] = [
  { id: 'al1', user: 'ધર્મિক પંડ્યા', action: 'ઉમેર્યો', entity: 'આવક', details: 'INC-001 - ₹75,000 - રાધા ટ્રાવેલ્સ', timestamp: '2026-07-13 09:15 AM', entityId: 't1' },
  { id: 'al2', user: 'ધર્મિક પંડ્યા', action: 'ઉમેર્યો', entity: 'ખર્ચ', details: 'EXP-001 - ₹18,000 - હોટલ ગ્રાન્ડ', timestamp: '2026-07-13 10:30 AM', entityId: 't2' },
  { id: 'al3', user: 'રવિ જીકાડારા', action: 'ઉમેર્યો', entity: 'આવક', details: 'INC-002 - ₹45,000 - ક્વિક વિઝા', timestamp: '2026-07-12 11:00 AM', entityId: 't3' },
  { id: 'al4', user: 'ધર્મિક પંડ્યા', action: 'સુધાર્યો', entity: 'પાર્ટી', details: 'ડ્રીમ ટૂર્સ - સ્ટેટસ: inactive', timestamp: '2026-07-12 12:00 PM' },
  { id: 'al5', user: 'નેહા શાહ', action: 'ઉમેર્યો', entity: 'આવક', details: 'INC-003 - ₹28,000 - ફાસ્ટ લોજિસ્ટિક', timestamp: '2026-07-11 03:30 PM', entityId: 't5' },
]

export const DEFAULT_SETTINGS: CompanySettings = {
  name: 'Jikadara & Pandav Associates',
  gst: '24AABCJ1234R1Z5',
  address: 'ઓફ. 201, બિઝ઼ ઝોન, સુરત - 395001, ગુજરાત',
  phone: '+91 98765 43210',
  email: 'info@jikadara.com',
  currency: 'INR',
  dateFormat: 'DD/MM/YYYY',
  language: 'gu',
  lastBackup: '',
  expenseCategories: 'Travel, Visa, Ticket, Hotel, Logistic, Consulting, Other',
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = ['પગાર', 'હોટલ', 'ટ્રાવેલ', 'વિઝા', 'માર્કેટિંગ', 'ઓફિસ ખર્ચ', 'ભાડું', 'વીજળી', 'ઇન્ટરનેટ', 'અન્ય']
export const PARTY_CATEGORIES = ['ગ્રાહક', 'સપ્લાયર', 'હોટલ', 'વિઝા', 'ટિકિટ', 'લોજિસ્ટિક', 'બેંક', 'કર્મચારી', 'ટ્રાવેલ', 'અન્ય']
export const PAYMENT_MODES = [
  { value: 'cash', label: 'રોકડ' },
  { value: 'bank', label: 'બેંક ટ્રાન્સફર' },
  { value: 'upi', label: 'યુ.પી.આઈ' },
  { value: 'cheque', label: 'ચેક' },
]
export const INCOME_CATEGORIES = ['ટ્રાવેલ', 'વિઝા', 'ટિકિટ', 'હોટલ', 'લોજિસ્ટિક', 'કન્સ્લ્ટિંગ', 'અન્ય']

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('gu-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function nowStr(): string {
  return new Date().toLocaleString('en-IN', { hour12: true, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
