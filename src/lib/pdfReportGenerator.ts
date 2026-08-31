import type { CompanySettings, AccountingYear, Transaction, Party, User } from '../types'
import { formatCurrency } from '../data/mockData'

export interface ReportKPICard {
  label: string
  value: string
  color?: string // text color, e.g. '#15803d', '#b91c1c', '#1d4ed8'
  bgColor?: string // background, e.g. '#f0fdf4', '#fef2f2', '#eff6ff'
  borderColor?: string
}

export interface ReportTableColumn {
  header: string
  align?: 'left' | 'center' | 'right'
  width?: string
}

export interface ReportTableSection {
  title: string
  badge?: string
  columns: ReportTableColumn[]
  rows: (string | number | React.ReactNode)[][]
  summaryRow?: (string | number)[]
  emptyMessage?: string
}

export interface PDFReportOptions {
  title: string
  subtitle?: string
  period?: string
  settings?: CompanySettings
  year?: AccountingYear
  cards?: ReportKPICard[]
  sections: ReportTableSection[]
  isGu?: boolean
}

/**
 * Generate and print/download a high-quality PDF Report
 */
export function printPDFReport(options: PDFReportOptions) {
  const {
    title,
    subtitle,
    period,
    settings,
    year,
    cards = [],
    sections = [],
    isGu = false
  } = options

  const companyName = settings?.name || 'GOPINATHJI GEMS'
  const companyPhone = settings?.phone || ''
  const companyGst = settings?.gst ? `GSTIN: ${settings.gst}` : ''
  const companyEmail = settings?.email || ''
  const companyAddress = settings?.address || ''
  const reportPeriod = period || (year ? year.name : '')

  const now = new Date()
  const generatedDateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  const generatedTimeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
  const timestampStr = `${generatedDateStr}, ${generatedTimeStr}`

  // Build Cards HTML
  let cardsHtml = ''
  if (cards.length > 0) {
    const gridCols = cards.length === 1 ? '1fr' : cards.length === 2 ? '1fr 1fr' : cards.length === 3 ? '1fr 1fr 1fr' : 'repeat(4, 1fr)'
    cardsHtml = `
      <div style="display: grid; grid-template-columns: ${gridCols}; gap: 14px; margin-bottom: 22px;">
        ${cards.map(c => `
          <div style="
            background: ${c.bgColor || '#f8fafc'};
            border: 1.5px solid ${c.borderColor || '#e2e8f0'};
            border-radius: 10px;
            padding: 12px 16px;
            box-sizing: border-box;
          ">
            <div style="
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: ${c.color || '#475569'};
              margin-bottom: 4px;
            ">
              ${escapeHtml(c.label)}
            </div>
            <div style="
              font-size: 20px;
              font-weight: 800;
              color: ${c.color || '#0f172a'};
            ">
              ${escapeHtml(c.value)}
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  // Build Sections Tables HTML
  let sectionsHtml = ''
  sections.forEach((sec, sIdx) => {
    let rowsHtml = ''
    if (sec.rows.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="${sec.columns.length}" style="text-align: center; padding: 24px; color: #94a3b8; font-size: 13px;">
            ${escapeHtml(sec.emptyMessage || (isGu ? 'કોઈ રેકોર્ડ મળ્યા નથી' : 'No records found for this period.'))}
          </td>
        </tr>
      `
    } else {
      rowsHtml = sec.rows.map((row, rIdx) => {
        const bg = rIdx % 2 === 1 ? '#fafafa' : '#ffffff'
        return `
          <tr style="background: ${bg}; border-bottom: 1px solid #f1f5f9;">
            ${row.map((cell, cIdx) => {
              const col = sec.columns[cIdx]
              const align = col?.align || 'left'
              const valStr = cell === null || cell === undefined ? '' : String(cell)
              const isAmount = valStr.startsWith('₹') || valStr.startsWith('+₹') || valStr.startsWith('-₹')
              const isPositive = valStr.startsWith('+')
              const isNegative = valStr.startsWith('-')
              const color = isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#1e293b'
              const fontW = isAmount || cIdx === 1 ? '600' : 'normal'

              return `
                <td style="
                  padding: 8px 10px;
                  font-size: 12px;
                  text-align: ${align};
                  color: ${color};
                  font-weight: ${fontW};
                  vertical-align: middle;
                ">
                  ${escapeHtml(valStr)}
                </td>
              `
            }).join('')}
          </tr>
        `
      }).join('')
    }

    let summaryHtml = ''
    if (sec.summaryRow && sec.summaryRow.length > 0) {
      summaryHtml = `
        <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 700;">
          ${sec.summaryRow.map((cell, cIdx) => {
            const col = sec.columns[cIdx]
            const align = col?.align || 'left'
            const valStr = cell === null || cell === undefined ? '' : String(cell)
            return `
              <td style="
                padding: 10px;
                font-size: 12px;
                text-align: ${align};
                color: #0f172a;
                font-weight: 800;
              ">
                ${escapeHtml(valStr)}
              </td>
            `
          }).join('')}
        </tr>
      `
    }

    sectionsHtml += `
      <div style="margin-bottom: 24px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #1e293b;">
            ${escapeHtml(sec.title)}
          </h3>
          ${sec.badge ? `
            <span style="
              font-size: 11px;
              font-weight: 700;
              color: #475569;
              background: #f1f5f9;
              padding: 2px 8px;
              border-radius: 6px;
            ">
              ${escapeHtml(sec.badge)}
            </span>
          ` : ''}
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
              ${sec.columns.map(col => `
                <th style="
                  padding: 8px 10px;
                  font-size: 11px;
                  font-weight: 700;
                  text-align: ${col.align || 'left'};
                  color: #334155;
                  text-transform: uppercase;
                  letter-spacing: 0.04em;
                  width: ${col.width || 'auto'};
                ">
                  ${escapeHtml(col.header)}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${summaryHtml}
          </tbody>
        </table>
      </div>
    `
  })

  // Full HTML Template
  const printHtml = `
<!DOCTYPE html>
<html lang="${isGu ? 'gu' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} - ${escapeHtml(companyName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+Gujarati:wght@400;500;600;700;800&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Plus Jakarta Sans', 'Noto Sans Gujarati', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }

    .report-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }

    .header-table td {
      vertical-align: middle;
    }

    .divider {
      height: 2.5px;
      background: #0f172a;
      margin-bottom: 18px;
    }

    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #64748b;
    }

    @media print {
      body {
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="width: 60%; vertical-align: top;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="/logoOne.png" alt="Logo" style="width: 48px; height: 48px; object-fit: contain;" onerror="this.src='/logoTwo.png'; this.onerror=null;" />
            <div>
              <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; text-transform: uppercase;">
                ${escapeHtml(companyName)}
              </h1>
              <div style="font-size: 11px; color: #475569; font-weight: 600; margin-top: 2px;">
                ${escapeHtml(subtitle || (isGu ? 'હીરા વ્યવસાય અને નાણાકીય હિસાબ' : 'Diamonds & Gems Accounting'))}
              </div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                ${companyGst ? `<span>${escapeHtml(companyGst)}</span> &nbsp;•&nbsp; ` : ''}
                ${companyPhone ? `<span>📞 ${escapeHtml(companyPhone)}</span>` : ''}
                ${companyEmail ? ` &nbsp;•&nbsp; <span>✉️ ${escapeHtml(companyEmail)}</span>` : ''}
              </div>
              ${companyAddress ? `<div style="font-size: 10px; color: #64748b; margin-top: 1px;">📍 ${escapeHtml(companyAddress)}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="width: 40%; text-align: right; vertical-align: top;">
          <div style="font-size: 16px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.02em;">
            ${escapeHtml(title)}
          </div>
          ${reportPeriod ? `
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">
              ${escapeHtml(reportPeriod)}
            </div>
          ` : ''}
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
            ${isGu ? 'તારીખ' : 'Generated'}: ${escapeHtml(timestampStr)}
          </div>
        </td>
      </tr>
    </table>

    <div class="divider"></div>

    <!-- KPI Cards -->
    ${cardsHtml}

    <!-- Tables -->
    ${sectionsHtml}

    <!-- Footer -->
    <div class="footer">
      <div>
        ◆ <strong>${escapeHtml(companyName)}</strong> &nbsp;•&nbsp; ${isGu ? 'ગોપનીય વ્યાપારી દસ્તાવેજ' : 'Confidential Business Document'}
      </div>
      <div>
        ${isGu ? 'કમ્પ્યુટર જનરેટેડ રિપોર્ટ' : 'Computer Generated Report'}
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>
  `

  // Use a hidden iframe for seamless, high quality printing
  let iframe = document.getElementById('pdf-print-iframe') as HTMLIFrameElement
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = 'pdf-print-iframe'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
  }

  const doc = iframe.contentWindow?.document
  if (doc) {
    doc.open()
    doc.write(printHtml)
    doc.close()
  }
}

function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ─────────────────────────────────────────────────────────────────────────────
// Specific Page PDF Generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Transactions PDF
 */
export function exportTransactionsPDF(
  transactions: Transaction[],
  settings: CompanySettings,
  year?: AccountingYear,
  isGu: boolean = false
) {
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netBalance = totalIncome - totalExpense

  const rows = transactions.map((t, idx) => [
    idx + 1,
    t.date,
    t.voucherNo,
    t.type === 'income' ? (isGu ? 'આવક' : 'Income') : (isGu ? 'ખર્ચ' : 'Expense'),
    t.partyName || '—',
    t.category || '—',
    t.paymentMode.toUpperCase(),
    t.description || '—',
    `${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}`
  ])

  printPDFReport({
    title: isGu ? 'વ્યવહાર પત્રક' : 'TRANSACTIONS REPORT',
    subtitle: isGu ? 'સંપૂર્ણ દૈનિક વ્યવહારો અને હિસાબ' : 'Complete Daily Transactions & Vouchers',
    period: year ? year.name : undefined,
    settings,
    year,
    isGu,
    cards: [
      {
        label: isGu ? 'કુલ આવક' : 'TOTAL INCOME',
        value: `+${formatCurrency(totalIncome)}`,
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0'
      },
      {
        label: isGu ? 'કુલ ખર્ચ' : 'TOTAL EXPENSE',
        value: `-${formatCurrency(totalExpense)}`,
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fecaca'
      },
      {
        label: isGu ? 'ચોખ્ખો નફો / સરવૈયું' : 'FINAL NET PROFIT',
        value: formatCurrency(netBalance),
        color: netBalance >= 0 ? '#1d4ed8' : '#b91c1c',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      }
    ],
    sections: [
      {
        title: isGu ? 'વ્યવહારોની યાદી' : 'Transactions List',
        badge: `${transactions.length} ${isGu ? 'નોંધ' : 'Records'}`,
        columns: [
          { header: 'Sr.', width: '35px', align: 'center' },
          { header: isGu ? 'તારીખ' : 'Date', width: '80px' },
          { header: isGu ? 'વાઉચર નં' : 'Voucher No', width: '85px' },
          { header: isGu ? 'પ્રકાર' : 'Type', width: '65px' },
          { header: isGu ? 'પાર્ટીનું નામ' : 'Party Name' },
          { header: isGu ? 'શ્રેણી' : 'Category' },
          { header: isGu ? 'ચુકવણી' : 'Payment', width: '65px' },
          { header: isGu ? 'વિગત' : 'Description' },
          { header: isGu ? 'રકમ' : 'Amount', width: '90px', align: 'right' }
        ],
        rows,
        summaryRow: [
          '',
          isGu ? 'કુલ સરવાળો' : 'TOTAL',
          '',
          '',
          '',
          '',
          '',
          '',
          formatCurrency(netBalance)
        ]
      }
    ]
  })
}

/**
 * 2. Income PDF
 */
export function exportIncomePDF(
  transactions: Transaction[],
  settings: CompanySettings,
  year?: AccountingYear,
  isGu: boolean = false
) {
  const incomeTxns = transactions.filter(t => t.type === 'income')
  const totalIncome = incomeTxns.reduce((s, t) => s + t.amount, 0)
  const cashIncome = incomeTxns.filter(t => t.paymentMode === 'cash').reduce((s, t) => s + t.amount, 0)
  const bankIncome = incomeTxns.filter(t => t.paymentMode !== 'cash').reduce((s, t) => s + t.amount, 0)

  const rows = incomeTxns.map((t, idx) => [
    idx + 1,
    t.date,
    t.voucherNo,
    t.partyName || '—',
    t.category || '—',
    t.paymentMode.toUpperCase(),
    t.description || '—',
    `+${formatCurrency(t.amount)}`
  ])

  printPDFReport({
    title: isGu ? 'આવક રિપોર્ટ' : 'INCOME REPORT',
    subtitle: isGu ? 'જમા વ્યવહારો અને આવક વિગતો' : 'Credit Transactions & Income Statement',
    period: year ? year.name : undefined,
    settings,
    year,
    isGu,
    cards: [
      {
        label: isGu ? 'કુલ આવક' : 'TOTAL INCOME',
        value: `+${formatCurrency(totalIncome)}`,
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0'
      },
      {
        label: isGu ? 'રોકડ આવક' : 'CASH INCOME',
        value: formatCurrency(cashIncome),
        color: '#16a34a',
        bgColor: '#f8fafc',
        borderColor: '#e2e8f0'
      },
      {
        label: isGu ? 'બેંક / ઓનલાઇન આવક' : 'BANK / ONLINE INCOME',
        value: formatCurrency(bankIncome),
        color: '#2563eb',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      }
    ],
    sections: [
      {
        title: isGu ? 'આવક નોંધ યાદી' : 'Income Records',
        badge: `${incomeTxns.length} ${isGu ? 'આવક' : 'Income Tasks'}`,
        columns: [
          { header: 'Sr.', width: '35px', align: 'center' },
          { header: isGu ? 'તારીખ' : 'Date', width: '85px' },
          { header: isGu ? 'વાઉચર નં' : 'Voucher No', width: '90px' },
          { header: isGu ? 'પાર્ટીનું નામ' : 'Party / Client' },
          { header: isGu ? 'શ્રેણી' : 'Category' },
          { header: isGu ? 'ચુકવણી' : 'Payment', width: '70px' },
          { header: isGu ? 'વિગત / સંદર્ભ' : 'Description / Reference' },
          { header: isGu ? 'ચોખ્ખી આવક' : 'Net Income', width: '95px', align: 'right' }
        ],
        rows,
        summaryRow: [
          '',
          isGu ? 'કુલ આવક સરવાળો' : 'TOTAL INCOME',
          '',
          '',
          '',
          '',
          '',
          `+${formatCurrency(totalIncome)}`
        ]
      }
    ]
  })
}

/**
 * 3. Expense PDF
 */
export function exportExpensePDF(
  transactions: Transaction[],
  settings: CompanySettings,
  year?: AccountingYear,
  isGu: boolean = false
) {
  const expenseTxns = transactions.filter(t => t.type === 'expense')
  const totalExpense = expenseTxns.reduce((s, t) => s + t.amount, 0)
  const cashExpense = expenseTxns.filter(t => t.paymentMode === 'cash').reduce((s, t) => s + t.amount, 0)
  const bankExpense = expenseTxns.filter(t => t.paymentMode !== 'cash').reduce((s, t) => s + t.amount, 0)

  const rows = expenseTxns.map((t, idx) => [
    idx + 1,
    t.date,
    t.voucherNo,
    t.partyName || '—',
    t.category || 'General',
    t.paymentMode.toUpperCase(),
    t.description || '—',
    `-${formatCurrency(t.amount)}`
  ])

  printPDFReport({
    title: isGu ? 'ખર્ચ રિપોર્ટ' : 'EXPENSE REPORT',
    subtitle: isGu ? 'ઉધાર વ્યવહારો અને સામાન્ય ખર્ચાઓ' : 'Debit Transactions & General Expenses',
    period: year ? year.name : undefined,
    settings,
    year,
    isGu,
    cards: [
      {
        label: isGu ? 'કુલ ખર્ચ' : 'TOTAL EXPENSE',
        value: `-${formatCurrency(totalExpense)}`,
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fecaca'
      },
      {
        label: isGu ? 'રોકડ ખર્ચ' : 'CASH EXPENSE',
        value: formatCurrency(cashExpense),
        color: '#ea580c',
        bgColor: '#fff7ed',
        borderColor: '#fed7aa'
      },
      {
        label: isGu ? 'બેંક ખર્ચ' : 'BANK EXPENSE',
        value: formatCurrency(bankExpense),
        color: '#2563eb',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      }
    ],
    sections: [
      {
        title: isGu ? 'સામાન્ય ખર્ચ યાદી' : 'General Expenses List',
        badge: `${expenseTxns.length} ${isGu ? 'ખર્ચાઓ' : 'Expenses'}`,
        columns: [
          { header: 'Sr.', width: '35px', align: 'center' },
          { header: isGu ? 'તારીખ' : 'Date', width: '85px' },
          { header: isGu ? 'વાઉચર નં' : 'Voucher No', width: '90px' },
          { header: isGu ? 'પાર્ટી / વેપારી' : 'Party / Vendor' },
          { header: isGu ? 'ખર્ચ શ્રેણી' : 'Category' },
          { header: isGu ? 'ચુકવણી' : 'Payment', width: '70px' },
          { header: isGu ? 'વિગત' : 'Description' },
          { header: isGu ? 'ખર્ચ રકમ' : 'Amount', width: '95px', align: 'right' }
        ],
        rows,
        summaryRow: [
          '',
          isGu ? 'કુલ ખર્ચ સરવાળો' : 'TOTAL EXPENSES',
          '',
          '',
          '',
          '',
          '',
          `-${formatCurrency(totalExpense)}`
        ]
      }
    ]
  })
}

/**
 * 4. Parties Directory & Balances PDF
 */
export function exportPartiesPDF(
  parties: Party[],
  transactions: Transaction[],
  settings: CompanySettings,
  isGu: boolean = false
) {
  let totalReceivable = 0
  let totalPayable = 0

  const rows = parties.map((p, idx) => {
    const partyTxns = transactions.filter(t => t.partyId === p.id || t.partyName === p.name)
    const inc = partyTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const exp = partyTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const bal = inc - exp

    if (bal > 0) totalReceivable += bal
    if (bal < 0) totalPayable += Math.abs(bal)

    const statusText = bal > 0 ? (isGu ? 'લેવાના' : 'Receivable') : bal < 0 ? (isGu ? 'આપવાના' : 'Payable') : (isGu ? 'ચૂકતે' : 'Settled')
    const balFormatted = bal > 0 ? `+${formatCurrency(bal)}` : bal < 0 ? `-${formatCurrency(Math.abs(bal))}` : '₹0'

    return [
      idx + 1,
      p.name,
      p.category || 'General',
      p.mobile || '—',
      p.contactPerson || '—',
      p.gst || '—',
      p.status === 'active' ? (isGu ? 'સક્રિય' : 'Active') : (isGu ? 'નિષ્ક્રિય' : 'Inactive'),
      statusText,
      balFormatted
    ]
  })

  printPDFReport({
    title: isGu ? 'પાર્ટી લેજર ડિરેક્ટરી' : 'PARTIES DIRECTORY & BALANCES',
    subtitle: isGu ? 'તમામ રજિસ્ટર્ડ પાર્ટીઓ અને વર્તમાન હિસાબી બાકી' : 'All Registered Parties & Outstanding Balances',
    settings,
    isGu,
    cards: [
      {
        label: isGu ? 'કુલ લેવાના (Receivable)' : 'TOTAL RECEIVABLES',
        value: `+${formatCurrency(totalReceivable)}`,
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0'
      },
      {
        label: isGu ? 'કુલ આપવાના (Payable)' : 'TOTAL PAYABLES',
        value: `-${formatCurrency(totalPayable)}`,
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fecaca'
      },
      {
        label: isGu ? 'કુલ પાર્ટીઓ' : 'REGISTERED PARTIES',
        value: `${parties.length}`,
        color: '#1d4ed8',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      }
    ],
    sections: [
      {
        title: isGu ? 'પાર્ટીઓની વિગતવાર યાદી' : 'Parties Directory',
        badge: `${parties.length} ${isGu ? 'પાર્ટીઓ' : 'Parties'}`,
        columns: [
          { header: 'Sr.', width: '35px', align: 'center' },
          { header: isGu ? 'પાર્ટીનું નામ' : 'Party Name' },
          { header: isGu ? 'શ્રેણી' : 'Category' },
          { header: isGu ? 'મોબાઇલ' : 'Mobile' },
          { header: isGu ? 'સંપર્ક વ્યક્તિ' : 'Contact Person' },
          { header: 'GSTIN' },
          { header: isGu ? 'સ્થિતિ' : 'Status', width: '65px' },
          { header: isGu ? 'ખાતાવહી સ્થિતિ' : 'Ledger Status', width: '85px' },
          { header: isGu ? 'ચોખ્ખી બાકી' : 'Balance', width: '95px', align: 'right' }
        ],
        rows
      }
    ]
  })
}

/**
 * 5. Single Party Ledger Statement PDF
 */
export function exportPartyLedgerPDF(
  party: Party,
  transactions: Transaction[],
  settings: CompanySettings,
  year?: AccountingYear,
  isGu: boolean = false
) {
  const partyTxns = transactions
    .filter(t => t.partyId === party.id || t.partyName === party.name)
    .sort((a, b) => a.date.localeCompare(b.date))

  let runningBalance = 0
  let totalCredit = 0
  let totalDebit = 0

  const rows = partyTxns.map((t, idx) => {
    const isCredit = t.type === 'income' // money received from party
    const isDebit = t.type === 'expense'  // money paid / expense on party

    if (isCredit) {
      totalCredit += t.amount
      runningBalance += t.amount
    } else {
      totalDebit += t.amount
      runningBalance -= t.amount
    }

    return [
      idx + 1,
      t.date,
      t.voucherNo,
      t.category || '—',
      t.description || '—',
      t.paymentMode.toUpperCase(),
      isCredit ? `+${formatCurrency(t.amount)}` : '—',
      isDebit ? `-${formatCurrency(t.amount)}` : '—',
      formatCurrency(runningBalance)
    ]
  })

  printPDFReport({
    title: isGu ? 'પાર્ટી ખાતાવહી પત્રક' : 'PARTY ACCOUNT STATEMENT',
    subtitle: `${party.name} ${party.mobile ? `(${party.mobile})` : ''}`,
    period: year ? year.name : undefined,
    settings,
    year,
    isGu,
    cards: [
      {
        label: isGu ? 'કુલ જમા (Credit)' : 'TOTAL CREDIT (RECEIVED)',
        value: `+${formatCurrency(totalCredit)}`,
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0'
      },
      {
        label: isGu ? 'કુલ ઉધાર (Debit)' : 'TOTAL DEBIT (PAID)',
        value: `-${formatCurrency(totalDebit)}`,
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fecaca'
      },
      {
        label: isGu ? 'અંતિમ બાકી હિસાબ' : 'CLOSING BALANCE',
        value: runningBalance > 0 ? `+${formatCurrency(runningBalance)} (${isGu ? 'લેવાના' : 'Receivable'})` : runningBalance < 0 ? `-${formatCurrency(Math.abs(runningBalance))} (${isGu ? 'આપવાના' : 'Payable'})` : '₹0 (Settled)',
        color: runningBalance >= 0 ? '#15803d' : '#dc2626',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      }
    ],
    sections: [
      {
        title: `${isGu ? 'ખાતા વ્યવહાર વિગતો' : 'Account Ledger Entries'} - ${party.name}`,
        badge: `${partyTxns.length} ${isGu ? 'નોંધ' : 'Entries'}`,
        columns: [
          { header: 'Sr.', width: '35px', align: 'center' },
          { header: isGu ? 'તારીખ' : 'Date', width: '85px' },
          { header: isGu ? 'વાઉચર નં' : 'Voucher No', width: '85px' },
          { header: isGu ? 'શ્રેણી' : 'Category' },
          { header: isGu ? 'વિગત' : 'Description' },
          { header: isGu ? 'ચુકવણી' : 'Payment', width: '65px' },
          { header: isGu ? 'જમા (+)' : 'Credit (+)', width: '90px', align: 'right' },
          { header: isGu ? 'ઉધાર (-)' : 'Debit (-)', width: '90px', align: 'right' },
          { header: isGu ? 'ચાલુ બાકી' : 'Balance', width: '95px', align: 'right' }
        ],
        rows,
        summaryRow: [
          '',
          isGu ? 'કુલ હિસાબ' : 'TOTALS',
          '',
          '',
          '',
          '',
          `+${formatCurrency(totalCredit)}`,
          `-${formatCurrency(totalDebit)}`,
          formatCurrency(runningBalance)
        ]
      }
    ]
  })
}

/**
 * 6. Financial Years / Cash Book PDF
 */
export function exportCashBookPDF(
  years: AccountingYear[],
  activeYear: AccountingYear | undefined,
  settings: CompanySettings,
  isGu: boolean = false
) {
  const rows = years.map((y, idx) => [
    idx + 1,
    y.name,
    y.startDate,
    y.endDate,
    formatCurrency(y.openingBalance),
    formatCurrency(y.openingBankBalance || 0),
    y.id === activeYear?.id ? (isGu ? '🟢 સક્રિય (Active)' : '🟢 Active') : (isGu ? 'સામાન્ય' : 'Standard'),
    y.notes || '—'
  ])

  printPDFReport({
    title: isGu ? 'નાણાકીય વર્ષો અને પ્રારંભિક સિલક' : 'ACCOUNTING YEARS & CASH BOOK',
    subtitle: isGu ? 'નાણાકીય વર્ષોની વિગત અને પ્રારંભિક રોકડ/બેંક સિલક' : 'Financial Periods & Opening Balances',
    settings,
    year: activeYear,
    isGu,
    cards: [
      {
        label: isGu ? 'સક્રિય નાણાકીય વર્ષ' : 'ACTIVE FINANCIAL YEAR',
        value: activeYear?.name || 'N/A',
        color: '#1d4ed8',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      },
      {
        label: isGu ? 'પ્રારંભિક રોકડ સિલક' : 'OPENING CASH BALANCE',
        value: formatCurrency(activeYear?.openingBalance || 0),
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0'
      },
      {
        label: isGu ? 'પ્રારંભિક બેંક સિલક' : 'OPENING BANK BALANCE',
        value: formatCurrency(activeYear?.openingBankBalance || 0),
        color: '#2563eb',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      }
    ],
    sections: [
      {
        title: isGu ? 'નાણાકીય વર્ષોની યાદી' : 'Financial Accounting Years',
        badge: `${years.length} ${isGu ? 'વર્ષો' : 'Periods'}`,
        columns: [
          { header: 'Sr.', width: '35px', align: 'center' },
          { header: isGu ? 'વર્ષનું નામ' : 'Year Name' },
          { header: isGu ? 'શરૂઆત તારીખ' : 'Start Date' },
          { header: isGu ? 'અંત તારીખ' : 'End Date' },
          { header: isGu ? 'રોકડ સિલક' : 'Opening Cash', align: 'right' },
          { header: isGu ? 'બેંક સિલક' : 'Opening Bank', align: 'right' },
          { header: isGu ? 'સ્થિતિ' : 'Status' },
          { header: isGu ? 'નોંધ' : 'Notes' }
        ],
        rows
      }
    ]
  })
}

/**
 * 7. Comprehensive Financial Report PDF
 */
export function exportComprehensiveReportsPDF(
  transactions: Transaction[],
  parties: Party[],
  settings: CompanySettings,
  year?: AccountingYear,
  dateRangeStr?: string,
  isGu: boolean = false
) {
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netProfit = totalIncome - totalExpense

  // Category summary
  const catMap: Record<string, number> = {}
  transactions.forEach(t => {
    const cat = t.category || (t.type === 'income' ? 'General Income' : 'General Expense')
    catMap[cat] = (catMap[cat] || 0) + (t.type === 'income' ? t.amount : -t.amount)
  })

  const txnRows = transactions.map((t, idx) => [
    idx + 1,
    t.date,
    t.voucherNo,
    t.type === 'income' ? (isGu ? 'આવક' : 'Income') : (isGu ? 'ખર્ચ' : 'Expense'),
    t.partyName || '—',
    t.category || '—',
    t.paymentMode.toUpperCase(),
    t.description || '—',
    `${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}`
  ])

  printPDFReport({
    title: isGu ? 'સંપૂર્ણ નાણાકીય અહેવાલ' : 'FINANCIAL REPORT',
    subtitle: isGu ? 'આવક-ખર્ચ વિશ્લેષણ અને ઓડિટ પત્રક' : 'Comprehensive Income, Expense & Audit Statement',
    period: dateRangeStr || (year ? year.name : undefined),
    settings,
    year,
    isGu,
    cards: [
      {
        label: isGu ? 'કુલ આવક (Tasks / Credits)' : 'TOTAL PROFIT (TASKS)',
        value: `+${formatCurrency(totalIncome)}`,
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0'
      },
      {
        label: isGu ? 'સામાન્ય ખર્ચાઓ' : 'GENERAL EXPENSES',
        value: `-${formatCurrency(totalExpense)}`,
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fecaca'
      },
      {
        label: isGu ? 'અંતિમ ચોખ્ખો નફો' : 'FINAL NET PROFIT',
        value: formatCurrency(netProfit),
        color: netProfit >= 0 ? '#1d4ed8' : '#b91c1c',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      }
    ],
    sections: [
      {
        title: isGu ? 'પૂર્ણ થયેલ વ્યવહારોની યાદી' : 'Income List (Completed Tasks)',
        badge: `${transactions.length} ${isGu ? 'વ્યવહારો' : 'Tasks'}`,
        columns: [
          { header: 'Sr.', width: '35px', align: 'center' },
          { header: isGu ? 'તારીખ' : 'Date', width: '80px' },
          { header: isGu ? 'વાઉચર નં' : 'Voucher No', width: '85px' },
          { header: isGu ? 'પ્રકાર' : 'Type', width: '65px' },
          { header: isGu ? 'પાર્ટી / ક્લાયન્ટ' : 'Client / Party' },
          { header: isGu ? 'શ્રેણી' : 'Document Type' },
          { header: isGu ? 'ચુકવણી' : 'Payment', width: '65px' },
          { header: isGu ? 'સંદર્ભ / વિગત' : 'Reference' },
          { header: isGu ? 'ચોખ્ખો નફો' : 'Net Profit', width: '90px', align: 'right' }
        ],
        rows: txnRows,
        summaryRow: [
          '',
          isGu ? 'કુલ ચોખ્ખો સરવાળો' : 'Total Tasks Net Profit',
          '',
          '',
          '',
          '',
          '',
          '',
          formatCurrency(netProfit)
        ]
      }
    ]
  })
}

/**
 * 8. Dashboard Snapshot PDF
 */
export function exportDashboardPDF(
  stats: {
    yearIncome: number
    yearExpense: number
    yearProfit: number
    cashBalance: number
    bankBalance: number
    totalReceivable: number
    totalPayable: number
  },
  recentTxns: Transaction[],
  settings: CompanySettings,
  year?: AccountingYear,
  isGu: boolean = false
) {
  const rows = recentTxns.map((t, idx) => [
    idx + 1,
    t.date,
    t.voucherNo,
    t.type === 'income' ? (isGu ? 'આવક' : 'Income') : (isGu ? 'ખર્ચ' : 'Expense'),
    t.partyName || '—',
    t.category || '—',
    t.paymentMode.toUpperCase(),
    `${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}`
  ])

  printPDFReport({
    title: isGu ? 'ડેશબોર્ડ નાણાકીય સારાંશ' : 'FINANCIAL DASHBOARD SUMMARY',
    subtitle: isGu ? 'સંપૂર્ણ નાણાકીય સ્થિતિ અને તાજેતરના વ્યવહારો' : 'Executive Business Performance & Cash Flow Summary',
    period: year ? year.name : undefined,
    settings,
    year,
    isGu,
    cards: [
      {
        label: isGu ? 'કુલ આવક' : 'TOTAL INCOME',
        value: `+${formatCurrency(stats.yearIncome)}`,
        color: '#15803d',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0'
      },
      {
        label: isGu ? 'કુલ ખર્ચ' : 'TOTAL EXPENSE',
        value: `-${formatCurrency(stats.yearExpense)}`,
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fecaca'
      },
      {
        label: isGu ? 'ચોખ્ખો નફો' : 'NET PROFIT',
        value: formatCurrency(stats.yearProfit),
        color: stats.yearProfit >= 0 ? '#1d4ed8' : '#b91c1c',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe'
      },
      {
        label: isGu ? 'કુલ રોકડ સિલક' : 'CASH BALANCE',
        value: formatCurrency(stats.cashBalance),
        color: '#0891b2',
        bgColor: '#ecfeff',
        borderColor: '#a5f3fc'
      }
    ],
    sections: [
      {
        title: isGu ? 'તાજેતરના વ્યવહારો' : 'Recent Transactions',
        badge: `${recentTxns.length} ${isGu ? 'નોંધ' : 'Records'}`,
        columns: [
          { header: 'Sr.', width: '35px', align: 'center' },
          { header: isGu ? 'તારીખ' : 'Date', width: '85px' },
          { header: isGu ? 'વાઉચર નં' : 'Voucher No', width: '90px' },
          { header: isGu ? 'પ્રકાર' : 'Type', width: '70px' },
          { header: isGu ? 'પાર્ટીનું નામ' : 'Party Name' },
          { header: isGu ? 'શ્રેણી' : 'Category' },
          { header: isGu ? 'ચુકવણી' : 'Payment', width: '70px' },
          { header: isGu ? 'રકમ' : 'Amount', width: '95px', align: 'right' }
        ],
        rows
      }
    ]
  })
}
