# Gopinathji Gems — Fix Status (post-remediation)

**Date:** 2026-11-10
**Scope:** all 28 defects from the QA audit (`BUG_REPORT.md`), fixed in priority order against the isolated `gopinathji_gems_qa` database. Production data was never touched.

## Final verification

| Suite | Before | After | Result |
|---|---|---|---|
| Server API (`server/qa/api.test.ts`) | 70/91 | **96/96** | ✅ (4 new DB-invariant tests) |
| Frontend unit (`qa/frontend`) | 21/22 | **22/22** | ✅ |
| E2E (`qa/e2e`) | 7/12 | **13/13** | ✅ (new 404 test) |
| Database audit (`server/qa/db-audit.ts`) | 26/26 checks, 28 findings | **26/26 checks, 0 findings** | ✅ |
| Frontend `tsc --noEmit` | 46 errors | **0** | ✅ |
| Server `tsc --noEmit` | errors | **0** | ✅ |
| Production build (`vite build`) | single 1.64 MB chunk | **route-split chunks** | ✅ |
| Server `npm audit` | 10 (1 critical, 4 high, 5 moderate) | **0** | ✅ |
| Dashboard axe (critical/serious) | 1 critical + 22 serious | **0 violations** | ✅ |
| Login axe (critical/serious) | — | **0 violations** | ✅ |

## Defect status

| ID | Severity | Defect | Fix | Status |
|---|---|---|---|---|
| QA-001 | Critical | Employee could export backups with password hashes | `requireAdmin` on all backup export/preview/import/JSON routes; JSON exports strip credential fields | ✅ |
| QA-002 | Critical | Employee could restore/replace the database | `requireAdmin` on `import-excel`; restore requires explicit `confirm="RESTORE"` and is audited | ✅ |
| QA-003 | Critical | Restore installed a known default hash | Missing hashes now receive an unguessable random bcrypt hash | ✅ |
| QA-004 | Critical | Deactivated/downgraded users kept access until JWT expiry | `authenticate` re-reads user + status + current role from DB on every request | ✅ |
| QA-005 | Critical | User creation defaulted password to `admin123` | Schema default removed; password is required | ✅ |
| QA-006 | High | Voucher numbers collided after deletion/concurrency | New `voucher_counters` table + atomic PostgreSQL `GREATEST(...)+1` upsert | ✅ |
| QA-007 | High | Employees could read P&L/financial reports | `requireManager` on the reports router | ✅ |
| QA-008 | High | PDF export threw `dateFrom is not defined` | PDF range derived from real filter state (`pdfRangeLabel`) | ✅ |
| QA-009 | High | Payment modes omitted `upi`/`cheque` | `PAYMENT_MODES` now has cash/bank/upi/cheque with bilingual labels | ✅ |
| QA-010 | High | No client route guard | Central `PAGE_ROLES` map; direct URLs render Access denied | ✅ |
| QA-011 | High | Invalid/impossible dates accepted or 500 | Strict `YYYY-MM-DD` + real calendar validation on create/update and query | ✅ |
| QA-012 | High | Amount overflow, sub-paise precision, unknown party | Max amount, 2-decimal check, party-existence validation | ✅ |
| QA-013 | High | 10 dependency vulnerabilities | Patched `multer`, `morgan`, `nodemailer`, `zod` v4, `body-parser`, `proxy-addr`, `qs`, `brace-expansion`, `uuid`; overrides added | ✅ `npm audit` = 0 |
| QA-014 | Medium | Outstanding report not scoped to active FY | Report filters to the active accounting year | ✅ |
| QA-015 | Medium | Unbounded transaction page size | `limit` capped at 200; frontend walks pages instead of truncating | ✅ |
| QA-016 | Medium | Invalid `dateFrom`/`dateTo` returned 500 | Invalid query dates now return 400 | ✅ |
| QA-017 | Medium | Employee could reach Excel preview | Covered by backup `requireAdmin` | ✅ |
| QA-018 | Medium | Drive-history 500 on BigInt | `fileSizeBytes` serialised as `Number` | ✅ |
| QA-019 | Low | Category create returned HTTP 211 | Returns `201` | ✅ |
| QA-020 | Medium | Frontend TypeScript errors / runtime `Transaction` bug | Translation/transaction shadowing fixed; unused symbols removed; `tsc` clean | ✅ |
| QA-021 | High | Dashboard a11y (unlabeled control + 22 contrast failures) | `aria-label` on year select; darker secondary/money colors; `<main>` + `<h1>` on login; heading order corrected; axe = 0 violations | ✅ |
| QA-022 | Low | AntD deprecated props | `variant="borderless"`, `orientation`, Drawer `size`, `destroyOnHidden`, Alert `title` | ✅ |
| QA-023 | Low | Unused imports/dead declarations | Removed; `tsc --noEmit` = 0 | ✅ |
| QA-024 | Low | No DB CHECK/unique invariants | `prisma/sql/constraints.sql` + `npm run db:constraints`: positive amount, valid year range, single active year, no overlapping years | ✅ |
| QA-025 | Low | JSON backup exposed hashes | Folded into QA-001 sanitisation | ✅ |
| QA-026 | Medium | Single 1.64 MB chunk | Pages use `React.lazy`/`Suspense`; per-route chunks emitted | ✅ |
| QA-027 | Low | Unknown paths silently rendered Dashboard | Explicit 404 page + route detection | ✅ |
| QA-028 | Low | Backup export/preview not audited | Audit entries added for export, preview, restore | ✅ |

## Key files changed

- **Security/RBAC:** `server/src/middleware/auth.ts`, `server/src/routes/backup.ts`, `server/src/routes/users.ts`, `server/src/routes/reports.ts`
- **Validation/transactions:** `server/src/routes/transactions.ts`, `server/src/routes/expenseCategories.ts`
- **Backup/restore:** `server/src/services/excelService.ts`
- **Schema/DB:** `server/prisma/schema.prisma` (`VoucherCounter`), `server/prisma/sql/constraints.sql`, `server/scripts/apply-constraints.ts`, `server/scripts/preflight-db.ts`, `server/prisma/migrations/`, `server/package.json` (`db:constraints`, `db:preflight`, `db:baseline`, `release`, overrides)
- **CI/CD:** `.github/workflows/ci.yml`, `DEPLOYMENT.md`, portable `qa/playwright.config.ts` and `server/qa/harness.ts`
- **Frontend:** `src/App.tsx`, `src/lib/api.ts`, `src/components/Dashboard.tsx`, `src/components/Reports.tsx`, `src/components/Login.tsx`, `src/index.css`, `src/data/mockData.ts`, plus unused-import cleanup across components
- **Tests:** `server/qa/api.test.ts` (96 tests), `qa/e2e/navigation.spec.ts` (404 test)

## Remaining non-blocking items

1. **Root dev-tooling advisories:** Electron/electron-builder (build-time only); fixing requires a major Electron toolchain upgrade. The server runtime has **0** advisories.

## Production release flow

The risky `prisma db push` build step has been removed:

- `npm run build` = `prisma generate && tsc` (no database changes).
- `npm run release` = `db:preflight && prisma migrate deploy`.
- Versioned migrations live in `server/prisma/migrations/`:
  - `20261110000000_baseline` — schema as it exists in production today (8 tables)
  - `20261110000050_new_tables` — adds `backup_runs` + `voucher_counters` (idempotent)
  - `20261110000100_constraints` — CHECK / partial-unique / exclusion constraints
- Existing databases get a one-time baseline (`npm run db:baseline`) before migrating.
- Render: build no longer touches the DB; set **Pre-Deploy Command** to `npm run release`.
- Vercel: set `VITE_API_LINK` and the backend `CORS_ORIGIN`; SPA rewrites already configured.
- `.github/workflows/ci.yml` runs migrations, the existing-database baseline path, all test suites, type-checks, audit, and the production build on every push/PR.
- Full instructions: [`DEPLOYMENT.md`](../DEPLOYMENT.md).

## Reproduce

```bash
# Apply migrations (preflight + prisma migrate deploy)
cd server
DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa npm run release

# API (96)
DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa npx ts-node --transpile-only qa/seed-qa.ts
DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa npx vitest run qa/api.test.ts

# DB constraints + audit
DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa npm run db:constraints
DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa npx ts-node --transpile-only qa/db-audit.ts

# Frontend unit (22), types, build
cd ..
npx vitest run --config qa/vitest.config.ts
npx tsc --noEmit
npm run build

# E2E (13)
cd server && DATABASE_URL=postgresql://dbpandav@localhost:5432/gopinathji_gems_qa npx ts-node --transpile-only qa/seed-qa.ts && cd ..
npx playwright test --config qa/playwright.config.ts
```
