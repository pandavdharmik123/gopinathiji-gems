# Gopinathji Gems — API Test Report

**Suite:** `server/qa/api.test.ts` (Vitest + real HTTP against a spawned Express server)
**Database:** isolated `gopinathji_gems_qa`, deterministic fixture (`server/qa/seed-qa.ts`)
**Server:** `127.0.0.1:3911`
**Final result:** **70 passed / 91 total (76.9%)** · **21 failed** · ~3.8 s
**Raw evidence:** `/tmp/qa-api-final.log`

> The suite drives the real Express app over HTTP. It does not mock the database, Prisma, or auth. Assertions express the *desired* secure/standard behaviour, so a failure is defect evidence, not necessarily a crash.

---

## 1. Result by category

| # | Category | Passed | Total | Pass % | Notes |
|---|---|---|---|---|---|
| 1 | Auth & session | 12 | 12 | 100% | Login, JWT validation, 2FA/OTP temp-token rejection |
| 2 | Transport security | 4 | 4 | 100% | Helmet, CORS allow/deny, JSON 404 |
| 3 | Financial accuracy | 9 | 10 | 90% | One failure: outstanding not year-scoped |
| 4 | Transaction validation | 7 | 14 | 50% | Date, amount, party, limit, query-date gaps |
| 5 | RBAC | 20 | 26 | 76.9% | Reports + backup exposure; HTTP 211 |
| 6 | User lifecycle | 5 | 6 | 83.3% | Default `admin123` account |
| 7 | Security PIN | 3 | 3 | 100% | Setup/verify/change/reset |
| 8 | Profile & password | 4 | 4 | 100% | Name, duplicate email, change/revert |
| 9 | Token lifecycle vs DB | 0 | 2 | 0% | Stale role + deactivated user still authorized |
| 10 | Voucher numbering | 0 | 3 | 0% | Collisions on delete/concurrency |
| 11 | Audit trail | 1 | 1 | 100% | Create/update/delete recorded |
| 12 | Notifications | 1 | 1 | 100% | Per-user isolation |
| 13 | Backup | 3 | 4 | 75% | BigInt serialisation 500 |
| 14 | Rate limiting | 1 | 1 | 100% | 429 after repeated failures |
| | **Total** | **70** | **91** | **76.9%** | **21 failures** |

---

## 2. Endpoint coverage matrix

Legend: ✅ tested & passing · ❌ tested & failing · ➖ exercised indirectly.

### Auth & session

| Method | Endpoint | Auth | Result | Assertion |
|---|---|---|---|---|
| POST | `/api/auth/login` | public | ✅ | Valid admin → 200 + JWT + safe user (no hash) |
| POST | `/api/auth/login` | public | ✅ | Wrong password → 401, identical to unknown user |
| POST | `/api/auth/login` | public | ✅ | Unknown username → 401 (no enumeration) |
| POST | `/api/auth/login` | public | ✅ | Inactive account → 401 |
| POST | `/api/auth/login` | public | ✅ | Missing password → 400 |
| POST | `/api/auth/login` | public | ✅ | Malformed JSON → 400 |
| GET | `/api/auth/me` | none | ✅ | No token → 401 |
| GET | `/api/auth/me` | malformed | ✅ | Malformed token → 401 |
| GET | `/api/auth/me` | wrong secret | ✅ | Wrong signature → 401 |
| GET | `/api/auth/me` | valid | ✅ | Returns current user |
| POST | `/api/auth/2fa/verify` | temp | ✅ | Invalid temp token → 401 |
| POST | `/api/auth/email-otp/send` | temp | ✅ | Invalid temp token → 401 |

### Transport security

| Method | Endpoint | Result | Assertion |
|---|---|---|---|
| GET | any | ✅ | Helmet security headers present |
| OPTIONS/GET | CORS | ✅ | Configured frontend origin allowed |
| GET | CORS | ✅ | Unknown origin not reflected |
| GET | `/api/does-not-exist` | ✅ | JSON 404 (not HTML) |

### Financial accuracy (seeded FY 2026-27)

Fixture: opening cash ₹100 000, opening bank ₹500 000, in-year income ₹39 000, expense ₹22 000, profit ₹17 000; prior-year income ₹99 999.

| Endpoint | Result | Expected vs actual |
|---|---|---|
| `GET /api/reports/summary` | ✅ | Cash balance 117 000 |
| `GET /api/reports/monthly?month=2026-04` | ✅ | Income 25 000, expense 17 000, profit 8 000 |
| `GET /api/reports/monthly?month=2026-05` | ✅ | Income 14 000, expense 5 000, profit 9 000 |
| `GET /api/reports/yearly?year=2026` | ✅ | Totals + 12 buckets exact |
| `GET /api/reports/by-category` | ✅ | Category expense totals match |
| `GET /api/reports/party/:id` | ✅ | Alpha credit 25 000, debit 7 000, net 18 000 |
| `GET /api/parties` | ✅ | All-time Alpha 18 000, Beta −8 000 |
| `GET /api/reports/outstanding` | ❌ | **Gamma 106 999, expected 7 000** (not FY-scoped) |
| `GET /api/transactions?dateFrom&dateTo` | ✅ | Boundary days inclusive |
| `GET /api/transactions` | ✅ | Decimal serialised as string; frontend normalises |

### Transaction validation

| Case | Result | Expected → actual |
|---|---|---|
| Negative amount | ✅ | 400 |
| Zero amount | ✅ | 400 |
| Missing amount | ✅ | 400 |
| Invalid type | ✅ | 400 |
| Invalid payment mode | ✅ | 400 |
| Missing date | ✅ | 400 |
| Non-date string `"garbage"` | ❌ | 400 → **500** |
| Impossible date `2026-04-31` | ❌ | 400 → **201** (stored 2026-05-01) |
| Non-existent `partyId` | ❌ | 400/404 → **500** |
| Amount overflow `9.99e13` | ❌ | 400 → **500** |
| 3-decimal amount `10.999` | ❌ | 400 → **201** (rounded to 11.00) |
| `limit=100000` | ❌ | 400/cap → **200** |
| Invalid `dateFrom=garbage` | ❌ | 400 → **500** |
| Unknown fields stripped | ✅ | Persisted payload clean |

### RBAC

| Actor | Action | Result | Expected |
|---|---|---|---|
| employee | list users | ✅ | 403 |
| manager | list users | ✅ | 403 |
| admin | list users | ✅ | 200, no hashes |
| employee | read audit logs | ✅ | 403 |
| manager | read audit logs | ✅ | 403 |
| employee | update settings | ✅ | 403 |
| manager | update settings | ✅ | 403 |
| admin | update settings | ✅ | 200 |
| employee | create category | ✅ | 403 |
| admin | create category | ❌ | 201 → **211** |
| employee | create party | ✅ | 403 |
| manager | create party / cannot delete / admin can | ✅ | 201/403/200 |
| employee | create transaction | ✅ | 201 (data entry allowed) |
| employee | edit transaction | ✅ | 403 |
| manager | edit transaction | ✅ | 200 |
| employee | delete transaction | ✅ | 403 |
| manager | delete transaction | ✅ | 403 |
| employee | create accounting year | ✅ | 403 |
| manager | create/delete empty year | ✅ | 201/200 |
| manager | create users | ✅ | 403 |
| employee | read `/api/reports/pl` | ❌ | 403 → **200** |
| employee | backup JSON | ❌ | 403 → **200** (hashes) |
| employee | Excel export | ❌ | 403 → **200** |
| employee | Excel preview | ❌ | 403 → **400** (reachable) |
| employee | Excel import | ❌ | 403 → **400** (reachable) |
| employee | Drive admin routes | ✅ | 403 |

### User lifecycle

| Case | Result | Notes |
|---|---|---|
| Weak password | ✅ | 400 |
| Duplicate username | ✅ | 409 |
| Omit password | ❌ | **201 with `admin123`** (expected 400) |
| Verify default `admin123` works | ✅ | Evidence test — login succeeds |
| Admin deletes self | ✅ | Blocked |
| 2FA enrol → challenge → verify → disable | ✅ | End-to-end |

### Security PIN

| Case | Result |
|---|---|
| Verify before setup | ✅ 400 |
| Non-numeric PIN | ✅ 400 |
| Setup → verify → change → reset | ✅ |

### Profile & password

| Case | Result |
|---|---|
| Update name; reject duplicate email | ✅ |
| Wrong current password | ✅ 400 |
| Change password and change back | ✅ |
| New password < 6 chars | ✅ 400 |

### Token lifecycle vs database

| Case | Result | Expected → actual |
|---|---|---|
| Role downgraded in DB, old token | ❌ | 403 → **200** |
| User deactivated in DB, old token | ❌ | 401/403 → **200** |

### Voucher numbering

| Case | Result | Expected → actual |
|---|---|---|
| Concurrent creates unique | ❌ | 6 × **409** |
| No reuse after delete | ❌ | 201 → **409** |
| Middle deletion no collision | ❌ | 201 → **409** |

### Audit, notifications, backup, rate limiting

| Case | Result | Notes |
|---|---|---|
| Audit create/update/delete with actor | ✅ | Real audit rows written |
| Notifications isolated per user | ✅ | |
| Admin Excel export | ✅ | 200 + xlsx |
| Admin preview rejects non-Excel | ✅ | 400 |
| Admin import rejects non-Excel | ✅ | 400 |
| Drive history BigInt | ❌ | 200 → **500** |
| Failed-login throttle | ✅ | 429 |

---

## 3. Failure evidence (verbatim highlights)

1. **Outstanding scoping** — `expected 106999 to be 7000` (`qa/api.test.ts:271`).
2. **Invalid date** — `expected 500 to be 400` (`:326`).
3. **Impossible date** — `expected 201 to be 400` (`:331`).
4. **Unknown party** — `expected [400,404,422] to include 500` (`:336`).
5. **Amount overflow** — `expected 500 to be 400` (`:341`).
6. **3 decimals** — `expected 201 to be 400` (`:346`).
7. **Unbounded limit** — `expected 200 to be 400` (`:351`).
8. **Invalid dateFrom** — `expected 500 to be 400` (`:356`).
9. **Category status** — `expected 211 to be 201` (`:426`).
10. **Employee reports** — `expected 200 to be 403` (`:496`).
11. **Employee JSON backup** — `expected 200 to be 403` (`:501`).
12. **Employee Excel export** — `expected 200 to be 403` (`:506`).
13. **Employee preview** — `expected 400 to be 403` (`:513`).
14. **Employee import** — `expected 400 to be 403` (`:520`).
15. **Default password** — `expected 201 to be 400` (`:549`).
16. **Downgraded token** — `expected 200 to be 403` (`:693`).
17. **Deactivated token** — `expected [401,403] to include 200` (`:708`).
18. **Concurrent vouchers** — 6 × `409:A record with this value already exists` (`:730`).
19. **Delete reuse** — `expected 409 to be 201` (`:744`).
20. **Middle deletion** — `expected 409 to be 201` (`:751`).
21. **Drive history** — `expected 500 to be 200` (`:838`).

---

## 4. What passed (confidence areas)

- **Authentication primitives:** bcrypt login, no user enumeration, signature/expiry checks, 2FA and email-OTP temp-token rejection.
- **Transport:** Helmet headers, CORS origin allow-list, JSON 404.
- **Financial arithmetic:** summary, monthly, yearly, by-category, party ledger and all-time balances reconcile exactly with the seed. Decimal serialisation is handled by the frontend normaliser.
- **Core RBAC primitives:** users, audit, settings, parties, year management and Drive routes enforce roles correctly.
- **Data-entry permission model:** employees can create but not edit/delete transactions (matches UI intent).
- **PIN and profile flows,** **audit writes,** **notification isolation,** and **login rate limiting**.

---

## 5. Test-harness notes and corrections

- Two initial financial expectations were corrected after verifying the seed: April income is **₹25 000** (not 15 000) and April profit **₹8 000**. The suite now reflects the true fixture math.
- The suite reseeds between runs; management APIs are used to clean up created rows.
- Assertions use the *desired* contract (e.g. `403` for employee backups). Where the app intentionally returns a different-but-safe code, that is noted; the only semantic mismatch filed as a defect is the `211`.
- Rate-limit and 2FA tests are timing-sensitive but passed consistently in the final run.

---

## 6. Reproduce

```bash
cd /Users/dbpandav/Projects/GopinathjiGemes/server
export DATABASE_URL='postgresql://dbpandav@localhost:5432/gopinathji_gems_qa'
npx prisma db push --skip-generate
npx tsx qa/seed-qa.ts
npx vitest run qa/api.test.ts --reporter=verbose
```

Full command sequence and environment are in `TEST_EXECUTION_SUMMARY.md`.
