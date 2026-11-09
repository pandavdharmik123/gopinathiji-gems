# Gopinathji Gems — Test Execution Summary

> **Post-fix update (2026-11-10):** all defects have been remediated and re-verified.
> See [`FIX_STATUS.md`](./FIX_STATUS.md) for the current results
> (API 96/96, frontend 22/22, E2E 13/13, DB audit 26/26, axe critical/serious = 0).
> The counts below describe the original pre-fix baseline.

**Audit date:** 2026-11-09
**Environment:** macOS · Node `v24.12.0` · npm `11.6.2`
**Isolated DB:** `gopinathji_gems_qa` · **App DB `gopinathji_gems` untouched**
**Overall automated result:** **98 passed / 125 total (78.4%)** · **27 failed**
**Plus:** database audit 26/26 · static checks · 640 load requests · 0 HTTP failures

---

## 1. Headline counts

| Suite | File | Tests | Passed | Failed | Pass % | Duration |
|---|---|---|---|---|---|---|
| API (real HTTP) | `server/qa/api.test.ts` | 91 | 70 | 21 | 76.9% | 3.8 s |
| Frontend unit/component | `qa/frontend/*.test.ts(x)` | 22 | 21 | 1 | 95.5% | 1.54 s |
| E2E (Chromium + mobile) | `qa/e2e/*.spec.ts` | 12 | 7 | 5 | 58.3% | 1.2 m |
| **Total** | | **125** | **98** | **27** | **78.4%** | |

> E2E runs 12 tests across two Playwright projects: `chromium` (desktop) and `mobile-chromium` (412 px). Failure count is by test, not by project.

### Additional checks (not in the 125)

| Check | Result | Evidence |
|---|---|---|
| Database integrity audit | **26/26 passed**, 0 failed, 1 informational warning | `/tmp/qa-db-audit-final.log` |
| Load probe (small dataset) | 320 requests, **0 failures** | `/tmp/qa-load.log` |
| Load probe (30 k dataset) | 320 requests, **0 failures** | `/tmp/qa-load-30k.log` |
| Server TypeScript | **0 errors** | `/tmp/qa-tsc-server.log` (empty) |
| Frontend TypeScript | **46 errors** | `/tmp/qa-tsc-frontend.log` |
| Production build | **Succeeds** — 1,635.91 kB / 500.03 kB gzip | Vite output |
| `npm audit --omit=dev` (root) | **0 vulnerabilities** | — |
| `npm audit --omit=dev` (server) | **10 vulnerabilities** (1 critical, 4 high, 5 moderate) | — |

---

## 2. Failure inventory (27)

### API failures (21)

| # | Category | Test | Expected → actual |
|---|---|---|---|
| 1 | Financial | outstanding is FY-scoped | 7 000 → **106 999** |
| 2 | Validation | non-date string | 400 → **500** |
| 3 | Validation | impossible date `2026-04-31` | 400 → **201** |
| 4 | Validation | non-existent party | 400/404 → **500** |
| 5 | Validation | amount overflow | 400 → **500** |
| 6 | Validation | 3-decimal amount | 400 → **201** |
| 7 | Validation | page-size cap | 400 → **200** |
| 8 | Validation | invalid `dateFrom` | 400 → **500** |
| 9 | RBAC | category status | 201 → **211** |
| 10 | RBAC | employee reports | 403 → **200** |
| 11 | RBAC | employee backup JSON | 403 → **200** |
| 12 | RBAC | employee Excel export | 403 → **200** |
| 13 | RBAC | employee preview | 403 → **400** |
| 14 | RBAC | employee import | 403 → **400** |
| 15 | User lifecycle | default password | 400 → **201** |
| 16 | Token lifecycle | downgraded role token | 403 → **200** |
| 17 | Token lifecycle | deactivated token | 401/403 → **200** |
| 18 | Voucher | concurrent creates | unique → **6 × 409** |
| 19 | Voucher | delete then create | 201 → **409** |
| 20 | Voucher | middle deletion | 201 → **409** |
| 21 | Backup | BigInt drive history | 200 → **500** |

### Frontend failures (1)

| Test | Expected → actual |
|---|---|
| `offers every payment mode supported by the backend` | `['cash','bank','upi','cheque']` → **`['cash','bank']`** |

### E2E failures (5)

| # | Spec | Failure |
|---|---|---|
| 1 | `login.spec.ts` dashboard axe | Critical `label` violation (unlabeled year `<Select>`) |
| 2 | `rbac.spec.ts` employee `/users` by URL | Admin page renders; no access-denied state |
| 3 | `rbac.spec.ts` employee `/settings` by URL | Admin page renders; no access-denied state |
| 4 | `reports.spec.ts` PDF export | `ReferenceError: dateFrom is not defined` |
| 5 | `reports.spec.ts` payment modes | Dropdown shows only `રોકડા | બેંક ટ્રાન્સફર` |

All 27 map to the 28 defects in `BUG_REPORT.md` (one medium defect, QA-019, is API-only; one E2E failure is accessibility).

---

## 3. Environment setup & safety

```bash
# Isolated database (production DB never touched)
createdb gopinathji_gems_qa
export DATABASE_URL='postgresql://dbpandav@localhost:5432/gopinathji_gems_qa'
cd server && npx prisma db push --skip-generate
npx tsx qa/seed-qa.ts
```

- Every QA process received the QA `DATABASE_URL`; no `.env` file was edited.
- Google Drive backup disabled (`GOOGLE_DRIVE_BACKUP_ENABLED=false`).
- API server on `3911`; load probe on `3912`; Playwright backend `3911`, Vite `9443` (8443 was occupied).
- App source logic was **not** modified to make tests pass. Only QA harness/test files and dev-only dependencies were added.
- Deterministic seed: users `qa_admin`/`Admin#12345`, `qa_manager`/`Manager#12345`, `qa_employee`/`Employee#12345`, `qa_inactive`; 3 parties; FY 2026-27 opening cash ₹100 000 / bank ₹500 000; 8 in-year + 1 prior-year transaction.

---

## 4. Reproduction commands

### API suite

```bash
cd /Users/dbpandav/Projects/GopinathjiGemes/server
export DATABASE_URL='postgresql://dbpandav@localhost:5432/gopinathji_gems_qa'
npx prisma db push --skip-generate
npx tsx qa/seed-qa.ts
npx vitest run qa/api.test.ts --reporter=verbose
```

### Database audit

```bash
cd /Users/dbpandav/Projects/GopinathjiGemes/server
export DATABASE_URL='postgresql://dbpandav@localhost:5432/gopinathji_gems_qa'
npx tsx qa/db-audit.ts
```

### Frontend unit tests

```bash
cd /Users/dbpandav/Projects/GopinathjiGemes
npx vitest run --config qa/vitest.config.ts
```

### E2E

```bash
cd /Users/dbpandav/Projects/GopinathjiGemes
# backend must be running on 3911 against the QA DB
npx playwright test --config qa/playwright.config.ts
```

### Load probe

```bash
cd /Users/dbpandav/Projects/GopinathjiGemes
node server/qa/load-test.mjs http://127.0.0.1:3912
```

### Static checks

```bash
npx tsc --noEmit                 # frontend: 46 errors
cd server && npx tsc --noEmit    # backend: 0 errors
npm run build                    # succeeds
npm audit --omit=dev             # root: 0
cd server && npm audit --omit=dev # 10 vulnerabilities
```

---

## 5. Tooling installed (dev-only)

| Package | Where | Purpose |
|---|---|---|
| `vitest`, `jsdom` | root + server | test runner |
| `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event` | root | component tests |
| `@playwright/test` | root | E2E |
| `@axe-core/playwright` | root | accessibility |
| `supertest` | server | (available; suite uses native `fetch`) |
| `tsx` | server | run seed/audit scripts |

No application runtime dependency was changed by QA.

---

## 6. Reproducibility & determinism

- The fixture is deterministic and reseeded between suites; transaction totals are asserted against fixed expected values.
- The 30 000-row performance fixture is created and then removed by reseeding before functional suites run.
- Rate-limit and 2FA tests are timing-sensitive but passed in the final run; isolate them if parallelising.
- The only flakiness observed was the E2E 15 s waits in the (correctly failing) RBAC tests.

---

## 7. What was not tested / limitations

| Area | Status |
|---|---|
| OWASP ZAP active scan | Not installed — substituted with real-HTTP security tests + source review |
| k6 / large-scale load | Not installed — Node probe at concurrency ≤ 20 |
| Lighthouse / Core Web Vitals | Not installed — build size + Playwright render only |
| Visual regression | Not requested — failure screenshots/traces captured |
| Native Electron wrapper | Not exercised (web app tested) |
| Real Google Drive backup | Disabled by design |
| SMTP/email OTP delivery | Temp-token rejection tested; real mail not sent |
| Production network latency | Not simulated (localhost probe) |
| 360 px / landscape | Not tested (412 px used) |
| ZAP-style XSS/CSRF crawl | Not performed; no XSS found by inspection |

---

## 8. Artifacts

| Artifact | Location |
|---|---|
| API raw log | `/tmp/qa-api-final.log` |
| Frontend raw log | `/tmp/qa-frontend.log` |
| E2E raw log | `/tmp/qa-e2e-final.log` |
| DB audit log | `/tmp/qa-db-audit-final.log` |
| Load logs | `/tmp/qa-load.log`, `/tmp/qa-load-30k.log` |
| Frontend `tsc` log | `/tmp/qa-tsc-frontend.log` |
| Playwright screenshots/traces | `qa/test-results/` |
| Test source | `server/qa/`, `qa/` |

---

## 9. Bottom line

The **suite executes reliably and the failures are reproducible defects**, not flaky tests. **78.4% of automated checks pass**; the 27 failures cluster into security/data-protection, transaction validation, voucher numbering, and frontend workflow/accessibility. The database and financial arithmetic are sound. See `FIX_PRIORITY.md` for remediation order.
