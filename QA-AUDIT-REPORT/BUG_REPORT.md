# Gopinathji Gems — Bug Report

**Audit date:** 2026-11-09
**Scope:** All frontend routes/components, all backend routes/middleware/services, Prisma schema, backup/restore path, dependency tree.
**Method:** Source inspection plus reproducible execution against the isolated `gopinathji_gems_qa` database (see `TEST_EXECUTION_SUMMARY.md`).
**Total defects:** **28** — **Critical 5 · High 8 · Medium 8 · Low 7**

> **Post-fix update (2026-11-10):** all 28 defects are resolved and re-verified.
> See [`FIX_STATUS.md`](./FIX_STATUS.md) for the per-defect fix and final test results.

> Every defect below was observed in real execution or verified directly in source. No defect was filed on speculation. Line numbers refer to the repository as audited.

---

## Severity model

| Severity | Definition |
|---|---|
| **Critical** | Full data disclosure, destructive data loss, authentication bypass, or account takeover. Blocks production use. |
| **High** | Core workflow broken, privilege escalation, user-facing crash, or exploitable dependency. Must fix before release. |
| **Medium** | Incorrect behaviour, weak validation, non-standard semantics, accessibility failure, or scalability risk. |
| **Low** | Quality, maintainability, hardening, or cosmetic issue. |

---

## Summary table

| ID | Module | Severity | Title | Covering test |
|---|---|---|---|---|
| QA-001 | Backup / Data protection | Critical | Employee can download the full database backup including bcrypt password hashes | API RBAC `employee can read backup JSON export` |
| QA-002 | Backup / Data protection | Critical | Employee can restore/replace the entire database via Excel import | API RBAC `employee cannot reach Excel import/restore` |
| QA-003 | Backup / Data protection | Critical | Restore assigns the bcrypt hash of `password` to users with a missing hash | Manual hash verification + source |
| QA-004 | Auth / RBAC | Critical | Deactivated or role-downgraded users keep full access until JWT expiry | API `token lifecycle vs database state` (0/2) |
| QA-005 | Users | Critical | User creation silently defaults the password to `admin123` | API `does NOT silently create accounts with the default password admin123` |
| QA-006 | Transactions | High | Voucher generator collides after deletion and under concurrency (409 = data entry blocked) | API `voucher numbering` (0/3) |
| QA-007 | Reports / RBAC | High | Employee can read P&L and all financial reports over the API | API `employee can read reports` |
| QA-008 | Reports / UI | High | PDF export throws `ReferenceError: dateFrom is not defined` | E2E `PDF export does not crash when a date preset is selected` |
| QA-009 | Income / Expense UI | High | Payment-mode dropdown omits `upi` and `cheque` even though the backend supports them | Vitest `offers every payment mode` + E2E `payment mode` |
| QA-010 | Routing / RBAC UI | High | No client route guard — employee can open `/users`, `/settings`, `/audit`, `/reports`, `/transactions` by URL | E2E `employee cannot open admin-only pages by typing the URL` |
| QA-011 | Transaction validation | High | Invalid/impossible dates accepted or returned as 500 | API `rejects a non-date date string` / `impossible calendar date` |
| QA-012 | Transaction validation | High | Amount overflow, 3-decimal currency, and unknown `partyId` are not rejected | API `overflows Decimal(15,2)`, `more than 2 decimal places`, `non-existent partyId` |
| QA-013 | Dependencies | High | 10 production dependency vulnerabilities, incl. `proxy-addr` critical | `npm audit --omit=dev` (server) |
| QA-014 | Reports | Medium | `/api/reports/outstanding` is not scoped to the active financial year | API `outstanding report is scoped to the active accounting year` |
| QA-015 | API / Performance | Medium | Transaction `limit` is unbounded (100 000 rows → 11.77 MB in one response) | API `caps the page size` + load probe |
| QA-016 | Transactions | Medium | Invalid `dateFrom` / `dateTo` query params return 500 | API `rejects an invalid dateFrom query parameter` |
| QA-017 | Backup / RBAC | Medium | Employee can reach the Excel preview endpoint (400 instead of 403) | API `employee cannot reach Excel preview` |
| QA-018 | Backup | Medium | `/api/backup/drive-history` crashes with 500 on BigInt `fileSizeBytes` | API `drive-history serialises BigInt` |
| QA-019 | Expense categories | Medium | Create returns non-standard HTTP `211` instead of `201` | API `admin category creation uses standard HTTP 201` |
| QA-020 | Frontend / Type safety | Medium | 46 TypeScript errors; includes a runtime-relevant non-callable `Transaction` bug | `tsc --noEmit` (frontend) |
| QA-021 | Accessibility | Medium | Dashboard has a critical unlabeled form control and 22 serious contrast failures | E2E axe scan `logs in, loads dashboard` |
| QA-022 | UI consistency | Low | Ant Design deprecated-property warnings on every page | E2E console output |
| QA-023 | Code quality | Low | ~20 unused imports / dead declarations (TS6133) | `tsc --noEmit` |
| QA-024 | Database hardening | Low | No DB CHECK constraints for money/date/year invariants | `DATABASE_AUDIT.md` |
| QA-025 | Backup minimisation | Low | JSON backup returns raw `passwordHash` rather than credential metadata | Source review |
| QA-026 | Performance / bundle | Low | 1.64 MB single JS chunk (500 KB gzip), no route code-splitting | Vite build |
| QA-027 | Routing | Low | Unknown paths silently render Dashboard instead of 404 | Source review |
| QA-028 | Audit coverage | Low | Backup export/preview are not written to the audit log | Source review |

---

## Critical defects

### QA-001 — Employee can download the full database backup including bcrypt password hashes

| Field | Detail |
|---|---|
| **Module** | Backup / Data protection |
| **Endpoint / page** | `GET /api/backup/json`, `POST /api/backup/export-excel` |
| **Severity** | Critical |
| **Covering test** | `server/qa/api.test.ts` → RBAC `employee can read backup JSON export`, `employee can export the full Excel backup` |

**Description.** Backup routes mount `authenticate` but not `requireAdmin`. Any signed-in employee can export the entire database. The payload includes every user record (including `passwordHash`), all transactions, parties, audit logs and settings.

**Reproduction.**
1. Log in as `qa_employee` and keep the JWT.
2. `GET /api/backup/json` with `Authorization: Bearer <employee token>`.
3. Observe `HTTP 200` and a JSON body containing `data.users[*].passwordHash`.
4. `POST /api/backup/export-excel` with the same token → `HTTP 200` and an `.xlsx` file.

**Expected.** `403 Forbidden` for non-admin roles; `passwordHash` never leaves the server.

**Actual.** `200 OK` and full credential dump.

**Root cause.** `server/src/routes/backup.ts:25` and `:95` attach only `authenticate`; `server/src/services/excelService.ts:65-76` includes `prisma.user.findMany(...)` and `:273-290` writes the `passwordHash` column into the Users sheet.

**Fix.** Add `requireAdmin` to `export-excel`, `json`, `preview-excel`, `import-excel` (all backup routes). Replace hash export with `select` that omits `passwordHash`, or export an irreversible marker. Rotate all bcrypt hashes after any exposure.

**Covering test.** RBAC assertions in `qa/api.test.ts:496-522`.

---

### QA-002 — Employee can restore/replace the entire database via Excel import

| Field | Detail |
|---|---|
| **Module** | Backup / Data protection |
| **Endpoint / page** | `POST /api/backup/import-excel` (multer `file` + optional password) |
| **Severity** | Critical |
| **Covering test** | API RBAC `employee cannot reach Excel import/restore` (got 400, not 403) |

**Description.** The restore endpoint is reachable by an employee. Because it runs `upsert`/replace logic inside a transaction, a malicious or mistaken employee can overwrite users, parties, transactions and years — a full destructive data-loss vector.

**Reproduction.**
1. Obtain an employee JWT.
2. `POST /api/backup/import-excel` with any multipart body.
3. Observe the request passes authentication and reaches file parsing (`400` for a bad file) instead of being refused (`403`).
4. With a valid workbook, the restore executes with `userName = req.user.username`.

**Expected.** `403 Forbidden`; restore restricted to `admin`.

**Actual.** Authentication passes; parsing proceeds (`400` on malformed input), and a valid file would restore.

**Root cause.** `server/src/routes/backup.ts:68` uses `authenticate` only; `restoreDataFromExcel` is invoked at `:78` without a role check.

**Fix.** `router.post('/import-excel', authenticate, requireAdmin, upload.single('file'), ...)`. Add a confirmation token and require a re-entered admin password. Wrap in an audit entry *before* mutation.

**Covering test.** `qa/api.test.ts:516-521`.

---

### QA-003 — Restore assigns the bcrypt hash of `password` to users with a missing hash

| Field | Detail |
|---|---|
| **Module** | Backup / Data protection |
| **Endpoint / page** | Excel restore path |
| **Severity** | Critical |
| **Covering test** | Manual hash verification (bcrypt compare) |

**Description.** During restore, a user row without a `passwordHash` is created with the constant hash `$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi`. QA confirmed this hash matches the plaintext **`password`**. Anyone who knows the convention can sign in as the restored account.

**Reproduction.**
1. Prepare a backup workbook whose Users sheet omits `Password Hash` for an admin row.
2. Restore it (see QA-002).
3. Log in with the affected username and password `password` → success.

**Expected.** Restore rejects the row, generates a random one-time secret, or forces a password reset. It must never install a known credential.

**Actual.** A known, publicly computable credential is installed.

**Root cause.** `server/src/services/excelService.ts` (~`:712-722`): `passwordHash: u.passwordHash || '<constant bcrypt hash>'`.

**Fix.** Never default to a known hash. Generate `crypto.randomBytes` + bcrypt, mark the account `mustChangePassword`, and refuse to restore privileged accounts without an explicit hash or reset flow.

**Covering test.** Manual bcrypt comparison documented in `TEST_EXECUTION_SUMMARY.md`; add an automated restore test.

---

### QA-004 — Deactivated or role-downgraded users keep full access until JWT expiry

| Field | Detail |
|---|---|
| **Module** | Auth / RBAC |
| **Endpoint / page** | Every authenticated endpoint |
| **Severity** | Critical |
| **Covering test** | API `token lifecycle vs database state` — **0/2 passed** |

**Description.** `authenticate` verifies the JWT signature and trusts `role`/`userId` claims. It never re-reads the user. If an admin downgrades a manager or sets a user `inactive`, the existing token continues to be accepted with the old privileges for up to 2 hours. QA confirmed both cases return `200` where `401/403` is required.

**Reproduction.**
1. Log in as manager; keep token.
2. Admin changes the manager's role to `employee` (or status to `inactive`).
3. Using the old manager token, `PUT /api/transactions/:id` → `200` (expected `403`), and a deactivated token still reaches protected routes (`200`).

**Expected.** Reject with `401` (deactivated) / `403` (role changed); invalidate sessions on role/status change.

**Actual.** Stale claims authorize the request.

**Root cause.** `server/src/middleware/auth.ts:25-36` — `jwt.verify(...)` then `req.user = payload; next()` with no DB lookup or `tokenVersion` check.

**Fix.** On each request resolve the user (`prisma.user.findUnique({ select: { role, status, tokenVersion } })`), reject inactive users, and use the DB role. Alternatively, embed a `tokenVersion` and bump it on any role/status/password change. Keep the lookup cached briefly if latency matters.

**Covering test.** `qa/api.test.ts:680-712`.

---

### QA-005 — User creation silently defaults the password to `admin123`

| Field | Detail |
|---|---|
| **Module** | Users |
| **Endpoint / page** | `POST /api/users` |
| **Severity** | Critical |
| **Covering test** | API `does NOT silently create accounts with the default password admin123` |

**Description.** The create-user schema declares `password: z.string().min(6).default('admin123')`. An admin who omits a password creates an account with a publicly known credential. QA confirmed the account is created with `201` and that `admin123` authenticates.

**Reproduction.**
1. `POST /api/users` as admin with `{ name, username, email, role }` and no `password`.
2. Observe `201 Created`.
3. `POST /api/auth/login` with `admin123` → success.

**Expected.** `400` requiring an explicit strong password (or a generated invite/reset token).

**Actual.** Predictable default credential.

**Root cause.** `server/src/routes/users.ts:20`.

**Fix.** Remove `.default(...)`; require a password or issue a one-time invite link. Enforce a password policy (length ≥ 10, not in a blocklist). Force change on first login.

**Covering test.** `qa/api.test.ts:543-550`; evidence test `confirms whether the default password admin123 actually works`.

---

## High defects

### QA-006 — Voucher generator collides after deletion and under concurrency

| Field | Detail |
|---|---|
| **Module** | Transactions |
| **Endpoint / page** | `POST /api/transactions` |
| **Severity** | High |
| **Covering test** | API `voucher numbering` — **0/3 passed** |

**Description.** `nextVoucherNo` computes `count(type) + 1`. If a transaction is deleted, the count decreases and the next insert reuses a live number → unique-constraint `409`. Under concurrent creates, multiple requests read the same count and collide. A middle deletion has the same effect. QA observed six `409`s in a concurrent batch and `409` after deleting the highest voucher.

**Reproduction.**
1. Create `INC-001`; delete it.
2. Create another income transaction → `409 A record with this value already exists` (expected `201` with `INC-002`).
3. Or fire 6 concurrent creates → multiple `409`s.

**Expected.** Unique, monotonic voucher numbers; no collision after delete or concurrency.

**Actual.** `409` collisions; data entry blocked.

**Root cause.** `server/src/routes/transactions.ts:36-40` (`count + 1`) and creation at `:127-140`; no sequence/transaction/lock.

**Fix.** Use a PostgreSQL sequence per type (`CREATE SEQUENCE inc_seq; nextval(...)`) or a `MAX(voucherNo)`-with-row-lock inside a serializable transaction / retry on `P2002`. Never derive identity from `count()`.

**Covering test.** `qa/api.test.ts:720-755`.

---

### QA-007 — Employee can read P&L and all financial reports over the API

| Field | Detail |
|---|---|
| **Module** | Reports / RBAC |
| **Endpoint / page** | `GET /api/reports/pl` (and all `/api/reports/*`) |
| **Severity** | High |
| **Covering test** | API `employee can read reports` (got `200`, expected `403`) |

**Description.** The reports router applies only `authenticate`. Employees can read summary, monthly, yearly, by-category, party ledger, outstanding and P&L — all confidential financial data the UI hides from them.

**Reproduction.**
1. Log in as `qa_employee`.
2. `GET /api/reports/pl` → `200` with profit/loss figures.

**Expected.** `403` for `employee`.

**Actual.** `200` with full financials.

**Root cause.** `server/src/routes/reports.ts:6` (`router.use(authenticate)`) and no `requireManager` on any route; `/pl` at `:232`.

**Fix.** `router.use(authenticate, requireManager)` or per-route guards. Keep a separate employee-safe summary endpoint if the dashboard truly needs one.

**Covering test.** `qa/api.test.ts:493-497`.

---

### QA-008 — PDF export throws `ReferenceError: dateFrom is not defined`

| Field | Detail |
|---|---|
| **Module** | Reports / UI |
| **Endpoint / page** | `/reports` → “Print PDF” button |
| **Severity** | High |
| **Covering test** | E2E `PDF export does not crash when a date preset is selected` |

**Description.** The export button's `onClick` references `dateFrom` and `dateTo`, which are not in scope. Selecting a non-`all` date preset and clicking Print PDF throws at click time; no report is produced.

**Reproduction.**
1. Sign in as admin/manager, open `/reports`.
2. Choose a date preset other than “All”.
3. Click the PDF export button.
4. Observe console `ReferenceError: dateFrom is not defined` (`Reports.tsx:419`).

**Expected.** A PDF/print window is generated with the selected range.

**Actual.** Uncaught runtime error; export fails.

**Root cause.** `src/components/Reports.tsx:419` uses undeclared `dateFrom`/`dateTo`. Confirmed independently by `tsc` (`TS2304`, `TS2552`).

**Fix.** Use the actual filter state, e.g. `datePreset !== 'all' ? \`${filters.dateFrom} ~ ${filters.dateTo}\` : undefined`, or pass the resolved range from the filter handler. Add a regression test that clicks export with every preset.

**Covering test.** `qa/e2e/reports.spec.ts:5`.

---

### QA-009 — Payment-mode dropdown omits `upi` and `cheque`

| Field | Detail |
|---|---|
| **Module** | Income / Expense UI |
| **Endpoint / page** | `/income`, `/expense` payment-mode `Select` |
| **Severity** | High |
| **Covering test** | Vitest `offers every payment mode`; E2E `payment mode` |

**Description.** The Prisma enum and backend Zod schema support `cash, bank, upi, cheque`, but the frontend constant exposes only `cash` and `bank`. Employees cannot record UPI or cheque transactions, so real financial data cannot be captured and reports understate non-cash activity.

**Reproduction.**
1. Open `/income`.
2. Open the payment-mode dropdown.
3. Observe exactly two options: `રોકડા | બેંક ટ્રાન્સફર`.

**Expected.** Four options including UPI and Cheque (localised).

**Actual.** Two options.

**Root cause.** `src/data/mockData.ts:72-75` `PAYMENT_MODES` lacks `upi`/`cheque`.

**Fix.** Add `{ value: 'upi', label: 'UPI / યુપી' }` and `{ value: 'cheque', label: 'Cheque / ચેક' }`; add a compile-time parity test against the backend enum.

**Covering test.** `qa/frontend/formatters.test.ts:36-42`; `qa/e2e/reports.spec.ts:23`.

---

### QA-010 — No client route guard for admin/manager pages

| Field | Detail |
|---|---|
| **Module** | Routing / RBAC UI |
| **Endpoint / page** | `/users`, `/settings`, `/audit`, `/reports`, `/transactions`, `/parties`, `/ledger`, `/cashbook` |
| **Severity** | High |
| **Covering test** | E2E `employee cannot open admin-only pages by typing the URL`, `employee direct URL to settings does not expose admin settings` |

**Description.** The sidebar filters links by role, but `renderPage()` in `App.tsx` switches on the pathname with no role check. An employee who types `/users` or `/settings` gets the admin page rendered. Data is partly protected server-side (some endpoints return 403), but settings/users pages still render and may expose cached data or admin actions.

**Reproduction.**
1. Sign in as employee.
2. Navigate directly to `/users` and `/settings`.
3. Observe the admin page renders with no “access denied” state.

**Expected.** Redirect to dashboard or show a 403 page.

**Actual.** Admin pages render.

**Root cause.** `src/App.tsx:248-262` maps page → component without checking `currentUser.role`; `src/components/Sidebar.tsx:32-50` only hides nav items.

**Fix.** Centralise a route-permission map and guard `renderPage()`; reuse it in the sidebar. Redirect unauthorised users and never mount the component.

**Covering test.** `qa/e2e/rbac.spec.ts:5,17`; sidebar test at `:27` passes.

---

### QA-011 — Invalid and impossible transaction dates accepted or returned as 500

| Field | Detail |
|---|---|
| **Module** | Transaction validation |
| **Endpoint / page** | `POST /api/transactions` |
| **Severity** | High |
| **Covering test** | API `rejects a non-date date string with 400 (not 500)`, `rejects an impossible calendar date 2026-04-31 with 400` |

**Description.** `date` is validated only as a non-empty string. `new Date('garbage')` yields `Invalid Date` and Prisma throws → `500`. `new Date('2026-04-31')` silently rolls over to 2026-05-01, so an impossible date is stored as a different date. This corrupts period reporting.

**Reproduction.**
1. `POST /api/transactions` with `date: "garbage"` → `500`.
2. `POST` with `date: "2026-04-31"` → `201`; stored date becomes 2026-05-01.

**Expected.** `400` with a clear validation error; no row written.

**Actual.** `500` / silent rollover.

**Root cause.** `server/src/routes/transactions.ts:16` (`z.string().min(1)`) and `:128` (`new Date(date)`).

**Fix.** Validate `z.coerce.date()` plus a strict `YYYY-MM-DD` regex and round-trip check (`date.toISOString().slice(0,10) === input`). Reject invalid ranges and future dates if business rules require.

**Covering test.** `qa/api.test.ts:324-332`.

---

### QA-012 — Amount overflow, sub-paise precision, and unknown `partyId` are not rejected

| Field | Detail |
|---|---|
| **Module** | Transaction validation |
| **Endpoint / page** | `POST /api/transactions` |
| **Severity** | High |
| **Covering test** | API `overflows Decimal(15,2)`, `more than 2 decimal places`, `non-existent partyId` |

**Description.**
- `amount: z.number().positive()` accepts `9.99e13` (+ paise), which overflows `Decimal(15,2)` → Prisma error `500`.
- It accepts `10.999`; PostgreSQL rounds silently to `11.00`, so the stored value differs from what the user entered.
- A non-existent `partyId` is passed straight to Prisma → FK violation `500` instead of `400/404`.

**Reproduction.**
1. `POST` with `amount: 99999999999999.99` → `500`.
2. `POST` with `amount: 10.999` → `201`, stored `11.00`.
3. `POST` with `partyId: "does-not-exist"` → `500`.

**Expected.** `400` for overflow/precision; `400/404` for unknown party.

**Actual.** `500` / silent rounding.

**Root cause.** `server/src/routes/transactions.ts:21` (`z.number().positive()`), and `partyId` used directly at `:133` after optional schema `:19`.

**Fix.** `z.number().positive().max(9_999_999_999_999.99).multipleOf(0.01)` — or accept a string and parse with a decimal library. Validate the party exists (`prisma.party.findUnique`) and map Prisma `P2003` to `400`. Consider a DB CHECK constraint.

**Covering test.** `qa/api.test.ts:339-347`.

---

### QA-013 — 10 production dependency vulnerabilities

| Field | Detail |
|---|---|
| **Module** | Dependencies / Security |
| **Endpoint / page** | `server/package.json`, `server/package-lock.json` |
| **Severity** | High |
| **Covering test** | `npm audit --omit=dev` (server) |

**Description.** The backend production tree reports **10 vulnerabilities: 1 critical, 4 high, 5 moderate**. The critical is `proxy-addr` (IP spoofing via IPv4-mapped IPv6 trust subnet), which matters because `app.set('trust proxy', 1)` relies on client IP for rate limiting. High findings include `multer` (multiple DoS/limit-bypass issues), `body-parser` (DoS via trailing bytes), `zod` (memory exhaustion), and `brace-expansion` (DoS). `qs`, `morgan`, `exceljs`/`uuid`, and `nodemailer` are moderate. The root frontend tree is clean (0).

**Expected.** 0 known high/critical advisories, or documented compensating controls.

**Actual.** 1 critical, 4 high, 5 moderate.

**Root cause.** Pinned transitive versions in `server/package-lock.json`; `multer <= 2.4.0`, `proxy-addr 1.1.0–2.0.7`, `body-parser < 1.20.9`, `zod < 4.6.6`.

**Fix.** `npm audit fix` then upgrade `express`/`multer`/`zod` majors as needed; pin patched versions; add `npm audit --omit=dev --audit-level=high` to CI. Until then, do not expose the API directly; terminate proxy headers at a trusted edge.

---

## Medium defects

### QA-014 — `/api/reports/outstanding` is not scoped to the active financial year

**Module:** Reports · **Endpoint:** `GET /api/reports/outstanding` · **Severity:** Medium · **Test:** API `outstanding report is scoped to the active accounting year`

**Description.** The endpoint aggregates every transaction a party has ever had, ignoring the active accounting year. Fixture Gamma (FY income 10 000, expense 3 000, prior-year income 99 999) returns **106 999** instead of the expected **7 000**. The UI labels this as the current-year outstanding, so users see materially wrong balances.

**Reproduction.** `GET /api/reports/outstanding` with a valid token; observe Gamma `net: 106999`.

**Expected.** `7000` for the active FY 2026-27.

**Actual.** `106999` (all-time).

**Root cause.** `server/src/routes/reports.ts:210-227` — `prisma.party.findMany({ include: { transactions: ... } })` has no date filter.

**Fix.** Filter transactions by the active `AccountingYear.startDate/endDate` (or accept an explicit `year`). Reuse the same scoping helper as `/summary`.

**Covering test.** `qa/api.test.ts:264-272`.

---

### QA-015 — Unbounded transaction page size

**Module:** API / Performance · **Endpoint:** `GET /api/transactions` · **Severity:** Medium · **Test:** API `caps the page size` + load probe

**Description.** `limit` is `z.coerce.number().default(50)` with no maximum. `?limit=100000` returns `200`; on the 30 000-row fixture it returned **11 770 722 bytes (11.77 MB) in 399.8 ms**. This is a trivial memory/bandwidth DoS and degrades the client.

**Reproduction.** `GET /api/transactions?limit=100000` → `200`, 11.77 MB.

**Expected.** `400` or a hard cap (e.g. 200).

**Actual.** `200` with unbounded rows.

**Root cause.** `server/src/routes/transactions.ts:32`.

**Fix.** `limit: z.coerce.number().int().min(1).max(200).default(50)`. Add cursor pagination for large exports.

**Covering test.** `qa/api.test.ts:349-352`; `server/qa/load-test.mjs`.

---

### QA-016 — Invalid `dateFrom`/`dateTo` query parameters return 500

**Module:** Transactions · **Endpoint:** `GET /api/transactions?dateFrom=garbage` · **Severity:** Medium · **Test:** API `rejects an invalid dateFrom query parameter with 400`

**Description.** Query dates are `z.string().optional()` and then passed to `new Date(...)`, producing `Invalid Date` and a Prisma `500`. Search/filter UI can be driven into an error state by a malformed link.

**Reproduction.** `GET /api/transactions?dateFrom=garbage` → `500`.

**Expected.** `400`.

**Actual.** `500`.

**Root cause.** `server/src/routes/transactions.ts:30-34` and date construction at `:46-51`.

**Fix.** Use `z.coerce.date()` / strict date refinement in `querySchema`; return `400` on invalid input.

**Covering test.** `qa/api.test.ts:354-356`.

---

### QA-017 — Employee can reach the Excel preview endpoint

**Module:** Backup / RBAC · **Endpoint:** `POST /api/backup/preview-excel` · **Severity:** Medium · **Test:** API `employee cannot reach Excel preview`

**Description.** Preview parses an uploaded workbook and returns table counts/summaries. It is not destructive, but it lets an employee probe backup structure and confirms the endpoint is not admin-gated. The request reaches parsing (`400` on bad input) instead of `403`.

**Reproduction.** Employee `POST /api/backup/preview-excel` with a dummy file → `400` (more than the expected `403`).

**Expected.** `403`.

**Actual.** `400` (endpoint reachable).

**Root cause.** `server/src/routes/backup.ts:44` (`authenticate` only).

**Fix.** Add `requireAdmin` (same change as QA-001/002).

**Covering test.** `qa/api.test.ts:509-514`.

---

### QA-018 — `/api/backup/drive-history` crashes with 500 on BigInt `fileSizeBytes`

**Module:** Backup · **Endpoint:** `GET /api/backup/drive-history` · **Severity:** Medium · **Test:** API `drive-history serialises BigInt fileSizeBytes without crashing`

**Description.** `BackupRun.fileSizeBytes` is a Prisma `BigInt`; `res.json()` cannot serialise `BigInt` and throws `TypeError: Do not know how to serialize a BigInt` → `500`. The backup history UI is unusable once any run has a file size.

**Reproduction.** Insert a `BackupRun` with `fileSizeBytes`, call `GET /api/backup/drive-history` as admin → `500`.

**Expected.** `200` with a numeric/string `fileSizeBytes`.

**Actual.** `500`.

**Root cause.** `server/src/routes/backup.ts:127-158` returns `runs` raw; no BigInt serialiser.

**Fix.** Map runs (`fileSizeBytes: Number(r.fileSizeBytes)`, guarding precision) or register a global `BigInt.prototype.toJSON`. Prefer a DTO.

**Covering test.** `qa/api.test.ts:830-839`.

---

### QA-019 — Expense-category creation returns HTTP 211

**Module:** Expense categories · **Endpoint:** `POST /api/expense-categories` · **Severity:** Medium · **Test:** API `admin category creation uses standard HTTP 201`

**Description.** Successful creation responds `211` (a WebDAV status) instead of `201 Created`. Clients and test harnesses that check `201` treat success as failure; proxies may mishandle the code.

**Reproduction.** Admin `POST /api/expense-categories` → `211`.

**Expected.** `201`.

**Actual.** `211`.

**Root cause.** `server/src/routes/expenseCategories.ts:51` (`res.status(211)`).

**Fix.** Change to `201`.

**Covering test.** `qa/api.test.ts:423-427`.

---

### QA-020 — 46 frontend TypeScript errors, including a runtime-relevant non-callable `Transaction`

**Module:** Frontend / Type safety · **Severity:** Medium · **Test:** `npx tsc --noEmit`

**Description.** The frontend does not type-check. Beyond ~20 unused-import warnings, there are real defects: `Income.tsx:103`, `Expense.tsx:103`, `Transactions.tsx:121` call `Transaction(...)` while `Transaction` is a type (TS2349); `Reports.tsx:419` references undefined `dateFrom`/`dateTo`; `mockData.ts:1` imports a non-existent `CashBook`; `Sidebar.tsx:109` re-exports `Page` twice. These make the build fragile and hide the PDF crash.

**Reproduction.** `cd /Users/dbpandav/Projects/GopinathjiGemes && npx tsc --noEmit` → 46 errors.

**Expected.** 0 errors; CI fails on type errors.

**Actual.** 46 errors.

**Root cause.** Type/identifier collisions (`Transaction` type vs constructor usage), missing exports, stale imports, AntD type changes.

**Fix.** Rename the `Transaction` type or use `new Transaction(...)` correctly; remove/replace `CashBook`; fix the duplicate export; delete unused imports; add `tsc --noEmit` to CI.

**Covering test.** `TEST_EXECUTION_SUMMARY.md` static-check section.

---

### QA-021 — Dashboard accessibility: critical unlabeled control + 22 serious contrast failures

**Module:** Accessibility · **Page:** `/dashboard` · **Severity:** Medium · **Test:** E2E axe-core scan

**Description.** The dashboard axe scan returns:
- `label` — **critical** — the financial-year `<Select>` (`ant-select-input`) has no accessible name (no label/aria-label/title).
- `color-contrast` — **serious**, 22 nodes.
- `page-has-heading-one` — moderate.
The login page additionally reports missing main landmark, missing H1, and region violations.

**Reproduction.** Sign in and run axe-core on `/dashboard` (see `qa/e2e/helpers`); or inspect `src/App.tsx:407`.

**Expected.** No critical/serious violations.

**Actual.** 1 critical + 22 serious + moderate.

**Root cause.** `src/App.tsx:407-414` `<Select>` has only a placeholder; low-contrast utility colours across dashboard cards.

**Fix.** Add `aria-label={t('nav.accountingYears')}`; raise contrast to WCAG AA (4.5:1); wrap pages in `<main>` with one `<h1>`. Add an axe gate to CI.

**Covering test.** `qa/e2e/login.spec.ts:34` (fails on the critical label).

---

## Low defects

### QA-022 — Ant Design deprecated-property warnings on every page

**Module:** UI consistency · **Severity:** Low · **Evidence:** E2E console.
`Card bordered`, `Space direction`, `Drawer width`, `Modal destroyOnClose`, `Alert message` are deprecated in Ant Design 6. Migrate to `variant`, `orientation`, `size`, `destroyOnHidden`, `title`. Cosmetic now, but will break on AntD 7.

### QA-023 — Unused imports / dead declarations (TS6133)

**Module:** Code quality · **Severity:** Low · **Evidence:** `tsc` (≈20 files).
Examples: `AuditLog.tsx` `Space`/`Edit2`, `Dashboard.tsx` `Wallet`/`ShieldCheck`, `Ledger.tsx` `Input`/`Card`/`Space`/`Download`, `Parties.tsx` `Sparkles`/`ArrowUpRight`/`ArrowDownLeft`/`Mail`, `Profile.tsx` `Tabs`/`Space`/`Badge`. Remove them and enable `noUnusedLocals`.

### QA-024 — No database CHECK constraints for money/date/year invariants

**Module:** Database hardening · **Severity:** Low · **Evidence:** `DATABASE_AUDIT.md`.
Application-level checks exist, but the DB will accept a negative amount, sub-paise precision, two active years, or an inverted year range if written outside the API. Add CHECK constraints and a partial unique index for a single active year.

### QA-025 — JSON backup returns raw `passwordHash`

**Module:** Backup minimisation · **Severity:** Low · **Evidence:** Source review.
`getAllBackupData()` (`excelService.ts:64-82`) returns full user rows. Even after QA-001 is fixed, an admin JSON download unnecessarily carries hashes. Return a DTO without `passwordHash`/`pinHash` and export credentials only in an encrypted, explicitly requested vault.

### QA-026 — Single 1.64 MB JS chunk, no route code-splitting

**Module:** Performance / bundle · **Severity:** Low · **Evidence:** Vite build (`1,635.91 kB`, `500.03 kB gzip`).
All pages, AntD and PDF code load up front. Use `React.lazy`/dynamic import per route and split vendor chunks; re-measure.

### QA-027 — Unknown paths silently render Dashboard

**Module:** Routing · **Severity:** Low · **Evidence:** Source review.
`getPageFromLocation()`/`renderPage()` fall through to Dashboard for unknown paths. Users get no 404 signal and mistyped links look valid. Add a 404 page/route.

### QA-028 — Backup export/preview are not audited

**Module:** Audit coverage · **Severity:** Low · **Evidence:** Source review (`backup.ts` has no `createAuditLog`; only restore writes one at `excelService.ts:838`).
Exporting the entire database is a sensitive action. Write an audit entry (actor, IP, format, row counts) for every export/preview/restore, and alert on bulk export.

---

## Bug distribution

| Module group | Bugs | IDs |
|---|---|---|
| Frontend UI / UX / accessibility / type safety | 9 | QA-008, 009, 010, 020, 021, 022, 023, 026, 027 |
| Backup / data protection / audit | 7 | QA-001, 002, 003, 017, 018, 025, 028 |
| Transactions / validation | 4 | QA-006, 011, 012, 016 |
| Auth / RBAC / users | 3 | QA-004, 005, 007 |
| Reports | 1 | QA-014 |
| Expense categories | 1 | QA-019 |
| Performance / API | 1 | QA-015 |
| Dependencies | 1 | QA-013 |
| Database hardening | 1 | QA-024 |

**Buggiest area:** frontend UI/UX/accessibility/type-safety (9 defects, 2 High), followed by backup/data protection (7 defects, 3 Critical).

---

## Cross-references

- Endpoint-by-endpoint results: `API_TEST_REPORT.md`
- Integrity checks and financial reconciliation: `DATABASE_AUDIT.md`
- OWASP mapping and control matrix: `SECURITY_AUDIT.md`
- Latency, throughput and bundle data: `PERFORMANCE_REPORT.md`
- Axe/responsive/localisation detail: `UI_UX_REPORT.md`
- Commands, counts and reproduction: `TEST_EXECUTION_SUMMARY.md`
- Remediation order: `FIX_PRIORITY.md`
