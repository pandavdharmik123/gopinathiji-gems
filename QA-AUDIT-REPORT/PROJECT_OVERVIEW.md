# Gopinathji Gems — QA Audit Report

**Project:** Gopinathji Gems (repo: `GopinathjiGemes`)
**Audit date:** 2026-11-09
**Auditor:** Automated QA audit (source inspection + isolated-database execution)
**Environment:** macOS, Node `v24.12.0`, npm `11.6.2`
**Verdict:** **Not production-ready.** Core accounting arithmetic is largely correct, but there are 5 critical security/data-protection defects, a voucher-numbering defect that blocks data entry after deletions/concurrency, a user-facing PDF crash, and an incomplete payment-mode workflow.

---

## 1. What the application is

Gopinathji Gems is a Gujarati/English gem-trading ERP-lite application. It manages income, expenses, parties, party ledgers, financial years, reports, users, audit logs, settings, notifications and backups. It ships as a Vite web app and as an Electron desktop wrapper.

## 2. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.7, Vite 8, Ant Design 6, Tailwind 4, lucide-react, dayjs |
| Backend | Node.js, Express 4, TypeScript, Zod 3, Prisma 5, JWT, bcryptjs, Helmet, CORS, express-rate-limit |
| Database | PostgreSQL 15+ (`gopinathji_gems`) |
| Desktop | Electron 22 + electron-builder |
| Reports | Browser print / print-window PDF generator (custom `pdfReportGenerator.ts`) |
| Backups | ExcelJS, optional AES-GCM encryption, optional Google Drive, node-cron scheduler |
| Auth | Username/password, bcrypt, JWT (2 h), optional TOTP 2FA, optional email OTP, optional PIN lock |

## 3. Repository layout

```
GopinathjiGemes/
├── src/                      React application
│   ├── App.tsx               Manual pathname/hash router + session restore + shell
│   ├── components/           13 pages + modals/panels
│   ├── store/AppContext.tsx  Global state, API orchestration, derived helpers
│   ├── lib/api.ts            Typed API client, JWT helpers, normalizers
│   ├── lib/pdfReportGenerator.ts
│   ├── data/mockData.ts      Seed/demo data, constants, formatters
│   └── types/index.ts
├── server/
│   ├── src/index.ts          Express bootstrap, middleware, routes
│   ├── src/routes/           auth, users, parties, transactions, accountingYears,
│   │                         reports, auditLogs, notifications, settings,
│   │                         expenseCategories, backup
│   ├── src/middleware/       auth (JWT/RBAC), validate (Zod), errorHandler
│   ├── src/services/         audit, Excel backup/restore, Drive backup
│   ├── prisma/schema.prisma  Data model
│   └── qa/                   QA harness, seed, API suite, DB audit, load probe
├── qa/                       QA Vitest config, frontend tests, Playwright E2E
└── QA-AUDIT-REPORT/          This report set
```

## 4. Roles

| Role | Intended capability |
|---|---|
| `admin` | Full access: users, settings, audit logs, deletes, backups, reports |
| `manager` | Data entry + edits, parties, financial years, reports; no user/settings/delete |
| `employee` | Data entry only (income/expense), calendar, own profile; no management/report/backup access |

## 5. Pages and routes inspected

| Route | Page | Access intended | Access observed |
|---|---|---|---|
| `/` → `/dashboard` | Dashboard | all roles | all roles |
| `/calendar` | Calendar / Panchang | all roles | all roles |
| `/income` | Income Management | all roles | all roles (employee can create; no edit/delete) |
| `/expense` | Expense Management | all roles | all roles (employee can create; no edit/delete) |
| `/transactions` | Transactions | admin, manager | admin, manager (UI); employee by direct URL |
| `/cashbook` | Financial Years | admin, manager | admin, manager (UI); employee by direct URL |
| `/parties` | Parties & Companies | admin, manager | admin, manager (UI); employee by direct URL |
| `/ledger` | Party Ledger | admin, manager | admin, manager (UI); employee by direct URL |
| `/reports` | Reports & Analytics | admin, manager | admin, manager (UI); employee by direct URL; API open to employee |
| `/users` | Users Management | admin | admin (UI); employee by direct URL |
| `/settings` | Settings | admin | admin (UI); employee by direct URL |
| `/audit` | Audit Logs | admin | admin (UI); employee by direct URL |
| `/profile` | My Profile | all roles | all roles |
| (login) | Login + 2FA + email OTP | public | public |

## 6. Backend API surface tested

Auth/session (`/api/auth/*`), users (`/api/users`), parties (`/api/parties`), transactions (`/api/transactions`, CSV export), accounting years (`/api/accounting-years`), reports (`summary`, `monthly`, `yearly`, `by-category`, `party/:id`, `outstanding`, `pl`), audit logs, notifications, settings, expense categories, backup (`json`, `export-excel`, `preview-excel`, `import-excel`, `drive-status`, `drive-history`, `drive-trigger`, `drive-files`), transliteration proxy, health, 404 and rate limiting. Full endpoint matrix is in `API_TEST_REPORT.md`.

## 7. Data model summary

`User`, `Party`, `Transaction`, `AccountingYear`, `AuditLog`, `Notification`, `CompanySettings`, `ExpenseCategory`, `BackupRun`. Enums: `UserRole`, `UserStatus`, `PartyStatus`, `TransactionType`, `PaymentMode` (`cash`, `bank`, `upi`, `cheque`), `AccountingYearStatus`, `NotificationType`, `BackupStatus`, `BackupTrigger`.

Key constraints:
- `Transaction.voucherNo` unique.
- `User.username` and `User.email` unique.
- `AccountingYear.name` unique.
- `ExpenseCategory.name` unique.
- FKs: transaction → party (`onDelete: SetNull`), audit log → user (`SetNull`), notification → user (`Cascade`).
- Indexes on transaction `date`, `type`, `partyId`; audit `createdAt`, `entity`; notification `userId`; backup `startedAt`.

There is **no database CHECK constraint** for positive amounts, 2-decimal currency, exactly one active accounting year, non-overlapping years, or valid date ranges. Those rules are application-level or absent.

## 8. Test environment and safety

- **Production/development DB `gopinathji_gems` was never written to.**
- An isolated database `gopinathji_gems_qa` was created, pushed from the Prisma schema and seeded deterministically.
- Every QA process received `DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa`; no `.env` file was edited.
- QA API server ran on port `3911`; load probe on `3912`; Playwright backend on `3911`, Vite on `9443` (8443 was already occupied by an unrelated process).
- Backup/Drive integration was disabled (`GOOGLE_DRIVE_BACKUP_ENABLED=false`).
- The QA database was reseeded between suites. The 30,000-row synthetic performance fixture was removed by reseeding before the final functional runs.
- No application source logic was modified to make tests pass. Only QA harness/test files and dev-only test dependencies were added.

## 9. Audit method

1. Full source inspection of frontend routes/components/state/API client and all backend routes/middleware/services/schema.
2. Isolated deterministic seed with expected financial totals.
3. 91-test real-HTTP API suite (`server/qa/api.test.ts`).
4. Read-only database integrity audit (`server/qa/db-audit.ts`).
5. 320-request load/latency probes against 9-row and 30,000-row datasets (`server/qa/load-test.mjs`).
6. 22 frontend unit/component tests (`qa/frontend`).
7. 12 Playwright Chromium/mobile E2E tests including axe-core accessibility scans (`qa/e2e`).
8. Static checks: TypeScript (`tsc --noEmit`), production build, `npm audit --omit=dev`.
9. Manual verification of security-sensitive code paths (known bcrypt hash, backup payload fields, route guards).

## 10. Limitations / unavailable tools

| Requested tool | Status | Substitute used |
|---|---|---|
| OWASP ZAP | Not installed | Auth/RBAC/validation/header/security test suite + dependency audit + manual source review |
| k6 | Not installed | Node `fetch` load/latency probe with percentiles and concurrency |
| Lighthouse | Not installed | Vite build size, Playwright mobile/desktop rendering, axe-core, load probe |
| Visual regression | Not requested/installed | Playwright screenshots on failure + manual screenshot review |
| MSW | Not required | Real spawned backend against isolated QA DB (stronger than mocks) |

## 11. Report index

| File | Contents |
|---|---|
| `BUG_REPORT.md` | 28 defects with repro, expected/actual, root cause, file:line, fix and covering test |
| `API_TEST_REPORT.md` | Endpoint matrix, 91-test results, failure evidence, auth/RBAC/financial detail |
| `DATABASE_AUDIT.md` | Schema, constraints, 26 integrity checks, financial reconciliation, hardening |
| `SECURITY_AUDIT.md` | OWASP mapping, access-control matrix, dependency CVEs, secrets/headers review |
| `PERFORMANCE_REPORT.md` | 9-row vs 30k-row latency, throughput, payload size, bundle analysis |
| `UI_UX_REPORT.md` | Page-by-page UX, responsive, localization, accessibility (axe) findings |
| `TEST_EXECUTION_SUMMARY.md` | Commands, counts, artifacts, reproducibility, limitations |
| `FIX_PRIORITY.md` | P0–P3 remediation order, effort, regression checklist |
