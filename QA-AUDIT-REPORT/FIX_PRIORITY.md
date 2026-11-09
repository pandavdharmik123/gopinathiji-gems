# Gopinathji Gems — Fix Priority & Release Plan

**Audit date:** 2026-11-09
**Basis:** 28 defects (5 Critical · 8 High · 8 Medium · 7 Low), 98/125 automated checks passing, 10 production CVEs.
**Verdict:** **Not production-ready.** P0 alone blocks any external exposure.

> Ordering principle: stop credential/data exposure and authorization bypass first (P0), then repair broken core workflows and validation (P1), then correctness/scalability/accessibility (P2), then hygiene (P3). Each item lists the covering test that must pass to close it.

---

## 1. P0 — Release blockers (fix immediately)

| Order | Bug | Fix | Effort | Acceptance |
|---|---|---|---|---|
| 1 | **QA-001** backup exposure | Add `requireAdmin` to `json`/`export-excel`; strip `passwordHash`/`pinHash` from exports | S (0.5 d) | Employee JSON/export → 403; payload contains no hash; rotate hashes |
| 2 | **QA-002** restore exposure | Add `requireAdmin` to `import-excel`; require re-auth + confirmation | S (0.5 d) | Employee import → 403; admin restore requires confirmation |
| 3 | **QA-003** restore default hash | Generate random secret + `mustChangePassword`; never install a known hash | M (1 d) | No constant hash in code; restored user cannot log in with `password` |
| 4 | **QA-004** stale JWT | DB-check `status`/`role` per request or add `tokenVersion`; bump on role/status/password change | M (1–2 d) | Deactivated token → 401; downgraded token → 403 |
| 5 | **QA-005** default `admin123` | Remove schema default; require strong password or invite flow | S (0.5 d) | `POST /users` without password → 400; no `admin123` login |
| 6 | **QA-013a** `proxy-addr` critical | Upgrade/patch `proxy-addr` + `express`; CI audit gate | M (1 d) | `npm audit --omit=dev` shows no critical |

**P0 exit criteria:** all five Critical defects closed, `proxy-addr` critical resolved, hashes rotated, and an independent re-test of QA-001–005 passes. **No production deployment before this.**

**Estimated P0 total: ~4–5 engineer-days.**

---

## 2. P1 — Core workflow & correctness (must fix before launch)

| Order | Bug | Fix | Effort | Acceptance |
|---|---|---|---|---|
| 7 | **QA-006** voucher collisions | PostgreSQL sequence per type or `MAX`+row-lock+retry on `P2002` | M (1 d) | Concurrent creates unique; delete/recreate no 409 |
| 8 | **QA-007** employee reports | `requireManager` on reports router (or per route) | S (0.5 d) | Employee `/reports/pl` → 403 |
| 9 | **QA-008** PDF crash | Use real filter state for `dateFrom`/`dateTo` | S (0.25 d) | PDF export works for every preset |
| 10 | **QA-009** payment modes | Add `upi`/`cheque` (+ localised labels) to `PAYMENT_MODES` | S (0.25 d) | Dropdown shows 4 modes; unit + E2E pass |
| 11 | **QA-010** route guard | Central route-permission map; guard `renderPage()`; 403 page | M (1 d) | Employee `/users`,`/settings`,`/audit` → denied |
| 12 | **QA-011** date validation | Strict `YYYY-MM-DD` + calendar validity + range | S (0.5 d) | Invalid/impossible date → 400 |
| 13 | **QA-012** amount/party validation | Max, 2-dp, party-exists check; map `P2002/P2003` | S (0.5 d) | Overflow/3-dp/unknown party → 400 |
| 14 | **QA-013b** remaining CVEs | `npm audit fix`; upgrade `multer`, `body-parser`, `zod`, `qs`, `morgan`, `nodemailer` | M (1–2 d) | No high/critical advisories |

**P1 exit criteria:** voucher entry never blocks; employees have no report/backup/admin access; payment capture complete; PDF works; validation returns 4xx not 5xx; high CVEs patched.

**Estimated P1 total: ~5–6 engineer-days.**

---

## 3. P2 — Correctness, scalability, accessibility

| Order | Bug | Fix | Effort | Acceptance |
|---|---|---|---|---|
| 15 | **QA-014** outstanding scope | Filter by active FY; reuse scoping helper | S (0.5 d) | Gamma returns 7 000, not 106 999 |
| 16 | **QA-015** unbounded limit | `max(200)`; cursor pagination for exports | S (0.5 d) | `limit=100000` → 400/capped |
| 17 | **QA-016** query date 500 | `z.coerce.date()` in `querySchema` | S (0.25 d) | `dateFrom=garbage` → 400 |
| 18 | **QA-017** preview access | Covered by requireAdmin (P0) | — | Employee preview → 403 |
| 19 | **QA-018** BigInt 500 | DTO/`Number(fileSizeBytes)` or global `BigInt.toJSON` | S (0.25 d) | Drive history → 200 |
| 20 | **QA-019** HTTP 211 | Change to `201` | XS (5 min) | Category create → 201 |
| 21 | **QA-020** TS errors | Fix callable `Transaction`, `CashBook` export, duplicate `Page`; remove unused; CI `tsc` | M (1–2 d) | `tsc --noEmit` = 0 |
| 22 | **QA-021** accessibility | `aria-label` on year select; contrast ≥ 4.5:1; `<main>`/`<h1>`; axe CI gate | M (1–2 d) | 0 critical/serious axe violations |

**P2 exit criteria:** report numbers correct, API robust to bad input, type-check clean, accessibility gate green.

**Estimated P2 total: ~4–5 engineer-days.**

---

## 4. P3 — Hardening & hygiene (schedule post-launch)

| Order | Bug | Fix | Effort |
|---|---|---|---|
| 23 | **QA-022** AntD deprecations | `variant`, `orientation`, `size`, `destroyOnHidden`, `title` | S (0.5 d) |
| 24 | **QA-023** unused imports | Remove; enable `noUnusedLocals` | S (0.25 d) |
| 25 | **QA-024** DB constraints | CHECK amount/date, single-active-year partial index, non-overlap exclusion | M (1 d) |
| 26 | **QA-025** hash in JSON backup | DTO excluding hashes | XS (in P0 work) |
| 27 | **QA-026** bundle size | Route `React.lazy`, vendor split, target < 250 KB gzip | M (1–2 d) |
| 28 | **QA-027** 404 page | Explicit 404 route/page | XS (0.25 d) |
| 29 | **QA-028** backup audit | Audit export/preview/restore with actor/IP/row counts; alert | S (0.5 d) |

**Estimated P3 total: ~3–4 engineer-days.**

---

## 5. Recommended sprint sequence

| Sprint | Focus | Bugs | Exit gate |
|---|---|---|---|
| **Sprint 1 (P0)** | Security & access control | 001–005, 013a | All critical closed; hashes rotated; re-test green |
| **Sprint 2 (P1a)** | Transactions & workflow | 006, 009, 011, 012 | Voucher + payment + validation tests pass |
| **Sprint 3 (P1b)** | RBAC, reports, deps | 007, 008, 010, 013b | Employee isolation + PDF + audit clean |
| **Sprint 4 (P2)** | Correctness/scalability/a11y | 014–016, 018–021 | DB/API/type/axe gates green |
| **Sprint 5 (P3)** | Hardening | 022–028 | Constraints + bundle + 404 + audit |

Total estimated remediation: **~16–20 engineer-days** (≈3–4 weeks for one engineer, ~1.5–2 weeks for two).

---

## 6. Dependencies & sequencing notes

- **QA-003 depends on QA-002** (restore must be admin-gated before changing its credential logic is meaningful).
- **QA-017 is closed by QA-001/002’s `requireAdmin` change** — do it once for all backup routes.
- **QA-004 should land before QA-010** — client guards are cosmetic if tokens still carry stale roles.
- **QA-024 (DB constraints) depends on QA-006/011/012** so the app does not fight the new constraints.
- **QA-025 is folded into QA-001** (one export-sanitisation change).
- Fixing **QA-008 requires QA-020’s type-check** to catch regressions; enable CI early.

---

## 7. Regression checklist (run after every fix)

Automated (must be green except known-open items):

- [ ] `server/qa/api.test.ts` — auth 12/12, transport 4/4, financial 10/10, validation 14/14, RBAC 26/26, user lifecycle 6/6, PIN 3/3, profile 4/4, token lifecycle 2/2, voucher 3/3, audit 1/1, notifications 1/1, backup 4/4, rate limit 1/1 → **91/91**
- [ ] `qa/frontend` → **22/22**
- [ ] `qa/e2e` → **12/12** (including dashboard axe critical = 0)
- [ ] `server/qa/db-audit.ts` → **26/26**
- [ ] `tsc --noEmit` frontend → **0**; server → **0**
- [ ] `npm audit --omit=dev` server → **no high/critical**
- [ ] Production build succeeds; bundle target reviewed

Manual:

- [ ] Employee cannot see admin nav **or** open admin URLs.
- [ ] Employee cannot download/restore backups; response contains no hashes.
- [ ] Deactivated/downgraded user is locked out immediately.
- [ ] New user requires an explicit strong password.
- [ ] Create/delete/recreate transactions never 409; concurrent entry works.
- [ ] UPI/Cheque can be recorded and appear in reports.
- [ ] PDF export works for all date presets.
- [ ] Invalid date/amount/party returns a clear 4xx.
- [ ] `/reports/outstanding` matches the active FY.
- [ ] `limit=100000` is rejected/capped.
- [ ] Drive history returns numeric sizes.
- [ ] Restored accounts are forced to reset; `password` does not work.
- [ ] axe scan: 0 critical/serious on login, dashboard, reports.

---

## 8. Release readiness verdict

| Gate | Status |
|---|---|
| No critical security defects | ❌ 5 open |
| No high security defects | ❌ 8 open (incl. 4 high CVEs) |
| Core data-entry workflow intact | ❌ voucher collisions + missing payment modes |
| Financial reporting accurate | ⚠️ 9/10 checks; outstanding mis-scoped |
| RBAC correct (API) | ⚠️ 20/26 |
| RBAC correct (UI) | ❌ direct-URL bypass |
| Accessibility baseline | ❌ critical axe violation |
| Type safety | ❌ 46 frontend errors |
| Test automation | ✅ harness working; 78.4% pass |
| Database integrity | ✅ 26/26 |

**Overall: NOT PRODUCTION-READY.**

The app is a solid functional prototype with correct database arithmetic and a working test harness, but it cannot be exposed to real users until **P0 is complete**. After P0 + P1 it becomes **conditionally releasable** to a small trusted pilot; full production should wait for P2 (correctness, type safety, accessibility).

**Fastest safe path to launch:** Sprint 1 (P0) → Sprint 2 + 3 (P1) → re-run the full 125-test suite and require **125/125** plus a clean `npm audit` and axe gate before go-live.

---

## 9. Cross-references

- Defect detail: `BUG_REPORT.md`
- API results: `API_TEST_REPORT.md`
- DB/financial: `DATABASE_AUDIT.md`
- Security/OWASP/CVEs: `SECURITY_AUDIT.md`
- Load/bundle: `PERFORMANCE_REPORT.md`
- UI/accessibility: `UI_UX_REPORT.md`
- Commands/counts: `TEST_EXECUTION_SUMMARY.md`
