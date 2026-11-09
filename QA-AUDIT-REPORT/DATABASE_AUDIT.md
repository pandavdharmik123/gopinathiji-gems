# Gopinathji Gems — Database & Financial Audit

**Engine:** PostgreSQL 15+ · **ORM:** Prisma 5 · **Schema:** `server/prisma/schema.prisma`
**Database audited:** isolated `gopinathji_gems_qa` (`postgresql://dbpandav@localhost:5432/gopinathji_gems_qa`)
**Production DB `gopinathji_gems`:** untouched (read/write isolation enforced via per-process `DATABASE_URL`).
**Script:** `server/qa/db-audit.ts` (read-only)
**Result:** **26 / 26 checks passed · 0 failed · 1 informational warning**
**Raw evidence:** `/tmp/qa-db-audit-final.log`

---

## 1. Fixture snapshot

| Table | Rows | Notes |
|---|---|---|
| `users` | 4 | `qa_admin`, `qa_manager`, `qa_employee`, `qa_inactive` |
| `parties` | 3 | Alpha, Beta, Gamma |
| `transactions` | 9 | 8 in-year + 1 prior-year (Gamma ₹99 999) |
| `accountingYears` | 2 | FY 2025-26 (inactive), FY 2026-27 (active) |
| `auditLogs` | 0 | Direct seed bypasses API; audit verified via API test |
| `notifications` | 0 | — |
| `expenseCategories` | 7 | — |
| `backupRuns` | 0 | — |

**Opening balances (FY 2026-27):** cash **₹100 000**, bank **₹500 000**.
**In-year totals:** income **₹39 000**, expense **₹22 000**.

---

## 2. Aggregate reconciliation

| Metric | Value | Check |
|---|---|---|
| All-time income | ₹138 999 | Includes prior-year ₹99 999 |
| All-time expense | ₹22 000 | — |
| All-time transfer / adjustment | ₹0 / ₹0 | — |
| All-time income − expense | **₹116 999** | Computed without drift |
| Active-year income | ₹39 000 | 8 in-year transactions |
| Active-year expense | ₹22 000 | — |
| Active-year profit | **₹17 000** | 39 000 − 22 000 |
| Opening cash | ₹100 000 | — |
| Derived cash balance | **₹117 000** | 100 000 + 39 000 − 22 000 ✅ |
| Opening bank | ₹500 000 | No transfers ⇒ derived bank 500 000 |

### Monthly reconciliation

| Month | Income | Expense | Profit |
|---|---|---|---|
| April 2026 | ₹25 000 | ₹17 000 | **₹8 000** |
| May 2026 | ₹14 000 | ₹5 000 | **₹9 000** |
| **FY total** | **₹39 000** | **₹22 000** | **₹17 000** |

### Party balances

| Party | Expected (FY) | Expected (all-time) | API observed |
|---|---|---|---|
| Alpha | ₹18 000 | ₹18 000 | ✅ 18 000 |
| Beta | −₹8 000 | −₹8 000 | ✅ −8 000 |
| Gamma | **₹7 000** (10 000 − 3 000) | ₹106 999 (incl. prior-year 99 999) | ❌ `/reports/outstanding` returns **106 999** |

The ledger/party endpoint is correct; only `/api/reports/outstanding` ignores the active-year scope (bug **QA-014**).

---

## 3. Integrity checks (26)

| # | Check | Result |
|---|---|---|
| 1 | amount always > 0 | ✅ 0 non-positive |
| 2 | amount max 2 decimals | ✅ 0 sub-paise rows |
| 3 | amount fits `Decimal(15,2)` | ✅ 0 overflow |
| 4 | voucherNo never blank | ✅ 0 blank |
| 5 | no future-dated transactions | ✅ 0 |
| 6 | no transactions before 2000 | ✅ 0 |
| 7 | no orphan transaction → party | ✅ 0 |
| 8 | no orphan audit log → user | ✅ 0 |
| 9 | no orphan notification → user | ✅ 0 |
| 10 | voucherNo unique (DB) | ✅ 0 duplicates |
| 11 | username unique (DB) | ✅ 0 duplicates |
| 12 | at most one active accounting year | ✅ 1 active |
| 13 | accounting year start < end | ✅ 0 invalid |
| 14 | accounting years do not overlap | ✅ none |
| 15 | every user has a password hash | ✅ 0 missing/weak |
| 16 | password hashes use bcrypt | ✅ 4/4 |
| 17 | no plaintext-looking passwords | ✅ 0 |
| 18 | PINs are hashed | ✅ 0 non-bcrypt |
| 19 | all-time income − expense drift-free | ✅ net 116 999 |
| 20 | derived cash balance finite | ✅ 117 000 |
| 21 | transaction writes are audited | ⚠️ 0 rows in direct seed |
| 22 | party writes are audited | ⚠️ 0 rows in direct seed |
| 23 | user writes are audited | ⚠️ 0 rows in direct seed |
| 24 | transaction reporting indexes exist | ✅ all present |
| 25 | backup run lifecycle consistent | ✅ 0 inconsistent |
| 26 | company settings is a singleton | ✅ 1 row |

> **Warning interpretation.** The three audit warnings are an artefact of seeding directly through Prisma rather than the API. They are **not** product defects: the API audit-trail test (`qa/api.test.ts` → *records create/update/delete actions with the acting user*) passed, and `excelService.ts:838` writes an audit row on restore. They are retained as informational only.

### Indexes present

```
accounting_years_name_key, accounting_years_pkey
audit_logs_createdAt_idx, audit_logs_entity_idx, audit_logs_pkey
notifications_pkey, notifications_userId_idx
parties_pkey
transactions_date_idx, transactions_partyId_idx, transactions_pkey,
transactions_type_idx, transactions_voucherNo_key
users_email_key, users_pkey, users_username_key
```

---

## 4. Schema review

### Strengths
- `Decimal(15,2)` for money (not `Float`) — correct for currency.
- Unique constraints on `voucherNo`, `username`, `email`, `AccountingYear.name`, `ExpenseCategory.name`.
- FK behaviour: transaction → party `SetNull` (preserves history), audit → user `SetNull`, notification → user `Cascade`.
- Reporting indexes on `date`, `type`, `partyId`; audit on `createdAt`/`entity`; notification on `userId`; backup on `startedAt`.
- Singleton settings keyed by a fixed `'singleton'` id.

### Gaps (defence-in-depth)
| Gap | Risk | Recommendation |
|---|---|---|
| No `CHECK (amount > 0)` | Negative amounts possible outside the API | Add CHECK constraint |
| No precision check | Sub-paise values possible if written directly | `NUMERIC(15,2)` already rounds; add a trigger/constraint if exactness matters |
| No partial unique index on active year | Two active years can exist | `CREATE UNIQUE INDEX one_active_year ON accounting_years (status) WHERE status = 'active'` |
| No `CHECK (startDate < endDate)` | Inverted range possible | Add CHECK |
| No non-overlap exclusion constraint | Overlapping FYs possible | `EXCLUDE USING gist (daterange(...) WITH &&)` |
| No `CHECK (date <= now())` | Future transactions possible | Add CHECK or enforce in app |
| `voucherNo` generated by `count+1` | Collisions (QA-006) | Replace with sequence |
| Backup `fileSizeBytes` is `BigInt` | JSON serialisation crash (QA-018) | DTO/`Number()` or global `BigInt.toJSON` |
| No `mustChangePassword` / `tokenVersion` columns | Default-password and stale-token risks (QA-003/004/005) | Add columns and enforce |
| Settings stored as singleton row | Fine, but no versioning | Add `updatedAt`, optimistic concurrency |

---

## 5. Migration / operational notes

- `prisma db push` was used for the QA database only. Production should use versioned `prisma migrate` with review.
- The QA database was reseeded before the functional suites; the 30 000-row performance fixture was removed by reseeding.
- No production tables, rows, or `.env` files were modified. Connection strings were injected per process.
- Backup/Drive was disabled (`GOOGLE_DRIVE_BACKUP_ENABLED=false`) to avoid external side effects.

---

## 6. Verdict

The **data model and stored data are internally consistent** and the **financial arithmetic reconciles exactly** for summary, monthly, yearly, category, and party-ledger views. The one financial defect is an *application query* (outstanding not year-scoped), not stored-data corruption.

The main database-level risks are **missing invariants as DB constraints** and **sensitive columns** (`passwordHash`, `pinHash`) exposed through backup code paths. Fixing `QA-001`–`QA-006` plus adding the CHECK/unique constraints above would make the persistence layer production-grade.

See `BUG_REPORT.md` for full defect detail and `FIX_PRIORITY.md` for sequencing.
