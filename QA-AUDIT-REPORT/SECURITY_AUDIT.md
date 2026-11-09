# Gopinathji Gems — Security Audit

**Audit date:** 2026-11-09
**Method:** Black-box HTTP security suite against a real spawned server, source review of every route/middleware/service, dependency audit (`npm audit`), header/CORS inspection, and manual credential/hash verification.
**Requested tool not available:** OWASP ZAP (see §9). The automated suite exercises the same classes of issues ZAP’s active scan would target: broken access control, injection/validation, auth/session, headers, rate limiting, and sensitive data exposure.
**Overall posture:** **Not production-ready.** Five critical findings allow credential/data disclosure, destructive restore, account takeover, or authorization bypass.

---

## 1. Findings summary

| ID | OWASP category | Severity | Finding |
|---|---|---|---|
| QA-001 | A01 Broken Access Control | **Critical** | Employee downloads full DB backup incl. bcrypt hashes |
| QA-002 | A01 Broken Access Control | **Critical** | Employee can restore/replace the database |
| QA-003 | A07 Identification & Auth Failures | **Critical** | Restore installs known `password` hash |
| QA-004 | A07 Identification & Auth Failures | **Critical** | Stale/deactivated JWT remains authorized |
| QA-005 | A07 Identification & Auth Failures | **Critical** | Accounts created with default `admin123` |
| QA-007 | A01 Broken Access Control | High | Employee reads P&L and financial reports |
| QA-010 | A01 Broken Access Control | High | No client route guard for admin pages |
| QA-011/012 | A03 Injection / A04 Insecure Design | High | Date/amount/party validation gaps → 500 / silent corruption |
| QA-013 | A06 Vulnerable Components | High | 1 critical + 4 high + 5 moderate production CVEs |
| QA-014/015/016 | A04 Insecure Design | Medium | Year-scope bug, unbounded limit, query-date 500 |
| QA-017/018 | A01/A04 | Medium | Preview reachable by employee; BigInt 500 |
| QA-021 | A11? / Accessibility | Medium | Unlabeled control, contrast (not a security issue per se) |
| QA-024/025/028 | A04/A09 | Low | Missing DB invariants, hash in JSON backup, backup actions unaudited |

---

## 2. OWASP Top 10 (2021) mapping

### A01 — Broken Access Control — **FAIL**
- Backup `export-excel`, `json`, `preview-excel`, `import-excel` use `authenticate` only (`server/src/routes/backup.ts:25,44,68,95`). Verified: employee gets `200` on JSON and Excel export, and reaches preview/import (`400` on bad file instead of `403`).
- Reports router uses `authenticate` only (`reports.ts:6`). Employee gets `200` on `/api/reports/pl`.
- Frontend renders admin pages for any role via direct URL (`App.tsx:248-262`); sidebar filtering is cosmetic (`Sidebar.tsx:32-50`).
- Positive: users, audit, settings, parties, accounting-year management and Drive admin routes correctly enforce `requireAdmin`/`requireManager`. Transaction edit/delete is role-protected.

### A02 — Cryptographic Failures — **PARTIAL**
- Passwords use bcrypt with configurable rounds (default 12); PINs are hashed (DB audit 4/4 bcrypt, 0 plaintext).
- **Critical:** restore path installs a constant bcrypt hash whose plaintext is `password` (`excelService.ts:~712`). A known hash is not a secret.
- JWT is HS256-signed with `JWT_SECRET` (min length 16). Recommend ≥ 32 random bytes and rotation.
- No transport enforcement in code (TLS expected at the proxy). Add HSTS at the edge.

### A03 — Injection — **PASS (SQL) / PARTIAL (input)**
- Prisma parameterises all queries; no raw SQL string interpolation found. No SQL injection evidence.
- Input validation is the weak point: dates, amounts, and `partyId` are insufficiently constrained (QA-011/012), producing `500`s and silent rounding rather than `400`s. This is a robustness/DoS issue, not classic injection.
- File upload uses `multer` memory storage with a 50 MB cap; workbook parsing should be constrained (see A06).

### A04 — Insecure Design — **FAIL**
- Voucher numbering derived from `count()` (QA-006) → integrity/data-entry failure.
- Unbounded `limit` (QA-015) → 11.77 MB response.
- Outstanding report ignores the accounting year (QA-014).
- Default password and no forced change (QA-005).
- No `tokenVersion`/session invalidation design (QA-004).

### A05 — Security Misconfiguration — **PARTIAL**
- Helmet is enabled (`index.ts:29`); CORS uses an explicit origin allow-list and does not reflect unknown origins (verified).
- `app.set('trust proxy', 1)` is required behind Render but interacts badly with `proxy-addr` CVE (see A06): spoofed `X-Forwarded-For` can bypass per-IP rate limiting.
- 404 returns JSON (verified), no stack traces in responses.
- Deprecated AntD props and unused code increase maintenance risk, not direct exploitability.

### A06 — Vulnerable & Outdated Components — **FAIL**
`npm audit --omit=dev` (server): **10 vulnerabilities — 1 critical, 4 high, 5 moderate.**

| Package | Severity | Advisory class |
|---|---|---|
| `proxy-addr` | **Critical** | IP spoofing via IPv4-mapped IPv6 trust subnet |
| `multer` | High | DoS via crafted multipart names, FD leak on abort, size-limit bypass race, orphaned writes |
| `body-parser` | High | DoS via trailing bytes after compressed body |
| `zod` | High | Memory exhaustion validating oversized constrained collections |
| `brace-expansion` | High | DoS via unbounded/quadratic expansion, stack exhaustion |
| `qs` | Moderate | Array-limit bypass, DoS via `isBuffer`, `stringify` TypeError |
| `morgan` | Moderate | Log forging/injection via unescaped separators/quotes |
| `exceljs` → `uuid` | Moderate | Missing buffer bounds check in v3/v5/v6 |
| `nodemailer` | Moderate | Multiple address-parser/DoS issues |

Root frontend tree: **0 vulnerabilities**. Remediate with `npm audit fix`, targeted major upgrades, and a CI gate at `--audit-level=high`.

### A07 — Identification & Authentication Failures — **FAIL**
- Login resists user enumeration (same `401` message for wrong password/unknown user) — verified.
- Inactive accounts are rejected **at login** — verified.
- But **existing tokens survive** deactivation/role change for up to 2 h (`auth.ts:25-36`) — verified `200` where `401/403` expected.
- Default `admin123` on user creation — verified account creation + login.
- Restore default hash = `password` — verified by bcrypt comparison.
- 2FA/email-OTP temp tokens are rejected when invalid — verified.
- PIN setup/verify/change/reset works and rejects non-numeric/unsupported states — verified.
- Rate limiting throttles repeated failed logins (`429`) — verified. Spoofing risk noted under A05.

### A08 — Software & Data Integrity Failures — **PARTIAL**
- Backup restore accepts a client-supplied workbook and replaces data; no signature/integrity check, no admin gate (QA-002), and no pre-restore audit entry.
- Voucher integrity is not guaranteed (QA-006).
- No checksum/signature on Drive backup files reviewed.

### A09 — Security Logging & Monitoring — **PARTIAL**
- Audit logging works for create/update/delete on transactions, parties, users, years, categories, settings, auth (verified by API test).
- **Gaps:** backup export/preview are not audited (QA-028); no alerting on bulk export or repeated 403s; no structured security-event channel; `morgan` log-injection advisory.
- Add audit rows for every backup/restore/export with actor, IP, row counts; alert on anomalies.

### A10 — Server-Side Request Forgery (SSRF) — **NOT OBSERVED**
- Drive/transliteration integrations use fixed provider URLs and configured credentials; no user-controlled URL fetch found. Re-verify if new integrations accept URLs.

---

## 3. Access-control matrix (observed)

| Capability | Admin | Manager | Employee | Unauthenticated |
|---|---|---|---|---|
| Login / 2FA / OTP | ✅ | ✅ | ✅ | ✅ (public) |
| Dashboard / calendar | ✅ | ✅ | ✅ | ❌ |
| Create income/expense | ✅ | ✅ | ✅ | ❌ |
| Edit/delete transaction | ✅ | ✅ (edit only; delete admin) | ❌ | ❌ |
| Parties / ledger | ✅ | ✅ | ❌ API (UI open by URL) | ❌ |
| Financial years | ✅ | ✅ | ❌ | ❌ |
| Reports / P&L | ✅ | ✅ | **❌ intended / ✅ actual** | ❌ |
| Users | ✅ | ❌ | ❌ API / **✅ UI by URL** | ❌ |
| Settings | ✅ | ❌ | ❌ API / **✅ UI by URL** | ❌ |
| Audit logs | ✅ | ❌ | ❌ API / **✅ UI by URL** | ❌ |
| Backup JSON/Excel/restore | **✅ intended / ✅ employee actual** | ❌ intended | **❌ intended / ✅ actual** | ❌ |
| Drive backup routes | ✅ | ❌ | ❌ | ❌ |

Bold entries are defects (QA-001/002/007/010).

---

## 4. Sensitive-data exposure

| Data | Where | Status |
|---|---|---|
| `passwordHash` | Excel Users sheet (`excelService.ts:273-290`) | ❌ exported |
| `passwordHash` | JSON backup (`getAllBackupData`, `:64-82`) | ❌ exported (QA-025) |
| `pinHash` | User model | Not exported in reviewed paths; exclude explicitly |
| JWT secret | `JWT_SECRET` env | ✅ not committed; `.env` git-ignored |
| SMTP/Brevo/Drive creds | env | ✅ not committed; `.env.example` contains placeholders only |
| Default hash | restore constant | ❌ known credential (QA-003) |
| Audit logs | `/api/audit-logs` | ✅ admin-only |

No production secret was printed or modified during this audit. `.env` files were not read for values; only key names were inspected.

---

## 5. Authentication & session review

| Control | Result |
|---|---|
| Password hashing | bcrypt (default cost 12) ✅ |
| PIN hashing | bcrypt ✅ |
| User enumeration | Resisted ✅ |
| Inactive user at login | Rejected ✅ |
| JWT signature/expiry | Verified (`401` on malformed/wrong-secret) ✅ |
| JWT expiry window | 2 h |
| Token revocation / role sync | ❌ none — stale claims trusted (QA-004) |
| Default credentials | ❌ `admin123` (QA-005), `password` on restore (QA-003) |
| 2FA enroll/verify/disable | Works ✅ |
| Email OTP temp-token validation | Works ✅ |
| Login rate limit | Works (429) ✅ |

---

## 6. Transport, headers, and CORS

- `helmet()` present (verified header assertion).
- CORS allow-list enforced; unknown origin not reflected (verified).
- JSON 404 for unknown routes (verified).
- `express.json({ limit: '10mb' })` — generous; consider lowering.
- TLS/HSTS expected at the reverse proxy; enforce and document.
- `trust proxy` + `proxy-addr` CVE is the main transport-layer risk (IP spoofing → rate-limit bypass).

---

## 7. File-upload / backup attack surface

- `multer` memory storage, 50 MB cap.
- Preview/import parse arbitrary workbooks from authenticated users.
- Missing `requireAdmin` makes the surface reachable by the lowest-privilege role.
- `multer` advisory set includes a file-size-limit bypass race and orphaned-write DoS — directly relevant.
- **Controls to add:** admin-only, MIME/magic-byte validation, sheet/row caps, zip-bomb guards, virus scan optional, pre-restore snapshot, audit entry.

---

## 8. Secrets & configuration

- `.env` is ignored by both root and `server/.gitignore` (verified).
- `server/.env.example` contains placeholders only; no live values.
- `JWT_SECRET` is required (min 16 chars) with **no hardcoded default** — good, but raise the minimum to 32 bytes and fail closed.
- `BCRYPT_ROUNDS` configurable (default 12) — good.
- Google Drive backup disabled during QA; no external side effects.

---

## 9. Tooling limitations

| Requested | Status | Substitute |
|---|---|---|
| OWASP ZAP | Not installed | Real-HTTP security suite (auth/RBAC/validation/headers/rate-limit), source review, `npm audit` |
| SAST (e.g. Semgrep) | Not installed | `tsc`, manual review |
| DAST fuzzing | Not installed | Targeted malformed-input tests (dates, amounts, party IDs, query params) |

The absence of ZAP means **no automated crawl-based XSS/CSRF scanning** was performed. No reflected/stored XSS was found by inspection (React escapes by default; no `dangerouslySetInnerHTML` in the audited pages), but a ZAP/DAST pass is recommended before release. CSRF is low-risk because auth uses a Bearer header rather than cookies, but confirm no cookie-based flows exist at the edge.

---

## 10. Security verdict & required actions

**Blockers (must fix before any exposure):**
1. Gate **all** backup routes with `requireAdmin` and remove `passwordHash` from exports (QA-001/002/017/025).
2. Remove the known restore hash; force reset/generated secret (QA-003).
3. Re-validate user status/role on every request or add `tokenVersion` (QA-004).
4. Remove the `admin123` default; require strong passwords (QA-005).
5. Patch critical/high dependencies and add an audit CI gate (QA-013).

**Strongly recommended:**
6. Server-side role guard on reports (QA-007) and client route guard (QA-010).
7. Strict input schemas for dates/amounts/party (QA-011/012) and a page-size cap (QA-015).
8. Audit and alert on backup export/restore; constrain uploads.
9. Raise `JWT_SECRET` length, add HSTS, resolve `trust proxy`/`proxy-addr` risk.
10. Run a ZAP/DAST pass and an authenticated crawl before release.

With items 1–5 resolved, the security posture moves from **critical** to **moderate**; items 6–10 are required for a production launch.
